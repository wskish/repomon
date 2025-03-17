import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [repoStatus, setRepoStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Connect to WebSocket server
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
    
    socket.on('repo-status', (status) => {
      console.log('Received repository status:', status);
      setRepoStatus(status);
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Repomon</h1>
        <div className="connection-status">
          Status: {connected ? 'Connected' : 'Disconnected'}
        </div>
      </header>
      <main>
        {error && <div className="error-message">{error}</div>}
        {repoStatus ? (
          <Dashboard repoStatus={repoStatus} />
        ) : (
          <div className="loading">Waiting for repository data...</div>
        )}
      </main>
    </div>
  );
}

export default App;
