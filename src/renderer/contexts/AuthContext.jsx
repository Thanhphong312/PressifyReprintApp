import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AuthContext = createContext(null);

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const SESSION_CHECK_INTERVAL = 60 * 1000; // check every minute

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const refreshTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);

  const clearSession = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('pressify_user');
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  }, []);

  const startRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    refreshTimerRef.current = setInterval(async () => {
      try {
        await window.electronAPI.auth.refresh();
        window.electronAPI.log('info', 'Token auto-refreshed');
      } catch (err) {
        window.electronAPI.log('error', 'Token auto-refresh failed', { message: err.message });
        clearSession();
      }
    }, REFRESH_INTERVAL);
  }, [clearSession]);

  const startSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    sessionTimerRef.current = setInterval(() => {
      const loginTime = parseInt(localStorage.getItem('pressify_login_time') || '0', 10);
      const lifetime = parseInt(localStorage.getItem('pressify_session_lifetime') || '2592000', 10);
      if (loginTime && Date.now() - loginTime > lifetime * 1000) {
        window.electronAPI.log('info', 'Session expired by lifetime setting');
        clearSession();
      }
    }, SESSION_CHECK_INTERVAL);
  }, [clearSession]);

  // Startup: restore session + validate token
  useEffect(() => {
    async function restoreSession() {
      const saved = localStorage.getItem('pressify_user');
      if (!saved) {
        setLoading(false);
        return;
      }

      let userData;
      try {
        userData = JSON.parse(saved);
      } catch {
        localStorage.removeItem('pressify_user');
        setLoading(false);
        return;
      }

      try {
        const status = await window.electronAPI.auth.getStatus();
        setSsoEnabled(status.ssoEnabled);

        if (status.ssoEnabled && status.hasToken) {
          // Validate the token against the API
          const validation = await window.electronAPI.auth.validate();
          if (validation.valid) {
            setCurrentUser(userData);
            startRefreshTimer();
            startSessionTimer();
            // Fetch latest session lifetime
            try {
              const rs = await window.electronAPI.db.reprintSettings.get();
              if (rs.session) localStorage.setItem('pressify_session_lifetime', String(rs.session));
            } catch { /* ignore */ }
          } else {
            // Token invalid, clear session
            localStorage.removeItem('pressify_user');
            window.electronAPI.log('info', 'Stored token invalid, clearing session');
          }
        } else {
          // SSO disabled or no token — trust localStorage (fallback mode)
          setCurrentUser(userData);
        }
      } catch (err) {
        // If we can't reach the API, still allow local session
        window.electronAPI.log('warn', 'Could not validate token on startup', { message: err.message });
        setCurrentUser(userData);
      }

      setLoading(false);
    }

    restoreSession();

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [startRefreshTimer, startSessionTimer]);

  async function login(username, password) {
    const result = await window.electronAPI.auth.login(username, password);
    const userData = result.user;
    setCurrentUser(userData);
    localStorage.setItem('pressify_user', JSON.stringify(userData));

    localStorage.setItem('pressify_login_time', String(Date.now()));

    if (result.sso) {
      setSsoEnabled(true);
      startRefreshTimer();
      startSessionTimer();
      // Fetch session lifetime from server
      try {
        const rs = await window.electronAPI.db.reprintSettings.get();
        if (rs.session) localStorage.setItem('pressify_session_lifetime', String(rs.session));
      } catch { /* ignore */ }
    }

    return userData;
  }

  async function logout() {
    try {
      await window.electronAPI.auth.logout();
    } catch (err) {
      window.electronAPI.log('warn', 'Logout API call failed', { message: err.message });
    }
    clearSession();
  }

  async function openWeb() {
    try {
      await window.electronAPI.auth.openWeb();
    } catch (err) {
      window.electronAPI.log('error', 'Open web failed', { message: err.message });
      throw err;
    }
  }

  const value = { currentUser, loading, ssoEnabled, login, logout, openWeb };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
