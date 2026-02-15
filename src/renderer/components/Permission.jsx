import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Permission() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState({});
  const [roles, setRoles] = useState({});
  const [reasons, setReasons] = useState({});
  const [orderTypes, setOrderTypes] = useState({});
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [form, setForm] = useState({ email: '', username: '', password: '', first_name: '', last_name: '', role_id: '' });
  const [tab, setTab] = useState('users');
  const [reasonName, setReasonName] = useState('');
  const [editReasonId, setEditReasonId] = useState(null);
  const [orderTypeName, setOrderTypeName] = useState('');
  const [editOrderTypeId, setEditOrderTypeId] = useState(null);

  async function loadData() {
    const [u, ro, r, ot] = await Promise.all([
      window.electronAPI.db.users.getAll(),
      window.electronAPI.db.roles.getAll(),
      window.electronAPI.db.reasons.getAll(),
      window.electronAPI.db.orderTypes.getAll(),
    ]);
    setUsers(u);
    setRoles(ro);
    setReasons(r);
    setOrderTypes(ot);
  }

  useEffect(() => { loadData(); }, []);

  function handleEditUser(id, user) {
    setEditUserId(id);
    setForm({
      email: user.email || '',
      username: user.username || '',
      password: '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role_id: user.role_id || '',
    });
    setShowUserForm(true);
  }

  function handleAddUser() {
    setEditUserId(null);
    setForm({ email: '', username: '', password: '', first_name: '', last_name: '', role_id: '' });
    setShowUserForm(true);
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    const data = {
      email: form.email,
      username: form.username,
      first_name: form.first_name,
      last_name: form.last_name,
      role_id: form.role_id,
    };

    if (editUserId) {
      if (form.password) data.password = form.password;
      await window.electronAPI.db.users.update(editUserId, data);
    } else {
      if (!form.password) {
        alert('Password is required for new users');
        return;
      }
      data.password = form.password;
      await window.electronAPI.db.users.create(data);
    }

    setShowUserForm(false);
    setEditUserId(null);
    await loadData();
  }

  async function handleDeleteUser(id) {
    if (id === currentUser.uid) {
      alert('Cannot delete yourself');
      return;
    }
    if (confirm('Delete this user?')) {
      await window.electronAPI.db.users.delete(id);
      await loadData();
    }
  }

  async function handleSaveReason(e) {
    e.preventDefault();
    if (!reasonName.trim()) return;
    if (editReasonId) {
      await window.electronAPI.db.reasons.update(editReasonId, { name: reasonName.trim() });
    } else {
      await window.electronAPI.db.reasons.create({ name: reasonName.trim() });
    }
    setReasonName('');
    setEditReasonId(null);
    await loadData();
  }

  async function handleDeleteReason(id) {
    if (confirm('Delete this reason?')) {
      await window.electronAPI.db.reasons.delete(id);
      await loadData();
    }
  }

  async function handleSaveOrderType(e) {
    e.preventDefault();
    if (!orderTypeName.trim()) return;
    if (editOrderTypeId) {
      await window.electronAPI.db.orderTypes.update(editOrderTypeId, { name: orderTypeName.trim() });
    } else {
      await window.electronAPI.db.orderTypes.create({ name: orderTypeName.trim() });
    }
    setOrderTypeName('');
    setEditOrderTypeId(null);
    await loadData();
  }

  async function handleDeleteOrderType(id) {
    if (confirm('Delete this order type?')) {
      await window.electronAPI.db.orderTypes.delete(id);
      await loadData();
    }
  }

  return (
    <div>
      <h4 className="mb-3">Permission & Settings</h4>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'reasons' ? 'active' : ''}`} onClick={() => setTab('reasons')}>Reprint Reasons</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'order_types' ? 'active' : ''}`} onClick={() => setTab('order_types')}>Order Types</button>
        </li>
      </ul>

      {tab === 'users' && (
        <div>
          <div className="mb-3">
            <button className="btn btn-primary" onClick={handleAddUser}>+ Add User</button>
          </div>

          <div className="card">
            <table className="table table-hover mb-0">
              <thead className="table-dark">
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(users).map(([id, user]) => (
                  <tr key={id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{user.name}</td>
                    <td><span className="badge bg-secondary">{user.role_name}</span></td>
                    <td className="small">{user.created_at || '-'}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => handleEditUser(id, user)}>Edit</button>
                        <button className="btn btn-outline-danger" onClick={() => handleDeleteUser(id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showUserForm && (
            <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{editUserId ? 'Edit User' : 'Add User'}</h5>
                    <button className="btn-close" onClick={() => setShowUserForm(false)}></button>
                  </div>
                  <form onSubmit={handleSaveUser}>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Username</label>
                        <input type="text" className="form-control" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">
                          Password {editUserId && <span className="text-muted small">(leave blank to keep current)</span>}
                        </label>
                        <input type="password" className="form-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editUserId} />
                      </div>
                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label">First Name</label>
                          <input type="text" className="form-control" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Last Name</label>
                          <input type="text" className="form-control" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Role</label>
                        <select className="form-select" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} required>
                          <option value="">Select role...</option>
                          {Object.entries(roles).map(([id, r]) => (
                            <option key={id} value={id}>{r.display_name || r.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowUserForm(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary">Save</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'reasons' && (
        <div>
          <form onSubmit={handleSaveReason} className="row g-2 mb-3 align-items-center">
            <div className="col-auto">
              <input type="text" className="form-control form-control-sm" placeholder="Reason name" value={reasonName} onChange={(e) => setReasonName(e.target.value)} required />
            </div>
            <div className="col-auto">
              <button type="submit" className="btn btn-sm btn-primary">{editReasonId ? 'Update' : 'Add'}</button>
              {editReasonId && (
                <button type="button" className="btn btn-sm btn-secondary ms-1" onClick={() => { setEditReasonId(null); setReasonName(''); }}>Cancel</button>
              )}
            </div>
          </form>
          <div className="card">
            <table className="table table-sm mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(reasons).map(([id, r]) => (
                  <tr key={id}>
                    <td>{r.name}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => { setEditReasonId(id); setReasonName(r.name); }}>Edit</button>
                        <button className="btn btn-outline-danger" onClick={() => handleDeleteReason(id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {Object.keys(reasons).length === 0 && (
                  <tr><td colSpan="2" className="text-muted text-center">No reasons added</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'order_types' && (
        <div>
          <form onSubmit={handleSaveOrderType} className="row g-2 mb-3 align-items-center">
            <div className="col-auto">
              <input type="text" className="form-control form-control-sm" placeholder="Order type name" value={orderTypeName} onChange={(e) => setOrderTypeName(e.target.value)} required />
            </div>
            <div className="col-auto">
              <button type="submit" className="btn btn-sm btn-primary">{editOrderTypeId ? 'Update' : 'Add'}</button>
              {editOrderTypeId && (
                <button type="button" className="btn btn-sm btn-secondary ms-1" onClick={() => { setEditOrderTypeId(null); setOrderTypeName(''); }}>Cancel</button>
              )}
            </div>
          </form>
          <div className="card">
            <table className="table table-sm mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(orderTypes).map(([id, ot]) => (
                  <tr key={id}>
                    <td>{ot.name}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => { setEditOrderTypeId(id); setOrderTypeName(ot.name); }}>Edit</button>
                        <button className="btn btn-outline-danger" onClick={() => handleDeleteOrderType(id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {Object.keys(orderTypes).length === 0 && (
                  <tr><td colSpan="2" className="text-muted text-center">No order types added</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
