const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const GitMonitor = require('./gitMonitor');
const WindowStateManager = require('./windowStateManager');
const isDev = process.env.NODE_ENV === 'development';

// Global references
let mainWindow;
let tray = null;
let windowStateManager;
let recentRepositories = [];
let activeRepositories = [];
let gitMonitors = new Map(); // Map of repoPath -> GitMonitor
let currentRepository = null; // Currently selected repository

/**
 * Enhanced persistent storage (key-value)
 * Includes support for repositories management
 */
const store = {
  get: function(key, defaultValue = null) {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'repomon-config.json');
      
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return key in data ? data[key] : defaultValue;
      }
    } catch (err) {
      console.error('Error reading config:', err);
    }
    return defaultValue;
  },
  
  set: function(key, value) {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'repomon-config.json');
      let data = {};
      
      // Read existing data if file exists
      if (fs.existsSync(filePath)) {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      
      // Update value
      data[key] = value;
      
      // Make sure directory exists
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      
      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error writing config:', err);
    }
  },
  
  // Add repository to recent list
  addRecentRepository: function(repoPath) {
    try {
      if (!repoPath) return;
      
      // Get current recent repositories
      let recents = this.get('recentRepositories', []);
      
      // Remove if already exists (to move it to top)
      recents = recents.filter(repo => repo.path !== repoPath);
      
      // Add to beginning of array
      recents.unshift({
        path: repoPath,
        name: path.basename(repoPath),
        timestamp: new Date().toISOString()
      });
      
      // Limit to 20 most recent
      if (recents.length > 20) {
        recents = recents.slice(0, 20);
      }
      
      // Save back to config
      this.set('recentRepositories', recents);
      
      // Update global variable
      recentRepositories = recents;
      
      return recents;
    } catch (err) {
      console.error('Error adding recent repository:', err);
      return [];
    }
  },
  
  // Get recent repositories
  getRecentRepositories: function() {
    return this.get('recentRepositories', []);
  },
  
  // Get active repositories
  getActiveRepositories: function() {
    return this.get('activeRepositories', []);
  },
  
  // Save active repositories
  saveActiveRepositories: function(repos) {
    this.set('activeRepositories', repos);
    activeRepositories = repos;
    return repos;
  },
  
  // Add active repository
  addActiveRepository: function(repoPath) {
    try {
      if (!repoPath) return;
      
      // Get current active repositories
      let repos = this.getActiveRepositories();
      
      // Check if already exists
      if (repos.some(repo => repo.path === repoPath)) {
        console.log(`Repository ${repoPath} already active`);
        return repos;
      }
      
      // Add to array
      repos.push({
        path: repoPath,
        name: path.basename(repoPath),
        added: new Date().toISOString()
      });
      
      // Save back to config
      this.saveActiveRepositories(repos);
      
      // Also add to recent repos
      this.addRecentRepository(repoPath);
      
      return repos;
    } catch (err) {
      console.error('Error adding active repository:', err);
      return [];
    }
  },
  
  // Remove active repository
  removeActiveRepository: function(repoPath) {
    try {
      // Get current active repositories
      let repos = this.getActiveRepositories();
      
      // Remove repository
      repos = repos.filter(repo => repo.path !== repoPath);
      
      // Save back to config
      this.saveActiveRepositories(repos);
      
      return repos;
    } catch (err) {
      console.error('Error removing active repository:', err);
      return [];
    }
  },
  
  // Update repository stats
  updateRepositoryStats: function(repoPath, stats) {
    try {
      // Get current active repositories
      let repos = this.getActiveRepositories();
      
      // Find and update repository
      const index = repos.findIndex(repo => repo.path === repoPath);
      if (index >= 0) {
        repos[index] = {
          ...repos[index],
          ...stats,
          lastUpdated: new Date().toISOString()
        };
        
        // Save back to config
        this.saveActiveRepositories(repos);
      }
      
      return repos;
    } catch (err) {
      console.error('Error updating repository stats:', err);
      return [];
    }
  },
  
  // Set current repository
  setCurrentRepository: function(repoPath) {
    this.set('currentRepository', repoPath);
    currentRepository = repoPath;
  },
  
  // Get current repository
  getCurrentRepository: function() {
    return this.get('currentRepository', null);
  }
};

/**
 * Create the main application window
 */
