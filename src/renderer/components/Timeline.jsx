import React, { useState, useEffect } from 'react';

export default function Timeline({ reprintId, onClose }) {
  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState({});

  useEffect(() => {
    async function load() {
      const [timelineData, usersData] = await Promise.all([
        window.electronAPI.db.timelines.getByReprint(reprintId),
        window.electronAPI.db.users.getAll(),
      ]);
      setEntries(timelineData);
      setUsers(usersData);
    }
    load();
  }, [reprintId]);

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Timeline</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {entries.length === 0 ? (
              <p className="text-muted">No timeline entries.</p>
            ) : (
              <div className="timeline-list">
                {entries.map((entry) => (
                  <div key={entry.id} className="timeline-entry border-start border-primary border-3 ps-3 mb-3">
                    <div className="fw-bold">{users[entry.user_id]?.name || entry.user_id}</div>
                    <div>{entry.note}</div>
                    <div className="small text-muted">
                      VN: {entry.time_vn} | US: {entry.time_us}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
