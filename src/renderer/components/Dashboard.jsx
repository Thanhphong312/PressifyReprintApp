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

  const reprintArr = Object.values(reprints);
  const total = reprintArr.length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = reprintArr.filter(
    (r) => r.created_at && r.created_at >= todayStart.getTime()
  ).length;

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

  const byReason = {};
  reprintArr.forEach((r) => {
    const name = reasons[r.reason_reprint_id]?.name || 'Unknown';
    byReason[name] = (byReason[name] || 0) + 1;
  });

  const reasonBarData = {
    labels: Object.keys(byReason),
    datasets: [{ label: 'Reprints', data: Object.values(byReason), backgroundColor: '#0d6efd' }],
  };

  const bySupport = {};
  reprintArr.forEach((r) => {
    const name = users[r.support_id]?.name || 'Unknown';
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
      <h4 className="mb-4">Dashboard</h4>
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-primary">
            <div className="card-body text-center">
              <div className="text-muted small">Total Reprints</div>
              <div className="fs-2 fw-bold text-primary">{total}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-success">
            <div className="card-body text-center">
              <div className="text-muted small">Today</div>
              <div className="fs-2 fw-bold text-success">{todayCount}</div>
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
              {total > 0 ? <Pie data={statusPieData} /> : <p className="text-muted text-center">No data</p>}
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">Reprints by Reason</div>
            <div className="card-body" style={{ height: '300px' }}>
              {total > 0 ? <Bar data={reasonBarData} options={barOptions} /> : <p className="text-muted text-center">No data</p>}
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
