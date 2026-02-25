import React, { useState, useEffect } from 'react';
import ProductImport from './ProductImport';

export default function ProductList() {
  const [productReprints, setProductReprints] = useState({});
  const [colorReprints, setColorReprints] = useState({});
  const [sizeReprints, setSizeReprints] = useState({});
  const [showImport, setShowImport] = useState(false);

  // Product form state
  const [editProduct, setEditProduct] = useState(null);
  const [productName, setProductName] = useState('');
  const [bulkProduct, setBulkProduct] = useState(false);
  const [bulkProductText, setBulkProductText] = useState('');

  // Color form state
  const [editColor, setEditColor] = useState(null);
  const [colorName, setColorName] = useState('');
  const [bulkColor, setBulkColor] = useState(false);
  const [bulkColorText, setBulkColorText] = useState('');

  // Size form state
  const [editSize, setEditSize] = useState(null);
  const [sizeName, setSizeName] = useState('');
  const [bulkSize, setBulkSize] = useState(false);
  const [bulkSizeText, setBulkSizeText] = useState('');

  async function loadData() {
    const [pr, cr, sr] = await Promise.all([
      window.electronAPI.db.productReprints.getAll(),
      window.electronAPI.db.colorReprints.getAll(),
      window.electronAPI.db.sizeReprints.getAll(),
    ]);
    setProductReprints(pr);
    setColorReprints(cr);
    setSizeReprints(sr);
  }

  useEffect(() => { loadData(); }, []);

  // ─── Product CRUD ───

  async function handleSaveProduct(e) {
    e.preventDefault();
    if (!productName.trim()) return;
    if (editProduct) {
      await window.electronAPI.db.productReprints.update(editProduct, { name: productName.trim() });
    } else {
      await window.electronAPI.db.productReprints.create({ name: productName.trim() });
    }
    setProductName('');
    setEditProduct(null);
    await loadData();
  }

  async function handleBulkProduct() {
    const names = bulkProductText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    for (const name of names) {
      await window.electronAPI.db.productReprints.create({ name });
    }
    setBulkProductText('');
    setBulkProduct(false);
    await loadData();
  }

  async function handleDeleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    await window.electronAPI.db.productReprints.delete(id);
    await loadData();
  }

  // ─── Color CRUD ───

  async function handleSaveColor(e) {
    e.preventDefault();
    if (!colorName.trim()) return;
    if (editColor) {
      await window.electronAPI.db.colorReprints.update(editColor, { name: colorName.trim() });
    } else {
      await window.electronAPI.db.colorReprints.create({ name: colorName.trim() });
    }
    setColorName('');
    setEditColor(null);
    await loadData();
  }

  async function handleBulkColor() {
    const names = bulkColorText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    for (const name of names) {
      await window.electronAPI.db.colorReprints.create({ name });
    }
    setBulkColorText('');
    setBulkColor(false);
    await loadData();
  }

  async function handleDeleteColor(id) {
    if (!confirm('Delete this color?')) return;
    await window.electronAPI.db.colorReprints.delete(id);
    await loadData();
  }

  // ─── Size CRUD ───

  async function handleSaveSize(e) {
    e.preventDefault();
    if (!sizeName.trim()) return;
    if (editSize) {
      await window.electronAPI.db.sizeReprints.update(editSize, { name: sizeName.trim() });
    } else {
      await window.electronAPI.db.sizeReprints.create({ name: sizeName.trim() });
    }
    setSizeName('');
    setEditSize(null);
    await loadData();
  }

  async function handleBulkSize() {
    const names = bulkSizeText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    for (const name of names) {
      await window.electronAPI.db.sizeReprints.create({ name });
    }
    setBulkSizeText('');
    setBulkSize(false);
    await loadData();
  }

  async function handleDeleteSize(id) {
    if (!confirm('Delete this size?')) return;
    await window.electronAPI.db.sizeReprints.delete(id);
    await loadData();
  }

  function handleImportClose() {
    setShowImport(false);
    loadData();
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Products, Colors &amp; Sizes</h4>
        <button className="btn btn-success" onClick={() => setShowImport(true)}>Import CSV</button>
      </div>

      <div className="row">
        {/* ─── Products ─── */}
        <div className="col-md-4">
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Products</strong>
              <button className="btn btn-sm btn-outline-success" onClick={() => setBulkProduct(!bulkProduct)}>
                {bulkProduct ? 'Single' : 'Add Many'}
              </button>
            </div>
            <div className="card-body py-2">
              {bulkProduct ? (
                <div className="mb-2">
                  <textarea className="form-control form-control-sm mb-2" rows="5" placeholder="One product per line" value={bulkProductText} onChange={(e) => setBulkProductText(e.target.value)} />
                  <button className="btn btn-sm btn-primary" onClick={handleBulkProduct}>Add All</button>
                  <button className="btn btn-sm btn-secondary ms-1" onClick={() => { setBulkProduct(false); setBulkProductText(''); }}>Cancel</button>
                </div>
              ) : (
              <form onSubmit={handleSaveProduct} className="row g-2 align-items-center mb-2">
                <div className="col">
                  <input type="text" className="form-control form-control-sm" placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} required />
                </div>
                <div className="col-auto">
                  <button type="submit" className="btn btn-sm btn-primary">{editProduct ? 'Update' : 'Add'}</button>
                  {editProduct && (
                    <button type="button" className="btn btn-sm btn-secondary ms-1" onClick={() => { setEditProduct(null); setProductName(''); }}>Cancel</button>
                  )}
                </div>
              </form>
              )}
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(productReprints).map(([id, p]) => (
                    <tr key={id}>
                      <td>{p.name}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={() => { setEditProduct(id); setProductName(p.name); }}>Edit</button>
                          <button className="btn btn-outline-danger" onClick={() => handleDeleteProduct(id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {Object.keys(productReprints).length === 0 && (
                    <tr><td colSpan="2" className="text-muted text-center">No products</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Colors ─── */}
        <div className="col-md-4">
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Colors</strong>
              <button className="btn btn-sm btn-outline-success" onClick={() => setBulkColor(!bulkColor)}>
                {bulkColor ? 'Single' : 'Add Many'}
              </button>
            </div>
            <div className="card-body py-2">
              {bulkColor ? (
                <div className="mb-2">
                  <textarea className="form-control form-control-sm mb-2" rows="5" placeholder="One color per line" value={bulkColorText} onChange={(e) => setBulkColorText(e.target.value)} />
                  <button className="btn btn-sm btn-primary" onClick={handleBulkColor}>Add All</button>
                  <button className="btn btn-sm btn-secondary ms-1" onClick={() => { setBulkColor(false); setBulkColorText(''); }}>Cancel</button>
                </div>
              ) : (
              <form onSubmit={handleSaveColor} className="row g-2 align-items-center mb-2">
                <div className="col">
                  <input type="text" className="form-control form-control-sm" placeholder="Color name" value={colorName} onChange={(e) => setColorName(e.target.value)} required />
                </div>
                <div className="col-auto">
                  <button type="submit" className="btn btn-sm btn-primary">{editColor ? 'Update' : 'Add'}</button>
                  {editColor && (
                    <button type="button" className="btn btn-sm btn-secondary ms-1" onClick={() => { setEditColor(null); setColorName(''); }}>Cancel</button>
                  )}
                </div>
              </form>
              )}
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(colorReprints).map(([id, c]) => (
                    <tr key={id}>
                      <td>{c.name}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={() => { setEditColor(id); setColorName(c.name); }}>Edit</button>
                          <button className="btn btn-outline-danger" onClick={() => handleDeleteColor(id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {Object.keys(colorReprints).length === 0 && (
                    <tr><td colSpan="2" className="text-muted text-center">No colors</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Sizes ─── */}
        <div className="col-md-4">
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Sizes</strong>
              <button className="btn btn-sm btn-outline-success" onClick={() => setBulkSize(!bulkSize)}>
                {bulkSize ? 'Single' : 'Add Many'}
              </button>
            </div>
            <div className="card-body py-2">
              {bulkSize ? (
                <div className="mb-2">
                  <textarea className="form-control form-control-sm mb-2" rows="5" placeholder="One size per line" value={bulkSizeText} onChange={(e) => setBulkSizeText(e.target.value)} />
                  <button className="btn btn-sm btn-primary" onClick={handleBulkSize}>Add All</button>
                  <button className="btn btn-sm btn-secondary ms-1" onClick={() => { setBulkSize(false); setBulkSizeText(''); }}>Cancel</button>
                </div>
              ) : (
              <form onSubmit={handleSaveSize} className="row g-2 align-items-center mb-2">
                <div className="col">
                  <input type="text" className="form-control form-control-sm" placeholder="Size name" value={sizeName} onChange={(e) => setSizeName(e.target.value)} required />
                </div>
                <div className="col-auto">
                  <button type="submit" className="btn btn-sm btn-primary">{editSize ? 'Update' : 'Add'}</button>
                  {editSize && (
                    <button type="button" className="btn btn-sm btn-secondary ms-1" onClick={() => { setEditSize(null); setSizeName(''); }}>Cancel</button>
                  )}
                </div>
              </form>
              )}
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sizeReprints).map(([id, s]) => (
                    <tr key={id}>
                      <td>{s.name}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={() => { setEditSize(id); setSizeName(s.name); }}>Edit</button>
                          <button className="btn btn-outline-danger" onClick={() => handleDeleteSize(id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {Object.keys(sizeReprints).length === 0 && (
                    <tr><td colSpan="2" className="text-muted text-center">No sizes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showImport && <ProductImport onClose={handleImportClose} productReprints={productReprints} colorReprints={colorReprints} sizeReprints={sizeReprints} />}
    </div>
  );
}
