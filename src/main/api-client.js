const { net } = require('electron');
const logger = require('./logger');
const tokenStore = require('./token-store');

let apiBaseUrl = '';
let apiTimeout = 10000;

function init(baseUrl, timeout) {
  apiBaseUrl = (baseUrl || '').replace(/\/+$/, '');
  apiTimeout = timeout || 10000;

  // Enforce HTTPS in production (allow HTTP only for localhost dev)
  if (apiBaseUrl && !apiBaseUrl.startsWith('https://')) {
    const url = new URL(apiBaseUrl);
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      logger.warn('API_BASE_URL is not HTTPS, forcing HTTPS');
      apiBaseUrl = apiBaseUrl.replace('http://', 'https://');
    }
  }

  logger.info('API client initialized', { baseUrl: apiBaseUrl, timeout: apiTimeout });
}

async function request(method, path, body, options = {}) {
  const url = `${apiBaseUrl}${path}`;
  const token = options.token || tokenStore.getToken();

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'Electron',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), apiTimeout);
  fetchOptions.signal = controller.signal;

  try {
    const response = await net.fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    // Handle rate limit
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      const error = new Error(`Rate limited. Try again in ${retryAfter} seconds.`);
      error.code = 'RATE_LIMITED';
      error.retryAfter = parseInt(retryAfter, 10);
      throw error;
    }

    // Handle 401 - try token refresh once (unless this is already a refresh/login request)
    if (response.status === 401 && !options.skipRefresh && !path.includes('/login')) {
      logger.info('Got 401, session expired');
      const error = new Error('Session expired');
      error.code = 'SESSION_EXPIRED';
      throw error;
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      const error = new Error(data.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const error = new Error('Request timed out');
      error.code = 'TIMEOUT';
      throw error;
    }
    if (err.code === 'RATE_LIMITED' || err.code === 'SESSION_EXPIRED' || err.code === 'TIMEOUT') {
      throw err;
    }
    if (err.status) {
      throw err;
    }
    // Network error
    const error = new Error('Cannot connect to server. Please check your network connection.');
    error.code = 'NETWORK_ERROR';
    error.originalError = err.message;
    throw error;
  }
}

// ─── Generic CRUD helpers ───

async function get(path) {
  return request('GET', path);
}

async function post(path, body) {
  return request('POST', path, body);
}

async function put(path, body) {
  return request('PUT', path, body);
}

async function del(path) {
  return request('DELETE', path);
}

// ─── Auth ───

async function login(username, password) {
  const data = await request('POST', '/api/login', {
    username,
    password,
    device_name: 'electron-app',
  }, { skipRefresh: true });

  if (data.token) {
    tokenStore.storeToken(data.token);
    tokenStore.storeUserData(data.user);
  }
  return data;
}

async function logout() {
  try {
    await request('POST', '/api/logout');
  } catch (err) {
    logger.warn('Logout API call failed (clearing local anyway)', { message: err.message });
  }
  tokenStore.clearAll();
}

async function getMe() {
  return request('GET', '/api/me');
}

async function validate() {
  try {
    await request('GET', '/api/me');
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function getBaseUrl() {
  return apiBaseUrl;
}

function hasToken() {
  return !!tokenStore.getToken();
}

module.exports = {
  init,
  request,
  get,
  post,
  put,
  del,
  login,
  logout,
  getMe,
  validate,
  getBaseUrl,
  hasToken,
};
