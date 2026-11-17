import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Boxes, ClipboardPlus, Trash2 } from 'lucide-react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import { ListError, PanelLoading, PanelTitle, Table } from './ManagerComponents';
import './styles/warehouse-workspace.css';

const localDateTime = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
const newLine = () => ({ materialId: '', quantity: '1', unitCost: '' });

export default function WarehouseMaterials() {
  const [materials, setMaterials] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState('materials');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', unit: '' });
  const [supplierId, setSupplierId] = useState('');
  const [receivedAt, setReceivedAt] = useState(localDateTime);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    Promise.all([
      adminApi(adminEndpoints.rawMaterials(), { signal: controller.signal }),
      adminApi('/api/manager/suppliers?active=true&page=0&size=100', { signal: controller.signal }),
      adminApi(adminEndpoints.rawMaterialReceipts(), { signal: controller.signal }),
    ]).then(([materialRows, supplierPage, receiptPage]) => {
      if (controller.signal.aborted) return;
      setMaterials(materialRows || []);
      setSuppliers(supplierPage?.content || []);
      setReceipts(receiptPage?.content || []);
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || 'Không tải được dữ liệu kho.'); });
    return () => controller.abort();
  }, [reload]);

  const total = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0), [lines]);
  const retry = () => setReload(value => value + 1);
  const updateLine = (index, patch) => setLines(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const saveMaterial = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const endpoint = editing ? adminEndpoints.rawMaterial(editing.id) : adminEndpoints.createRawMaterial();
      await adminApi(endpoint, { method: editing ? 'PUT' : 'POST', body: editing ? { name: form.name, active: editing.active } : { code: form.code, name: form.name, unit: form.unit } });
      setNotice(editing ? 'Đã cập nhật nguyên liệu.' : 'Đã thêm nguyên liệu.');
      setForm({ code: '', name: '', unit: '' }); setEditing(null); retry();
    } catch (failure) { setNotice(failure.message || 'Không thể lưu nguyên liệu.'); }
    finally { setBusy(false); }
  };
  const submitReceipt = async event => {
    event.preventDefault();
    setNotice('');
    const selected = lines.map(line => Number(line.materialId));
    if (!supplierId || lines.length === 0 || lines.some(line => !line.materialId || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0 || line.unitCost === '' || !Number.isFinite(Number(line.unitCost)) || Number(line.unitCost) < 0)) {
      setNotice('Chọn nhà cung cấp, nguyên liệu, số lượng dương và đơn giá hợp lệ cho từng dòng.'); return;
    }
    if (new Set(selected).size !== selected.length) { setNotice('Mỗi nguyên liệu chỉ được nhập một lần trong một phiếu.'); return; }
    setBusy(true);
    try {
      const saved = await adminApi(adminEndpoints.createRawMaterialReceipt(), { method: 'POST', body: {
        supplierId: Number(supplierId), receivedAt: new Date(receivedAt).toISOString(), note: note.trim() || null,
        items: lines.map(line => ({ materialId: Number(line.materialId), quantity: Number(line.quantity), unitCost: Number(line.unitCost) })),
      } });
      setNotice(`Đã ghi nhận phiếu ${saved.receiptCode} với tổng tiền ${money(saved.totalCost)}.`);
      setLines([newLine()]); setNote(''); retry();
    } catch (failure) { setNotice(failure.message || 'Không thể tạo phiếu nhập nguyên liệu.'); }
    finally { setBusy(false); }
  };

  if (materials === null && !error) return <PanelLoading />;
  return <section className="admin-panel warehouse-workspace">
    <PanelTitle title="Nguyên liệu và nhập kho" subtitle="Theo dõi tồn nguyên liệu, lập danh mục và ghi nhận phiếu nhập từ nhà cung cấp." />
    <div className="warehouse-tabs" role="tablist" aria-label="Chức năng nguyên liệu">
      <button type="button" role="tab" aria-selected={mode === 'materials'} onClick={() => setMode('materials')}><Boxes size={16}/> Danh mục nguyên liệu</button>
      <button type="button" role="tab" aria-selected={mode === 'receipts'} onClick={() => setMode('receipts')}><ClipboardPlus size={16}/> Phiếu nhập nguyên liệu</button>
    </div>
    {error ? <ListError message={error} onRetry={retry} /> : mode === 'materials' ? <>
      <form className="warehouse-form-card" onSubmit={saveMaterial}>
        <h3>{editing ? `Sửa nguyên liệu ${editing.code}` : 'Thêm nguyên liệu'}</h3>
        <div className="warehouse-form-grid">
          {!editing && <label>Mã nguyên liệu<input aria-label="Mã nguyên liệu" required maxLength="40" value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value.toUpperCase() }))}/></label>}
          <label>Tên nguyên liệu<input aria-label="Tên nguyên liệu" required maxLength="150" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))}/></label>
          {!editing && <label>Đơn vị tính<input aria-label="Đơn vị tính" required maxLength="24" value={form.unit} onChange={event => setForm(current => ({ ...current, unit: event.target.value }))}/></label>}
          {editing && <label>Trạng thái<select value={String(editing.active)} onChange={event => setEditing(current => ({ ...current, active: event.target.value === 'true' }))}><option value="true">Đang sử dụng</option><option value="false">Ngừng sử dụng</option></select></label>}
        </div>
        <div className="warehouse-actions"><button className="admin-primary" disabled={busy}>{busy ? 'Đang lưu…' : editing ? 'Lưu nguyên liệu' : 'Lưu nguyên liệu'}</button>{editing && <button type="button" className="admin-action" onClick={() => { setEditing(null); setForm({ code: '', name: '', unit: '' }); }}>Hủy sửa</button>}</div>
      </form>
      <div className="warehouse-section-head"><h3>Danh mục nguyên liệu</h3><button type="button" className="admin-action" onClick={retry}>Tải lại</button></div>
      <Table headers={['Mã', 'Nguyên liệu', 'Đơn vị', 'Tồn khả dụng', 'Trạng thái', 'Thao tác']}>
        {(materials || []).map(material => <tr key={material.id}><td>{material.code}</td><td>{material.name}</td><td>{material.unit}</td><td>{material.availableQuantity}</td><td>{material.active ? 'Đang sử dụng' : 'Ngừng sử dụng'}</td><td><button type="button" className="admin-action" onClick={() => { setEditing(material); setForm({ code: material.code, name: material.name, unit: material.unit }); }}>Sửa</button></td></tr>)}
      </Table>
    </> : <>
      <form className="warehouse-form-card" onSubmit={submitReceipt}>
        <h3>Tạo phiếu nhập nguyên liệu</h3>
        <div className="warehouse-form-grid">
          <label>Nhà cung cấp<select aria-label="Nhà cung cấp" value={supplierId} onChange={event => setSupplierId(event.target.value)}><option value="">Chọn nhà cung cấp</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.name}</option>)}</select></label>
          <label>Ngày nhập<input aria-label="Ngày nhập" type="datetime-local" value={receivedAt} onChange={event => setReceivedAt(event.target.value)}/></label>
        </div>
        {lines.map((line, index) => <div className="warehouse-receipt-line" key={index}>
          <label>Nguyên liệu<select aria-label="Nguyên liệu" value={line.materialId} onChange={event => updateLine(index, { materialId: event.target.value })}><option value="">Chọn nguyên liệu</option>{(materials || []).filter(material => material.active).map(material => <option key={material.id} value={material.id}>{material.code} · {material.name} ({material.unit})</option>)}</select></label>
          <label>Số lượng nhập<input aria-label="Số lượng nhập" type="number" min="0.001" step="0.001" value={line.quantity} onChange={event => updateLine(index, { quantity: event.target.value })}/></label>
          <label>Đơn giá nhập<input aria-label="Đơn giá nhập" type="number" min="0" step="0.01" value={line.unitCost} onChange={event => updateLine(index, { unitCost: event.target.value })}/></label>
          <button className="warehouse-icon-button" type="button" aria-label={`Xóa dòng ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines(rows => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={16}/></button>
        </div>)}
        <button type="button" className="admin-action" onClick={() => setLines(rows => [...rows, newLine()])}><Plus size={15}/> Thêm dòng</button>
        <label className="warehouse-notes">Ghi chú<textarea rows="2" maxLength="2000" value={note} onChange={event => setNote(event.target.value)}/></label>
        <div className="warehouse-actions"><strong>Tổng tiền dự kiến: {money(total)}</strong><button className="admin-primary" disabled={busy}>{busy ? 'Đang ghi nhận…' : 'Xác nhận nhập nguyên liệu'}</button></div>
      </form>
      {notice && <p className="warehouse-notice" role={notice.startsWith('Chọn') || notice.startsWith('Mỗi') ? 'alert' : 'status'}>{notice}</p>}
      <div className="warehouse-section-head"><h3>Lịch sử nhập nguyên liệu</h3><span>{receipts?.length || 0} phiếu gần nhất</span></div>
      <Table headers={['Mã phiếu', 'Ngày nhập', 'Nhà cung cấp', 'Số dòng', 'Tổng tiền']}>
        {(receipts || []).map(receipt => <tr key={receipt.id}><td>{receipt.receiptCode}</td><td>{receipt.receivedAt ? new Date(receipt.receivedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}</td><td>{receipt.supplierName}</td><td>{receipt.itemCount}</td><td>{money(receipt.totalCost)}</td></tr>)}
      </Table>
    </>}
    {notice && mode === 'materials' && <p className="warehouse-notice" role="status">{notice}</p>}
  </section>;
}
