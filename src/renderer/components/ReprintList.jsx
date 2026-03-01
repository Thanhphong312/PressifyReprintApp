import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
    const host = url.hostname.replace(/ú/g, 'u');
    if (host === 'qr.pressify.us') {
      return url.pathname.replace(/^\//, '');
    }
    if (host === 'shirt.pressify.us') {
      if (url.searchParams.has('search')) return url.searchParams.get('search');
      return url.pathname.replace(/^\//, '');
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
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setEditing(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editing]);

  function commit(newVal) {
    if (newVal === '__add_new__') {
      setEditing(false);
      setSearch('');
      if (onAddNew) onAddNew();
      return;
    }
    setEditing(false);
    setSearch('');
    if (newVal !== (value || '')) onSave(newVal);
  }

  if (!editing) {
    return (
      <span className={`editable-cell ${className || ''}`} onClick={() => setEditing(true)}>
        {displayValue || <span className="text-muted">-</span>}
      </span>
    );
  }

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: '150px' }}>
      <input
        ref={inputRef}
        type="text"
        className="form-control form-control-sm inline-input"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setEditing(false); setSearch(''); }
        }}
      />
      <div className="dropdown-search-list" style={{
        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
        maxHeight: '180px', overflowY: 'auto', backgroundColor: '#fff',
        border: '1px solid #dee2e6', borderRadius: '0 0 4px 4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <div className="dropdown-search-item px-2 py-1 text-muted" style={{ cursor: 'pointer', fontSize: '0.8rem' }}
          onMouseDown={() => commit('')}>-- Clear --</div>
        {filtered.map((o) => (
          <div key={o.value}
            className="dropdown-search-item px-2 py-1"
            style={{ cursor: 'pointer', fontSize: '0.8rem', backgroundColor: o.value === value ? '#e8f0fe' : '' }}
            onMouseDown={() => commit(o.value)}
          >{o.label}</div>
        ))}
        {filtered.length === 0 && <div className="px-2 py-1 text-muted" style={{ fontSize: '0.8rem' }}>No match</div>}
        {onAddNew && (
          <div className="dropdown-search-item px-2 py-1 text-primary fw-bold" style={{ cursor: 'pointer', fontSize: '0.8rem', borderTop: '1px solid #dee2e6' }}
            onMouseDown={() => commit('__add_new__')}>+ Add New...</div>
        )}
      </div>
    </div>
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
  const { typeId } = useParams();
  const [reprints, setReprints] = useState({});
  const [users, setUsers] = useState({});
  const [reasons, setReasons] = useState({});
  const [productReprints, setProductReprints] = useState({});
  const [colorReprints, setColorReprints] = useState({});
  const [sizeReprints, setSizeReprints] = useState({});
  const [userReprints, setUserReprints] = useState({});
  const [reasonErrors, setReasonErrors] = useState({});
  const [reprintTypes, setReprintTypes] = useState({});
  const [timelineId, setTimelineId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [addNewModal, setAddNewModal] = useState(null); // { type, reprintId }
  const [copyMsg, setCopyMsg] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [dragFill, setDragFill] = useState(null); // { field, value, sourceIdx }
  const [dragFillEnd, setDragFillEnd] = useState(null);
  const [filledIds, setFilledIds] = useState(new Set()); // IDs just filled
  const [activeDate, setActiveDate] = useState(() => {
    const now = new Date();
    const chi = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const y = chi.getFullYear();
    const m = String(chi.getMonth() + 1).padStart(2, '0');
    const d = String(chi.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const loadingRef = useRef(false);
  const dragFillRef = useRef(null);
  const dragFillEndRef = useRef(null);

  async function loadData() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [r, u, re, pr, cr, sr, ur, rErr, rt] = await Promise.all([
        window.electronAPI.db.reprints.getAll(),
        window.electronAPI.db.users.getAll(),
        window.electronAPI.db.reasons.getAll(),
        window.electronAPI.db.productReprints.getAll(),
        window.electronAPI.db.colorReprints.getAll(),
        window.electronAPI.db.sizeReprints.getAll(),
        window.electronAPI.db.userReprints.getAll(),
        window.electronAPI.db.reasonErrors.getAll(),
        window.electronAPI.db.reprintTypes.getAll(),
      ]);
      setReprints(r);
      setUsers(u);
      setReasons(re);
      setProductReprints(pr);
      setColorReprints(cr);
      setSizeReprints(sr);
      setUserReprints(ur);
      setReasonErrors(rErr);
      setReprintTypes(rt);
    } catch {
      // Silently ignore polling errors
    } finally {
      loadingRef.current = false;
    }
  }

  // ─── Polling every 30s (only when window is focused) + reload on refocus ───
  useEffect(() => {
    let intervalId = null;

    function startPolling() {
      if (intervalId) return;
      intervalId = setInterval(() => { loadData(); }, 30000);
    }

    function stopPolling() {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    }

    function handleFocus() {
      loadData();
      startPolling();
    }

    function handleBlur() {
      stopPolling();
    }

    if (document.hasFocus()) startPolling();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      stopPolling();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [typeId]);

  // Reset selection when switching type
  useEffect(() => {
    setSelectedIds(new Set());
  }, [typeId]);

  useEffect(() => {
    async function init() {
      const [r, u] = await Promise.all([
        window.electronAPI.db.reprints.getAll(),
        window.electronAPI.db.users.getAll(),
      ]);
      // Filter reprints for the current type
      const currentTypeId = typeId || null;
      const typeReprints = Object.values(r).filter((rep) =>
        currentTypeId ? String(rep.reprint_type_id) === String(currentTypeId) : !rep.reprint_type_id
      );
      // Only auto-create if no existing reprint of this type has an empty order_id
      const hasBlank = typeReprints.some((rep) => !rep.order_id);
      if (!hasBlank) {
        const firstSupport = Object.entries(u)
          .filter(([, usr]) => usr.role === 'support')
          .map(([id]) => id)[0] || null;
        const createData = {
          support_id: firstSupport,
          status: 'not_yet',
        };
        if (currentTypeId) createData.reprint_type_id = currentTypeId;
        const newId = await window.electronAPI.db.reprints.create(createData);
        await window.electronAPI.db.timelines.create({
          user_id: currentUser.uid,
          reprint_id: newId,
          note: `Reprint created by ${currentUser.name}`,
        });
      }
      await loadData();
    }
    init();
  }, [typeId]);

  function getChicagoNow() {
    const now = new Date();
    const chi = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const y = chi.getFullYear();
    const mo = String(chi.getMonth() + 1).padStart(2, '0');
    const d = String(chi.getDate()).padStart(2, '0');
    const h = String(chi.getHours()).padStart(2, '0');
    const mi = String(chi.getMinutes()).padStart(2, '0');
    const s = String(chi.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }

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
      const updateData = { status: newStatus };
      if (newStatus === 'completed') {
        updateData.finished_date = getChicagoNow();
      }
      await window.electronAPI.db.reprints.update(id, updateData);
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

  // ─── Drag fill (spreadsheet-style) ───
  function startDragFill(e, field, value, sourceIdx) {
    e.preventDefault();
    e.stopPropagation();
    const state = { field, value, sourceIdx };
    dragFillRef.current = state;
    dragFillEndRef.current = sourceIdx;
    setDragFill(state);
    setDragFillEnd(sourceIdx);
    document.body.classList.add('drag-filling');

    function onMouseMove(ev) {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const tr = el?.closest('tr[data-row-idx]');
      if (tr) {
        const idx = Number(tr.dataset.rowIdx);
        dragFillEndRef.current = idx;
        setDragFillEnd(idx);
      }
    }

    function onMouseUp() {
      const df = dragFillRef.current;
      const endIdx = dragFillEndRef.current;
      if (df && endIdx !== null && endIdx !== df.sourceIdx) {
        applyDragFill(df.field, df.value, df.sourceIdx, endIdx);
      }
      dragFillRef.current = null;
      dragFillEndRef.current = null;
      setDragFill(null);
      setDragFillEnd(null);
      document.body.classList.remove('drag-filling');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  async function applyDragFill(field, value, sourceIdx, endIdx) {
    const from = Math.min(sourceIdx, endIdx);
    const to = Math.max(sourceIdx, endIdx);
    const ids = new Set();
    try {
      for (let i = from; i <= to; i++) {
        if (i === sourceIdx) continue;
        const r = filteredByDate[i];
        if (!r) continue;
        ids.add(r.id);
        await window.electronAPI.db.reprints.update(r.id, { [field]: value || '' });
        await window.electronAPI.db.timelines.create({
          user_id: currentUser.uid,
          reprint_id: r.id,
          note: `"${field}" updated by ${currentUser.name}`,
        });
      }
      await loadData();
      setFilledIds(ids);
      setTimeout(() => setFilledIds(new Set()), 3000);
    } catch (err) {
      alert('Error updating: ' + err.message);
    }
  }

  function isInDragFillRange(idx) {
    if (!dragFill || dragFillEnd === null) return false;
    const from = Math.min(dragFill.sourceIdx, dragFillEnd);
    const to = Math.max(dragFill.sourceIdx, dragFillEnd);
    return idx >= from && idx <= to && idx !== dragFill.sourceIdx;
  }

  const ADD_NEW_CONFIG = {
    reason: { label: 'Reason', field: 'reason_reprint_id', api: window.electronAPI.db.reasons },
    product: { label: 'Loai Ao', field: 'product_reprint_id', api: window.electronAPI.db.productReprints },
    color: { label: 'Color', field: 'color_reprint_id', api: window.electronAPI.db.colorReprints },
    size: { label: 'Size', field: 'size_reprint_id', api: window.electronAPI.db.sizeReprints },
    userReprint: { label: 'User', field: null, api: window.electronAPI.db.userReprints },
    reasonError: { label: 'Ly Do Loi', field: 'reason_error_id', api: window.electronAPI.db.reasonErrors },
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
      case 'reasonError': return Object.entries(reasonErrors);
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
      const createData = {
        support_id: firstSupport,
        status: 'not_yet',
      };
      if (typeId) createData.reprint_type_id = typeId;
      const newId = await window.electronAPI.db.reprints.create(createData);
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

  async function handleProcessingSelected() {
    if (selectedIds.size === 0) return;
    try {
      for (const id of selectedIds) {
        await window.electronAPI.db.reprints.update(id, { status: 'processing' });
        await window.electronAPI.db.timelines.create({
          user_id: currentUser.uid,
          reprint_id: id,
          note: `Status changed to "processing" by ${currentUser.name}`,
        });
      }
      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      alert('Error updating reprints: ' + err.message);
    }
  }

  async function handleCompleteSelected() {
    if (selectedIds.size === 0) return;
    const finishedDate = getChicagoNow();
    try {
      for (const id of selectedIds) {
        await window.electronAPI.db.reprints.update(id, { status: 'completed', finished_date: finishedDate });
        await window.electronAPI.db.timelines.create({
          user_id: currentUser.uid,
          reprint_id: id,
          note: `Status changed to "completed" by ${currentUser.name}`,
        });
      }
      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      alert('Error completing reprints: ' + err.message);
    }
  }

  const lastSelectedRef = useRef(null);

  function toggleSelect(id, shiftKey) {
    if (shiftKey && lastSelectedRef.current && lastSelectedRef.current !== id) {
      // Shift+click: select range between last clicked and current
      const ids = filteredByDate.map((r) => r.id);
      const startIdx = ids.indexOf(lastSelectedRef.current);
      const endIdx = ids.indexOf(id);
      if (startIdx !== -1 && endIdx !== -1) {
        const from = Math.min(startIdx, endIdx);
        const to = Math.max(startIdx, endIdx);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = from; i <= to; i++) next.add(ids[i]);
          return next;
        });
        lastSelectedRef.current = id;
        return;
      }
    }
    lastSelectedRef.current = id;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─── Filter + sort ───
  const currentTypeName = typeId ? (reprintTypes[typeId]?.name || 'Reprints') : 'Reprints';

  const reprintList = Object.entries(reprints)
    .map(([id, data]) => ({ id, ...data }))
    .filter((r) => {
      // Filter by reprint type
      if (typeId) {
        if (String(r.reprint_type_id) !== String(typeId)) return false;
      } else {
        if (r.reprint_type_id) return false;
      }
      if (statusFilter && r.status !== statusFilter) return false;
      if (dateFrom) {
        const created = (r.created_at || '').substring(0, 10);
        if (created < dateFrom) return false;
      }
      if (dateTo) {
        const created = (r.created_at || '').substring(0, 10);
        if (created > dateTo) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const orderMatch = (r.order_id || '').toLowerCase().includes(term);
        const noteMatch = (r.note || '').toLowerCase().includes(term);
        const supportName = (users[r.support_id]?.name || '').toLowerCase().includes(term);
        return orderMatch || noteMatch || supportName;
      }
      return true;
    })
    .sort((a, b) => Number(a.id) - Number(b.id));

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
  const sortById = (a, b) => Number(a.value) - Number(b.value);

  const supportUserOpts = Object.entries(users)
    .filter(([, u]) => u.role === 'support')
    .map(([id, u]) => ({ value: id, label: u.name }))
    .sort(sortById);

  const errorUserOpts = Object.entries(userReprints)
    .filter(([, u]) => u.type === 1)
    .map(([id, u]) => ({ value: id, label: u.name }))
    .sort(sortById);

  const noteUserOpts = Object.entries(userReprints)
    .filter(([, u]) => u.type === 2)
    .map(([id, u]) => ({ value: id, label: u.name }))
    .sort(sortById);

  const reasonOpts = Object.entries(reasons)
    .map(([id, r]) => ({ value: id, label: r.name }))
    .sort(sortById);

  const statusOpts = [
    { value: 'not_yet', label: 'Not Yet' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'printed', label: 'Printed' },
  ];

  const productOpts = Object.entries(productReprints)
    .map(([id, p]) => ({ value: id, label: p.name }))
    .sort(sortById);

  const colorOpts = Object.entries(colorReprints)
    .map(([id, c]) => ({ value: id, label: c.name }))
    .sort(sortById);

  const sizeOpts = Object.entries(sizeReprints)
    .map(([id, s]) => ({ value: id, label: s.name }))
    .sort(sortById);

  const reasonErrorOpts = Object.entries(reasonErrors)
    .map(([id, r]) => ({ value: id, label: r.name }))
    .sort(sortById);

  const brandOpts = [
    { value: 'Circle', label: 'Circle' },
    { value: 'Gildan', label: 'Gildan' },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-2 align-items-center">
          <h4 className="mb-0">{currentTypeName}</h4>
          {selectedIds.size > 0 && (<>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => {
              const lines = [];
              selectedIds.forEach((id) => {
                const r = reprints[id];
                if (r && r.order_id && r.order_id.trim()) lines.push(r.order_id);
              });
              if (lines.length > 0) {
                navigator.clipboard.writeText(lines.join('\n'));
                setCopyMsg(`Copied ${lines.length} ID(s)`);
              } else {
                setCopyMsg('No order IDs to copy');
              }
              setTimeout(() => setCopyMsg(null), 2000);
            }}>
              Copy IDs ({selectedIds.size})
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => {
              const lines = [];
              selectedIds.forEach((id) => {
                const r = reprints[id];
                if (r && r.order_id && r.order_id.trim()) {
                  const note = (r.note || '').trim();
                  lines.push(note ? `${r.order_id} ${note}` : r.order_id);
                }
              });
              if (lines.length > 0) {
                navigator.clipboard.writeText(lines.join('\n'));
                setCopyMsg(`Copied ${lines.length} ID(s) with notes`);
              } else {
                setCopyMsg('No order IDs to copy');
              }
              setTimeout(() => setCopyMsg(null), 2000);
            }}>
              Copy with Note ({selectedIds.size})
            </button>
            <button className="btn btn-sm btn-info" onClick={handleProcessingSelected}>
              Processing ({selectedIds.size})
            </button>
            <button className="btn btn-sm btn-success" onClick={handleCompleteSelected}>
              Complete Selected ({selectedIds.size})
            </button>
          </>)}
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={handleAdd}>+ Add Reprint</button>
        </div>
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
              <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
            </div>
            <div className="col-md-2">
              <input type="date" className="form-control form-control-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" />
            </div>
            <div className="col-md-1">
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
                <th rowSpan="2" className="align-middle text-center col-fixed-xs">
                  <input
                    type="checkbox"
                    checked={filteredByDate.length > 0 && filteredByDate.every((r) => selectedIds.has(r.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredByDate.map((r) => r.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </th>
                <th rowSpan="2" className="align-middle text-center col-fixed-xs">#</th>
                <th colSpan="3" className="text-center col-group-order">Order</th>
                <th colSpan="5" className="text-center col-group-product">Product</th>
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
                (() => {
                  // Check duplicates across ALL reprints in database
                  const orderDateCount = {};
                  Object.entries(reprints).forEach(([id, r]) => {
                    const oid = (r.order_id || '').trim();
                    if (!oid) return;
                    const key = `${(r.created_at || '').substring(0, 10)}||${oid}`;
                    orderDateCount[key] = (orderDateCount[key] || 0) + 1;
                  });
                  return filteredByDate.map((r, idx) => {
                  const oid = (r.order_id || '').trim();
                  const isDup = oid && orderDateCount[`${(r.created_at || '').substring(0, 10)}||${oid}`] > 1;
                  return (
                  <tr key={r.id}
                    data-row-idx={idx}
                    className={`${isDup ? 'row-duplicate' : selectedIds.has(r.id) ? 'row-selected' : ''} ${dragFill?.sourceIdx === idx ? 'row-drag-source' : ''} ${isInDragFillRange(idx) ? 'row-drag-fill' : ''} ${filledIds.has(r.id) ? 'row-filled' : ''}`}
                    onClick={(e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') toggleSelect(r.id, e.shiftKey); }}
                  >
                    <td className="text-center">
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={(e) => toggleSelect(r.id, e.nativeEvent.shiftKey)} />
                    </td>
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
                      <div className="d-flex align-items-center gap-1">
                        <EditableText
                          value={r.order_id}
                          className="fw-semibold"
                          placeholder="Order ID"
                          onSave={(v) => saveField(r.id, 'order_id', extractOrderId(v))}
                        />
                        {r.order_id && (
                          <button
                            className="btn btn-sm p-0 border-0 text-muted"
                            style={{ fontSize: '0.7rem', lineHeight: 1 }}
                            title="Copy Order ID"
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(r.order_id); setCopyMsg('Copied: ' + r.order_id); setTimeout(() => setCopyMsg(null), 2000); }}
                          >
                            <i className="bi bi-clipboard"></i>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="cell-order" style={{ position: 'relative' }}>
                      <EditableSelect
                        value={r.reason_reprint_id}
                        options={reasonOpts}
                        displayValue={reasons[r.reason_reprint_id]?.name}
                        onSave={(v) => saveField(r.id, 'reason_reprint_id', v)}
                        onAddNew={() => { setAddNewModal({ type: 'reason', reprintId: r.id }); setNewItemName(''); }}
                      />
                      {r.reason_reprint_id && (
                        <div
                          className="drag-fill-handle"
                          onMouseDown={(e) => startDragFill(e, 'reason_reprint_id', r.reason_reprint_id, idx)}
                        />
                      )}
                    </td>

                    {/* ── Product ── */}
                    <td className="cell-product cell-note">
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
                      <EditableSelect
                        value={r.brand}
                        options={brandOpts}
                        displayValue={r.brand || null}
                        onSave={(v) => saveField(r.id, 'brand', v)}
                      />
                    </td>

                    {/* ── Error ── */}
                    <td className="cell-error">
                      <EditableSelect
                        value={r.reason_error_id}
                        options={reasonErrorOpts}
                        displayValue={reasonErrors[r.reason_error_id]?.name}
                        onSave={(v) => saveField(r.id, 'reason_error_id', v)}
                        onAddNew={() => { setAddNewModal({ type: 'reasonError', reprintId: r.id }); setNewItemName(''); }}
                      />
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
                  );
                });
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {copyMsg && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
          <div className="alert alert-success py-2 px-3 mb-0 shadow">{copyMsg}</div>
        </div>
      )}

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
