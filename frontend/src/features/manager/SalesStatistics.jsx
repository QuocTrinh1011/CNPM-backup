import React, { useCallback } from 'react';
import { adminApi } from '../../api/manager-api';
import { managerQuery, useManagerFilters } from '../../shared/hooks/useManagerFilters';
import { useManagerResource } from '../../shared/hooks/useManagerResource';
import './sales-statistics.css';

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
const currentYear = () => Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date()));
const defaults = { year: String(currentYear()), groupBy: 'quarter' };
const periodLabel = (period, groupBy) => groupBy === 'quarter' ? period.split('-')[1] : groupBy === 'month' ? `Tháng ${period.slice(-2)}` : period;

function PeriodTable({ title, description, firstHeader, periods, rows, groupBy, totalLabel = 'Tổng', metric }) {
  return <section className="sales-stat-card">
    <div className="sales-stat-heading"><div><h3>{title}</h3>{description && <p>{description}</p>}</div></div>
    <div className="sales-stat-scroll"><table className="sales-stat-table">
      <thead><tr><th>{firstHeader}</th>{periods.map(period => <th key={period}>{periodLabel(period, groupBy)}</th>)}<th>{totalLabel}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.key}>
        <th scope="row">{row.label}</th>
        {periods.map(period => <td key={period}>{row.value(period)}</td>)}
        <td><strong>{row.total}</strong></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

export default function SalesStatistics() {
  const [filters, change] = useManagerFilters(defaults);
  const groupBy = ['month', 'quarter', 'year'].includes(filters.groupBy) ? filters.groupBy : 'quarter';
  const year = Number(filters.year);
  const validYear = Number.isInteger(year) && year >= 2000 && year <= currentYear() + 1;
  const fetcher = useCallback(signal => adminApi(`/api/manager/reports/sales-statistics?${managerQuery({ year, groupBy })}`, { signal }), [year, groupBy]);
  const { data, loading, error, backgroundError, load } = useManagerResource(fetcher, { enabled: validYear });
  const periods = data?.periods || [];
  const financeRows = [
    { key: 'collected', label: 'Tổng tiền đã thu', value: period => money(data?.finance?.find(row => row.period === period)?.collected), total: money(data?.totalCollected) },
    { key: 'expense', label: 'Tổng chi nhập kho', value: period => money(data?.finance?.find(row => row.period === period)?.inventoryExpense), total: money(data?.totalInventoryExpense) },
    { key: 'profit', label: 'Lợi nhuận tạm tính', value: period => money(data?.finance?.find(row => row.period === period)?.estimatedProfit), total: money(data?.estimatedProfit) },
  ];
  const employeeRows = (data?.employees || []).map(employee => ({
    key: employee.id ?? 'online', label: employee.name,
    value: period => money(employee.periods?.find(item => item.period === period)?.amount),
    total: money(employee.totalRevenue),
  }));
  const productRows = (data?.products || []).map(product => ({
    key: product.id, label: product.name,
    value: period => money(product.periods?.find(item => item.period === period)?.amount),
    total: money(product.totalRevenue),
  }));
  const yearLabel = groupBy === 'year' ? 'Tất cả các năm' : `Năm ${year}`;

  return <section className="sales-statistics" aria-label="Thống kê doanh thu">
    <div className="sales-stat-toolbar">
      <div><h3>Thống kê doanh thu</h3><p>Gom theo thời điểm xác nhận thu và nhận hàng · múi giờ Việt Nam.</p></div>
      <div className="sales-stat-filters">
        <label>Thống kê theo<select value={groupBy} onChange={event => change({ groupBy: event.target.value })}><option value="month">Tháng</option><option value="quarter">Quý</option><option value="year">Năm (các năm)</option></select></label>
        {groupBy !== 'year' && <label>Năm<input type="number" min="2000" max={currentYear() + 1} value={filters.year} onChange={event => change({ year: event.target.value })} /></label>}
      </div>
    </div>
    {!validYear && groupBy !== 'year' && <p className="sales-stat-error" role="alert">Nhập năm hợp lệ.</p>}
    {(error || backgroundError) && <div className="sales-stat-error" role="alert">{error || backgroundError}<button className="admin-action" type="button" onClick={() => load(true)}>Tải lại</button></div>}
    {loading && !data && <p role="status">Đang tải thống kê…</p>}
    {data && <>
      <PeriodTable title={`Thu, chi và lợi nhuận · ${yearLabel}`} description="Lợi nhuận tạm tính = tổng tiền đã thu − chi nhập kho." firstHeader={groupBy === 'quarter' ? yearLabel : groupBy === 'month' ? `Tháng · ${year}` : 'Năm'} periods={periods} rows={financeRows} groupBy={groupBy} totalLabel={groupBy === 'year' ? 'Tất cả' : 'Cả năm'} />
      <PeriodTable title={`Doanh thu theo nhân viên · ${yearLabel}`} description="Đơn chưa gán được nhân viên hiển thị riêng ở dòng Online / chưa gán nhân viên. Gán nhân viên trong chi tiết đơn hàng." firstHeader="Nhân viên" periods={periods} rows={employeeRows} groupBy={groupBy} totalLabel={groupBy === 'year' ? 'Tất cả' : 'Cả năm'} />
      <PeriodTable title={`Doanh thu theo sản phẩm · ${yearLabel}`} description="Doanh thu sản phẩm đã phân bổ giảm giá cấp đơn theo tỷ trọng giá trị từng sản phẩm." firstHeader="Sản phẩm" periods={periods} rows={productRows} groupBy={groupBy} totalLabel={groupBy === 'year' ? 'Tất cả' : 'Cả năm'} />
      <div className="sales-stat-note"><p><b>{data.collectedOrders}</b> đơn đã xác nhận thu · Tổng tiền đã thu {money(data.totalCollected)} · Chi nhập kho {money(data.totalInventoryExpense)} · Lợi nhuận tạm tính {money(data.estimatedProfit)}.</p>
        {Number(data.unknownPayment?.orders) > 0 && <p>Có {data.unknownPayment.orders} đơn PayOS cũ đã thanh toán nhưng thiếu ngày xác nhận ({money(data.unknownPayment.amount)}); các đơn này được để ngoài biểu đồ theo kỳ để không tự suy đoán ngày.</p>}
        <p>Hai phiếu nhập mẫu năm 2025 dùng giá ước tính sẽ được tính vào chi nhập kho. Chi nhập kho chưa phải giá vốn hàng đã bán và chưa gồm chi phí vận hành.</p>
      </div>
      <small className="sales-stat-updated">Cập nhật {data.updatedAt ? new Date(data.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}.</small>
    </>}
  </section>;
}
