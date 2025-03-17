# Repomon: Real-time Repository Change Visualization


## Key Features

- **Real-time monitoring** of your Git repository
- **Side-by-side diff view** in responsive cards
- **Dynamic layout** that adjusts to window size
- **Auto-scaling font size** based on number of changed files
- **File type color coding** for better visual organization
- **Expandable/collapsible cards** to focus on specific changes

## Architecture Overview

The application consists of two main parts:

1. **Backend (Node.js)**
   - Monitors the repository for changes using `chokidar`
   - Executes Git commands to get file status and diffs
   - Broadcasts changes via WebSockets (Socket.IO)

2. **Frontend (React)**
   - Displays diffs in a responsive card layout
   - Adjusts font size dynamically based on window size and file count
   - Provides a clean, code-focused interface for easy reading

## Implementation Details

### Change Detection

The backend uses the `chokidar` library to watch for file system changes. When changes are detected, it:

1. Debounces rapidly occurring changes
2. Executes `git diff` commands to get the current status
3. Broadcasts changes to all connected clients

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

## How to Deploy

1. Clone the repo and navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Access the application at `http://localhost:3000`

## Customizing the Tool

You can easily extend the application by:

- Adding filters for file types
- Implementing commit functionality
- Adding support for diff statistics
- Creating a dark mode theme
- Adding a search feature within diffs

## Performance Considerations

The application is designed to be lightweight and responsive even with a large number of changed files:

- Diffs are loaded only when needed
- Card expansion is controlled to prevent layout thrashing
- Network requests are minimized by using WebSockets instead of polling

Would you like me to explain any specific part of the implementation in more detail?
