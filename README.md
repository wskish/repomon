# Repomon: Real-time Repository Change Visualization

Repomon is a tool that provides real-time visualization of changes in your Git repository with a side-by-side diff view. It's perfect for monitoring active development and seeing changes as they happen.

## Key Features

- **Real-time monitoring** of your Git repository
- **Side-by-side diff view** in responsive cards
- **Dynamic layout** that adjusts to window size
- **Auto-scaling font size** based on number of changed files
- **File type color coding** for better visual organization
- **Expandable/collapsible cards** to focus on specific changes
- **Available as desktop app or web app**

## Installation

### Web App

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/repomon.git
   cd repomon
   ```

2. Install dependencies:
   ```bash
   npm run install-all
   ```

3. Start the web application:
   ```bash
   npm run dev
   ```

4. Access the web interface at `http://localhost:3000`

### Desktop App (Electron)

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/repomon.git
   cd repomon
   ```

2. Install dependencies:
   ```bash
   npm run install-all
   ```

3. Start the Electron application in development mode:
   ```bash
   npm run electron:dev
   ```

4. Build the desktop application:
   ```bash
   # For your current platform
   npm run dist
   
   # For all platforms (requires appropriate build environments)
   npm run dist -- -mwl
   ```

5. Packaged applications will be available in the `dist` directory

## Usage

### Web App

1. Start Repomon with the repository you want to monitor:
   ```bash
   ./start.sh /path/to/your/repo
   ```
   If no path is provided, it will monitor the current directory.

2. Access the web interface at `http://localhost:3000`

### Desktop App

1. Launch the Repomon application
2. Use the "Open Repository" button or File > Open Repository menu to select a Git repository
3. Changes to files will appear in real-time in the interface

## Architecture Overview

The application is built with two deployment options:

### Web Application
- **Backend (Node.js)**
  - Monitors the repository for changes using `chokidar`
  - Executes Git commands to get file status and diffs
  - Broadcasts changes via WebSockets (Socket.IO)

- **Frontend (React)**
  - Displays diffs in a responsive card layout
  - Adjusts font size dynamically based on window size and file count
  - Provides a clean, code-focused interface for easy reading

### Desktop Application (Electron)
- **Main Process**
  - Monitors repository for changes using same core logic as web app
  - Provides native OS functionality (file dialogs, menus, notifications)
  - Persistent configuration via electron-store

- **Renderer Process**
  - Same React frontend as the web app
  - Communicates with main process via IPC
  - Native desktop look and feel

## Implementation Details

### Change Detection

The application uses the `chokidar` library to watch for file system changes. When changes are detected, it:

1. Debounces rapidly occurring changes
2. Executes `git diff` commands to get the current status
3. Broadcasts changes to all connected clients (web) or sends via IPC (desktop)

### Diff Visualization

The frontend parses the raw Git diff output and renders it as a side-by-side comparison:

- Removed lines appear on the left with a red background
- Added lines appear on the right with a green background
- Unchanged lines appear on both sides

### Responsive Design

The application uses:

- Flexbox layout for card arrangement
- Dynamic font size calculation based on available space
- CSS media queries for different screen sizes
- ResizeObserver to detect window size changes

## Desktop App Features

The Electron version includes additional features:

- **System Tray Integration** - Minimize to tray for background monitoring
- **Native Notifications** - Get notified when files change
- **File Dialogs** - Select repositories using native OS dialogs
- **Keyboard Shortcuts** - Quick access to common functions
- **Window State Persistence** - Remembers size and position between sessions
- **Recent Repositories** - Quickly switch between monitored repositories

## License

MIT