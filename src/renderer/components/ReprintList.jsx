import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Timeline from './Timeline';

const STATUS_LABELS = {
  not_yet: { label: 'Not Yet', class: 'bg-warning text-dark' },
  processing: { label: 'Processing', class: 'bg-info text-dark' },
  completed: { label: 'Completed', class: 'bg-success' },
  printed: { label: 'Printed', class: 'bg-primary' },
};

function extractOrderId(val) {
  const s = val.trim();
  try {
    const url = new URL(s);
    if (url.hostname === 'qr.pressify.us') {
      return url.pathname.replace(/^\//, '');
    }
    if (url.hostname === 'shirt.pressify.us' && url.searchParams.has('search')) {
      return url.searchParams.get('search');
    }
  } catch { /* not a URL */ }
  return s;
}

// ─── Inline editable cell ───

function EditableText({ value, onSave, className, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== (value || '')) onSave(draft);
  }

  if (!editing) {
    return (
      <span className={`editable-cell ${className || ''}`} onClick={() => setEditing(true)} title={value || ''}>
        {value || <span className="text-muted">-</span>}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className="form-control form-control-sm inline-input"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); } }}
    />
  );
}

function EditableSelect({ value, options, onSave, className, displayValue, onAddNew }) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => { if (editing && selectRef.current) selectRef.current.focus(); }, [editing]);

  function commit(newVal) {
    if (newVal === '__add_new__') {
      setEditing(false);
      if (onAddNew) onAddNew();
      return;
    }
    setEditing(false);
    if (newVal !== (value || '')) onSave(newVal);
  }

  if (!editing) {
    return (
      <span className={`editable-cell ${className || ''}`} onClick={() => setEditing(true)}>
        {displayValue || <span className="text-muted">-</span>}
      </span>
    );
  }

  return (
    <select
      ref={selectRef}
      className="form-select form-select-sm inline-input"
      value={value || ''}
      onChange={(e) => commit(e.target.value)}
      onBlur={() => setEditing(false)}
    >
      <option value="">-- Select --</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
      {onAddNew && <option value="__add_new__">+ Add New...</option>}
    </select>
  );
}

function EditableDatetime({ value, onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== (value || '')) onSave(draft);
  }

  if (!editing) {
    return (
      <span className={`editable-cell ${className || ''}`} onClick={() => setEditing(true)}>
        {value ? <span className="small">{value}</span> : <span className="text-muted">-</span>}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="datetime-local"
      className="form-control form-control-sm inline-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); } }}
    />
  );
}

// ─── Main Component ───

