const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const GitMonitor = require('./gitMonitor');
const WindowStateManager = require('./windowStateManager');
const isDev = process.env.NODE_ENV === 'development';

// Global references
let mainWindow;
let gitMonitor;
let tray = null;
let windowStateManager;
let lastRepository = null;
let recentRepositories = [];

/**
 * Enhanced persistent storage (key-value)
 * Includes support for recent repositories
 */
const store = {
  get: function(key, defaultValue = null) {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'repomon-config.json');
      
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return key in data ? data[key] : defaultValue;
      }
    } catch (err) {
      console.error('Error reading config:', err);
    }
    return defaultValue;
  },
  
  set: function(key, value) {
    try {
      const userDataPath = app.getPath('userData');
      const filePath = path.join(userDataPath, 'repomon-config.json');
      let data = {};
      
      // Read existing data if file exists
      if (fs.existsSync(filePath)) {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      
      // Update value
      data[key] = value;
      
      // Make sure directory exists
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      
      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error writing config:', err);
    }
  },
  
  // Add repository to recent list
  addRecentRepository: function(repoPath) {
    try {
      if (!repoPath) return;
      
      // Get current recent repositories
      let recents = this.get('recentRepositories', []);
      
      // Remove if already exists (to move it to top)
      recents = recents.filter(repo => repo.path !== repoPath);
      
      // Add to beginning of array
      recents.unshift({
        path: repoPath,
        name: path.basename(repoPath),
        timestamp: new Date().toISOString()
      });
      
      // Limit to 20 most recent
      if (recents.length > 20) {
        recents = recents.slice(0, 20);
      }
      
      // Save back to config
      this.set('recentRepositories', recents);
      
      // Update global variable
      recentRepositories = recents;
      
      return recents;
    } catch (err) {
      console.error('Error adding recent repository:', err);
      return [];
    }
  },
  
  // Get recent repositories
  getRecentRepositories: function() {
    return this.get('recentRepositories', []);
  }
};

/**
 * Create the main application window
 */
function createWindow() {
  console.log('Creating main window...');
  
  // Initialize window state manager if not already
  if (!windowStateManager) {
    windowStateManager = new WindowStateManager({
      storeName: 'repomon-window-state',
      defaultWidth: 1200,
      defaultHeight: 800
    });
  }
  
  // Get saved window state
  const windowState = windowStateManager.getState();
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../assets/icons/icon.png'),
    title: 'Repomon',
    show: false  // Don't show until ready
  });
  
  // Restore maximized state if needed
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }
  
  // Track window state changes
  windowStateManager.track(mainWindow);
  
  // Show window when ready to avoid flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Load the React app
  let startUrl;
  
  if (isDev) {
    // Development mode - always use the React dev server
    startUrl = 'http://localhost:3000';
  } else {
    // Production mode - check if build exists, otherwise fall back to dev server
    const buildPath = path.join(__dirname, '../build/index.html');
    if (fs.existsSync(buildPath)) {
      startUrl = `file://${buildPath}`;
    } else {
      console.warn('Production build not found, falling back to development server');
      startUrl = 'http://localhost:3000';
    }
  }
  
  console.log(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);
  
  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  // Initialize repository from saved config or show picker
  try {
    // Load last repository
    lastRepository = store.get('lastRepository');
    console.log('Last repository:', lastRepository);
    
    // Load recent repositories list
    recentRepositories = store.getRecentRepositories();
    console.log(`Loaded ${recentRepositories.length} recent repositories`);
    
    if (lastRepository && lastRepository.path) {
      setTimeout(() => {
        initRepository(lastRepository.path);
      }, 1000);
    } else {
      // Wait for app to be ready before showing dialog
      setTimeout(() => {
        openRepositoryDialog();
      }, 1000);
    }
  } catch (err) {
    console.error('Error loading repository data:', err);
  }
  
  // Handle window close event
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

/**
 * Initialize repository monitoring
 */
async function initRepository(repoPath) {
  if (!repoPath) {
    console.error('No repository path provided');
    return;
  }
  
  console.log(`Initializing repository at: ${repoPath}`);
  
  try {
    // Stop current monitor if any
    if (gitMonitor) {
      gitMonitor.stopMonitoring();
    }
    
    // Create new monitor
    gitMonitor = new GitMonitor(repoPath);
    
    // Wait a bit for the git repo check to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Start monitoring
    await gitMonitor.startMonitoring((status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('repo-status', status);
      }
    });
    
    // Save as last used repository
    store.set('lastRepository', { path: repoPath });
    lastRepository = { path: repoPath };
    
    // Add to recent repositories
    store.addRecentRepository(repoPath);
    
    // Send path to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('repo-path', repoPath);
      mainWindow.setTitle(`Repomon - ${path.basename(repoPath)}`);
    }
  } catch (err) {
    console.error('Error initializing repository:', err);
    
    // Notify renderer of the error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('repo-error', {
        error: `Failed to initialize repository: ${err.message}`
      });
    }
  }
}

