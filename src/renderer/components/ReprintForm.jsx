import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const STATUS_OPTIONS = [
  { value: 'not_yet', label: 'Not Yet' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'printed', label: 'Printed' },
];

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
  } catch { /* not a URL, return as-is */ }
  return s;
}

const EMPTY_FORM = {
  support_id: '',
  order_id: '',
  link_id: '',
  reason_reprint_id: '',
  order_type_id: '',
  note: '',
  product_reprint_id: '',
  color_reprint_id: '',
  size_reprint_id: '',
  brand: '',
  machine_number: '',
  user_error_id: '',
  reason_error: '',
  user_note: '',
  status: 'not_yet',
  finished_date: '',
};

export default function ReprintForm({ editData, onClose }) {
  const { currentUser } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [users, setUsers] = useState({});
  const [reasons, setReasons] = useState({});
  const [orderTypes, setOrderTypes] = useState({});
  const [productReprints, setProductReprints] = useState({});
  const [colorReprints, setColorReprints] = useState({});
  const [sizeReprints, setSizeReprints] = useState({});
  const [saving, setSaving] = useState(false);
  const [addNewField, setAddNewField] = useState(null); // 'reason' | 'product' | 'color' | 'size'
  const [newItemName, setNewItemName] = useState('');

  useEffect(() => {
    async function load() {
      const [u, r, ot, pr, cr, sr] = await Promise.all([
        window.electronAPI.db.users.getAll(),
        window.electronAPI.db.reasons.getAll(),
        window.electronAPI.db.orderTypes.getAll(),
        window.electronAPI.db.productReprints.getAll(),
        window.electronAPI.db.colorReprints.getAll(),
        window.electronAPI.db.sizeReprints.getAll(),
      ]);
      setUsers(u);
      setReasons(r);
      setOrderTypes(ot);
      setProductReprints(pr);
      setColorReprints(cr);
      setSizeReprints(sr);
    }
    load();
  }, []);

  useEffect(() => {
    if (editData) {
      setForm({
        ...EMPTY_FORM,
        ...editData,
      });
    }
  }, [editData]);

  const supportUsers = Object.entries(users).filter(([, u]) => u.role === 'support');
  const errorUsers = Object.entries(users).filter(([, u]) => u.role === 'presser');
  const noteUsers = Object.entries(users).filter(([, u]) => ['cuter', 'picker'].includes(u.role));

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const ADD_CFG = {
    reason: { field: 'reason_reprint_id', api: window.electronAPI.db.reasons, setter: setReasons },
    product: { field: 'product_reprint_id', api: window.electronAPI.db.productReprints, setter: setProductReprints },
    color: { field: 'color_reprint_id', api: window.electronAPI.db.colorReprints, setter: setColorReprints },
    size: { field: 'size_reprint_id', api: window.electronAPI.db.sizeReprints, setter: setSizeReprints },
  };

  async function confirmAddNew() {
    if (!newItemName.trim() || !addNewField) return;
    const cfg = ADD_CFG[addNewField];
    try {
      const res = await cfg.api.create({ name: newItemName.trim() });
      const updated = await cfg.api.getAll();
      cfg.setter(updated);
      setForm((prev) => ({ ...prev, [cfg.field]: res.id || res }));
    } catch (err) {
      window.electronAPI.log('error', `Error creating ${addNewField}`, { message: err.message });
    }
    setAddNewField(null);
    setNewItemName('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { id, ...data } = form;

      if (editData?.id) {
        await window.electronAPI.db.reprints.update(editData.id, data);
        await window.electronAPI.db.timelines.create({
          user_id: currentUser.uid,
          reprint_id: editData.id,
          note: `Reprint updated by ${currentUser.name}`,
        });
      } else {
        const newId = await window.electronAPI.db.reprints.create(data);
        await window.electronAPI.db.timelines.create({
          user_id: currentUser.uid,
          reprint_id: newId,
          note: `Reprint created by ${currentUser.name}`,
        });
      }
      onClose(true);
    } catch (err) {
      alert('Error saving reprint: ' + err.message);
    }
    setSaving(false);
  }

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{editData?.id ? 'Edit Reprint' : 'Add Reprint'}</h5>
            <button className="btn-close" onClick={() => onClose(false)}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Support Name</label>
                  <select className="form-select" value={form.support_id} onChange={(e) => handleChange('support_id', e.target.value)} required>
                    <option value="">Select support...</option>
                    {supportUsers.map(([id, u]) => (
                      <option key={id} value={id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Order ID</label>
                  <input type="text" className="form-control" value={form.order_id} onChange={(e) => handleChange('order_id', extractOrderId(e.target.value))} placeholder="Order ID or paste URL" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Link ID</label>
                  <input type="text" className="form-control" value={form.link_id} onChange={(e) => handleChange('link_id', e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Reason Reprint</label>
                  {addNewField === 'reason' ? (
                    <div className="input-group">
                      <input type="text" className="form-control" placeholder="New reason name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAddNew(); } }} autoFocus />
                      <button type="button" className="btn btn-success" onClick={confirmAddNew} disabled={!newItemName.trim()}>OK</button>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setAddNewField(null)}>X</button>
                    </div>
                  ) : (
                    <div className="input-group">
                      <select className="form-select" value={form.reason_reprint_id} onChange={(e) => handleChange('reason_reprint_id', e.target.value)} required>
                        <option value="">Select reason...</option>
                        {Object.entries(reasons).map(([id, r]) => (<option key={id} value={id}>{r.name}</option>))}
                      </select>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => { setAddNewField('reason'); setNewItemName(''); }}>+</button>
                    </div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Order Type</label>
                  <select className="form-select" value={form.order_type_id} onChange={(e) => handleChange('order_type_id', e.target.value)}>
                    <option value="">Select order type...</option>
                    {Object.entries(orderTypes).map(([id, ot]) => (
                      <option key={id} value={id}>{ot.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Note</label>
                  <input type="text" className="form-control" value={form.note} onChange={(e) => handleChange('note', e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Product</label>
                  {addNewField === 'product' ? (
                    <div className="input-group">
                      <input type="text" className="form-control" placeholder="New product name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAddNew(); } }} autoFocus />
                      <button type="button" className="btn btn-success" onClick={confirmAddNew} disabled={!newItemName.trim()}>OK</button>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setAddNewField(null)}>X</button>
                    </div>
                  ) : (
                    <div className="input-group">
                      <select className="form-select" value={form.product_reprint_id} onChange={(e) => handleChange('product_reprint_id', e.target.value)} required>
                        <option value="">Select product...</option>
                        {Object.entries(productReprints).map(([id, p]) => (<option key={id} value={id}>{p.name}</option>))}
                      </select>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => { setAddNewField('product'); setNewItemName(''); }}>+</button>
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="form-label">Color</label>
                  {addNewField === 'color' ? (
                    <div className="input-group">
                      <input type="text" className="form-control" placeholder="New color name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAddNew(); } }} autoFocus />
                      <button type="button" className="btn btn-success" onClick={confirmAddNew} disabled={!newItemName.trim()}>OK</button>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setAddNewField(null)}>X</button>
                    </div>
                  ) : (
                    <div className="input-group">
                      <select className="form-select" value={form.color_reprint_id} onChange={(e) => handleChange('color_reprint_id', e.target.value)}>
                        <option value="">Select color...</option>
                        {Object.entries(colorReprints).map(([id, c]) => (<option key={id} value={id}>{c.name}</option>))}
                      </select>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => { setAddNewField('color'); setNewItemName(''); }}>+</button>
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="form-label">Size</label>
                  {addNewField === 'size' ? (
                    <div className="input-group">
                      <input type="text" className="form-control" placeholder="New size name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAddNew(); } }} autoFocus />
                      <button type="button" className="btn btn-success" onClick={confirmAddNew} disabled={!newItemName.trim()}>OK</button>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setAddNewField(null)}>X</button>
                    </div>
                  ) : (
                    <div className="input-group">
                      <select className="form-select" value={form.size_reprint_id} onChange={(e) => handleChange('size_reprint_id', e.target.value)}>
                        <option value="">Select size...</option>
                        {Object.entries(sizeReprints).map(([id, s]) => (<option key={id} value={id}>{s.name}</option>))}
                      </select>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => { setAddNewField('size'); setNewItemName(''); }}>+</button>
                    </div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Brand</label>
                  <input type="text" className="form-control" value={form.brand} onChange={(e) => handleChange('brand', e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Machine #</label>
                  <input type="text" className="form-control" value={form.machine_number} onChange={(e) => handleChange('machine_number', e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">User Error</label>
                  <select className="form-select" value={form.user_error_id} onChange={(e) => handleChange('user_error_id', e.target.value)}>
                    <option value="">Select user...</option>
                    {errorUsers.map(([id, u]) => (
                      <option key={id} value={id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Reason Error</label>
                  <input type="text" className="form-control" value={form.reason_error} onChange={(e) => handleChange('reason_error', e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Note (Picker/Cuter)</label>
                  <select className="form-select" value={form.user_note} onChange={(e) => handleChange('user_note', e.target.value)}>
                    <option value="">Select user...</option>
                    {noteUsers.map(([id, u]) => (
                      <option key={id} value={id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={(e) => handleChange('status', e.target.value)} required>
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Finished Date</label>
                  <input type="datetime-local" className="form-control" value={form.finished_date} onChange={(e) => handleChange('finished_date', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
