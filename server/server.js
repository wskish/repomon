const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const GitMonitor = require('./gitMonitor');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store for active repository monitors
const repoMonitors = new Map();
let activeRepos = [];

// Path to store repository list
const configDir = path.join(process.env.HOME || process.env.USERPROFILE, '.repomon');
const reposConfigPath = path.join(configDir, 'repositories.json');

// Create config directory if it doesn't exist
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Load saved repositories list
const loadRepositories = () => {
  try {
    if (fs.existsSync(reposConfigPath)) {
      const data = fs.readFileSync(reposConfigPath, 'utf8');
      activeRepos = JSON.parse(data);
      console.log(`Loaded ${activeRepos.length} repositories from config`);
      return activeRepos;
    }
  } catch (err) {
    console.error('Error loading repositories config:', err);
  }
  
  // Default to current directory if no saved repos
  const defaultRepo = process.env.REPO_PATH || process.cwd();
  activeRepos = [{ path: defaultRepo, name: path.basename(defaultRepo) }];
  return activeRepos;
};

// Save repositories list
const saveRepositories = () => {
  try {
    fs.writeFileSync(reposConfigPath, JSON.stringify(activeRepos, null, 2));
    console.log(`Saved ${activeRepos.length} repositories to config`);
  } catch (err) {
    console.error('Error saving repositories config:', err);
  }
};

// Start monitoring a repository
const startMonitoringRepo = async (repoInfo) => {
  const { path: repoPath } = repoInfo;
  
  // Skip if already monitoring
  if (repoMonitors.has(repoPath)) {
    console.log(`Already monitoring ${repoPath}`);
    return;
  }
  
  try {
    console.log(`Starting monitoring for ${repoPath}`);
    const gitMonitor = new GitMonitor(repoPath);
    
    // Wait for Git repository check to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await gitMonitor.startMonitoring((status) => {
      // Update summary stats for this repo
      const additions = status.files?.reduce((sum, file) => {
        const parsed = gitMonitor.parseDiffStats(file.diff);
        return sum + (parsed?.additions || 0);
      }, 0) || 0;
      
      const deletions = status.files?.reduce((sum, file) => {
        const parsed = gitMonitor.parseDiffStats(file.diff);
        return sum + (parsed?.deletions || 0);
      }, 0) || 0;
      
      // Update repo info with latest stats
      const repoIndex = activeRepos.findIndex(r => r.path === repoPath);
      if (repoIndex >= 0) {
        activeRepos[repoIndex] = {
          ...activeRepos[repoIndex],
          branch: status.branch,
          changedFiles: status.files?.length || 0,
          additions,
          deletions,
          lastUpdated: new Date().toISOString()
        };
        
        // Save updated repo list
        saveRepositories();
      }
      
      // Broadcast updates
      console.log(`Broadcasting update for ${repoPath} with ${status.files?.length || 0} changed files`);
      io.emit('repo-status', { repoPath, status });
      io.emit('repos-list', activeRepos);
    });
    
    // Store the monitor
    repoMonitors.set(repoPath, gitMonitor);
    
    // Get initial status
    const initialStatus = await gitMonitor.getStatus();
    return initialStatus;
  } catch (error) {
    console.error(`Error monitoring repository ${repoPath}:`, error);
    throw error;
  }
};

// Stop monitoring a repository
const stopMonitoringRepo = (repoPath) => {
  if (repoMonitors.has(repoPath)) {
    const monitor = repoMonitors.get(repoPath);
    monitor.stopMonitoring();
    repoMonitors.delete(repoPath);
    console.log(`Stopped monitoring ${repoPath}`);
    return true;
  }
  return false;
};

// Initialize repositories from saved config
const initRepositories = async () => {
  loadRepositories();
  
  // Start monitoring all repositories
  for (const repo of activeRepos) {
    try {
      await startMonitoringRepo(repo);
    } catch (err) {
      console.error(`Failed to initialize repository ${repo.path}:`, err);
    }
  }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial repositories list
  socket.emit('repos-list', activeRepos);
  
  // Handle request for repository status
  socket.on('get-repo-status', async (repoPath) => {
    try {
      if (repoMonitors.has(repoPath)) {
        const monitor = repoMonitors.get(repoPath);
        const status = await monitor.getStatus();
        socket.emit('repo-status', { repoPath, status });
      } else {
        socket.emit('repo-status', { 
          repoPath, 
          status: { error: 'Repository not monitored' } 
        });
      }
    } catch (err) {
      console.error(`Error getting status for ${repoPath}:`, err);
      socket.emit('repo-status', { 
        repoPath, 
        status: { error: err.message } 
      });
    }
  });
  
  // Handle add repository request
  socket.on('add-repository', async (repoPath) => {
    try {
      // Verify path exists and is a git repository
      if (!fs.existsSync(repoPath)) {
        socket.emit('repo-error', { error: 'Repository path does not exist' });
        return;
      }
      
      // Check if already in list
      if (activeRepos.some(repo => repo.path === repoPath)) {
        socket.emit('repo-error', { error: 'Repository already monitored' });
        return;
      }
      
      // Add to active repos
      const repoInfo = { 
        path: repoPath, 
        name: path.basename(repoPath),
        added: new Date().toISOString()
      };
      activeRepos.push(repoInfo);
      saveRepositories();
      
      // Start monitoring
      await startMonitoringRepo(repoInfo);
      
      // Send updated list
      io.emit('repos-list', activeRepos);
      socket.emit('repo-added', { success: true, path: repoPath });
    } catch (err) {
      console.error('Error adding repository:', err);
      socket.emit('repo-error', { error: err.message });
    }
  });
  
  // Handle remove repository request
  socket.on('remove-repository', (repoPath) => {
    try {
      // Stop monitoring if active
      stopMonitoringRepo(repoPath);
      
      // Remove from active repos
      activeRepos = activeRepos.filter(repo => repo.path !== repoPath);
      saveRepositories();
      
      // Send updated list
      io.emit('repos-list', activeRepos);
      socket.emit('repo-removed', { success: true, path: repoPath });
    } catch (err) {
      console.error('Error removing repository:', err);
      socket.emit('repo-error', { error: err.message });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize repositories from config
initRepositories();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Monitoring ${activeRepos.length} repositories`);
});
