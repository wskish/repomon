import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import RepoSidebar from './components/RepoSidebar';
import './App.css';

function App() {
  const [repositories, setRepositories] = useState([]);
  const [currentRepo, setCurrentRepo] = useState(null);
  const [repoStatus, setRepoStatus] = useState(null);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState(null);
  const [isElectron, setIsElectron] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  useEffect(() => {
    // Check if running in Electron
    const electron = window.electronAPI;
    setIsElectron(!!electron);
    
    if (electron) {
      console.log('Running in Electron mode');
      
      // Listen for repository status updates
      electron.onRepoStatus((status) => {
        console.log('Received repository status:', status);
        setRepoStatus(status);
        
        // Clear error if we got a successful status
        if (!status.error) {
          setError(null);
        }
      });
      
      // Listen for active repositories updates
      electron.onActiveRepositories((repos) => {
        console.log('Received active repositories:', repos);
        setRepositories(repos);
      });
      
      // Listen for current repository updates
      electron.onCurrentRepository((repoPath) => {
        console.log('Current repository set to:', repoPath);
        setCurrentRepo(repoPath);
      });
      
      // Listen for repository errors
      if (electron.onRepoError) {
        electron.onRepoError((errorData) => {
          console.error('Repository error:', errorData);
          setError(errorData.error || 'Repository error');
        });
      }
      
      // Get initial active repositories
      electron.getActiveRepositories()
        .then(repos => {
          setRepositories(repos);
        })
        .catch(err => {
          console.error('Error getting active repositories:', err);
        });
      
      // Get initial current repository
      electron.getCurrentRepository()
        .then(repoPath => {
          if (repoPath) {
            setCurrentRepo(repoPath);
            
            // Get initial status for current repository
            return electron.getStatus(repoPath);
          }
        })
        .then(status => {
          if (status && !status.error) {
            setRepoStatus(status);
          } else if (status?.error) {
            console.error('Error getting status:', status.error);
            setError(status.error);
          }
        })
        .catch(err => {
          console.error('Error initializing:', err);
        });
    } else {
      console.log('Running in web mode - using Socket.IO fallback');
      // Import Socket.IO dynamically to avoid Electron conflicts
      import('socket.io-client').then(({ io }) => {
        const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');
        
        socket.on('connect', () => {
          console.log('Connected to server');
          setConnected(true);
          setError(null);
        });
        
        socket.on('disconnect', () => {
          console.log('Disconnected from server');
          setConnected(false);
        });
        
        socket.on('connect_error', (err) => {
          console.error('Connection error:', err);
          setConnected(false);
          setError('Failed to connect to server');
        });
        
        // Handle repositories list updates
        socket.on('repos-list', (repos) => {
          console.log('Received repositories list:', repos);
          setRepositories(repos);
          
          // If no current repo is set but we have repos, set the first one as current
          if (!currentRepo && repos.length > 0) {
            setCurrentRepo(repos[0].path);
            socket.emit('get-repo-status', repos[0].path);
          }
        });
        
        // Handle repository status updates
        socket.on('repo-status', (data) => {
          console.log('Received repository status:', data);
          
          // If the status is for the current repository, update the state
          if (data.repoPath === currentRepo) {
            setRepoStatus(data.status);
          }
        });
        
        // Handle repository errors
        socket.on('repo-error', (error) => {
          console.error('Repository error:', error);
          setError(error.error);
        });
        
        return () => {
          socket.disconnect();
        };
      });
    }
  }, [currentRepo]);

  const handleAddRepo = async () => {
    if (isElectron) {
      try {
        const result = await window.electronAPI.addRepository();
        console.log('Repository added:', result);
      } catch (err) {
        console.error('Error adding repository:', err);
      }
    } else {
      // Web mode - show dialog or prompt for repository path
      const repoPath = prompt('Enter repository path:');
      if (repoPath) {
        const socket = window._socket;
        if (socket) {
          socket.emit('add-repository', repoPath);
        }
      }
    }
  };
  
  const handleSelectRepo = async (repoPath) => {
    if (repoPath === currentRepo) return;
    
    if (isElectron) {
      try {
        await window.electronAPI.setCurrentRepository(repoPath);
      } catch (err) {
        console.error('Error selecting repository:', err);
      }
    } else {
      // Web mode
      setCurrentRepo(repoPath);
      const socket = window._socket;
      if (socket) {
        socket.emit('get-repo-status', repoPath);
      }
    }
  };
  
  const handleRemoveRepo = async (repoPath) => {
    if (window.confirm(`Are you sure you want to remove "${
      repositories.find(r => r.path === repoPath)?.name || repoPath
    }" from the monitoring list?`)) {
      if (isElectron) {
        try {
          await window.electronAPI.removeRepository(repoPath);
        } catch (err) {
          console.error('Error removing repository:', err);
        }
      } else {
        // Web mode
        const socket = window._socket;
        if (socket) {
          socket.emit('remove-repository', repoPath);
        }
      }
    }
  };
  
  const handleToggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const handleOpenInEditor = async (repoPath) => {
    if (isElectron) {
      try {
        await window.electronAPI.openInEditor(repoPath);
      } catch (err) {
        console.error('Error opening repository in editor:', err);
      }
    }
  };

  const handleOpenFileInEditor = async (repoPath, filePath, lineNumber = 1) => {
    if (isElectron) {
      try {
        await window.electronAPI.openFileInEditor(repoPath, filePath, lineNumber);
      } catch (err) {
        console.error('Error opening file in editor:', err);
      }
    }
  };

  const currentRepoName = repositories.find(r => r.path === currentRepo)?.name || '';

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-left">
          <button 
            className="toggle-sidebar-btn"
            onClick={handleToggleSidebar}
            title={sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
          >
            ☰
          </button>
          <h1>Repomon</h1>
        </div>
        <div className="app-controls">
          <div className="connection-status">
            Status: {connected ? 'Active' : 'Disconnected'}
          </div>
        </div>
      </header>
      
      <div className="app-container">
        {sidebarVisible && (
          <RepoSidebar 
            repositories={repositories}
            currentRepo={currentRepo}
            onAddRepo={handleAddRepo}
            onSelectRepo={handleSelectRepo}
            onRemoveRepo={handleRemoveRepo}
            onOpenInEditor={handleOpenInEditor}
          />
        )}
        
        <div className="content-area">
          {currentRepo && (
            <div className="repo-header">
              <h2>{currentRepoName}</h2>
              {repoStatus?.branch && (
                <div className="branch-name">
                  Branch: {repoStatus.branch}
                </div>
              )}
            </div>
          )}
          
          <main>
            {error && <div className="error-message">{error}</div>}
            {repoStatus && !repoStatus.error ? (
              <Dashboard 
                repoStatus={repoStatus} 
                onOpenFileInEditor={(filePath, lineNumber) => handleOpenFileInEditor(currentRepo, filePath, lineNumber)} 
              />
            ) : (
              <div className="loading">
                {repositories.length === 0 
                  ? 'Add a Git repository to begin monitoring' 
                  : 'Select a repository to view changes'}
              </div>
            )}
          </main>
        </div>
      </div>
      
      {isElectron && (
        <footer className="app-footer">
          <div className="electron-info">
            Electron v{window.electronAPI?.versions?.electron} | Node v{window.electronAPI?.versions?.node}
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;