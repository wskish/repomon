/* Development entry point for Electron */
process.env.NODE_ENV = 'development';

const { spawn } = require('child_process');
const { app, BrowserWindow } = require('electron');
const path = require('path');
const waitOn = require('wait-on');

// Start React development server
const startReactApp = () => {
  console.log('Starting React development server...');
  const reactProcess = spawn('npm', ['start'], {
    cwd: path.join(__dirname, 'client'),
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      BROWSER: 'none',
    },
  });

  reactProcess.on('error', (error) => {
    console.error('Failed to start React app:', error);
  });

  return reactProcess;
};

// Main function to start the application
const start = async () => {
  const reactProcess = startReactApp();

  try {
    // Wait for React dev server to start
    await waitOn({
      resources: ['http-get://localhost:3333'],
      timeout: 60000,
    });

    console.log('React development server is ready!');
    console.log('Starting Electron app...');
    
    // Start Electron app
    require('./electron/main.js');
  } catch (err) {
    console.error('Error starting application:', err);
    if (reactProcess) {
      reactProcess.kill();
    }
    process.exit(1);
  }
};

start();