function createWindow() {
  console.log('Creating main window...');
  
  // Initialize window state manager if not already
  if (!windowStateManager) {
    windowStateManager = new WindowStateManager({
      storeName: 'repomon-window-state',
      defaultWidth: 1200,
      defaultHeight: 800
    });
  }
  
  // Get saved window state
  const windowState = windowStateManager.getState();
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../assets/icons/icon.png'),
    title: 'Repomon',
    show: false  // Don't show until ready
  });
  
  // Restore maximized state if needed
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }
  
  // Track window state changes
  windowStateManager.track(mainWindow);
  
  // Show window when ready to avoid flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Load the React app
  let startUrl;
  
  if (isDev) {
    // Development mode - always use the React dev server
    startUrl = 'http://localhost:3000';
  } else {
    // Production mode - check if build exists, otherwise fall back to dev server
    const buildPath = path.join(__dirname, '../build/index.html');
    if (fs.existsSync(buildPath)) {
      startUrl = `file://${buildPath}`;
    } else {
      console.warn('Production build not found, falling back to development server');
      startUrl = 'http://localhost:3000';
    }
  }
  
  console.log(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);
  
  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  // Initialize repositories from saved config
  try {
    // Load recent repositories list
    recentRepositories = store.getRecentRepositories();
    console.log(`Loaded ${recentRepositories.length} recent repositories`);
    
    // Initialize repositories
    setTimeout(() => {
      initializeRepositories().then(() => {
        // If no active repositories, prompt to add one
        if (activeRepositories.length === 0) {
          console.log('No active repositories found, showing repository picker');
          setTimeout(() => {
            openRepositoryDialog();
          }, 500);
        }
      });
    }, 1000);
  } catch (err) {
    console.error('Error loading repository data:', err);
  }
  
  // Handle window close event
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

/**
 * Initialize repositories monitoring
 */
async function initializeRepositories() {
  console.log('Initializing repositories...');
  
  try {
    // Load active repositories
    activeRepositories = store.getActiveRepositories();
    
    // Load current repository
    currentRepository = store.getCurrentRepository();
    
    // If no active repos, try to use last repository from old config
    if (activeRepositories.length === 0) {
      const lastRepo = store.get('lastRepository');
      if (lastRepo && lastRepo.path) {
        console.log(`Migrating last repository ${lastRepo.path} to active repositories`);
        activeRepositories = store.addActiveRepository(lastRepo.path);
        currentRepository = lastRepo.path;
        store.setCurrentRepository(lastRepo.path);
      }
    }
    
    // If still no active repos, we'll prompt user later
    if (activeRepositories.length === 0) {
      console.log('No active repositories found');
      return;
    }
    
    // Start monitoring all active repositories
    for (const repo of activeRepositories) {
      await startMonitoringRepository(repo.path);
    }
    
    // If no current repository is set but we have active ones, use the first
    if (!currentRepository && activeRepositories.length > 0) {
      currentRepository = activeRepositories[0].path;
      store.setCurrentRepository(currentRepository);
    }
    
    // Send the list of active repositories to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('active-repositories', activeRepositories);
      
      // If we have a current repository, send its status
      if (currentRepository) {
        mainWindow.webContents.send('current-repository', currentRepository);
        
        // Update window title
        mainWindow.setTitle(`Repomon - ${path.basename(currentRepository)}`);
        
        // Request initial status for current repo
        const monitor = gitMonitors.get(currentRepository);
        if (monitor) {
          const status = await monitor.getStatus();
          mainWindow.webContents.send('repo-status', status);
        }
      }
    }
  } catch (err) {
    console.error('Error initializing repositories:', err);
  }
}

/**
 * Start monitoring a repository
 */
