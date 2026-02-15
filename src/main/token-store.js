const { safeStorage } = require('electron');
const Store = require('electron-store');
const logger = require('./logger');

const store = new Store({
  name: 'pressify-auth',
  encryptionKey: 'pressify-reprint-store-key',
});

function storeToken(token) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      store.set('auth_token', encrypted.toString('base64'));
      store.set('auth_token_encrypted', true);
    } else {
      store.set('auth_token', token);
      store.set('auth_token_encrypted', false);
    }
    store.set('auth_token_stored_at', Date.now());
    logger.info('Token stored successfully');
  } catch (err) {
    logger.error('Failed to store token', { message: err.message });
    throw err;
  }
}

function getToken() {
  try {
    const token = store.get('auth_token');
    if (!token) return null;

    const isEncrypted = store.get('auth_token_encrypted', false);
    if (isEncrypted) {
      if (!safeStorage.isEncryptionAvailable()) {
        logger.warn('safeStorage not available, cannot decrypt token');
        return null;
      }
      const buffer = Buffer.from(token, 'base64');
      return safeStorage.decryptString(buffer);
    }
    return token;
  } catch (err) {
    logger.error('Failed to get token', { message: err.message });
    return null;
  }
}

function clearToken() {
  store.delete('auth_token');
  store.delete('auth_token_encrypted');
  store.delete('auth_token_stored_at');
  logger.info('Token cleared');
}

function storeUserData(data) {
  store.set('user_data', data);
}

function getUserData() {
  return store.get('user_data', null);
}

function clearAll() {
  store.clear();
  logger.info('All auth data cleared');
}

module.exports = {
  storeToken,
  getToken,
  clearToken,
  storeUserData,
  getUserData,
  clearAll,
};
