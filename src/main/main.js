const { app, BrowserWindow, ipcMain } = require('electron');
const { execFile } = require('child_process');
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

// ─── USB HID scanner detection ────────────────────────────────────────────
// Use execFile to call powershell.exe directly — no cmd.exe shell, no quoting issues
function runPS(script) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 10000 },
      (err, stdout, stderr) => resolve({
        out: (stdout || '').trim(),
        err: err?.message || '',
        stderr: (stderr || '').trim(),
      })
    );
  });
}

// WMI filter syntax — no $_ / Where-Object needed
const PS_GET_HID  = `Get-WmiObject -Class Win32_PnPEntity -Filter "PNPClass='HIDClass'" | Where-Object { $_.Name -notmatch 'keyboard|mouse|pointer|touchpad|trackpad|gamepad|joystick' } | Select-Object -ExpandProperty PNPDeviceID`;
const PS_GET_ALL  = `Get-WmiObject -Class Win32_PnPEntity | Where-Object {$_.PNPClass} | Select-Object Name,PNPDeviceID,PNPClass | ConvertTo-Json -Compress`;

async function getHidIds() {
  const { out } = await runPS(PS_GET_HID);
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

let prevHidIds = [];
let hidPollTimer = null;

async function startHidPolling() {
  prevHidIds = await getHidIds();
  hidPollTimer = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) { clearInterval(hidPollTimer); return; }
    const current = await getHidIds();
    const added = current.filter((d) => !prevHidIds.includes(d));
    const removed = prevHidIds.filter((d) => !current.includes(d));
    if (added.length) mainWindow.webContents.send('usb-hid-changed', { type: 'connected', added });
    else if (removed.length) mainWindow.webContents.send('usb-hid-changed', { type: 'disconnected', removed });
    prevHidIds = current;
  }, 2000);
}
// ──────────────────────────────────────────────────────────────────────────

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

  ipcMain.handle('scanner:getDevices', async () => {
    const [hids, all] = await Promise.all([getHidIds(), runPS(PS_GET_ALL)]);
    return { hids, raw: all.out, err: all.err };
  });

  ipcMain.handle('log-from-renderer', (_, level, message, data) => {
    if (['info', 'warn', 'error'].includes(level)) {
      logger[level](`[renderer] ${message}`, data);
    }
  });

  createWindow();
  startHidPolling();
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
