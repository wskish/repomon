const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const GitMonitor = require('./gitMonitor');

const app = express();
app.use(cors());

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

// Get repository path from environment variable or use current directory
const repoPath = process.env.REPO_PATH || process.cwd();

// Initialize Git monitor
const gitMonitor = new GitMonitor(repoPath);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial repository state
  gitMonitor.getStatus().then(status => {
    socket.emit('repo-status', status);
  });
  
  // Handle request for repository path
  socket.on('get-repo-path', () => {
    socket.emit('repo-path', repoPath);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start monitoring repository
gitMonitor.startMonitoring((status) => {
  io.emit('repo-status', status);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Monitoring repository at: ${repoPath}`);
});