/**
 * Open repository dialog
 */
async function openRepositoryDialog() {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.warn('Cannot open repository dialog - window is not available');
      return null;
    }
    
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Git Repository'
    });
    
    if (!canceled && filePaths.length > 0) {
      initRepository(filePaths[0]);
      return filePaths[0];
    }
  } catch (error) {
    console.error('Error showing directory picker:', error);
  }
  return null;
}

/**
 * Show recent repositories menu
 */
function showRecentRepositoriesMenu(x, y) {
  // Load recent repositories from store
  if (recentRepositories.length === 0) {
    recentRepositories = store.getRecentRepositories();
  }
  
  // Create menu items for each repository
  const menuItems = recentRepositories.map(repo => {
    return {
      label: repo.name,
      sublabel: repo.path,
      click: () => {
        initRepository(repo.path);
      }
    };
  });
  
  // Add option to browse for repository
  menuItems.push(
    { type: 'separator' },
    { 
      label: 'Browse for Repository...',
      click: () => openRepositoryDialog()
    }
  );
  
  // If we have items, create and show the menu
  if (menuItems.length > 0) {
    const menu = Menu.buildFromTemplate(menuItems);
    
    if (x && y) {
      // Show at specified position (context menu)
      menu.popup({ x, y });
    } else {
      // Show at mouse position
      menu.popup({ window: mainWindow });
    }
    
    return true;
  }
  
  return false;
}

/**
 * Create system tray icon
 */
function createTray() {
  try {
    console.log('Creating tray icon...');
    
    // Try to load tray icon
    let trayIcon;
    const trayIconPath = path.join(__dirname, '../assets/icons/tray-icon.png');
    
    try {
      if (fs.existsSync(trayIconPath)) {
        console.log(`Loading tray icon from: ${trayIconPath}`);
        trayIcon = nativeImage.createFromPath(trayIconPath);
      }
    } catch (err) {
      console.error('Error loading tray icon:', err);
    }
    
    // Create empty icon as fallback
    if (!trayIcon || trayIcon.isEmpty()) {
      console.log('Using empty tray icon');
      trayIcon = nativeImage.createEmpty();
    }
    
    // Create tray
    tray = new Tray(trayIcon);
    
    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Repomon', click: () => mainWindow.show() },
      { label: 'Open Repository...', click: openRepositoryDialog },
      { label: 'Recent Repositories', click: () => showRecentRepositoriesMenu() },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); }}
    ]);
    
    tray.setToolTip('Repomon - Git Repository Monitor');
    tray.setContextMenu(contextMenu);
    
    // Handle tray click
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
    
    console.log('Tray icon created successfully');
  } catch (err) {
    console.error('Failed to create tray icon:', err);
  }
}

/**
 * Create application menu
 */
function createMenu() {
  try {
    console.log('Creating application menu...');
    
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Open Repository...',
            accelerator: 'CmdOrCtrl+O',
            click: openRepositoryDialog
          },
          {
            label: 'Recent Repositories',
            accelerator: 'CmdOrCtrl+R',
            click: () => showRecentRepositoriesMenu()
          },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        role: 'help',
        submenu: [
          {
            label: 'Learn More',
            click: async () => {
              const { shell } = require('electron');
              await shell.openExternal('https://github.com/yourusername/repomon');
            }
          }
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    
    console.log('Application menu created successfully');
  } catch (err) {
    console.error('Failed to create application menu:', err);
  }
}

// IPC Handlers
ipcMain.handle('open-repository', openRepositoryDialog);

// Open recent repositories menu
ipcMain.handle('show-recent-repositories', (event, position) => {
  // Position is optional, can be used to position the menu
  if (position && position.x && position.y) {
    return showRecentRepositoriesMenu(position.x, position.y);
  } else {
    return showRecentRepositoriesMenu();
  }
});

// Get recent repositories list
ipcMain.handle('get-recent-repositories', () => {
  return store.getRecentRepositories();
});

// Get repository status on demand
ipcMain.handle('get-status', async () => {
  if (gitMonitor) {
    return await gitMonitor.getStatus();
  }
  return { error: 'No repository initialized' };
});

// Get repository path on demand
ipcMain.handle('get-repo-path', () => {
  return lastRepository ? lastRepository.path : null;
});

// Initialize application
app.whenReady().then(() => {
  console.log("Electron app is ready!");
  
  try {
    // Create window and UI components
    createWindow();
    createTray();
    createMenu();
    
    console.log("Application initialization complete");
  } catch (error) {
    console.error("Error during application initialization:", error);
  }
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle activate event (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

// Handle before-quit event
app.on('before-quit', () => {
  app.isQuitting = true;
});