const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Load .env before anything else
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')
  : path.join(app.getAppPath(), '.env');
require('dotenv').config({ path: envPath });

const logger = require('./logger');
const { registerHandlers } = require('./ipc-handlers');
const apiClient = require('./api-client');

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
      const { autoUpdater } = require('electron-updater');

      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on('update-available', (info) => {
        logger.info('Update available', { version: info.version });
        mainWindow.webContents.send('update-available', info);
      });

      autoUpdater.on('update-downloaded', (info) => {
        logger.info('Update downloaded', { version: info.version });
        mainWindow.webContents.send('update-downloaded', info);
      });

      autoUpdater.on('error', (err) => {
        logger.error('Auto-updater error', { message: err.message });
      });

      autoUpdater.checkForUpdatesAndNotify();
      logger.info('Auto-updater initialized');
    } catch (err) {
      logger.error('Auto-updater init error', { message: err.message });
    }
  }
};

app.whenReady().then(async () => {
  logger.info('App ready', { version: app.getVersion(), platform: process.platform });

  // Initialize API client
  apiClient.init(
    process.env.API_BASE_URL || 'http://127.0.0.1:8000',
    parseInt(process.env.API_TIMEOUT || '10000', 10)
  );
  logger.info('API client initialized');

  // Register all IPC handlers
  registerHandlers();

  // Core IPC
  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('install-update', () => {
    logger.info('User requested update install');
    if (app.isPackaged) {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.quitAndInstall();
    }
  });

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
