import React, { useState } from 'react';
import { adminApi, adminEndpoints } from '../../../api/manager-api';
import { ListError, PanelLoading, PanelTitle } from '../ManagerComponents';
import { today } from './employeeWorkspaceUtils';
import { useApiData } from './useApiData';
export function EmployeeLeaveRequests({ hr = false }) {
  const [reload, setReload] = useState(0);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [form, setForm] = useState({ requestType: 'ANNUAL', startDate: today(), endDate: today(), employeeNote: '' });
  const [reviewerNote, setReviewerNote] = useState('');
  const [notice, setNotice] = useState('');
  const endpoint = hr ? adminEndpoints.hrLeaveRequests({ status: statusFilter }) : adminEndpoints.myLeaveRequests();
  const { data, error, loading } = useApiData(endpoint, reload);
  const rows = data?.content || [];
  const runAction = async (url, method, body) => {
    setNotice('');
    try { await adminApi(url, { method, ...(body ? { body } : {}) }); setNotice('Đã lưu thay đổi.'); setReload(value => value + 1); }
    catch (failure) { setNotice(failure.message || 'Không thể cập nhật đơn nghỉ.'); }
  };
  const submit = async event => {
    event.preventDefault(); await runAction(adminEndpoints.submitMyLeave(), 'POST', form);
  };
  return <section className="admin-panel hr-workspace">
    <PanelTitle title={hr ? 'Duyệt đơn nghỉ' : 'Đơn nghỉ của tôi'} subtitle={hr ? 'Xem và xử lý đơn nghỉ phép, nghỉ ốm, thai sản hoặc nghỉ việc.' : 'Gửi yêu cầu nghỉ và theo dõi quyết định của nhân sự.'} />
    {!hr && <form className="hr-form-grid" onSubmit={submit}>
      <label>Loại đơn<select value={form.requestType} onChange={event => setForm({ ...form, requestType: event.target.value })}><option value="ANNUAL">Nghỉ phép năm</option><option value="SICK">Nghỉ ốm</option><option value="MATERNITY">Nghỉ thai sản</option><option value="RESIGNATION">Nghỉ việc</option></select></label>
      <label>Từ ngày<input type="date" required value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} /></label>
      <label>Đến ngày<input type="date" required value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} /></label>
      <label>Ghi chú<textarea maxLength={4000} value={form.employeeNote} onChange={event => setForm({ ...form, employeeNote: event.target.value })} /></label>
      <button className="admin-primary" type="submit">Gửi đơn</button>
    </form>}
    {hr && <label className="hr-filter">Lọc trạng thái<select aria-label="Lọc đơn nghỉ" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option><option value="WITHDRAWN">Đã rút</option></select></label>}
    {loading ? <PanelLoading /> : error ? <ListError message={error} onRetry={() => setReload(value => value + 1)} /> : rows.length === 0 ? <p className="admin-table-empty">Chưa có đơn nghỉ.</p> : <div className="hr-request-list">{rows.map(row => <article className="hr-request-card" key={row.id}>
      <div><b>{hr ? row.employeeName : row.requestType}</b><span>{hr ? `${row.employeeCode} · ` : ''}{row.requestType} · {row.startDate} – {row.endDate}</span><small>Trạng thái: {row.status}{row.employeeNote ? ` · ${row.employeeNote}` : ''}</small></div>
      {hr && row.status === 'PENDING' && <div className="hr-inline-actions"><input aria-label={`Ghi chú duyệt ${row.id}`} placeholder="Ghi chú tùy chọn" value={reviewerNote} onChange={event => setReviewerNote(event.target.value)} /><button onClick={() => runAction(adminEndpoints.decideLeave(row.id), 'PATCH', { decision: 'APPROVED', reviewerNote })}>Duyệt</button><button className="hr-danger" onClick={() => runAction(adminEndpoints.decideLeave(row.id), 'PATCH', { decision: 'REJECTED', reviewerNote })}>Từ chối</button></div>}
      {!hr && row.status === 'PENDING' && <button className="hr-danger" onClick={() => runAction(adminEndpoints.withdrawMyLeave(row.id), 'PATCH')}>Rút đơn</button>}
    </article>)}</div>}
    {notice && <p role="status" className="hr-notice">{notice}</p>}
  </section>;
}
