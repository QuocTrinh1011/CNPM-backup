import React, { useState } from 'react';
import { adminEndpoints } from '../../../api/manager-api';
import { ListError, PanelLoading, PanelTitle, Table } from '../ManagerComponents';
import { currentYear, monthNames, money, employmentStatusLabel } from './employeeWorkspaceUtils';
import { useApiData } from './useApiData';
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
