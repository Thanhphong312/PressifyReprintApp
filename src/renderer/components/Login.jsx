import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [apiTimeout, setApiTimeout] = useState(10000);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.settings.get().then((config) => {
        setApiUrl(config.apiBaseUrl || '');
        setApiTimeout(config.apiTimeout || 10000);
      });
    }
  }, []);

  function getErrorMessage(err) {
    const msg = err.message || '';
    if (msg.includes('Rate limited')) return msg;
    if (msg.includes('Cannot connect to server'))
      return 'Cannot connect to server. Please check API URL in settings.';
    if (msg.includes('Request timed out'))
      return 'Server is not responding. Please check API URL in settings.';
    return msg || 'Login failed. Please try again.';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(getErrorMessage(err));
    }
    setLoading(false);
  }

  async function handleSaveConfig() {
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      await window.electronAPI.settings.save({
        apiBaseUrl: apiUrl.trim(),
        apiTimeout: parseInt(apiTimeout, 10) || 10000,
      });
      setConfigMsg({ type: 'success', text: 'Saved.' });
    } catch (err) {
      setConfigMsg({ type: 'danger', text: err.message });
    }
    setConfigSaving(false);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.settings.testConnection(apiUrl.trim());
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
    setTesting(false);
  }

  return (
    <div className="login-page d-flex align-items-center justify-content-center vh-100">
      <div className="card shadow-lg" style={{ width: '420px' }}>
        <div className="card-body p-4">
          <div className="text-center mb-4 position-relative">
            <button
              className="btn btn-sm btn-outline-secondary position-absolute top-0 end-0"
              onClick={() => { setShowConfig(!showConfig); setConfigMsg(null); setTestResult(null); }}
              title="API Settings"
            >
              <i className="bi bi-gear"></i>
            </button>
            <img src={logo} alt="Pressify" style={{ height: '60px' }} className="mb-2" />
            <h3 className="fw-bold text-primary">Pressify Reprint</h3>
            <p className="text-muted">Sign in to your account</p>
          </div>

          {showConfig && (
            <div className="border rounded p-3 mb-3 bg-light">
              <h6 className="mb-2"><i className="bi bi-gear me-1"></i>API Configuration</h6>
              {configMsg && (
                <div className={`alert alert-${configMsg.type} py-1 small`}>{configMsg.text}</div>
              )}
              <div className="mb-2">
                <label className="form-label small mb-1">API Base URL</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://hub.pressify.us"
                />
              </div>
              <div className="mb-2">
                <label className="form-label small mb-1">Timeout (ms)</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={apiTimeout}
                  onChange={(e) => setApiTimeout(e.target.value)}
                  min="1000"
                  max="120000"
                  step="1000"
                />
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={handleSaveConfig} disabled={configSaving}>
                  {configSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="btn btn-sm btn-outline-info"
                  onClick={handleTestConnection}
                  disabled={testing || !apiUrl.trim()}
                >
                  {testing ? 'Testing...' : 'Test'}
                </button>
              </div>
              {testResult && (
                <div className={`small mt-2 text-${testResult.success ? 'success' : 'danger'}`}>
                  <i className={`bi ${testResult.success ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
