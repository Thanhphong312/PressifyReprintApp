const mysql = require('mysql2/promise');
const path = require('path');
const { app } = require('electron');

let pool = null;

function loadEnv() {
  const envPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.join(app.getAppPath(), '.env');
  require('dotenv').config({ path: envPath });
}

function getPrefix() {
  return process.env.DB_PREFIX || '';
}

function t(table) {
  return `${getPrefix()}${table}`;
}

async function createPool() {
  loadEnv();
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_DATABASE || 'pressify',
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
  });
  return pool;
}

function getPool() {
  return pool;
}

module.exports = { createPool, getPool, t };
