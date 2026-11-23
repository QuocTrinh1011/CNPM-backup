import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, ClipboardList, Factory, PackageCheck, RefreshCw, RotateCcw } from 'lucide-react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import { ListError, PanelLoading, PanelTitle } from './ManagerComponents';
import { InlineNotice, StatusPill } from './ManagerKit';

const statusLabel = status => ({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', PLANNED: 'Chờ thực hiện', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' })[status] || status;
const statusTone = status => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', PLANNED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'success', CANCELLED: 'neutral' })[status] || 'neutral';

export default function WarehouseEmployeeWorkspace() {
  const [plans, setPlans] = useState(null);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [materialReturns, setMaterialReturns] = useState([]);
  const [finishedGoodsRequests, setFinishedGoodsRequests] = useState([]);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [action, setAction] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [producedQuantity, setProducedQuantity] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setPlans(null); setError('');
    Promise.all([
      adminApi(adminEndpoints.warehouseEmployeePlans(), { signal: controller.signal }),
      adminApi(adminEndpoints.warehouseEmployeeMaterialRequests(), { signal: controller.signal }),
      adminApi(adminEndpoints.warehouseEmployeeMaterialReturns(), { signal: controller.signal }),
      adminApi(adminEndpoints.warehouseEmployeeFinishedGoodsRequests(), { signal: controller.signal }),
    ]).then(([planPage, requestPage, returnPage, finishedPage]) => {
      if (controller.signal.aborted) return;
      setPlans(planPage?.content || []);
      setMaterialRequests(requestPage?.content || []);
      setMaterialReturns(returnPage?.content || []);
      setFinishedGoodsRequests(finishedPage?.content || []);
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || 'Không tải được công việc kho.'); });
    return () => controller.abort();
  }, [reload]);

  const products = useMemo(() => [...new Map((plans || []).map(plan => [plan.productId, { id: plan.productId, name: plan.productName }])).values()], [plans]);
  const startAction = (kind, plan = null) => {
    setAction({ kind, plan }); setQuantities({}); setProducedQuantity(''); setTransferProductId(''); setTransferQuantity(''); setNote(''); setError(''); setNotice('');
  };
  const submit = async event => {
    event.preventDefault();
    if (!action || busy) return;
    setError(''); setNotice('');
    let path;
    let body;
    let message;
    if (action.kind === 'production') {
      const quantity = Number(producedQuantity);
      if (!Number.isInteger(quantity) || quantity < 1) { setError('Nhập số lượng thành phẩm là số nguyên dương.'); return; }
      path = adminEndpoints.submitWarehouseProductionRun(action.plan.id);
      body = { producedQuantity: quantity, note: note.trim() || null };
      message = `Đã ghi nhận sản lượng cho ${action.plan.planCode}.`;
    } else if (action.kind === 'material-request' || action.kind === 'material-return') {
      const items = action.plan.materials.flatMap(material => {
        const quantity = Number(quantities[material.id]);
        return Number.isFinite(quantity) && quantity > 0 ? [{ planMaterialId: material.id, quantity }] : [];
      });
      if (!items.length || action.plan.materials.some(material => quantities[material.id] !== undefined && quantities[material.id] !== '' && (!Number.isFinite(Number(quantities[material.id])) || Number(quantities[material.id]) <= 0))) {
        setError('Nhập ít nhất một số lượng dương hợp lệ.'); return;
      }
      path = action.kind === 'material-request'
        ? adminEndpoints.createWarehouseEmployeeMaterialRequest()
        : adminEndpoints.createWarehouseEmployeeMaterialReturn(action.plan.id);
      body = action.kind === 'material-request'
        ? { planId: action.plan.id, items, note: note.trim() || null }
        : { items, note: note.trim() || null };
      message = action.kind === 'material-request' ? 'Đã gửi đề nghị cấp nguyên liệu.' : 'Đã gửi đề nghị trả nguyên liệu.';
    } else {
      const productId = Number(transferProductId);
      const quantity = Number(transferQuantity);
      if (!productId || !Number.isInteger(quantity) || quantity < 1) { setError('Chọn sản phẩm và nhập số lượng nguyên dương.'); return; }
      path = adminEndpoints.createWarehouseEmployeeFinishedGoodsRequest();
      body = { items: [{ productId, quantity }], note: note.trim() || null };
      message = 'Đã gửi đề nghị chuyển thành phẩm.';
    }
    setBusy(true);
    try {
      await adminApi(path, { method: 'POST', body });
      setNotice(message); setAction(null); setReload(value => value + 1);
    } catch (failure) { setError(failure.message || 'Không thể gửi yêu cầu kho.'); }
    finally { setBusy(false); }
  };

  if (plans === null && !error) return <PanelLoading />;
  if (error && plans === null) return <section className="admin-panel warehouse-workspace"><PanelTitle title="Công việc kho của tôi" subtitle="Kế hoạch được giao và các yêu cầu do bạn gửi."/><ListError message={error} onRetry={() => setReload(value => value + 1)} /></section>;

  const renderHistory = (title, rows, codeField) => <section className="warehouse-employee-history" aria-label={title}>
    <h3>{title}</h3>
    {rows.length ? rows.map(row => <div className="warehouse-history-row" key={row.id}><b>{row[codeField]}</b><span>{row.planCode || row.items?.map(item => item.productName).join(', ')}</span><StatusPill tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusPill></div>) : <p className="warehouse-empty">Chưa có yêu cầu.</p>}
  </section>;

  return <section className="admin-panel warehouse-workspace">
    <PanelTitle title="Công việc kho của tôi" subtitle="Xem kế hoạch được giao, ghi nhận sản xuất và theo dõi các đề nghị kho." />
    {error && <InlineNotice tone="danger">{error}</InlineNotice>}
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    <div className="warehouse-section-head"><h3>Kế hoạch được giao</h3><button type="button" className="admin-action" onClick={() => setReload(value => value + 1)}><RefreshCw size={15}/> Tải lại</button></div>
    {plans.length ? <div className="warehouse-employee-plans">{plans.map(plan => <article className="warehouse-employee-plan" key={plan.id}>
      <div className="warehouse-approval-heading"><div><b>{plan.planCode} · {plan.productName}</b><span>Chỉ tiêu {plan.targetQuantity} · Hoàn thành {plan.completedQuantity} · Hạn {plan.dueDate || 'chưa đặt'}</span></div><StatusPill tone={statusTone(plan.status)}>{statusLabel(plan.status)}</StatusPill></div>
      <div className="warehouse-material-breakdown"><b>Định mức và nguyên liệu đã nhận</b>{plan.materials.map(material => <div key={material.id}><span>{material.materialName} ({material.unit})</span><span>Yêu cầu {material.requiredQuantity} · Đã cấp {material.allocatedQuantity} · Đã dùng {material.consumedQuantity} · Đã trả {material.returnedQuantity}</span></div>)}</div>
      <div className="warehouse-actions">
        <button type="button" className="admin-action" onClick={() => startAction('material-request', plan)}><Boxes size={15}/> Đề nghị nguyên liệu {plan.planCode}</button>
        <button type="button" className="admin-action" onClick={() => startAction('material-return', plan)}><RotateCcw size={15}/> Đề nghị trả nguyên liệu {plan.planCode}</button>
        {['PLANNED', 'IN_PROGRESS'].includes(plan.status) && <button type="button" className="admin-primary" onClick={() => startAction('production', plan)}><Factory size={15}/> Ghi nhận sản lượng {plan.planCode}</button>}
      </div>
      {action?.plan?.id === plan.id && action.kind !== 'finished-goods' && <form className="warehouse-form-card warehouse-employee-form" onSubmit={submit}>
        <h4>{action.kind === 'production' ? `Ghi sản lượng · ${plan.planCode}` : action.kind === 'material-request' ? `Đề nghị cấp nguyên liệu · ${plan.planCode}` : `Đề nghị trả nguyên liệu · ${plan.planCode}`}</h4>
        {action.kind === 'production' ? <label>Số lượng hoàn thành<input aria-label="Số lượng hoàn thành" type="number" min="1" max={plan.targetQuantity - plan.completedQuantity} step="1" value={producedQuantity} onChange={event => setProducedQuantity(event.target.value)}/></label> : plan.materials.map(material => <label key={material.id}>{action.kind === 'material-request' ? 'Số lượng xin cấp' : 'Số lượng xin trả'} {material.materialName}<input aria-label={`${action.kind === 'material-request' ? 'Số lượng xin cấp' : 'Số lượng trả'} ${material.materialName}`} type="number" min="0.001" step="0.001" value={quantities[material.id] || ''} onChange={event => setQuantities(current => ({ ...current, [material.id]: event.target.value }))}/></label>)}
        <label className="warehouse-notes">Ghi chú<textarea rows="2" maxLength="2000" value={note} onChange={event => setNote(event.target.value)}/></label>
        <div className="warehouse-actions"><button className="admin-primary" disabled={busy}>{action.kind === 'production' ? 'Lưu sản lượng' : action.kind === 'material-request' ? 'Gửi đề nghị nguyên liệu' : 'Gửi đề nghị trả nguyên liệu'}</button><button type="button" className="admin-action" disabled={busy} onClick={() => setAction(null)}>Hủy</button></div>
      </form>}
    </article>)}</div> : <p className="warehouse-empty"><ClipboardList size={18}/> Hiện chưa có kế hoạch sản xuất được giao.</p>}
    {action?.kind === 'finished-goods' && <form className="warehouse-form-card" onSubmit={submit}>
      <h3>Đề nghị chuyển thành phẩm sang kho bán</h3>
      <div className="warehouse-form-grid"><label>Sản phẩm cần chuyển<select aria-label="Sản phẩm cần chuyển" value={transferProductId} onChange={event => setTransferProductId(event.target.value)}><option value="">Chọn sản phẩm đã được giao sản xuất</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Số lượng chuyển<input aria-label="Số lượng chuyển" type="number" min="1" step="1" value={transferQuantity} onChange={event => setTransferQuantity(event.target.value)}/></label></div>
      <label className="warehouse-notes">Ghi chú<textarea rows="2" maxLength="2000" value={note} onChange={event => setNote(event.target.value)}/></label><div className="warehouse-actions"><button className="admin-primary" disabled={busy || !products.length}><PackageCheck size={15}/> Gửi đề nghị chuyển thành phẩm</button><button type="button" className="admin-action" disabled={busy} onClick={() => setAction(null)}>Hủy</button></div>
    </form>}
    {!action?.kind && <button type="button" className="admin-action" disabled={!products.length} onClick={() => startAction('finished-goods')}><PackageCheck size={15}/> Đề nghị chuyển thành phẩm</button>}
    <div className="warehouse-employee-history-grid">
      {renderHistory('Yêu cầu cấp nguyên liệu', materialRequests, 'requestCode')}
      {renderHistory('Yêu cầu trả nguyên liệu', materialReturns, 'returnCode')}
      {renderHistory('Yêu cầu chuyển thành phẩm', finishedGoodsRequests, 'requestCode')}
    </div>
  </section>;
}
