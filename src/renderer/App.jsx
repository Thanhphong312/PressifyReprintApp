import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ReprintList from './components/ReprintList';
import ProductList from './components/ProductList';
import Permission from './components/Permission';

function PrivateRoute({ children, roles }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" />;
  if (roles && !roles.includes(currentUser.role)) {
    return <Navigate to="/reprints" />;
  }
  return children;
}

function AppRoutes() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={currentUser ? <Navigate to="/reprints" /> : <Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/reprints" />} />
          <Route
            path="dashboard"
            element={
              <PrivateRoute roles={['admin']}>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route path="reprints" element={<ReprintList />} />
          <Route
            path="products"
            element={
              <PrivateRoute roles={['admin']}>
                <ProductList />
              </PrivateRoute>
            }
          />
          <Route
            path="permission"
            element={
              <PrivateRoute roles={['admin']}>
                <Permission />
              </PrivateRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/reprints" />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
