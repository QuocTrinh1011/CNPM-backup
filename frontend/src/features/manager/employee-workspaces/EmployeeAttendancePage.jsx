import React, { useState } from 'react';
import { adminApi, adminEndpoints } from '../../../api/manager-api';
import { ListError, PanelLoading, PanelTitle, Table } from '../ManagerComponents';
import { currentYear, monthNames, today } from './employeeWorkspaceUtils';
import { useApiData } from './useApiData';
export function EmployeeAttendancePage({ hr = false, team = false, teamAttendance = false }) {
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [employeeId, setEmployeeId] = useState('');
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ employeeId: '', attendanceDate: today(), attendanceStatus: 'WORKED', dayFraction: '1', paidEquivalentDays: '1', overtimeNormalHours: '0', overtimeRestDayHours: '0', overtimeHolidayHours: '0', overtimeNightHours: '0', overtimeNightNormalHours: '0', overtimeNightRestDayHours: '0', overtimeNightHolidayHours: '0', note: '' });
  const path = hr ? adminEndpoints.hrAttendance({ year, month, employeeId: employeeId || undefined }) : teamAttendance ? adminEndpoints.myTeamAttendance({ year, month }) : team ? null : adminEndpoints.myAttendance({ year, month });
  const { data, error, loading } = useApiData(path, reload);
  const directory = useApiData(hr ? adminEndpoints.employees({ page: 0, size: 100 }) : null, reload);
  const roster = useApiData(team ? adminEndpoints.myTeam() : null, reload);
  const submit = async event => {
    event.preventDefault(); setNotice('');
    const body = { ...form, employeeId: Number(form.employeeId), dayFraction: Number(form.dayFraction), paidEquivalentDays: Number(form.paidEquivalentDays), overtimeNormalHours: Number(form.overtimeNormalHours), overtimeRestDayHours: Number(form.overtimeRestDayHours), overtimeHolidayHours: Number(form.overtimeHolidayHours), overtimeNightHours: Number(form.overtimeNightHours), overtimeNightNormalHours: Number(form.overtimeNightNormalHours), overtimeNightRestDayHours: Number(form.overtimeNightRestDayHours), overtimeNightHolidayHours: Number(form.overtimeNightHolidayHours) };
    try { await adminApi(adminEndpoints.upsertAttendance(), { method: 'PUT', body }); setNotice('Đã lưu chấm công.'); setReload(value => value + 1); }
    catch (failure) { setNotice(failure.message || 'Không thể lưu chấm công.'); }
  };
  const members = roster.data || [];
  const rows = data?.content || data || [];
  return <section className="admin-panel hr-workspace">
    <PanelTitle title={hr ? 'Chấm công' : team ? teamAttendance ? 'Chấm công nhóm' : 'Nhân viên trong nhóm' : 'Chấm công của tôi'} subtitle={hr ? 'Ghi nhận ngày công và giờ tăng ca cho kỳ lương.' : team ? 'Chỉ xem hồ sơ cơ bản và ngày công của nhân viên trực tiếp thuộc nhóm.' : 'Xem ngày công và giờ tăng ca của bạn.'} />
    {(!team || teamAttendance) && <div className="hr-filter-row"><label>Năm<input type="number" min="2000" max="2100" value={year} onChange={event => setYear(Number(event.target.value))} /></label><label>Tháng<select value={month} onChange={event => setMonth(Number(event.target.value))}>{monthNames.map(item => <option key={item} value={item}>{item}</option>)}</select></label>{hr && <label>Nhân viên<select aria-label="Nhân viên chấm công" value={employeeId} onChange={event => setEmployeeId(event.target.value)}><option value="">Tất cả nhân viên</option>{(directory.data?.content || []).map(employee => <option key={employee.id} value={employee.id}>{employee.employeeCode} · {employee.fullName}</option>)}</select></label>}</div>}
    {hr && <form className="hr-form-grid" onSubmit={submit}>
      <label>Nhân viên<select required value={form.employeeId} onChange={event => setForm({ ...form, employeeId: event.target.value })}><option value="">Chọn nhân viên</option>{(directory.data?.content || []).map(employee => <option key={employee.id} value={employee.id}>{employee.employeeCode} · {employee.fullName}</option>)}</select></label>
      <label>Ngày<input type="date" required value={form.attendanceDate} onChange={event => setForm({ ...form, attendanceDate: event.target.value })} /></label>
      <label>Trạng thái<select value={form.attendanceStatus} onChange={event => setForm({ ...form, attendanceStatus: event.target.value })}>{['WORKED','PAID_LEAVE','SICK_LEAVE','MATERNITY_LEAVE','UNPAID_LEAVE','PUBLIC_HOLIDAY','ABSENT'].map(status => <option key={status}>{status}</option>)}</select></label>
      <label>Ngày công<input type="number" min="0" max="1" step="0.5" value={form.dayFraction} onChange={event => setForm({ ...form, dayFraction: event.target.value })} /></label>
      <label>Ngày tính lương<input type="number" min="0" max="1" step="0.5" value={form.paidEquivalentDays} onChange={event => setForm({ ...form, paidEquivalentDays: event.target.value })} /></label>
      <label>Tăng ca thường<input type="number" min="0" step="0.25" value={form.overtimeNormalHours} onChange={event => setForm({ ...form, overtimeNormalHours: event.target.value })} /></label>
      <label>Tăng ca ngày nghỉ<input type="number" min="0" step="0.25" value={form.overtimeRestDayHours} onChange={event => setForm({ ...form, overtimeRestDayHours: event.target.value })} /></label>
      <label>Tăng ca ngày lễ<input type="number" min="0" step="0.25" value={form.overtimeHolidayHours} onChange={event => setForm({ ...form, overtimeHolidayHours: event.target.value })} /></label>
      <label>Giờ ca đêm (không tăng ca)<input type="number" min="0" step="0.25" value={form.overtimeNightHours} onChange={event => setForm({ ...form, overtimeNightHours: event.target.value })} /></label>
      <label>Tăng ca đêm ngày thường<input type="number" min="0" step="0.25" value={form.overtimeNightNormalHours} onChange={event => setForm({ ...form, overtimeNightNormalHours: event.target.value })} /></label>
      <label>Tăng ca đêm ngày nghỉ<input type="number" min="0" step="0.25" value={form.overtimeNightRestDayHours} onChange={event => setForm({ ...form, overtimeNightRestDayHours: event.target.value })} /></label>
      <label>Tăng ca đêm ngày lễ<input type="number" min="0" step="0.25" value={form.overtimeNightHolidayHours} onChange={event => setForm({ ...form, overtimeNightHolidayHours: event.target.value })} /></label>
      <label>Ghi chú<input value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} /></label>
      <button className="admin-primary" type="submit">Lưu chấm công</button>
    </form>}
    {team && <div className="hr-team-roster">{teamAttendance && <h3>Nhân viên trong nhóm</h3>}{roster.loading ? <PanelLoading /> : roster.error ? <ListError message={roster.error} onRetry={() => setReload(value => value + 1)} /> : members.length ? members.map(member => <span key={member.employeeId}>{member.employeeCode} · {member.fullName} · {member.jobTitle}</span>) : <p>Chưa có nhân viên trực tiếp trong nhóm.</p>}</div>}
    {(!team || teamAttendance) && (loading ? <PanelLoading /> : error ? <ListError message={error} onRetry={() => setReload(value => value + 1)} /> : <Table headers={team ? ['Nhân viên','Ngày','Trạng thái','Ngày công'] : hr ? ['Nhân viên','Ngày','Trạng thái','Ngày công','Ngày tính lương','OT thường','OT nghỉ','OT lễ','Ca đêm','OT đêm thường','OT đêm nghỉ','OT đêm lễ'] : ['Ngày','Trạng thái','Ngày công','Ngày tính lương','OT thường','OT nghỉ','OT lễ','Ca đêm','OT đêm thường','OT đêm nghỉ','OT đêm lễ']}>
      {rows.map((row, index) => <tr key={row.id || `${row.employeeId || 'me'}-${row.attendanceDate}-${index}`}>
        {team && <td>{row.employeeCode} · {row.employeeName}</td>}{hr && <td>{row.employeeCode} · {row.employeeName}</td>}
        <td>{row.attendanceDate}</td><td>{row.attendanceStatus}</td><td>{row.dayFraction}</td>
        {!team && <><td>{row.paidEquivalentDays}</td><td>{row.overtimeNormalHours}</td><td>{row.overtimeRestDayHours}</td><td>{row.overtimeHolidayHours}</td><td>{row.overtimeNightHours}</td><td>{row.overtimeNightNormalHours || 0}</td><td>{row.overtimeNightRestDayHours || 0}</td><td>{row.overtimeNightHolidayHours || 0}</td></>}
      </tr>)}
    </Table>)}
    {notice && <p role="status" className="hr-notice">{notice}</p>}
  </section>;
}
