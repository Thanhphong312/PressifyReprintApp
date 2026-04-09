import React, { useState, useEffect, useCallback } from 'react';

function BarCell({ count, max, color = '#0d6efd' }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="d-flex align-items-center gap-2">
      <div style={{ flex: 1, height: 10, background: '#e9ecef', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5, transition: 'width 0.3s' }} />
      </div>
      <span className="text-muted" style={{ fontSize: '0.78rem', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

export default function Report() {
  const [reprints, setReprints] = useState({});
  const [userReprints, setUserReprints] = useState({});
  const [reasonErrors, setReasonErrors] = useState({});
  const [reprintTypes, setReprintTypes] = useState({});
  const [productReprints, setProductReprints] = useState({});
  const [loading, setLoading] = useState(true);

  // ── Filters ──
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().substring(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().substring(0, 10));
  const [typeFilter, setTypeFilter] = useState('');
  const [onlyWithErrors, setOnlyWithErrors] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, ur, re, rt, pr] = await Promise.all([
        window.electronAPI.db.reprints.getAll(),
        window.electronAPI.db.userReprints.getAll(),
        window.electronAPI.db.reasonErrors.getAll(),
        window.electronAPI.db.reprintTypes.getAll(),
        window.electronAPI.db.productReprints.getAll(),
      ]);
      setReprints(r);
      setUserReprints(ur);
      setReasonErrors(re);
      setReprintTypes(rt);
      setProductReprints(pr);
    } catch (err) {
      console.error('Report load error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Apply filters ──
  const filtered = Object.values(reprints).filter((r) => {
    if (typeFilter && String(r.reprint_type_id) !== typeFilter) return false;
    const date = (r.created_at || '').substring(0, 10);
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    if (onlyWithErrors) {
      const hasWho = !!r.user_error_id;
      const hasReason = !!(r.reason_error_id || (r.reason_error || '').trim());
      if (!hasWho && !hasReason) return false;
    }
    return true;
  });

  const total = filtered.length;
  const withWho = filtered.filter((r) => !!r.user_error_id).length;
  const withReason = filtered.filter((r) => !!(r.reason_error_id || (r.reason_error || '').trim())).length;

  // Sorted product list (used as columns in Ai Làm Sai table)
  const productEntries = Object.entries(productReprints).sort(([a], [b]) => Number(a) - Number(b));

  // ── Group by Ai Làm Sai ──  (skip reprints without user_error_id)
  const whoMap = {};
  filtered.forEach((r) => {
    const uid = r.user_error_id;
    if (!uid) return; // skip unassigned — not shown

    const name = userReprints[uid]?.name || `User #${uid}`;
    if (!whoMap[uid]) whoMap[uid] = { name, count: 0, byProduct: {}, id: uid };
    whoMap[uid].count++;

    // Track per-Loại Áo count
    const pid = r.product_reprint_id ? String(r.product_reprint_id) : '__none__';
    whoMap[uid].byProduct[pid] = (whoMap[uid].byProduct[pid] || 0) + 1;
  });
  const whoRows = Object.values(whoMap).sort((a, b) => b.count - a.count);
  const whoMax = whoRows[0]?.count || 1;

  // Column totals per product (for the footer)
  const whoProductTotals = {};
  whoRows.forEach((row) => {
    Object.entries(row.byProduct).forEach(([pid, cnt]) => {
      whoProductTotals[pid] = (whoProductTotals[pid] || 0) + cnt;
    });
  });

  // ── Group by Lý Do Lỗi ──
  const reasonMap = {};
  filtered.forEach((r) => {
    let name;
    if (r.reason_error_id && reasonErrors[r.reason_error_id]) {
      name = reasonErrors[r.reason_error_id].name.trim();
    } else if ((r.reason_error || '').trim()) {
      name = r.reason_error.trim();
    } else {
      reasonMap['__none__'] = reasonMap['__none__'] || { name: 'Chưa xác định', count: 0 };
      reasonMap['__none__'].count++;
      return;
    }
    const key = name.toLowerCase();
    reasonMap[key] = reasonMap[key] || { name, count: 0 };
    reasonMap[key].count++;
  });
  const reasonRows = Object.values(reasonMap).sort((a, b) => b.count - a.count);
  const reasonMax = reasonRows[0]?.count || 1;

  // ── Group by Reprint Type ──
  const byType = {};
  filtered.forEach((r) => {
    const tid = r.reprint_type_id;
    const name = tid ? (reprintTypes[tid]?.name || `Type #${tid}`) : 'Không phân loại';
    byType[name] = (byType[name] || 0) + 1;
  });
  const typeRows = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const typeMax = typeRows[0]?.[1] || 1;

  // ── Group by Loại Áo ──
  const byProduct = {};
  filtered.forEach((r) => {
    const pid = r.product_reprint_id;
    const name = pid ? (productReprints[pid]?.name || `Product #${pid}`) : 'Chưa xác định';
    byProduct[name] = (byProduct[name] || 0) + 1;
  });
  const productRows = Object.entries(byProduct).sort((a, b) => b[1] - a[1]);
  const productMax = productRows[0]?.[1] || 1;

  const typeOpts = Object.entries(reprintTypes).sort(([a], [b]) => Number(a) - Number(b));

  const hasNoneProduct = whoRows.some((row) => row.byProduct['__none__']);

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  function buildWhoCSV() {
    const productCols = productEntries.map(([, p]) => p.name);
    const headers = ['#', 'Tên', ...productCols, ...(hasNoneProduct ? ['Chưa xác định'] : []), 'Tổng'];

    const dataRows = whoRows.map((row, i) => {
      const cols = [
        i + 1,
        row.name,
        ...productEntries.map(([id]) => row.byProduct[id] || 0),
        ...(hasNoneProduct ? [row.byProduct['__none__'] || 0] : []),
        row.count,
      ];
      return cols.map(esc).join(',');
    });

    const footerCols = [
      'Tổng cột',
      '',
      ...productEntries.map(([id]) => whoProductTotals[id] || 0),
      ...(hasNoneProduct ? [whoProductTotals['__none__'] || 0] : []),
      withWho,
    ];

    return [
      headers.map(esc).join(','),
      ...dataRows,
      footerCols.map(esc).join(','),
    ];
  }

  function buildReasonCSV() {
    const lines = [['#', 'Lý Do', 'Số lần'].map(esc).join(',')];
    reasonRows.forEach((row, i) => {
      lines.push([i + 1, row.name, row.count].map(esc).join(','));
    });
    lines.push(['', 'Tổng (có ghi nhận)', withReason].map(esc).join(','));
    return lines;
  }

  function buildTypeCSV() {
    const lines = [['#', 'Loại', 'Số lần'].map(esc).join(',')];
    typeRows.forEach(([name, count], i) => {
      lines.push([i + 1, name, count].map(esc).join(','));
    });
    lines.push(['', 'Tổng cộng', total].map(esc).join(','));
    return lines;
  }

  function buildProductCSV() {
    const lines = [['#', 'Loại Áo', 'Số lần'].map(esc).join(',')];
    productRows.forEach(([name, count], i) => {
      lines.push([i + 1, name, count].map(esc).join(','));
    });
    lines.push(['', 'Tổng cộng', total].map(esc).join(','));
    return lines;
  }

  function downloadCSV(csvLines, filename) {
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportWhoCSV() {
    downloadCSV(buildWhoCSV(), `ai-lam-sai_${dateFrom}_${dateTo}.csv`);
  }

  function exportAllCSV() {
    const sep = [''];  // blank line separator between sections
    const lines = [
      // Summary
      esc(`Báo Cáo Reprint: ${dateFrom} — ${dateTo}`),
      ['Tổng số reprint', total].map(esc).join(','),
      ['Có ghi nhận người làm sai', withWho].map(esc).join(','),
      ['Có ghi nhận lý do lỗi', withReason].map(esc).join(','),
      ...sep,
      // Section 1: Người Làm Sai
      esc('TỔNG SỐ REPRINT THEO NGƯỜI LÀM SAI'),
      ...buildWhoCSV(),
      ...sep,
      // Section 2: Lý Do Lỗi
      esc('TỔNG SỐ REPRINT THEO LÝ DO LỖI'),
      ...buildReasonCSV(),
      ...sep,
      // Section 3: Theo Loại
      esc('TỔNG SỐ REPRINT THEO LOẠI'),
      ...buildTypeCSV(),
      ...sep,
      // Section 4: Theo Loại Áo
      esc('TỔNG SỐ REPRINT THEO LOẠI ÁO'),
      ...buildProductCSV(),
    ];
    downloadCSV(lines, `bao-cao-reprint_${dateFrom}_${dateTo}.csv`);
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Báo Cáo Reprint</h4>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-success" onClick={exportAllCSV}>
            <i className="bi bi-file-earmark-spreadsheet me-1"></i>Export All CSV
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={loadData}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body py-2">
          <div className="row g-2 align-items-center">
            <div className="col-auto">
              <label className="form-label mb-0 small fw-semibold">Từ ngày</label>
              <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="col-auto">
              <label className="form-label mb-0 small fw-semibold">Đến ngày</label>
              <input type="date" className="form-control form-control-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="col-auto">
              <label className="form-label mb-0 small fw-semibold">Loại reprint</label>
              <select className="form-select form-select-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">Tất cả</option>
                {typeOpts.map(([id, t]) => (
                  <option key={id} value={id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="col-auto pt-3">
              <div className="form-check form-check-sm mt-1">
                <input type="checkbox" className="form-check-input" id="onlyErr" checked={onlyWithErrors} onChange={(e) => setOnlyWithErrors(e.target.checked)} />
                <label className="form-check-label small" htmlFor="onlyErr">Chỉ có ghi nhận lỗi</label>
              </div>
            </div>
            <div className="col-auto pt-3 ms-auto">
              <span className="text-muted small">
                <strong>{total}</strong> reprints trong khoảng thời gian này
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card text-center border-0 shadow-sm">
            <div className="card-body py-3">
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0d6efd' }}>{total}</div>
              <div className="text-muted small">Tổng số reprint</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center border-0 shadow-sm">
            <div className="card-body py-3">
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc3545' }}>{withWho}</div>
              <div className="text-muted small">Có ghi nhận người làm sai</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center border-0 shadow-sm">
            <div className="card-body py-3">
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fd7e14' }}>{withReason}</div>
              <div className="text-muted small">Có ghi nhận lý do lỗi</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Ai Làm Sai — full width with per-style columns ── */}
      <div className="card mb-4">
        <div className="card-header py-2 bg-danger text-white d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Tổng Số Reprint Theo Người Làm Sai</span>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-light text-danger">{withWho} có ghi nhận</span>
            {whoRows.length > 0 && (
              <button className="btn btn-sm btn-light py-0 px-2" onClick={exportWhoCSV} title="Export CSV">
                <i className="bi bi-download me-1"></i>CSV
              </button>
            )}
          </div>
        </div>
        <div className="card-body p-0">
          {whoRows.length === 0 ? (
            <div className="text-center text-muted py-4">Không có dữ liệu</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 36 }} className="text-center align-middle">#</th>
                    <th className="align-middle">Tên</th>
                    {productEntries.map(([id, p]) => (
                      <th key={id} className="text-center align-middle" style={{ minWidth: 90, fontSize: '0.8rem' }}>
                        {p.name}
                      </th>
                    ))}
                    {/* column for reprints without a product */}
                    {hasNoneProduct && (
                      <th className="text-center align-middle" style={{ minWidth: 90, fontSize: '0.8rem' }}>
                        Chưa xác định
                      </th>
                    )}
                    <th style={{ width: 60 }} className="text-center align-middle">Tổng</th>
                    <th style={{ minWidth: 160 }} className="align-middle">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {whoRows.map((row, i) => (
                    <tr key={row.id}>
                      <td className="text-center text-muted">{i + 1}</td>
                      <td className="fw-medium">{row.name}</td>
                      {productEntries.map(([id]) => (
                        <td key={id} className="text-center">
                          {row.byProduct[id]
                            ? <span className="badge bg-danger">{row.byProduct[id]}</span>
                            : <span className="text-muted">—</span>
                          }
                        </td>
                      ))}
                      {hasNoneProduct && (
                        <td className="text-center">
                          {row.byProduct['__none__']
                            ? <span className="badge bg-secondary">{row.byProduct['__none__']}</span>
                            : <span className="text-muted">—</span>
                          }
                        </td>
                      )}
                      <td className="text-center">
                        <span className="badge bg-dark">{row.count}</span>
                      </td>
                      <td><BarCell count={row.count} max={whoMax} color="#dc3545" /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light fw-semibold">
                  <tr>
                    <td colSpan={2} className="text-end text-muted small">Tổng cột</td>
                    {productEntries.map(([id]) => (
                      <td key={id} className="text-center small">
                        {whoProductTotals[id] || '—'}
                      </td>
                    ))}
                    {hasNoneProduct && (
                      <td className="text-center small">{whoProductTotals['__none__'] || '—'}</td>
                    )}
                    <td className="text-center">{withWho}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Lý Do Lỗi + Theo Loại + Theo Loại Áo — three columns ── */}
      <div className="row g-4">

        {/* Lý Do Lỗi */}
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header py-2 bg-warning text-dark d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Tổng Số Reprint Theo Lý Do Lỗi</span>
              <span className="badge bg-light text-warning border">{withReason} có ghi nhận</span>
            </div>
            <div className="card-body p-0">
              {reasonRows.length === 0 ? (
                <div className="text-center text-muted py-4">Không có dữ liệu</div>
              ) : (
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 36 }} className="text-center">#</th>
                      <th>Lý Do</th>
                      <th style={{ width: 60 }} className="text-center">Số lần</th>
                      <th style={{ width: 160 }}>Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reasonRows.map((row, i) => {
                      const isNone = row.name === 'Chưa xác định';
                      return (
                        <tr key={i} className={isNone ? 'table-light' : ''}>
                          <td className="text-center text-muted">{i + 1}</td>
                          <td>
                            {isNone
                              ? <span className="text-muted fst-italic">{row.name}</span>
                              : <span className="fw-medium">{row.name}</span>
                            }
                          </td>
                          <td className="text-center">
                            <span className={`badge ${!isNone ? 'bg-warning text-dark' : 'bg-secondary'}`}>{row.count}</span>
                          </td>
                          <td><BarCell count={row.count} max={reasonMax} color="#ffc107" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan={2} className="text-end text-muted small">Tổng (có ghi nhận)</td>
                      <td className="text-center fw-bold">{withReason}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Theo Loại */}
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header py-2 bg-primary text-white d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Tổng Số Reprint Theo Loại</span>
              <span className="badge bg-light text-primary">{total} tổng cộng</span>
            </div>
            <div className="card-body p-0">
              {typeRows.length === 0 ? (
                <div className="text-center text-muted py-4">Không có dữ liệu</div>
              ) : (
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 36 }} className="text-center">#</th>
                      <th>Loại</th>
                      <th style={{ width: 60 }} className="text-center">Số lần</th>
                      <th style={{ width: 160 }}>Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeRows.map(([name, count], i) => (
                      <tr key={name}>
                        <td className="text-center text-muted">{i + 1}</td>
                        <td className="fw-medium">{name}</td>
                        <td className="text-center">
                          <span className="badge bg-primary">{count}</span>
                        </td>
                        <td><BarCell count={count} max={typeMax} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan={2} className="text-end text-muted small">Tổng cộng</td>
                      <td className="text-center fw-bold">{total}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Theo Loại Áo */}
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header py-2 bg-success text-white d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Tổng Số Reprint Theo Loại Áo</span>
              <span className="badge bg-light text-success">{total} tổng cộng</span>
            </div>
            <div className="card-body p-0">
              {productRows.length === 0 ? (
                <div className="text-center text-muted py-4">Không có dữ liệu</div>
              ) : (
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 36 }} className="text-center">#</th>
                      <th>Loại Áo</th>
                      <th style={{ width: 60 }} className="text-center">Số lần</th>
                      <th style={{ width: 160 }}>Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRows.map(([name, count], i) => {
                      const isNone = name === 'Chưa xác định';
                      return (
                        <tr key={name} className={isNone ? 'table-light' : ''}>
                          <td className="text-center text-muted">{i + 1}</td>
                          <td>
                            {isNone
                              ? <span className="text-muted fst-italic">{name}</span>
                              : <span className="fw-medium">{name}</span>
                            }
                          </td>
                          <td className="text-center">
                            <span className={`badge ${!isNone ? 'bg-success' : 'bg-secondary'}`}>{count}</span>
                          </td>
                          <td><BarCell count={count} max={productMax} color="#198754" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan={2} className="text-end text-muted small">Tổng cộng</td>
                      <td className="text-center fw-bold">{total}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