async function startMonitoringRepository(repoPath) {
  if (!repoPath) {
    console.error('No repository path provided');
    return;
  }
  
  // Skip if already monitoring
  if (gitMonitors.has(repoPath)) {
    console.log(`Already monitoring ${repoPath}`);
    return;
  }
  
  console.log(`Starting to monitor repository at: ${repoPath}`);
  
  try {
    // Create new monitor
    const gitMonitor = new GitMonitor(repoPath);
    
    // Wait a bit for the git repo check to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Start monitoring
    await gitMonitor.startMonitoring((status) => {
      // Update repository stats
      const additions = status.files?.reduce((sum, file) => {
        // Extract additions/deletions stats to update repo summary
        const lines = file.diff.split('\n');
        const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).length;
        const deletedLines = lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length;
        return sum + addedLines;
      }, 0) || 0;
      
      const deletions = status.files?.reduce((sum, file) => {
        const lines = file.diff.split('\n');
        const deletedLines = lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length;
        return sum + deletedLines;
      }, 0) || 0;
      
      // Update repository stats
      store.updateRepositoryStats(repoPath, {
        branch: status.branch,
        changedFiles: status.files?.length || 0,
        additions,
        deletions
      });
      
      // Send updated repositories list
      const updatedRepos = store.getActiveRepositories();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('active-repositories', updatedRepos);
        
        // If this is the current repository, send its status
        if (currentRepository === repoPath) {
          mainWindow.webContents.send('repo-status', status);
        }
      }
    });
    
    // Store the monitor
    gitMonitors.set(repoPath, gitMonitor);
    
    // Make sure it's in the active repositories list
    store.addActiveRepository(repoPath);
    
    // Add to recent repositories
    store.addRecentRepository(repoPath);
    
    return gitMonitor;
  } catch (err) {
    console.error(`Error monitoring repository ${repoPath}:`, err);
    
    // Notify renderer of the error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('repo-error', {
        repoPath,
        error: `Failed to monitor repository: ${err.message}`
      });
    }
    
    throw err;
  }
}

/**
 * Stop monitoring a repository
 */
function stopMonitoringRepository(repoPath) {
  if (gitMonitors.has(repoPath)) {
    console.log(`Stopping monitoring for ${repoPath}`);
    const monitor = gitMonitors.get(repoPath);
    monitor.stopMonitoring();
    gitMonitors.delete(repoPath);
    return true;
  }
  return false;
}

/**
 * Set the current repository
 */
async function setCurrentRepository(repoPath) {
  // Make sure repository is monitored
  if (!gitMonitors.has(repoPath)) {
    await startMonitoringRepository(repoPath);
  }
  
  // Set as current
  currentRepository = repoPath;
  store.setCurrentRepository(repoPath);
  
  // Get status
  const monitor = gitMonitors.get(repoPath);
  const status = await monitor.getStatus();
  
  // Update UI
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('current-repository', repoPath);
    mainWindow.webContents.send('repo-status', status);
    mainWindow.setTitle(`Repomon - ${path.basename(repoPath)}`);
  }
}

/**
 * Open repository dialog
 */
async function openRepositoryDialog() {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.warn('Cannot open repository dialog - window is not available');
      return null;
    }
    
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Git Repository'
    });
    
    if (!canceled && filePaths.length > 0) {
      const repoPath = filePaths[0];
      
      try {
        // Start monitoring the new repository
        await startMonitoringRepository(repoPath);
        
        // Set as the current repository
        await setCurrentRepository(repoPath);
        
        return repoPath;
      } catch (err) {
        console.error(`Error adding repository ${repoPath}:`, err);
        
        dialog.showErrorBox(
          'Repository Error',
          `Failed to add repository: ${err.message}`
        );
      }
    }
  } catch (error) {
    console.error('Error showing directory picker:', error);
  }
  return null;
}

/**
 * Show recent repositories menu
 */
function showRecentRepositoriesMenu(x, y) {
  // Load recent repositories from store
  if (recentRepositories.length === 0) {
    recentRepositories = store.getRecentRepositories();
  }
  
  // Create menu items for each repository
  const menuItems = recentRepositories.map(repo => {
    return {
      label: repo.name,
      sublabel: repo.path,
      click: () => {
        initRepository(repo.path);
      }
    };
  });
  
  // Add option to browse for repository
  menuItems.push(
    { type: 'separator' },
    { 
      label: 'Browse for Repository...',
      click: () => openRepositoryDialog()
    }
  );
  
  // If we have items, create and show the menu
  if (menuItems.length > 0) {
    const menu = Menu.buildFromTemplate(menuItems);
    
    if (x && y) {
      // Show at specified position (context menu)
      menu.popup({ x, y });
    } else {
      // Show at mouse position
      menu.popup({ window: mainWindow });
    }
    
    return true;
  }
  
  return false;
}

/**
 * Create system tray icon
 */
