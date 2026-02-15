import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';

const MENU_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'bi-speedometer2', roles: ['admin'] },
  { path: '/reprints', label: 'Reprints', icon: 'bi-printer', roles: null },
  { path: '/products', label: 'Products', icon: 'bi-box-seam', roles: ['admin'] },
  { path: '/permission', label: 'Permission', icon: 'bi-shield-lock', roles: ['admin'] },
  { path: '/settings', label: 'Settings', icon: 'bi-gear', roles: ['admin'] },
];

export default function Layout() {
  const { currentUser, ssoEnabled, logout, openWeb } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setAppVersion);
      window.electronAPI.onUpdateDownloaded(() => setUpdateAvailable(true));
    }
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handleOpenWeb() {
    try {
      await openWeb();
    } catch {
      // Error already logged in AuthContext
    }
  }

  function handleUpdate() {
    if (window.electronAPI) {
      window.electronAPI.installUpdate();
    }
  }

  const visibleMenu = MENU_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(currentUser?.role)
  );

  return (
    <div className="d-flex vh-100">
      {/* Sidebar */}
      <div className={`sidebar bg-dark text-white d-flex flex-column ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header p-3 border-bottom border-secondary d-flex align-items-center gap-2">
          <img src={logo} alt="Pressify" style={{ height: '28px' }} />
          {!collapsed && <h5 className="mb-0 fw-bold">Pressify</h5>}
        </div>
        <nav className="flex-grow-1 py-2">
          {visibleMenu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                `sidebar-link d-flex align-items-center ${collapsed ? 'justify-content-center' : ''} px-3 py-2 text-decoration-none ${isActive ? 'active' : ''}`
              }
            >
              <i className={`bi ${item.icon}${collapsed ? '' : ' me-2'}`} style={collapsed ? { fontSize: '1.2rem' } : {}}></i>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-top border-secondary">
          <button
            className="btn btn-sm btn-outline-light w-100"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <i className="bi bi-chevron-right"></i> : <><i className="bi bi-chevron-left me-1"></i>Collapse</>}
          </button>
          {appVersion && (
            <div className="text-center mt-2 small text-muted">v{appVersion}</div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">
        {/* Topbar */}
        <div className="topbar bg-white border-bottom px-4 py-2 d-flex align-items-center justify-content-between">
          <div></div>
          <div className="d-flex align-items-center gap-3">
            {updateAvailable && (
              <button className="btn btn-sm btn-success" onClick={handleUpdate}>
                Update Available - Restart
              </button>
            )}
            {ssoEnabled && (
              <button className="btn btn-sm btn-outline-primary" onClick={handleOpenWeb}>
                <i className="bi bi-box-arrow-up-right me-1"></i>Open Web
              </button>
            )}
            <span className="badge bg-secondary">{currentUser?.role}</span>
            <span className="fw-medium">{currentUser?.name}</span>
            <button className="btn btn-sm btn-outline-danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-grow-1 overflow-auto p-4 bg-light">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
