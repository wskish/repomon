import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [repoStatus, setRepoStatus] = useState(null);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState(null);
  const [repoPath, setRepoPath] = useState("");
  const [isElectron, setIsElectron] = useState(false);

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
      
      // Listen for repository path updates
      electron.onRepoPath((path) => {
        console.log('Monitoring repository at:', path);
        setRepoPath(path);
      });
      
      // Listen for repository errors
      if (electron.onRepoError) {
        electron.onRepoError((errorData) => {
          console.error('Repository error:', errorData);
          setError(errorData.error || 'Repository error');
        });
      }
      
      // Get initial status
      electron.getStatus()
        .then(status => {
          if (!status.error) {
            setRepoStatus(status);
          } else {
            console.error('Error getting status:', status.error);
            setError(status.error);
          }
        })
        .catch(err => {
          console.error('Error getting initial status:', err);
          setError('Failed to get repository status');
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
          
          // Request the repository path
          socket.emit('get-repo-path');
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
        
        socket.on('repo-status', (status) => {
          console.log('Received repository status:', status);
          setRepoStatus(status);
        });
        
        socket.on('repo-path', (path) => {
          console.log('Monitoring repository at:', path);
          setRepoPath(path);
        });
        
        return () => {
          socket.disconnect();
        };
      });
    }
  }, []);

  const handleOpenRepository = async () => {
    if (window.electronAPI) {
      try {
        await window.electronAPI.openRepository();
      } catch (err) {
        console.error('Error opening repository:', err);
      }
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Repomon</h1>
        <div className="app-controls">
          {isElectron && (
            <button className="repo-button" onClick={handleOpenRepository}>
              Open Repository
            </button>
          )}
          <div className="connection-status">
            Status: {connected ? 'Active' : 'Disconnected'}
          </div>
        </div>
      </header>
      {repoPath && (
        <div className="repo-path">
          Monitoring: <code>{repoPath}</code>
        </div>
      )}
      <main>
        {error && <div className="error-message">{error}</div>}
        {repoStatus ? (
          <Dashboard repoStatus={repoStatus} />
        ) : (
          <div className="loading">
            {isElectron 
              ? 'Select a Git repository to begin monitoring' 
              : 'Waiting for repository data...'}
          </div>
        )}
      </main>
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