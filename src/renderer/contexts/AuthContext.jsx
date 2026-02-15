import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AuthContext = createContext(null);

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const refreshTimerRef = useRef(null);

  const clearSession = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('pressify_user');
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
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
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [startRefreshTimer]);

  async function login(username, password) {
    const result = await window.electronAPI.auth.login(username, password);
    const userData = result.user;
    setCurrentUser(userData);
    localStorage.setItem('pressify_user', JSON.stringify(userData));

    if (result.sso) {
      setSsoEnabled(true);
      startRefreshTimer();
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
