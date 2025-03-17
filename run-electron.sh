#!/bin/bash

# Script to run Repomon Electron app in development mode

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required but not installed."
    exit 1
fi

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    cd client && npm install && cd ..
fi

# Start Electron in development mode
echo "Starting Repomon Electron app in development mode..."
npm run electron:dev