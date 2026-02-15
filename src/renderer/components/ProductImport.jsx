import React, { useState } from 'react';
import Papa from 'papaparse';

export default function ProductImport({ onClose, productReprints, colorReprints, sizeReprints }) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('CSV parse errors: ' + results.errors.map((e) => e.message).join(', '));
          return;
        }
        const valid = results.data.filter((row) => row.product_name);
        if (valid.length === 0) {
          setError('No valid rows found. Expected columns: product_name, color, size');
          return;
        }
        setPreview(valid);
      },
      error: (err) => {
        setError('Error reading file: ' + err.message);
      },
    });
  }

  async function handleImport() {
    if (!preview || preview.length === 0) return;
    setImporting(true);

    try {
      // Build lookup maps from existing data
      const productMap = {};
      if (productReprints) {
        Object.entries(productReprints).forEach(([id, p]) => {
          productMap[p.name.toLowerCase()] = id;
        });
      }

      const colorMap = {};
      if (colorReprints) {
        Object.entries(colorReprints).forEach(([id, c]) => {
          colorMap[c.name.toLowerCase()] = id;
        });
      }

      const sizeMap = {};
      if (sizeReprints) {
        Object.entries(sizeReprints).forEach(([id, s]) => {
          sizeMap[s.name.toLowerCase()] = id;
        });
      }

      for (const row of preview) {
        // Create product if not exists
        const productName = row.product_name.trim();
        if (productName && !productMap[productName.toLowerCase()]) {
          const productId = await window.electronAPI.db.productReprints.create({ name: productName });
          productMap[productName.toLowerCase()] = productId;
        }

        // Create color if not exists
        const colorName = (row.color || '').trim();
        if (colorName && !colorMap[colorName.toLowerCase()]) {
          const colorId = await window.electronAPI.db.colorReprints.create({ name: colorName });
          colorMap[colorName.toLowerCase()] = colorId;
        }

        // Create size if not exists
        const sizeName = (row.size || '').trim();
        if (sizeName && !sizeMap[sizeName.toLowerCase()]) {
          const sizeId = await window.electronAPI.db.sizeReprints.create({ name: sizeName });
          sizeMap[sizeName.toLowerCase()] = sizeId;
        }
      }

      alert(`Imported ${preview.length} rows successfully.`);
      onClose();
    } catch (err) {
      setError('Import error: ' + err.message);
    }
    setImporting(false);
  }

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Import Products, Colors &amp; Sizes from CSV</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <p className="text-muted small">
              CSV should have columns: <strong>product_name</strong>, <strong>color</strong>, <strong>size</strong>.
              Duplicate names are automatically skipped.
            </p>
            <input type="file" accept=".csv" className="form-control mb-3" onChange={handleFileChange} />
            {error && <div className="alert alert-danger py-2">{error}</div>}
            {preview && (
              <>
                <p className="fw-medium">{preview.length} rows to import:</p>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="table table-sm table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Product Name</th>
                        <th>Color</th>
                        <th>Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 100).map((row, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{row.product_name}</td>
                          <td>{row.color}</td>
                          <td>{row.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 100 && (
                    <p className="text-muted small">Showing first 100 of {preview.length} rows</p>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!preview || importing} onClick={handleImport}>
              {importing ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