function createTray() {
  try {
    console.log('Creating tray icon...');
    
    // Try to load tray icon
    let trayIcon;
    const trayIconPath = path.join(__dirname, '../assets/icons/tray-icon.png');
    
    try {
      if (fs.existsSync(trayIconPath)) {
        console.log(`Loading tray icon from: ${trayIconPath}`);
        trayIcon = nativeImage.createFromPath(trayIconPath);
      }
    } catch (err) {
      console.error('Error loading tray icon:', err);
    }
    
    // Create empty icon as fallback
    if (!trayIcon || trayIcon.isEmpty()) {
      console.log('Using empty tray icon');
      trayIcon = nativeImage.createEmpty();
    }
    
    // Create tray
    tray = new Tray(trayIcon);
    
    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Repomon', click: () => mainWindow.show() },
      { label: 'Open Repository...', click: openRepositoryDialog },
      { label: 'Recent Repositories', click: () => showRecentRepositoriesMenu() },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); }}
    ]);
    
    tray.setToolTip('Repomon - Git Repository Monitor');
    tray.setContextMenu(contextMenu);
    
    // Handle tray click
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
    
    console.log('Tray icon created successfully');
  } catch (err) {
    console.error('Failed to create tray icon:', err);
  }
}

/**
 * Create application menu
 */
function createMenu() {
  try {
    console.log('Creating application menu...');
    
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Open Repository...',
            accelerator: 'CmdOrCtrl+O',
            click: openRepositoryDialog
          },
          {
            label: 'Recent Repositories',
            accelerator: 'CmdOrCtrl+R',
            click: () => showRecentRepositoriesMenu()
          },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        role: 'help',
        submenu: [
          {
            label: 'Learn More',
            click: async () => {
              const { shell } = require('electron');
              await shell.openExternal('https://github.com/yourusername/repomon');
            }
          }
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    
    console.log('Application menu created successfully');
  } catch (err) {
    console.error('Failed to create application menu:', err);
  }
}

// IPC Handlers
ipcMain.handle('open-repository', openRepositoryDialog);

// Open recent repositories menu
ipcMain.handle('show-recent-repositories', (event, position) => {
  // Position is optional, can be used to position the menu
  if (position && position.x && position.y) {
    return showRecentRepositoriesMenu(position.x, position.y);
  } else {
    return showRecentRepositoriesMenu();
  }
});

// Get recent repositories list
ipcMain.handle('get-recent-repositories', () => {
  return store.getRecentRepositories();
});

// Get active repositories list
ipcMain.handle('get-active-repositories', () => {
  return store.getActiveRepositories();
});

// Add repository
ipcMain.handle('add-repository', async (event, repoPath) => {
  try {
    // If a dialog is requested
    if (!repoPath) {
      return await openRepositoryDialog();
    }
    
    // Otherwise use the provided path
    await startMonitoringRepository(repoPath);
    await setCurrentRepository(repoPath);
    return { success: true, path: repoPath };
  } catch (err) {
    console.error('Error adding repository:', err);
    return { error: err.message };
  }
});

// Remove repository
ipcMain.handle('remove-repository', (event, repoPath) => {
  try {
    // Stop monitoring
    stopMonitoringRepository(repoPath);
    
    // Remove from active repositories
    store.removeActiveRepository(repoPath);
    
    // If this was the current repository, select another one
    if (currentRepository === repoPath) {
      const repos = store.getActiveRepositories();
      if (repos.length > 0) {
        setCurrentRepository(repos[0].path);
      } else {
        currentRepository = null;
        
        // Notify renderer that there's no current repository
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('current-repository', null);
          mainWindow.webContents.send('repo-status', { error: 'No repository selected' });
          mainWindow.setTitle('Repomon');
        }
      }
    }
    
    // Send updated repositories list
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('active-repositories', store.getActiveRepositories());
    }
    
    return { success: true };
  } catch (err) {
    console.error('Error removing repository:', err);
    return { error: err.message };
  }
});

// Set current repository
ipcMain.handle('set-current-repository', async (event, repoPath) => {
  try {
    await setCurrentRepository(repoPath);
    return { success: true };
  } catch (err) {
    console.error('Error setting current repository:', err);
    return { error: err.message };
  }
});

// Get current repository
ipcMain.handle('get-current-repository', () => {
  return currentRepository;
});

// Get repository status on demand
ipcMain.handle('get-status', async (event, repoPath) => {
  const targetRepo = repoPath || currentRepository;
  
  if (!targetRepo) {
    return { error: 'No repository selected' };
  }
  
  const monitor = gitMonitors.get(targetRepo);
  if (monitor) {
    return await monitor.getStatus();
  }
  
  return { error: 'Repository not monitored' };
});

// Initialize application
app.whenReady().then(() => {
  console.log("Electron app is ready!");
  
  try {
    // Create window and UI components
    createWindow();
    createTray();
    createMenu();
    
    console.log("Application initialization complete");
  } catch (error) {
    console.error("Error during application initialization:", error);
  }
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle activate event (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

// Handle before-quit event
app.on('before-quit', () => {
  app.isQuitting = true;
});