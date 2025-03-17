const { screen, app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Window state manager to persist window position and size between sessions
 */
class WindowStateManager {
  constructor(options) {
    // Default options
    this.options = Object.assign({
      storeName: 'window-state',
      defaultWidth: 1200,
      defaultHeight: 800
    }, options);
    
    // Simple in-memory store until app is ready
    this.state = {
      width: this.options.defaultWidth,
      height: this.options.defaultHeight,
      x: undefined,
      y: undefined,
      isMaximized: false
    };
    
    // Set up file path once app is ready
    if (app.isReady()) {
      this._setupFilePath();
      this.loadState();
    } else {
      app.whenReady().then(() => {
        this._setupFilePath();
        this.loadState();
      });
    }
  }
  
  _setupFilePath() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, `${this.options.storeName}.json`);
    console.log(`Window state file: ${this.filePath}`);
  }
  
  // Load window state from disk
  loadState() {
    try {
      if (this.filePath && fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const savedState = JSON.parse(data);
        
        // Merge with default state
        Object.assign(this.state, savedState);
        console.log('Loaded window state:', this.state);
      }
    } catch (err) {
      console.error('Failed to load window state:', err);
    }
  }
  
  // Save window state to disk
  saveState(win) {
    if (!win.isDestroyed()) {
      try {
        // Only update position if not maximized
        const isMaximized = win.isMaximized();
        if (!isMaximized) {
          const bounds = win.getBounds();
          this.state.width = bounds.width;
          this.state.height = bounds.height;
          this.state.x = bounds.x;
          this.state.y = bounds.y;
        }
        
        this.state.isMaximized = isMaximized;
        
        // Save to disk if app is ready and path is set
        if (this.filePath) {
          // Make sure directory exists
          const dir = path.dirname(this.filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
        }
      } catch (err) {
        console.error('Failed to save window state:', err);
      }
    }
  }
  
  // Get window state with bounds check
  getState() {
    // Check if window is offscreen
    if (this.state.x !== undefined && this.state.y !== undefined && screen) {
      const displays = screen.getAllDisplays();
      let isOnScreen = false;
      
      // Check if window is on any display
      for (const display of displays) {
        const bounds = display.bounds;
        if (
          this.state.x >= bounds.x && 
          this.state.y >= bounds.y && 
          this.state.x + this.state.width <= bounds.x + bounds.width && 
          this.state.y + this.state.height <= bounds.y + bounds.height
        ) {
          isOnScreen = true;
          break;
        }
      }
      
      // Reset position if window is offscreen
      if (!isOnScreen) {
        this.state.x = undefined;
        this.state.y = undefined;
      }
    }
    
    return this.state;
  }
  
  // Track window state changes
  track(win) {
    ['resize', 'move', 'close'].forEach(event => {
      win.on(event, () => {
        this.saveState(win);
      });
    });
  }
}

module.exports = WindowStateManager;