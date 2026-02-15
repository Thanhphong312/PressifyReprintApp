const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const logger = require('./logger');
const { registerHandlers } = require('./ipc-handlers');
const apiClient = require('./api-client');

const settingsStore = new Store({ name: 'pressify-settings' });

// Handle Squirrel events for Windows installer
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

const createWindow = () => {
  logger.info('Creating main window');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, '..', '..', 'src', 'renderer', 'icon.png'),
    show: false,
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logger.info('Main window ready');
  });

  // Auto-updater setup (only in production)
  if (app.isPackaged) {
    try {
      const { updateElectronApp, UpdateSourceType } = require('update-electron-app');
      updateElectronApp({
        updateSource: {
          type: UpdateSourceType.ElectronPublicUpdateService,
          repo: 'Thanhphong312/PressifyReprintApp',
        },
        updateInterval: '10 minutes',
        notifyUser: true,
      });
      logger.info('Auto-updater initialized');
    } catch (err) {
      logger.error('Auto-updater init error', { message: err.message });
    }
  }
};

app.whenReady().then(async () => {
  logger.info('App ready', { version: app.getVersion(), platform: process.platform });

  // Initialize API client (use stored settings, fallback to defaults)
  const apiBaseUrl = settingsStore.get('apiBaseUrl', 'https://hub.pressify.us');
  const apiTimeoutVal = settingsStore.get('apiTimeout', 10000);
  apiClient.init(apiBaseUrl, apiTimeoutVal);
  logger.info('API client initialized');

  // Register all IPC handlers
  registerHandlers();

  // Core IPC
  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('log-from-renderer', (_, level, message, data) => {
    if (['info', 'warn', 'error'].includes(level)) {
      logger[level](`[renderer] ${message}`, data);
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
