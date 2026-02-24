const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
  },
  log: (level, message, data) => ipcRenderer.invoke('log-from-renderer', level, message, data),

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (config) => ipcRenderer.invoke('settings:save', config),
    reset: () => ipcRenderer.invoke('settings:reset'),
    testConnection: (url) => ipcRenderer.invoke('settings:testConnection', url),
  },

  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    refresh: () => ipcRenderer.invoke('auth:refresh'),
    validate: () => ipcRenderer.invoke('auth:validate'),
    me: () => ipcRenderer.invoke('auth:me'),
    openWeb: () => ipcRenderer.invoke('auth:sso-web'),
    getStatus: () => ipcRenderer.invoke('auth:get-status'),
  },

  db: {
    users: {
      getAll: () => ipcRenderer.invoke('db:users:getAll'),
      count: () => ipcRenderer.invoke('db:users:count'),
      create: (data) => ipcRenderer.invoke('db:users:create', data),
      update: (id, data) => ipcRenderer.invoke('db:users:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:users:delete', id),
    },
    roles: {
      getAll: () => ipcRenderer.invoke('db:roles:getAll'),
    },
    reprints: {
      getAll: () => ipcRenderer.invoke('db:reprints:getAll'),
      create: (data) => ipcRenderer.invoke('db:reprints:create', data),
      update: (id, data) => ipcRenderer.invoke('db:reprints:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:reprints:delete', id),
    },
    productReprints: {
      getAll: () => ipcRenderer.invoke('db:productReprints:getAll'),
      create: (data) => ipcRenderer.invoke('db:productReprints:create', data),
      update: (id, data) => ipcRenderer.invoke('db:productReprints:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:productReprints:delete', id),
    },
    colorReprints: {
      getAll: () => ipcRenderer.invoke('db:colorReprints:getAll'),
      create: (data) => ipcRenderer.invoke('db:colorReprints:create', data),
      update: (id, data) => ipcRenderer.invoke('db:colorReprints:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:colorReprints:delete', id),
    },
    sizeReprints: {
      getAll: () => ipcRenderer.invoke('db:sizeReprints:getAll'),
      create: (data) => ipcRenderer.invoke('db:sizeReprints:create', data),
      update: (id, data) => ipcRenderer.invoke('db:sizeReprints:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:sizeReprints:delete', id),
    },
    userReprints: {
      getAll: () => ipcRenderer.invoke('db:userReprints:getAll'),
      create: (data) => ipcRenderer.invoke('db:userReprints:create', data),
      update: (id, data) => ipcRenderer.invoke('db:userReprints:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:userReprints:delete', id),
    },
    reasonErrors: {
      getAll: () => ipcRenderer.invoke('db:reasonErrors:getAll'),
      create: (data) => ipcRenderer.invoke('db:reasonErrors:create', data),
      update: (id, data) => ipcRenderer.invoke('db:reasonErrors:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:reasonErrors:delete', id),
    },
    reasons: {
      getAll: () => ipcRenderer.invoke('db:reasons:getAll'),
      create: (data) => ipcRenderer.invoke('db:reasons:create', data),
      update: (id, data) => ipcRenderer.invoke('db:reasons:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:reasons:delete', id),
    },
    orderTypes: {
      getAll: () => ipcRenderer.invoke('db:orderTypes:getAll'),
      create: (data) => ipcRenderer.invoke('db:orderTypes:create', data),
      update: (id, data) => ipcRenderer.invoke('db:orderTypes:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:orderTypes:delete', id),
    },
    reprintSettings: {
      get: () => ipcRenderer.invoke('db:reprintSettings:get'),
      save: (data) => ipcRenderer.invoke('db:reprintSettings:save', data),
    },
    timelines: {
      getByReprint: (reprintId) => ipcRenderer.invoke('db:timelines:getByReprint', reprintId),
      create: (data) => ipcRenderer.invoke('db:timelines:create', data),
    },
  },
});
