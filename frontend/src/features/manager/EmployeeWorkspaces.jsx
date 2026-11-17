import React, { useEffect, useState } from 'react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import { ListError, PanelLoading, PanelTitle, Table } from './ManagerComponents';
import './manager-hr.css';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const currentYear = () => new Date().getFullYear();
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
const monthNames = Array.from({ length: 12 }, (_, index) => index + 1);
const employmentStatusLabel = status => ({ ACTIVE: 'Đang làm việc', RESIGNED: 'Nghỉ việc', TERMINATED: 'Đã chấm dứt' })[status] || status;

function useApiData(path, reload = 0) {
  const [state, setState] = useState({ data: null, error: '', loading: Boolean(path) });
  useEffect(() => {
    if (!path) {
      setState({ data: null, error: '', loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState(previous => ({ ...previous, loading: true, error: '' }));
    adminApi(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ data, error: '', loading: false }); })
      .catch(error => { if (!controller.signal.aborted) setState({ data: null, error: error.message, loading: false }); });
    return () => controller.abort();
  }, [path, reload]);
  return state;
}

export function EmployeeSelfProfile() {
  const [reload, setReload] = useState(0);
  const { data, error, loading } = useApiData(adminEndpoints.myProfile(), reload);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (data) setForm({ phone: data.phone || '', emergencyContactName: data.emergencyContactName || '', emergencyContactPhone: data.emergencyContactPhone || '', emergencyContactRelationship: data.emergencyContactRelationship || '' });
  }, [data]);
  const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const save = async event => {
    event.preventDefault(); setNotice('');
    try { await adminApi(adminEndpoints.myProfile(), { method: 'PUT', body: form }); setNotice('Đã cập nhật thông tin liên hệ.'); setReload(value => value + 1); }
    catch (failure) { setNotice(failure.message || 'Không thể lưu hồ sơ.'); }
  };
  if (loading) return <PanelLoading />;
  if (error && !data) return <ListError message={error} onRetry={() => setReload(value => value + 1)} />;
  return <section className="admin-panel hr-workspace">
    <PanelTitle title="Thông tin của tôi" subtitle="Xem hồ sơ công việc và tự cập nhật thông tin liên hệ của bạn." />
    <div className="hr-profile-summary"><b>{data?.fullName}</b><span>{data?.employeeCode} · {data?.jobTitle}</span><span>{data?.employmentStatus === 'ACTIVE' ? 'Đang làm việc' : data?.employmentStatus}</span></div>
    {form && <form className="hr-form-grid" onSubmit={save}>
      <label>Điện thoại<input value={form.phone} onChange={event => update('phone', event.target.value)} /></label>
      <label>Người liên hệ khẩn cấp<input value={form.emergencyContactName} onChange={event => update('emergencyContactName', event.target.value)} /></label>
      <label>Số điện thoại khẩn cấp<input value={form.emergencyContactPhone} onChange={event => update('emergencyContactPhone', event.target.value)} /></label>
      <label>Mối quan hệ<input value={form.emergencyContactRelationship} onChange={event => update('emergencyContactRelationship', event.target.value)} /></label>
      <button className="admin-primary" type="submit">Lưu thông tin</button>
    </form>}
    {notice && <p role="status" className="hr-notice">{notice}</p>}
  </section>;
}

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

