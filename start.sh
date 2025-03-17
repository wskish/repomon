#!/bin/bash

# Script to start Repomon with a specified repository path

# Default to current directory if no path provided
REPO_PATH=${1:-$(pwd)}

# Check if directory exists
if [ ! -d "$REPO_PATH" ]; then
  echo "Error: Directory $REPO_PATH does not exist"
  exit 1
fi

# Check if it's a git repository
if [ ! -d "$REPO_PATH/.git" ]; then
  echo "Warning: $REPO_PATH does not appear to be a Git repository"
  read -p "Do you want to continue anyway? (y/n) " CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    exit 1
  fi
fi

# Export repository path for Node.js server
export REPO_PATH="$REPO_PATH"

# Start application
echo "Starting Repomon for repository at $REPO_PATH"
npm run dev