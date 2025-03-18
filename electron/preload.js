const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Repository operations
  openRepository: () => ipcRenderer.invoke('open-repository'),
  getStatus: (repoPath) => ipcRenderer.invoke('get-status', repoPath),
  
  // Multiple repositories management
  getActiveRepositories: () => ipcRenderer.invoke('get-active-repositories'),
  getCurrentRepository: () => ipcRenderer.invoke('get-current-repository'),
  addRepository: (repoPath) => ipcRenderer.invoke('add-repository', repoPath),
  removeRepository: (repoPath) => ipcRenderer.invoke('remove-repository', repoPath),
  setCurrentRepository: (repoPath) => ipcRenderer.invoke('set-current-repository', repoPath),
  
  // Recent repositories
  showRecentRepositories: (position) => ipcRenderer.invoke('show-recent-repositories', position),
  getRecentRepositories: () => ipcRenderer.invoke('get-recent-repositories'),
  
  // Event listeners
  onRepoStatus: (callback) => ipcRenderer.on('repo-status', (_, data) => callback(data)),
  onActiveRepositories: (callback) => ipcRenderer.on('active-repositories', (_, repos) => callback(repos)),
  onCurrentRepository: (callback) => ipcRenderer.on('current-repository', (_, repoPath) => callback(repoPath)),
  onRepoError: (callback) => ipcRenderer.on('repo-error', (_, error) => callback(error)),
  
  // App info
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron
  }
});