#!/bin/bash

# RepoMon - Consolidated startup script
# This script can launch both the regular app mode and Electron app mode

# Default variables
MODE="regular"  # Options: "regular", "electron", "electron-debug"
REPO_PATH=${1:-$(pwd)}  # Default to current directory if no repo path provided

# Help message
function show_help {
  echo "Usage: ./start.sh [OPTIONS] [REPO_PATH]"
  echo ""
  echo "Options:"
  echo "  -m, --mode MODE    Specify launch mode: regular, electron, electron-debug"
  echo "  -h, --help         Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./start.sh                          # Launch regular mode with current directory"
  echo "  ./start.sh /path/to/repo            # Launch regular mode with specified repo"
  echo "  ./start.sh -m electron              # Launch electron mode with current directory"
  echo "  ./start.sh -m electron-debug        # Launch electron debug mode with current directory"
  echo "  ./start.sh -m electron /path/to/repo # Launch electron mode with specified repo"
  exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--mode)
      MODE="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      ;;
    *)
      REPO_PATH="$1"
      shift
      ;;
  esac
done

# Validate repository path
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

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required but not found. Please install Node.js."
  exit 1
fi

# Create necessary directories for Electron modes
if [[ "$MODE" == "electron"* ]]; then
  # Create necessary directories
  mkdir -p assets/icons

  # Create a minimal test icon if it doesn't exist
  if [ ! -s assets/icons/tray-icon.png ]; then
    echo "Creating placeholder tray icon..."
    echo -e '\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\0\x10\0\0\0\x10\x08\x06\0\0\0\x1f\xf3\xffa\0\0\0\tpHYs\0\0\x0b\x13\0\0\x0b\x13\x01\0\x9a\x9c\x18\0\0\0\x07tIME\x07\xe2\x02\x05\x0c&7l\xae\xed\xda\0\0\0\x1diTXtComment\0\0\0\0\0Created with GIMPd.e\x07\0\0\0WIDAT8\xcb\xed\xd2\xcbN\xc2@\x14\x86\xe1\xaf\x9d\x0e7\xa5\x17\xaa\xa0\x06\x13\xc5\xf5<\xfez\xe2\x86M\t\xa5\xb6\x9dp\xa6\xc7\x05\x97\"M\xbb\x90\x05&\xff:\xf9\xf2\xfd\x93\x1f\xfc5\xf5\x05\xb4\x80!\xb0\x01^\x80Y\x13L\x0e\xc0\xc3\x0f\xb3\xa7:p\r<\x03\xabL\x85\xab\x84sIs\xc0\x1d\xf0X5\xf4\xb1\x1c\\\x06\xb4\x81\x87\xd3\xe1#\xb0|\xa7\x9a\x11\xe98\x02q\xe0\xec\xdf,\x01\xee\x81\xd9\xa9p\x19\xba\x8a\x03\x7f\xb6\x01\x98\xe7\xc3\xcbd\xfd\xdd\x9d\xc6\x81W\x01\x9c\r\x9ey\xfd]\x00\xb3\xe3?n>\x01\xc4Bg\xcb\xcf\xd5\xe3\xb8\0\0\0\0IEND\xaeB\x60\x82' > assets/icons/tray-icon.png
  fi

  if [ ! -s assets/icons/icon.png ]; then
    echo "Creating placeholder app icon..."
    cp assets/icons/tray-icon.png assets/icons/icon.png
  fi

  # Make sure electron/main.js exists
  if [ ! -f electron/main.js ]; then
    echo "Error: electron/main.js does not exist."
    exit 1
  fi
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -d "client/node_modules" ]; then
  echo "Installing client dependencies..."
  cd client && npm install && cd ..
fi

# Launch application based on mode
echo "Starting RepoMon for repository at $REPO_PATH"

case "$MODE" in
  "regular")
    echo "Running in regular mode..."
    npm run dev
    ;;
  "electron")
    echo "Running in Electron mode..."
    export BROWSER=none
    npx concurrently \
      "cd client && npm start" \
      "npx wait-on http://localhost:3333 && NODE_ENV=development electron ."
    ;;
  "electron-debug")
    echo "Running in Electron debug mode..."
    export BROWSER=none
    DEBUG=electron,electron:* NODE_ENV=development npx concurrently \
      "cd client && npm start" \
      "npx wait-on http://localhost:3333 && npx electron --trace-warnings ."
    ;;
  *)
    echo "Error: Unknown mode '$MODE'"
    show_help
    ;;
esac