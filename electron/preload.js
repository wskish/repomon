const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Repository operations
  openRepository: () => ipcRenderer.invoke('open-repository'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  
  // Recent repositories
  showRecentRepositories: (position) => ipcRenderer.invoke('show-recent-repositories', position),
  getRecentRepositories: () => ipcRenderer.invoke('get-recent-repositories'),
  
  // Event listeners
  onRepoStatus: (callback) => ipcRenderer.on('repo-status', (_, data) => callback(data)),
  onRepoPath: (callback) => ipcRenderer.on('repo-path', (_, path) => callback(path)),
  onRepoError: (callback) => ipcRenderer.on('repo-error', (_, error) => callback(error)),
  
  // App info
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron
  }
});