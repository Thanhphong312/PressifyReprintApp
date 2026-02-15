const { ipcMain, shell } = require('electron');
const Store = require('electron-store');
const apiClient = require('./api-client');
const tokenStore = require('./token-store');
const logger = require('./logger');

const settingsStore = new Store({ name: 'pressify-settings' });

function registerHandlers() {

  // ─── Settings ───

  ipcMain.handle('settings:get', async () => {
    return {
      apiBaseUrl: settingsStore.get('apiBaseUrl', 'https://hub.pressify.us'),
      apiTimeout: settingsStore.get('apiTimeout', 10000),
    };
  });

  ipcMain.handle('settings:save', async (_, config) => {
    settingsStore.set('apiBaseUrl', config.apiBaseUrl);
    settingsStore.set('apiTimeout', config.apiTimeout);
    apiClient.init(config.apiBaseUrl, config.apiTimeout);
    logger.info('Settings saved and API client reinitialized', config);
    return { success: true };
  });

  ipcMain.handle('settings:reset', async () => {
    settingsStore.delete('apiBaseUrl');
    settingsStore.delete('apiTimeout');
    const apiBaseUrl = 'https://hub.pressify.us';
    const apiTimeout = 10000;
    apiClient.init(apiBaseUrl, apiTimeout);
    logger.info('Settings reset to defaults');
    return { apiBaseUrl, apiTimeout };
  });

  ipcMain.handle('settings:testConnection', async (_, url) => {
    try {
      const testUrl = (url || '').replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const { net } = require('electron');
      const response = await net.fetch(`${testUrl}/api/me`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'Electron' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // Any response (even 401) means the server is reachable
      return { success: true, message: `Server reachable (HTTP ${response.status})` };
    } catch (err) {
      return { success: false, message: err.name === 'AbortError' ? 'Connection timed out' : `Connection failed: ${err.message}` };
    }
  });

  // ─── Users ───

  ipcMain.handle('db:users:getAll', async () => {
    return apiClient.get('/api/reprint-users');
  });

  ipcMain.handle('db:users:count', async () => {
    const data = await apiClient.get('/api/reprint-users/count');
    return data.count;
  });

  ipcMain.handle('db:roles:getAll', async () => {
    return apiClient.get('/api/reprint-roles');
  });

  ipcMain.handle('db:users:create', async (_, data) => {
    const result = await apiClient.post('/api/reprint-users', data);
    return result.id;
  });

  ipcMain.handle('db:users:update', async (_, id, data) => {
    await apiClient.put(`/api/reprint-users/${id}`, data);
  });

  ipcMain.handle('db:users:delete', async (_, id) => {
    await apiClient.del(`/api/reprint-users/${id}`);
  });

  // ─── Reprints ───

  ipcMain.handle('db:reprints:getAll', async () => {
    return apiClient.get('/api/reprints');
  });

  ipcMain.handle('db:reprints:create', async (_, data) => {
    const result = await apiClient.post('/api/reprints', data);
    return result.id;
  });

  ipcMain.handle('db:reprints:update', async (_, id, data) => {
    await apiClient.put(`/api/reprints/${id}`, data);
  });

  ipcMain.handle('db:reprints:delete', async (_, id) => {
    await apiClient.del(`/api/reprints/${id}`);
  });

  // ─── Product Reprints ───

  ipcMain.handle('db:productReprints:getAll', async () => {
    return apiClient.get('/api/product-reprints');
  });

  ipcMain.handle('db:productReprints:create', async (_, data) => {
    const result = await apiClient.post('/api/product-reprints', data);
    return result.id;
  });

  ipcMain.handle('db:productReprints:update', async (_, id, data) => {
    await apiClient.put(`/api/product-reprints/${id}`, data);
  });

  ipcMain.handle('db:productReprints:delete', async (_, id) => {
    await apiClient.del(`/api/product-reprints/${id}`);
  });

  // ─── Color Reprints ───

  ipcMain.handle('db:colorReprints:getAll', async () => {
    return apiClient.get('/api/color-reprints');
  });

  ipcMain.handle('db:colorReprints:create', async (_, data) => {
    const result = await apiClient.post('/api/color-reprints', data);
    return result.id;
  });

  ipcMain.handle('db:colorReprints:update', async (_, id, data) => {
    await apiClient.put(`/api/color-reprints/${id}`, data);
  });

  ipcMain.handle('db:colorReprints:delete', async (_, id) => {
    await apiClient.del(`/api/color-reprints/${id}`);
  });

  // ─── Size Reprints ───

  ipcMain.handle('db:sizeReprints:getAll', async () => {
    return apiClient.get('/api/size-reprints');
  });

  ipcMain.handle('db:sizeReprints:create', async (_, data) => {
    const result = await apiClient.post('/api/size-reprints', data);
    return result.id;
  });

  ipcMain.handle('db:sizeReprints:update', async (_, id, data) => {
    await apiClient.put(`/api/size-reprints/${id}`, data);
  });

  ipcMain.handle('db:sizeReprints:delete', async (_, id) => {
    await apiClient.del(`/api/size-reprints/${id}`);
  });

  // ─── Reason Reprints ───

  ipcMain.handle('db:reasons:getAll', async () => {
    return apiClient.get('/api/reasons');
  });

  ipcMain.handle('db:reasons:create', async (_, data) => {
    const result = await apiClient.post('/api/reasons', data);
    return result.id;
  });

  ipcMain.handle('db:reasons:update', async (_, id, data) => {
    await apiClient.put(`/api/reasons/${id}`, data);
  });

  ipcMain.handle('db:reasons:delete', async (_, id) => {
    await apiClient.del(`/api/reasons/${id}`);
  });

  // ─── Order Types ───

  ipcMain.handle('db:orderTypes:getAll', async () => {
    return apiClient.get('/api/order-types');
  });

  ipcMain.handle('db:orderTypes:create', async (_, data) => {
    const result = await apiClient.post('/api/order-types', data);
    return result.id;
  });

  ipcMain.handle('db:orderTypes:update', async (_, id, data) => {
    await apiClient.put(`/api/order-types/${id}`, data);
  });

  ipcMain.handle('db:orderTypes:delete', async (_, id) => {
    await apiClient.del(`/api/order-types/${id}`);
  });

  // ─── Timelines ───

  ipcMain.handle('db:timelines:getByReprint', async (_, reprintId) => {
    return apiClient.get(`/api/timelines/${reprintId}`);
  });

  ipcMain.handle('db:timelines:create', async (_, data) => {
    const result = await apiClient.post('/api/timelines', data);
    return result.id;
  });

  // ─── Auth ───

  ipcMain.handle('auth:login', async (_, username, password) => {
    try {
      const data = await apiClient.login(username, password);
      logger.info('API login successful', { username });
      return { user: data.user, sso: true };
    } catch (err) {
      logger.error('API login failed', { message: err.message, code: err.code });
      throw err;
    }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      await apiClient.logout();
    } catch (err) {
      logger.warn('API logout failed', { message: err.message });
    }
    tokenStore.clearAll();
    return { message: 'Logged out' };
  });

  ipcMain.handle('auth:refresh', async () => {
    // Sanctum tokens don't refresh - just validate
    try {
      const result = await apiClient.validate();
      return { refreshed: result.valid };
    } catch (err) {
      logger.error('Token validation failed via IPC', { message: err.message });
      throw err;
    }
  });

  ipcMain.handle('auth:validate', async () => {
    try {
      const data = await apiClient.validate();
      return { ...data, sso: true };
    } catch (err) {
      logger.warn('Token validation failed', { message: err.message });
      return { valid: false, sso: true, error: err.message };
    }
  });

  ipcMain.handle('auth:me', async () => {
    try {
      return await apiClient.getMe();
    } catch (err) {
      logger.error('Get me failed', { message: err.message });
      throw err;
    }
  });

  ipcMain.handle('auth:sso-web', async () => {
    throw new Error('SSO web login is not supported in API-only mode');
  });

  ipcMain.handle('auth:get-status', async () => {
    return { ssoEnabled: true, hasToken: apiClient.hasToken() };
  });
}

module.exports = { registerHandlers };
