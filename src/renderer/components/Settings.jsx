import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiTimeout, setApiTimeout] = useState(10000);
  const [sessionLifetime, setSessionLifetime] = useState(2592000);
  const [timeblockEnabled, setTimeblockEnabled] = useState(false);
  const [timeblock, setTimeblock] = useState('17:00');
  const [timeunlock, setTimeunlock] = useState('06:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);
  const [sessionMessage, setSessionMessage] = useState(null);
  const [lockMessage, setLockMessage] = useState(null);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    loadSettings();
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setAppVersion);
    }
  }, []);

  async function loadSettings() {
    try {
      const [config, reprintConfig] = await Promise.all([
        window.electronAPI.settings.get(),
        window.electronAPI.db.reprintSettings.get().catch(() => ({})),
      ]);
      setApiBaseUrl(config.apiBaseUrl || '');
      setApiTimeout(config.apiTimeout || 10000);
      if (reprintConfig.session) setSessionLifetime(reprintConfig.session);
      setTimeblockEnabled(!!reprintConfig.timeblock_enabled);
      if (reprintConfig.timeblock) setTimeblock(reprintConfig.timeblock);
      if (reprintConfig.timeunlock) setTimeunlock(reprintConfig.timeunlock);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  // Builds the full reprintSettings object so each save section doesn't overwrite others
  function buildReprintSettings() {
    return {
      session: parseInt(sessionLifetime, 10) || 2592000,
      timeblock_enabled: timeblockEnabled,
      timeblock,
      timeunlock,
    };
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      await window.electronAPI.settings.save({
        apiBaseUrl: apiBaseUrl.trim(),
        apiTimeout: parseInt(apiTimeout, 10) || 10000,
      });
      setSaveMessage({ type: 'success', text: 'Settings saved. API client reinitialized.' });
    } catch (err) {
      setSaveMessage({ type: 'danger', text: `Failed to save: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const config = await window.electronAPI.settings.reset();
      setApiBaseUrl(config.apiBaseUrl || '');
      setApiTimeout(config.apiTimeout || 10000);
      setSaveMessage({ type: 'info', text: 'Settings reset to defaults.' });
    } catch (err) {
      setSaveMessage({ type: 'danger', text: `Failed to reset: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.settings.testConnection(apiBaseUrl.trim());
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveSession(e) {
    e.preventDefault();
    setSavingSession(true);
    setSessionMessage(null);
    try {
      await window.electronAPI.db.reprintSettings.save(buildReprintSettings());
      setSessionMessage({ type: 'success', text: 'Session lifetime saved.' });
    } catch (err) {
      setSessionMessage({ type: 'danger', text: `Failed to save: ${err.message}` });
    } finally {
      setSavingSession(false);
    }
  }

  async function handleSaveLock(e) {
    e.preventDefault();
    setSavingLock(true);
    setLockMessage(null);
    try {
      await window.electronAPI.db.reprintSettings.save(buildReprintSettings());
      setLockMessage({ type: 'success', text: 'Edit lock settings saved.' });
    } catch (err) {
      setLockMessage({ type: 'danger', text: `Failed to save: ${err.message}` });
    } finally {
      setSavingLock(false);
    }
  }

  const sessionPresets = [
    { label: '1 day', value: 86400 },
    { label: '7 days', value: 604800 },
    { label: '30 days', value: 2592000 },
    { label: '90 days', value: 7776000 },
  ];

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="mb-0">Settings</h4>
        <span className="badge bg-primary fs-6">v{appVersion}</span>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-body">
          <h6 className="card-title mb-3">API Configuration</h6>

          {saveMessage && (
            <div className={`alert alert-${saveMessage.type} alert-dismissible fade show`} role="alert">
              {saveMessage.text}
              <button type="button" className="btn-close" onClick={() => setSaveMessage(null)}></button>
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="mb-3">
              <label className="form-label">API Base URL</label>
              <input
                type="text"
                className="form-control"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://hub.pressify.us"
              />
              <div className="form-text">The Laravel Vanguard API server address.</div>
            </div>

            <div className="mb-3">
              <label className="form-label">API Timeout (ms)</label>
              <input
                type="number"
                className="form-control"
                value={apiTimeout}
                onChange={(e) => setApiTimeout(e.target.value)}
                min="1000"
                max="120000"
                step="1000"
              />
              <div className="form-text">Request timeout in milliseconds (1000 - 120000).</div>
            </div>

            <div className="d-flex gap-2 mb-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                ) : (
                  <><i className="bi bi-check-lg me-1"></i>Save</>
                )}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={handleReset} disabled={saving}>
                <i className="bi bi-arrow-counterclockwise me-1"></i>Reset to Default
              </button>
            </div>
          </form>

          <hr />

          <h6 className="mb-3">Connection Test</h6>
          <button
            className="btn btn-outline-info"
            onClick={handleTestConnection}
            disabled={testing || !apiBaseUrl.trim()}
          >
            {testing ? (
              <><span className="spinner-border spinner-border-sm me-1"></span>Testing...</>
            ) : (
              <><i className="bi bi-wifi me-1"></i>Test Connection</>
            )}
          </button>

          {testResult && (
            <div className={`alert ${testResult.success ? 'alert-success' : 'alert-danger'} mt-3 mb-0`}>
              <i className={`bi ${testResult.success ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-4" style={{ maxWidth: '600px' }}>
        <div className="card-body">
          <h6 className="card-title mb-3">Session Lifetime</h6>

          {sessionMessage && (
            <div className={`alert alert-${sessionMessage.type} alert-dismissible fade show`} role="alert">
              {sessionMessage.text}
              <button type="button" className="btn-close" onClick={() => setSessionMessage(null)}></button>
            </div>
          )}

          <form onSubmit={handleSaveSession}>
            <div className="mb-3">
              <label className="form-label">Session Lifetime (seconds)</label>
              <input
                type="number"
                className="form-control"
                value={sessionLifetime}
                onChange={(e) => setSessionLifetime(e.target.value)}
                min="3600"
                step="1"
              />
              <div className="form-text">
                How long a login session stays valid. Current: {Math.floor(sessionLifetime / 86400)} days ({Math.floor(sessionLifetime / 3600)} hours).
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap mb-3">
              {sessionPresets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`btn btn-sm ${parseInt(sessionLifetime) === p.value ? 'btn-dark' : 'btn-outline-secondary'}`}
                  onClick={() => setSessionLifetime(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingSession}>
              {savingSession ? (
                <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
              ) : (
                'Save Session Lifetime'
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="card mt-4" style={{ maxWidth: '600px' }}>
        <div className="card-body">
          <h6 className="card-title mb-3">Edit Lock Schedule</h6>
          <p className="text-muted small mb-3">
            After the lock time, non-admin users cannot edit, add, or bulk-update reprints until the unlock time.
            Times are in <strong>America/Chicago (CT)</strong>.
          </p>

          {lockMessage && (
            <div className={`alert alert-${lockMessage.type} alert-dismissible fade show`} role="alert">
              {lockMessage.text}
              <button type="button" className="btn-close" onClick={() => setLockMessage(null)}></button>
            </div>
          )}

          <form onSubmit={handleSaveLock}>
            <div className="mb-3">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="timeblockEnabled"
                  checked={timeblockEnabled}
                  onChange={(e) => setTimeblockEnabled(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="timeblockEnabled">
                  Enable edit lock
                </label>
              </div>
            </div>

            {timeblockEnabled && (
              <>
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label">
                      🔒 Lock Time <span className="text-muted">(Block)</span>
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={timeblock}
                      onChange={(e) => setTimeblock(e.target.value)}
                    />
                    <div className="form-text">Editing locks at this time each day.</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label">
                      🔓 Unlock Time
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={timeunlock}
                      onChange={(e) => setTimeunlock(e.target.value)}
                    />
                    <div className="form-text">Editing re-enables at this time.</div>
                  </div>
                </div>
                <div className="alert alert-info py-2 small mb-3">
                  Example: Lock at <strong>17:00</strong>, Unlock at <strong>06:00</strong> → editing is blocked from
                  5 PM until 6 AM the next morning. Admin users are never locked.
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary" disabled={savingLock}>
              {savingLock ? (
                <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
              ) : (
                'Save Lock Settings'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
