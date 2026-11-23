import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import { ListError, PanelLoading, PanelTitle } from './ManagerComponents';
import { InlineNotice, StatusPill, Tabs } from './ManagerKit';

const queues = [
  ['materials', 'Yêu cầu xuất nguyên liệu', adminEndpoints.warehouseMaterialRequests, adminEndpoints.decideWarehouseMaterialRequest],
  ['returns', 'Yêu cầu trả nguyên liệu', adminEndpoints.warehouseMaterialReturns, adminEndpoints.decideWarehouseMaterialReturn],
  ['finished', 'Yêu cầu xuất thành phẩm', adminEndpoints.warehouseFinishedGoodsRequests, adminEndpoints.decideWarehouseFinishedGoodsRequest],
];
const statusLabel = status => ({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' })[status] || status;
const statusTone = status => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' })[status] || 'neutral';

export default function WarehouseApprovals() {
  const [queueKey, setQueueKey] = useState('materials');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const queue = useMemo(() => queues.find(([key]) => key === queueKey) || queues[0], [queueKey]);

  useEffect(() => {
    const controller = new AbortController();
    setRows(null); setError('');
    adminApi(queue[2](), { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setRows(result?.content || []); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message || 'Không tải được hàng đợi duyệt.'); });
    return () => controller.abort();
  }, [queue, reload]);

  const decide = async (row, decision) => {
    setBusyId(row.id); setNotice(''); setError('');
    try {
      const apiDecision = decision === 'APPROVED' ? 'APPROVE' : 'REJECT';
      await adminApi(queue[3](row.id), { method: 'PATCH', body: { decision: apiDecision, note: note.trim() } });
      setNotice(`${decision === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'} yêu cầu ${row.requestCode || row.returnCode}.`);
      setNote(''); setReload(value => value + 1);
    } catch (failure) { setError(failure.message || 'Không thể xử lý yêu cầu.'); }
    finally { setBusyId(null); }
  };

  return <section className="admin-panel warehouse-workspace">
    <PanelTitle title="Duyệt yêu cầu kho" subtitle="Xem và quyết định cấp nguyên liệu, nhận lại nguyên liệu dư hoặc chuyển thành phẩm sang kho bán." />
    <Tabs
      tabs={queues.map(([key, label]) => ({ key, label, icon: <ClipboardCheck size={16} /> }))}
      value={queueKey}
      onChange={key => { setQueueKey(key); setNotice(''); }}
      ariaLabel="Hàng đợi yêu cầu kho"
    />
    <label className="warehouse-notes">Ghi chú quyết định<textarea aria-label="Ghi chú quyết định" rows="2" maxLength="2000" value={note} onChange={event => setNote(event.target.value)} placeholder="Không bắt buộc" /></label>
    {error && <ListError message={error} onRetry={() => setReload(value => value + 1)} />}
    {rows === null && !error ? <PanelLoading /> : rows?.length ? <div className="warehouse-approval-list">
      {rows.map(row => <article className="warehouse-approval-card" key={row.id}>
        <div className="warehouse-approval-heading"><div><b>{row.requestCode || row.returnCode}</b><span>{row.planCode ? `Kế hoạch ${row.planCode} · ` : ''}{row.employeeName || 'Nhân viên'}</span></div><StatusPill tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusPill></div>
        {row.employeeNote && <p>{row.employeeNote}</p>}
        <ul>{(row.items || []).map((item, index) => <li key={`${item.planMaterialId || item.productId || item.materialId}-${index}`}>
          {item.materialCode || item.productName || item.materialName} · {item.quantity} {item.unit || ''}
        </li>)}</ul>
        {row.status === 'PENDING' && <div className="warehouse-actions">
          <button type="button" className="admin-primary" disabled={busyId === row.id} onClick={() => decide(row, 'APPROVED')}><Check size={15}/> Duyệt {row.requestCode || row.returnCode}</button>
          <button type="button" className="admin-action warehouse-danger-action" disabled={busyId === row.id} onClick={() => decide(row, 'REJECTED')}><X size={15}/> Từ chối</button>
        </div>}
        {row.decisionNote && <small>Ghi chú quyết định: {row.decisionNote}</small>}
      </article>)}
    </div> : !error ? <p className="warehouse-empty">Không có yêu cầu trong nhóm này.</p> : null}
    {notice && <InlineNotice tone={notice.startsWith('Đã') ? 'success' : 'danger'}>{notice}</InlineNotice>}
  </section>;
}
