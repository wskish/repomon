// Electron entry point for production build
const path = require('path');
const { app } = require('electron');

// Set production environment
process.env.NODE_ENV = 'production';

// Load the main process
require(path.join(__dirname, '../../electron/main.js'));