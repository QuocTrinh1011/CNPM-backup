import React, { useEffect, useState } from 'react';
import { adminApi, adminEndpoints } from '../../../api/manager-api';
import { ListError, PanelLoading, PanelTitle, Table } from '../ManagerComponents';
import { currentYear, monthNames, money } from './employeeWorkspaceUtils';
import { payrollRulesJson } from './payrollRulePresets';
import { useApiData } from './useApiData';
export function EmployeePayrollPage({ hr = false }) {
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState('');
  const [printTarget, setPrintTarget] = useState(null);
  const [standardDays, setStandardDays] = useState('22');
  const [dependentCountsJson, setDependentCountsJson] = useState('{}');
  const [rulesFrom, setRulesFrom] = useState(`${currentYear()}-01-01`);
  const [rulesJson, setRulesJson] = useState(payrollRulesJson);
  const path = hr ? adminEndpoints.payrollPeriod(year, month) : adminEndpoints.myPayslips(year);
  const { data, error, loading } = useApiData(path, reload);
  const periods = useApiData(hr ? adminEndpoints.payrollPeriods({ year }) : null, reload);
  const settingPath = adminEndpoints.payrollSettings({ asOf: `${year}-${String(month).padStart(2, '0')}-01` });
  const setting = useApiData(hr ? settingPath : null, reload);
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
        <div className="hr-rule-preset"><span>Mẫu 2026 chỉ điền vào biểu mẫu khi bạn chọn; hệ thống không tự lưu. Kiểm tra lịch làm, địa bàn và căn cứ bảo hiểm trước khi lưu.</span><button type="button" onClick={() => setRulesJson(payrollRulesJson())}>Dùng cấu hình đề xuất 2026</button></div>
        <label>Quy tắc PAYROLL_RULES (JSON)<textarea required rows="10" value={rulesJson} onChange={event => setRulesJson(event.target.value)} /></label>
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