export function EmployeeAttendancePage({ hr = false, team = false, teamAttendance = false }) {
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [employeeId, setEmployeeId] = useState('');
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ employeeId: '', attendanceDate: today(), attendanceStatus: 'WORKED', dayFraction: '1', paidEquivalentDays: '1', overtimeNormalHours: '0', overtimeRestDayHours: '0', overtimeHolidayHours: '0', overtimeNightHours: '0', note: '' });
  const path = hr ? adminEndpoints.hrAttendance({ year, month, employeeId: employeeId || undefined }) : teamAttendance ? adminEndpoints.myTeamAttendance({ year, month }) : team ? null : adminEndpoints.myAttendance({ year, month });
  const { data, error, loading } = useApiData(path, reload);
  const directory = useApiData(hr ? adminEndpoints.employees({ page: 0, size: 100 }) : null, reload);
  const roster = useApiData(team ? adminEndpoints.myTeam() : null, reload);
  const submit = async event => {
    event.preventDefault(); setNotice('');
    const body = { ...form, employeeId: Number(form.employeeId), dayFraction: Number(form.dayFraction), paidEquivalentDays: Number(form.paidEquivalentDays), overtimeNormalHours: Number(form.overtimeNormalHours), overtimeRestDayHours: Number(form.overtimeRestDayHours), overtimeHolidayHours: Number(form.overtimeHolidayHours), overtimeNightHours: Number(form.overtimeNightHours) };
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
      <label>Giờ làm ban đêm<input type="number" min="0" step="0.25" value={form.overtimeNightHours} onChange={event => setForm({ ...form, overtimeNightHours: event.target.value })} /></label>
      <label>Ghi chú<input value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} /></label>
      <button className="admin-primary" type="submit">Lưu chấm công</button>
    </form>}
    {team && <div className="hr-team-roster">{teamAttendance && <h3>Nhân viên trong nhóm</h3>}{roster.loading ? <PanelLoading /> : roster.error ? <ListError message={roster.error} onRetry={() => setReload(value => value + 1)} /> : members.length ? members.map(member => <span key={member.employeeId}>{member.employeeCode} · {member.fullName} · {member.jobTitle}</span>) : <p>Chưa có nhân viên trực tiếp trong nhóm.</p>}</div>}
    {(!team || teamAttendance) && (loading ? <PanelLoading /> : error ? <ListError message={error} onRetry={() => setReload(value => value + 1)} /> : <Table headers={team ? ['Nhân viên','Ngày','Trạng thái','Ngày công'] : hr ? ['Nhân viên','Ngày','Trạng thái','Ngày công','Ngày tính lương','OT thường','OT nghỉ','OT lễ','OT đêm'] : ['Ngày','Trạng thái','Ngày công','Ngày tính lương','OT thường','OT nghỉ','OT lễ','OT đêm']}>
      {rows.map((row, index) => <tr key={row.id || `${row.employeeId || 'me'}-${row.attendanceDate}-${index}`}>
        {team && <td>{row.employeeCode} · {row.employeeName}</td>}{hr && <td>{row.employeeCode} · {row.employeeName}</td>}
        <td>{row.attendanceDate}</td><td>{row.attendanceStatus}</td><td>{row.dayFraction}</td>
        {!team && <><td>{row.paidEquivalentDays}</td><td>{row.overtimeNormalHours}</td><td>{row.overtimeRestDayHours}</td><td>{row.overtimeHolidayHours}</td><td>{row.overtimeNightHours}</td></>}
      </tr>)}
    </Table>)}
    {notice && <p role="status" className="hr-notice">{notice}</p>}
  </section>;
}