export default function ReprintList() {
  const { currentUser } = useAuth();
  const [reprints, setReprints] = useState({});
  const [users, setUsers] = useState({});
  const [reasons, setReasons] = useState({});
  const [productReprints, setProductReprints] = useState({});
  const [colorReprints, setColorReprints] = useState({});
  const [sizeReprints, setSizeReprints] = useState({});
  const [userReprints, setUserReprints] = useState({});
  const [timelineId, setTimelineId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [addNewModal, setAddNewModal] = useState(null); // { type, reprintId }
  const [newItemName, setNewItemName] = useState('');
  const [activeDate, setActiveDate] = useState(() => {
    const now = new Date();
    const chi = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const y = chi.getFullYear();
    const m = String(chi.getMonth() + 1).padStart(2, '0');
    const d = String(chi.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  async function loadData() {
    const [r, u, re, pr, cr, sr, ur] = await Promise.all([
      window.electronAPI.db.reprints.getAll(),
      window.electronAPI.db.users.getAll(),
      window.electronAPI.db.reasons.getAll(),
      window.electronAPI.db.productReprints.getAll(),
      window.electronAPI.db.colorReprints.getAll(),
      window.electronAPI.db.sizeReprints.getAll(),
      window.electronAPI.db.userReprints.getAll(),
    ]);
    setReprints(r);
    setUsers(u);
    setReasons(re);
    setProductReprints(pr);
    setColorReprints(cr);
    setSizeReprints(sr);
    setUserReprints(ur);
  }

  useEffect(() => {
    async function init() {
      const [r, u] = await Promise.all([
        window.electronAPI.db.reprints.getAll(),
        window.electronAPI.db.users.getAll(),
      ]);
      // Only auto-create if no existing reprint has an empty order_id
      const hasBlank = Object.values(r).some((rep) => !rep.order_id);
      if (!hasBlank) {
        const firstSupport = Object.entries(u)
          .filter(([, usr]) => usr.role === 'support')
          .map(([id]) => id)[0] || null;
        const newId = await window.electronAPI.db.reprints.create({
          support_id: firstSupport,
          status: 'not_yet',
        });
        await window.electronAPI.db.timelines.create({
          user_id: currentUser.uid,
          reprint_id: newId,
          note: `Reprint created by ${currentUser.name}`,
        });
      }
      await loadData();
    }
    init();
  }, []);

  // ─── Inline save ───
  const saveField = useCallback(async (id, field, value) => {
    try {
      await window.electronAPI.db.reprints.update(id, { [field]: value || '' });
      await window.electronAPI.db.timelines.create({
        user_id: currentUser.uid,
        reprint_id: id,
        note: `"${field}" updated by ${currentUser.name}`,
      });
      await loadData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  }, [currentUser]);

  const saveStatus = useCallback(async (id, newStatus) => {
    try {
      await window.electronAPI.db.reprints.update(id, { status: newStatus });
      await window.electronAPI.db.timelines.create({
        user_id: currentUser.uid,
        reprint_id: id,
        note: `Status changed to "${newStatus}" by ${currentUser.name}`,
      });
      await loadData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  }, [currentUser]);

  const ADD_NEW_CONFIG = {
    reason: { label: 'Reason', field: 'reason_reprint_id', api: window.electronAPI.db.reasons },
    product: { label: 'Loai Ao', field: 'product_reprint_id', api: window.electronAPI.db.productReprints },
    color: { label: 'Color', field: 'color_reprint_id', api: window.electronAPI.db.colorReprints },
    size: { label: 'Size', field: 'size_reprint_id', api: window.electronAPI.db.sizeReprints },
    userReprint: { label: 'User', field: null, api: window.electronAPI.db.userReprints },
  };

  const confirmAddNew = useCallback(async () => {
    if (!newItemName.trim() || !addNewModal) return;
    const { type, reprintId, field: modalField } = addNewModal;
    const cfg = ADD_NEW_CONFIG[type];
    try {
      const createData = { name: newItemName.trim() };
      if (type === 'userReprint' && modalField === 'user_error_id') createData.type = 1;
      if (type === 'userReprint' && modalField === 'user_note') createData.type = 2;
      const res = await cfg.api.create(createData);
      const newId = res.id || res;
      const updateField = modalField || cfg.field;
      if (reprintId && updateField) {
        await window.electronAPI.db.reprints.update(reprintId, { [updateField]: newId });
        await window.electronAPI.db.timelines.create({
          user_id: currentUser.uid,
          reprint_id: reprintId,
          note: `"${updateField}" updated by ${currentUser.name}`,
        });
      }
      await loadData();
    } catch (err) {
      window.electronAPI.log('error', `Error creating ${type}`, { message: err.message });
    }
    setAddNewModal(null);
    setNewItemName('');
  }, [currentUser, addNewModal, newItemName]);

  function getModalItems() {
    if (!addNewModal) return [];
    const { type, field } = addNewModal;
    switch (type) {
      case 'reason': return Object.entries(reasons);
      case 'product': return Object.entries(productReprints);
      case 'color': return Object.entries(colorReprints);
      case 'size': return Object.entries(sizeReprints);
      case 'userReprint':
        return Object.entries(userReprints).filter(([, u]) => field === 'user_error_id' ? u.type === 1 : u.type === 2);
      default: return [];
    }
  }

  const deleteModalItem = useCallback(async (itemId) => {
    if (!addNewModal) return;
    const cfg = ADD_NEW_CONFIG[addNewModal.type];
    try {
      await cfg.api.delete(itemId);
      await loadData();
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  }, [addNewModal]);

  async function handleAdd() {
    const firstSupport = supportUserOpts[0]?.value || null;
    try {
      const newId = await window.electronAPI.db.reprints.create({
        support_id: firstSupport,
        status: 'not_yet',
      });
      await window.electronAPI.db.timelines.create({
        user_id: currentUser.uid,
        reprint_id: newId,
        note: `Reprint created by ${currentUser.name}`,
      });
      await loadData();
    } catch (err) {
      alert('Error creating reprint: ' + err.message);
    }
  }

  async function handleDelete(id) {
    if (confirm('Are you sure you want to delete this reprint?')) {
      await window.electronAPI.db.reprints.delete(id);
      await loadData();
    }
  }

  // ─── Filter + sort ───
  const reprintList = Object.entries(reprints)
    .map(([id, data]) => ({ id, ...data }))
    .filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const orderMatch = (r.order_id || '').toLowerCase().includes(term);
        const noteMatch = (r.note || '').toLowerCase().includes(term);
        const supportName = (users[r.support_id]?.name || '').toLowerCase().includes(term);
        return orderMatch || noteMatch || supportName;
      }
      return true;
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  // ─── Group by date (created_at is already America/Chicago from API) ───
  function getDateKey(ts) {
    if (!ts) return '0000-00-00';
    return ts.substring(0, 10); // "YYYY-MM-DD" from "YYYY-MM-DD HH:mm:ss"
  }

  function getDateLabel(dateKey) {
    if (dateKey === '0000-00-00') return 'No Date';
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  const dateCounts = {};
  reprintList.forEach((r) => {
    const key = getDateKey(r.created_at);
    dateCounts[key] = (dateCounts[key] || 0) + 1;
  });

  const dateTabs = Object.keys(dateCounts).sort((a, b) => b.localeCompare(a));

  const filteredByDate = activeDate
    ? reprintList.filter((r) => getDateKey(r.created_at) === activeDate)
    : reprintList;

  // ─── Lookup helpers ───
  const supportUserOpts = Object.entries(users)
    .filter(([, u]) => u.role === 'support')
    .map(([id, u]) => ({ value: id, label: u.name }));

  const errorUserOpts = Object.entries(userReprints)
    .filter(([, u]) => u.type === 1)
    .map(([id, u]) => ({ value: id, label: u.name }));

  const noteUserOpts = Object.entries(userReprints)
    .filter(([, u]) => u.type === 2)
    .map(([id, u]) => ({ value: id, label: u.name }));

  const reasonOpts = Object.entries(reasons)
    .map(([id, r]) => ({ value: id, label: r.name }));

  const statusOpts = [
    { value: 'not_yet', label: 'Not Yet' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'printed', label: 'Printed' },
  ];

  const productOpts = Object.entries(productReprints)
    .map(([id, p]) => ({ value: id, label: p.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const colorOpts = Object.entries(colorReprints)
    .map(([id, c]) => ({ value: id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const sizeOpts = Object.entries(sizeReprints)
    .map(([id, s]) => ({ value: id, label: s.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Reprints</h4>
        <button className="btn btn-primary" onClick={handleAdd}>+ Add Reprint</button>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-center">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search order ID, note, support..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="not_yet">Not Yet</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="printed">Printed</option>
              </select>
            </div>
            <div className="col-md-2">
              <span className="text-muted small">{filteredByDate.length} records</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Date tabs ── */}
      <div className="mb-3 d-flex flex-wrap gap-1 align-items-center">
        <button
          className={`btn btn-sm ${!activeDate ? 'btn-dark' : 'btn-outline-secondary'}`}
          onClick={() => setActiveDate('')}
        >
          All ({reprintList.length})
        </button>
        {dateTabs.map((dk) => (
          <button
            key={dk}
            className={`btn btn-sm ${activeDate === dk ? 'btn-dark' : 'btn-outline-secondary'}`}
            onClick={() => setActiveDate(dk)}
          >
            {getDateLabel(dk)} ({dateCounts[dk]})
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover table-sm table-bordered reprint-table mb-0">
            <thead className="table-dark">
              <tr>
                <th rowSpan="2" className="align-middle text-center col-fixed-xs">#</th>
                <th colSpan="3" className="text-center col-group-order">Order</th>
                <th colSpan="6" className="text-center col-group-product">Product</th>
                <th colSpan="3" className="text-center col-group-error">Error</th>
                <th colSpan="2" className="text-center col-group-status">Status</th>
                <th rowSpan="2" className="align-middle text-center">Actions</th>
              </tr>
              <tr>
                <th className="col-group-order">Support Name</th>
                <th className="col-group-order">Order ID</th>
                <th className="col-group-order">Li do Reprint</th>
                <th className="col-group-product">NOTE (TEAM GANGSHEET NOTE LÊN ĐỂ IN)</th>
                <th className="col-group-product">Loai Ao</th>
                <th className="col-group-product">Size</th>
                <th className="col-group-product">Color</th>
                <th className="col-group-product">Hang Ao</th>
                <th className="col-group-product">Machine #</th>
                <th className="col-group-error">Ly Do Loi</th>
                <th className="col-group-error">Ai Lam Sai</th>
                <th className="col-group-error">Note</th>
                <th className="col-group-status">Status (Gangsheet)</th>
                <th className="col-group-status">Finished Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredByDate.length === 0 ? (
                <tr>
                  <td colSpan="16" className="text-center text-muted py-4">No reprints found</td>
                </tr>
              ) : (
                filteredByDate.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="text-center text-muted">{idx + 1}</td>

                    {/* ── Order ── */}
                    <td className="cell-order">
                      <EditableSelect
                        value={r.support_id}
                        options={supportUserOpts}
                        displayValue={users[r.support_id]?.name}
                        onSave={(v) => saveField(r.id, 'support_id', v)}
                      />
                    </td>
                    <td className="cell-order">
                      <EditableText
                        value={r.order_id}
                        className="fw-semibold"
                        placeholder="Order ID"
                        onSave={(v) => saveField(r.id, 'order_id', extractOrderId(v))}
                      />
                    </td>
                    <td className="cell-order">
                      <EditableSelect
                        value={r.reason_reprint_id}
                        options={reasonOpts}
                        displayValue={reasons[r.reason_reprint_id]?.name}
                        onSave={(v) => saveField(r.id, 'reason_reprint_id', v)}
                        onAddNew={() => { setAddNewModal({ type: 'reason', reprintId: r.id }); setNewItemName(''); }}
                      />
                    </td>

                    {/* ── Product ── */}
                    <td className="cell-product">
                      <EditableText value={r.note} placeholder="Note" onSave={(v) => saveField(r.id, 'note', v)} />
                    </td>
                    <td className="cell-product">
                      <EditableSelect
                        value={r.product_reprint_id}
                        options={productOpts}
                        displayValue={productReprints[r.product_reprint_id]?.name}
                        onSave={(v) => saveField(r.id, 'product_reprint_id', v)}
                        onAddNew={() => { setAddNewModal({ type: 'product', reprintId: r.id }); setNewItemName(''); }}
                      />
                    </td>
                    <td className="cell-product">
                      <EditableSelect
                        value={r.size_reprint_id}
                        options={sizeOpts}
                        displayValue={sizeReprints[r.size_reprint_id]?.name}
                        onSave={(v) => saveField(r.id, 'size_reprint_id', v)}
                        onAddNew={() => { setAddNewModal({ type: 'size', reprintId: r.id }); setNewItemName(''); }}
                      />
                    </td>
                    <td className="cell-product">
                      <EditableSelect
                        value={r.color_reprint_id}
                        options={colorOpts}
                        displayValue={colorReprints[r.color_reprint_id]?.name}
                        onSave={(v) => saveField(r.id, 'color_reprint_id', v)}
                        onAddNew={() => { setAddNewModal({ type: 'color', reprintId: r.id }); setNewItemName(''); }}
                      />
                    </td>
                    <td className="cell-product">
                      <EditableText value={r.brand} placeholder="Hang ao" onSave={(v) => saveField(r.id, 'brand', v)} />
                    </td>
                    <td className="cell-product">
                      <EditableText value={r.machine_number} placeholder="Machine #" onSave={(v) => saveField(r.id, 'machine_number', v)} />
                    </td>

                    {/* ── Error ── */}
                    <td className="cell-error">
                      <EditableText value={r.reason_error} placeholder="Ly do loi" onSave={(v) => saveField(r.id, 'reason_error', v)} />
                    </td>
                    <td className="cell-error">
                      <EditableSelect
                        value={r.user_error_id}
                        options={errorUserOpts}
                        displayValue={userReprints[r.user_error_id]?.name}
                        onSave={(v) => saveField(r.id, 'user_error_id', v)}
                        onAddNew={() => { setAddNewModal({ type: 'userReprint', reprintId: r.id, field: 'user_error_id' }); setNewItemName(''); }}
                      />
                    </td>
                    <td className="cell-error">
                      <EditableSelect
                        value={r.user_note}
                        options={noteUserOpts}
                        displayValue={userReprints[r.user_note]?.name}
                        onSave={(v) => saveField(r.id, 'user_note', v)}
                        onAddNew={() => { setAddNewModal({ type: 'userReprint', reprintId: r.id, field: 'user_note' }); setNewItemName(''); }}
                      />
                    </td>

                    {/* ── Status ── */}
                    <td className="cell-status">
                      <EditableSelect
                        value={r.status}
                        options={statusOpts}
                        displayValue={
                          <span className={`badge ${(STATUS_LABELS[r.status] || STATUS_LABELS.not_yet).class}`}>
                            {(STATUS_LABELS[r.status] || STATUS_LABELS.not_yet).label}
                          </span>
                        }
                        onSave={(v) => saveStatus(r.id, v)}
                      />
                    </td>
                    <td className="cell-status">
                      <EditableDatetime
                        value={r.finished_date}
                        onSave={(v) => saveField(r.id, 'finished_date', v)}
                      />
                    </td>

                    {/* ── Actions ── */}
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-info btn-sm px-2" onClick={() => setTimelineId(r.id)} title="Timeline">Log</button>
                        {currentUser?.role === 'admin' && (
                          <button className="btn btn-outline-danger btn-sm px-2" onClick={() => handleDelete(r.id)} title="Delete">Del</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {timelineId && <Timeline reprintId={timelineId} onClose={() => setTimelineId(null)} />}

      {addNewModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title">{ADD_NEW_CONFIG[addNewModal.type]?.label}</h6>
                <button className="btn-close" onClick={() => setAddNewModal(null)}></button>
              </div>
              <div className="modal-body py-2">
                {getModalItems().length > 0 && (
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }} className="mb-2">
                    {getModalItems().map(([id, item]) => (
                      <div key={id} className="d-flex justify-content-between align-items-center py-1 px-1 border-bottom">
                        <span className="small">{item.name}</span>
                        <button className="btn btn-sm btn-outline-danger py-0 px-1 ms-2" style={{ fontSize: '0.7rem', lineHeight: 1 }} onClick={() => deleteModalItem(id)} title="Delete">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Add new..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmAddNew(); }}
                    autoFocus
                  />
                  <button className="btn btn-primary" onClick={confirmAddNew} disabled={!newItemName.trim()}>Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
