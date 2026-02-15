const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogPath() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `app-${date}.log`);
}

function rotateIfNeeded(logPath) {
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_SIZE) {
      const rotated = logPath.replace('.log', `-${Date.now()}.log`);
      fs.renameSync(logPath, rotated);
    }
  } catch {
    // ignore rotation errors
  }
}

function formatMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  let line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (data !== undefined) {
    try {
      line += ' ' + JSON.stringify(data);
    } catch {
      line += ' [unserializable data]';
    }
  }
  return line;
}

function writeLog(level, message, data) {
  ensureLogDir();
  const logPath = getLogPath();
  rotateIfNeeded(logPath);
  const line = formatMessage(level, message, data) + '\n';
  fs.appendFileSync(logPath, line, 'utf8');
}

const logger = {
  info: (message, data) => writeLog('info', message, data),
  warn: (message, data) => writeLog('warn', message, data),
  error: (message, data) => writeLog('error', message, data),
  getLogDir: () => LOG_DIR,
};

module.exports = logger;
