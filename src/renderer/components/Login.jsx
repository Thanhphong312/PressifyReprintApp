import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function getErrorMessage(err) {
    const msg = err.message || '';
    if (msg.includes('Rate limited')) return msg;
    if (msg.includes('Cannot connect to server'))
      return 'Cannot connect to server. Please check your network connection.';
    if (msg.includes('Request timed out'))
      return 'Server is not responding. Please try again later.';
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

  return (
    <div className="login-page d-flex align-items-center justify-content-center vh-100">
      <div className="card shadow-lg" style={{ width: '400px' }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <img src={logo} alt="Pressify" style={{ height: '60px' }} className="mb-2" />
            <h3 className="fw-bold text-primary">Pressify Reprint</h3>
            <p className="text-muted">Sign in to your account</p>
          </div>
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