export function EmployeePayrollPage({ hr = false }) {
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState('');
  const [printTarget, setPrintTarget] = useState(null);
  const [standardDays, setStandardDays] = useState('22');
  const [dependentCountsJson, setDependentCountsJson] = useState('{}');
  const [rulesFrom, setRulesFrom] = useState(`${currentYear()}-01-01`);
  const [rulesJson, setRulesJson] = useState('');
  const path = hr ? adminEndpoints.payrollPeriod(year, month) : adminEndpoints.myPayslips(year);
  const { data, error, loading } = useApiData(path, reload);
  const periods = hr ? useApiData(adminEndpoints.payrollPeriods({ year }), reload) : { data: null, error: '', loading: false };
  const settingPath = adminEndpoints.payrollSettings({ asOf: `${year}-${String(month).padStart(2, '0')}-01` });
  const setting = hr ? useApiData(settingPath, reload) : { data: null, error: '', loading: false };
  useEffect(() => { if (setting.data?.settingValue) setRulesJson(JSON.stringify(setting.data.settingValue, null, 2)); }, [setting.data]);
  useEffect(() => {
    const finishPrint = () => setPrintTarget(null);
    window.addEventListener('afterprint', finishPrint);
    return () => window.removeEventListener('afterprint', finishPrint);
  }, []);
  const printPayslip = target => {
    setPrintTarget(target);
    window.requestAnimationFrame(() => window.print());
  };
  const post = async (url, method = 'POST', body) => {
    setNotice('');
    try { await adminApi(url, { method, ...(body ? { body } : {}) }); setNotice('Đã lưu thay đổi.'); setReload(value => value + 1); }
    catch (failure) { setNotice(failure.message || 'Không thể lưu thay đổi.'); }
  };
  const saveRules = async event => {
    event.preventDefault();
    try { const settingValue = JSON.parse(rulesJson); await post(adminEndpoints.payrollSettings(), 'PUT', { settingKey: 'PAYROLL_RULES', effectiveFrom: rulesFrom, settingValue, note: 'Cấu hình HR theo quy định áp dụng' }); }
    catch (failure) { setNotice(failure instanceof SyntaxError ? 'JSON cấu hình không hợp lệ.' : failure.message); }
  };
  const generate = event => {
    event.preventDefault();
    try {
      const dependentCounts = JSON.parse(dependentCountsJson);
      if (!dependentCounts || Array.isArray(dependentCounts) || typeof dependentCounts !== 'object') throw new Error('Cần nhập object JSON với mã nhân viên làm khóa.');
      void post(adminEndpoints.generatePayroll(), 'POST', { year: Number(year), month: Number(month), standardPaidWorkdays: Number(standardDays), dependentCounts });
    } catch (failure) { setNotice(failure.message || 'JSON số người phụ thuộc không hợp lệ.'); }
  };
  const slips = hr ? data?.payslips || [] : data || [];
  const annualTotals = slips.reduce((totals, slip) => ({
    gross: totals.gross + Number(slip.grossEarnings || 0) + Number(slip.separateBenefits || 0),
    deductions: totals.deductions + Number(slip.employeeDeductions || 0),
    takeHome: totals.takeHome + Number(slip.takeHomePay || 0),
  }), { gross: 0, deductions: 0, takeHome: 0 });
  const latestPeriod = (periods.data || []).find(period => period.year === year && period.month === month);
  const payrollLoading = loading || (hr && periods.loading);
  const payrollError = hr ? periods.error || (latestPeriod ? error : '') : error;
  return <section className="admin-panel hr-workspace">
    <PanelTitle title={hr ? 'Bảng lương' : 'Phiếu lương của tôi'} subtitle={hr ? 'Cấu hình, lập, duyệt và công bố lương theo từng kỳ.' : 'Chỉ hiển thị phiếu lương đã được nhân sự công bố.'} />
    {hr ? <>
      <form className="hr-settings-form" onSubmit={saveRules}>
        <h3>Cấu hình tính lương hiệu lực theo ngày</h3><p>Nhập mức thuế, bảo hiểm, lịch làm và hệ số tăng ca đã được HR xác nhận. Hệ thống không tự đặt mức pháp định.</p>
        {setting.error && <ListError message={setting.error} onRetry={() => setReload(value => value + 1)} />}
        <label>Hiệu lực từ<input type="date" required value={rulesFrom} onChange={event => setRulesFrom(event.target.value)} /></label>
        <label>Quy tắc PAYROLL_RULES (JSON)<textarea required rows="10" value={rulesJson} onChange={event => setRulesJson(event.target.value)} placeholder={'{"hoursPerWorkday":8,"normalOvertimeMultiplier":1.5,"restDayOvertimeMultiplier":2,"holidayOvertimeMultiplier":3,"nightWorkPremiumMultiplier":0.3,"employeeInsuranceRate":0,"employerContributionRate":0,"personalTaxAllowance":0,"dependentTaxAllowance":0,"workingWeekdays":[1,2,3,4,5],"publicHolidays":[],"taxBrackets":[{"lowerBound":0,"upperBound":null,"rate":0}]}'} /></label>
        <button type="submit">Lưu cấu hình</button>
      </form>
      {!latestPeriod && !periods.loading && <p className="hr-notice">Chưa có kỳ lương cho tháng đang chọn. Hãy kiểm tra cấu hình và tạo kỳ lương nháp.</p>}
      <form className="hr-filter-row" onSubmit={generate}>
        <label>Năm<input type="number" min="2000" max="2100" value={year} onChange={event => setYear(Number(event.target.value))} /></label>
        <label>Tháng<select value={month} onChange={event => setMonth(Number(event.target.value))}>{monthNames.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Ngày công chuẩn<input type="number" min="0.5" max="31" step="0.5" required value={standardDays} onChange={event => setStandardDays(event.target.value)} /></label>
        <label>Số người phụ thuộc theo mã nhân viên (JSON)<textarea rows="2" value={dependentCountsJson} onChange={event => setDependentCountsJson(event.target.value)} aria-label="Số người phụ thuộc theo mã nhân viên" /><small>Ví dụ: {`{"42": 1}`}. Bỏ trống trong object tương đương 0 người phụ thuộc.</small></label>
        <button className="admin-primary" type="submit">Tạo kỳ lương nháp</button>
      </form>
      {latestPeriod && <div className="hr-period-actions"><b>Kỳ {year}/{String(month).padStart(2, '0')} · {latestPeriod.status}</b>{latestPeriod.status === 'DRAFT' && <button onClick={() => post(adminEndpoints.reviewPayroll(year, month))}>Duyệt kỳ lương</button>}{latestPeriod.status === 'REVIEWED' && <button onClick={() => post(adminEndpoints.publishPayroll(year, month))}>Công bố phiếu lương</button>}</div>}
    </> : <div className="hr-filter-row"><label>Năm<input type="number" min="2000" max="2100" value={year} onChange={event => setYear(Number(event.target.value))} /></label></div>}
    {payrollLoading ? <PanelLoading /> : payrollError ? <ListError message={payrollError} onRetry={() => setReload(value => value + 1)} /> : slips.length === 0 ? <p className="admin-table-empty">{hr ? 'Chưa có bảng lương cho kỳ này.' : 'Chưa có phiếu lương công bố trong năm này.'}</p> : hr ? <Table headers={['Nhân viên','Ngày công','Tổng thu nhập','Khấu trừ','Thực nhận','Trạng thái']}>
      {slips.map(slip => <tr key={slip.id}><td>{slip.employeeCode} · {slip.employeeName}</td><td>{slip.paidEquivalentDays}</td><td>{money(slip.grossEarnings + slip.separateBenefits)}</td><td>{money(slip.employeeDeductions)}{slip.uncollectedDeductions > 0 && <small>Chưa thu: {money(slip.uncollectedDeductions)}</small>}</td><td><b>{money(slip.takeHomePay)}</b></td><td>{slip.status}</td></tr>)}
    </Table> : <>
      <button className="hr-annual-print" onClick={() => printPayslip('annual')}>In bảng lương năm {year}</button>
      <div className="hr-pay-totals hr-annual-summary"><span>Tổng thu nhập năm <b>{money(annualTotals.gross)}</b></span><span>Tổng khấu trừ năm <b>{money(annualTotals.deductions)}</b></span><span>Tổng thực nhận năm <b>{money(annualTotals.takeHome)}</b></span></div>
      <div className={`hr-payslip-list${printTarget === 'annual' ? ' hr-print-annual' : printTarget !== null ? ' hr-print-monthly' : ''}`}>
        {slips.map(slip => <article className={`hr-payslip${printTarget === slip.id ? ' is-print-target' : ''}`} key={slip.id}>
          <div className="hr-payslip-head"><div><h3>{slip.year}/{String(slip.month).padStart(2, '0')} · Phiếu lương #{slip.revision}</h3><p>{slip.employeeCode} · {slip.status}</p></div><button onClick={() => printPayslip(slip.id)}>In phiếu tháng</button></div>
          <div className="hr-pay-totals"><span>Tổng thu nhập <b>{money(slip.grossEarnings + slip.separateBenefits)}</b></span><span>Khấu trừ <b>{money(slip.employeeDeductions)}</b></span><span>Thực nhận <b>{money(slip.takeHomePay)}</b></span></div>
          <Table headers={['Khoản mục','Loại','Số tiền']}>{(slip.lines || []).map((line, index) => <tr key={line.id || `${line.code}-${index}`}><td>{line.description}</td><td>{line.lineType}</td><td>{money(line.amount)}</td></tr>)}</Table>
          {slip.uncollectedDeductions > 0 && <p role="note">Khoản khấu trừ chưa thu trong kỳ: {money(slip.uncollectedDeductions)}. Hãy liên hệ nhân sự để được hướng dẫn.</p>}
        </article>)}
      </div>
    </>}
    {notice && <p role="status" className="hr-notice">{notice}</p>}
  </section>;
}

export function EmployeeReportPage() {
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const path = adminEndpoints.hrReports({ year, month });
  const { data, error, loading } = useApiData(path);
  return <section className="admin-panel hr-workspace">
    <PanelTitle title="Báo cáo nhân sự" subtitle="Tình trạng nhân sự, nghỉ phép, học vấn, mức lương và thâm niên theo kỳ." />
    <div className="hr-filter-row"><label>Năm<input type="number" min="2000" max="2100" value={year} onChange={event => setYear(Number(event.target.value))} /></label><label>Tháng<select value={month} onChange={event => setMonth(Number(event.target.value))}>{monthNames.map(item => <option key={item} value={item}>{item}</option>)}</select></label></div>
    {loading ? <PanelLoading /> : error ? <ListError message={error} onRetry={() => window.location.reload()} /> : data && <>
      <div className="hr-kpi-grid"><article><span>Nhân sự trong kỳ</span><b>{data.summary.totalEmployees}</b></article><article><span>Đang làm việc</span><b>{data.summary.activeCount}</b></article><article><span>Đang nghỉ được duyệt</span><b>{data.summary.onApprovedLeaveCount}</b></article><article><span>Nghỉ việc trong kỳ</span><b>{data.summary.resignedInPeriodCount}</b></article><article><span>Đã chấm dứt</span><b>{data.summary.terminatedInPeriodCount}</b></article></div>
      <div className="hr-report-summaries"><article><h3>Học vấn</h3>{data.educationSummary.map(item => <p key={item.educationLevel}>{item.educationLevel}<b>{item.employeeCount}</b></p>)}</article><article><h3>Lương tháng ({data.salarySummary.basis})</h3><p>Tổng <b>{money(data.salarySummary.totalMonthlyBaseSalary)}</b></p><p>Trung bình <b>{money(data.salarySummary.averageMonthlyBaseSalary)}</b></p><p>Thấp nhất / cao nhất <b>{money(data.salarySummary.minimumMonthlyBaseSalary)} / {money(data.salarySummary.maximumMonthlyBaseSalary)}</b></p></article><article><h3>Thâm niên</h3><p>Trung bình <b>{data.tenureSummary.averageTenureMonths} tháng</b></p><p>Cao nhất <b>{data.tenureSummary.maximumTenureMonths} tháng</b></p></article></div>
      <Table headers={['Nhân viên','Trạng thái','Nghỉ được duyệt','Học vấn','Lương tháng','Thâm niên']}>
        {data.employees.map(employee => <tr key={employee.employeeId}><td>{employee.employeeCode} · {employee.fullName}<small>{employee.jobTitle}</small></td><td>{employmentStatusLabel(employee.employmentStatus)}</td><td>{employee.approvedLeaveTypes.join(', ') || '—'}</td><td>{employee.educationLevel || 'Chưa cập nhật'}</td><td>{money(employee.monthlyBaseSalary)}<small>{employee.salaryBasis}</small></td><td>{employee.tenureMonths} tháng</td></tr>)}
      </Table>
    </>}
  </section>;
}
