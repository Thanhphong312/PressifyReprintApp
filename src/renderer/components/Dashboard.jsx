import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const STATUS_COLORS = {
  not_yet: '#ffc107',
  processing: '#0dcaf0',
  completed: '#198754',
  printed: '#0d6efd',
};

const STATUS_LABELS = {
  not_yet: 'Not Yet',
  processing: 'Processing',
  completed: 'Completed',
  printed: 'Printed',
};

export default function Dashboard() {
  const [reprints, setReprints] = useState({});
  const [users, setUsers] = useState({});
  const [reasons, setReasons] = useState({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  async function loadData() {
    const [r, u, re] = await Promise.all([
      window.electronAPI.db.reprints.getAll(),
      window.electronAPI.db.users.getAll(),
      window.electronAPI.db.reasons.getAll(),
    ]);
    setReprints(r);
    setUsers(u);
    setReasons(re);
  }

  useEffect(() => { loadData(); }, []);

  // Filter by date range
  const reprintArr = Object.values(reprints).filter((r) => {
    if (dateFrom) {
      const created = (r.created_at || '').substring(0, 10);
      if (created < dateFrom) return false;
    }
    if (dateTo) {
      const created = (r.created_at || '').substring(0, 10);
      if (created > dateTo) return false;
    }
    return true;
  });

  const total = reprintArr.length;

  // Total reprints & orders with status completed only
  const completedArr = reprintArr.filter((r) => r.status === 'completed');
  const totalCompleted = completedArr.length;
  const uniqueOrders = new Set(completedArr.map((r) => r.order_id).filter((id) => id && id.trim()));
  const totalOrders = uniqueOrders.size;

  const byStatus = {};
  reprintArr.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  });

  const statusPieData = {
    labels: Object.keys(byStatus).map((s) => STATUS_LABELS[s] || s),
    datasets: [
      {
        data: Object.values(byStatus),
        backgroundColor: Object.keys(byStatus).map((s) => STATUS_COLORS[s] || '#6c757d'),
      },
    ],
  };

  const statusPieOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${val} (${pct}%)`;
          },
        },
      },
    },
  };

  // Reason pie chart with % and total
  const byReason = {};
  reprintArr.forEach((r) => {
    if (!r.reason_reprint_id || !reasons[r.reason_reprint_id]) return;
    const name = reasons[r.reason_reprint_id].name;
    byReason[name] = (byReason[name] || 0) + 1;
  });

  const REASON_COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#0dcaf0', '#6c757d', '#d63384'];

  const reasonPieData = {
    labels: Object.keys(byReason),
    datasets: [{
      data: Object.values(byReason),
      backgroundColor: Object.keys(byReason).map((_, i) => REASON_COLORS[i % REASON_COLORS.length]),
    }],
  };

  const reasonTotal = Object.values(byReason).reduce((a, b) => a + b, 0);

  const reasonPieOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed;
            const pct = reasonTotal > 0 ? ((val / reasonTotal) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${val} (${pct}%)`;
          },
        },
      },
    },
  };

  const bySupport = {};
  reprintArr.forEach((r) => {
    if (!r.support_id || !users[r.support_id]) return;
    const name = users[r.support_id].name;
    bySupport[name] = (bySupport[name] || 0) + 1;
  });

  const supportBarData = {
    labels: Object.keys(bySupport),
    datasets: [{ label: 'Reprints', data: Object.values(bySupport), backgroundColor: '#198754' }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Dashboard</h4>
        <div className="d-flex gap-2 align-items-center">
          <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" style={{ width: '150px' }} />
          <span className="text-muted small">to</span>
          <input type="date" className="form-control form-control-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" style={{ width: '150px' }} />
          {(dateFrom || dateTo) && (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
          )}
        </div>
      </div>
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-primary">
            <div className="card-body text-center">
              <div className="text-muted small">Total Reprints</div>
              <div className="fs-2 fw-bold text-primary">{totalCompleted}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-dark">
            <div className="card-body text-center">
              <div className="text-muted small">Total Orders</div>
              <div className="fs-2 fw-bold text-dark">{totalOrders}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-warning">
            <div className="card-body text-center">
              <div className="text-muted small">Not Yet</div>
              <div className="fs-2 fw-bold text-warning">{byStatus['not_yet'] || 0}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-info">
            <div className="card-body text-center">
              <div className="text-muted small">Processing</div>
              <div className="fs-2 fw-bold text-info">{byStatus['processing'] || 0}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">Reprints by Status</div>
            <div className="card-body">
              {total > 0 ? <Pie data={statusPieData} options={statusPieOptions} /> : <p className="text-muted text-center">No data</p>}
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">Reprints by Reason ({reasonTotal})</div>
            <div className="card-body">
              {reasonTotal > 0 ? <Pie data={reasonPieData} options={reasonPieOptions} /> : <p className="text-muted text-center">No data</p>}
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">Reprints by Support</div>
            <div className="card-body" style={{ height: '300px' }}>
              {total > 0 ? <Bar data={supportBarData} options={barOptions} /> : <p className="text-muted text-center">No data</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
