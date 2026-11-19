import AdminOrganizationOverview from "./AdminOrganizationOverview";
import AdminSecurityOverview from "./AdminSecurityOverview";
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, ChevronRight, CreditCard, Layers, Package, RefreshCw, ShieldCheck, ShoppingBag, Users } from 'lucide-react';
import { adminApi } from '../../api/api';
import './styles/admin-dashboard.css';

const CURRENT_YEAR = new Date().getFullYear();
const PERIOD_TYPES = [
  ['year', 'Năm'],
  ['quarter', 'Quý'],
  ['month', 'Tháng'],
];
const QUARTERS = [1, 2, 3, 4];
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function formatMoney(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

function formatVnd(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatCompactMoney(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} k`;
  return `${value} đ`;
}

function MultiViewDonutChart({ slices, totalNumber, centerValue, centerLabel, unit = '' }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const computedSlices = useMemo(() => {
    let accumulated = 0;
    return slices.map((item) => {
      const percentage = totalNumber > 0 ? item.value / totalNumber : 0;
      const strokeLength = percentage * circumference;
      const strokeDashoffset = -accumulated;
      accumulated += strokeLength;
      return { ...item, percentage: Math.round(percentage * 100), strokeLength, strokeDashoffset };
    });
  }, [slices, totalNumber, circumference]);

  return (
    <div className="hallmark-donut-layout">
      <div className="hallmark-chart-viewport">
        <svg viewBox="0 0 100 100" className="hallmark-donut-svg" aria-hidden="true">
          <circle cx="50" cy="50" r={radius} className="hallmark-donut-bg-track" fill="transparent" strokeWidth="10" />
          {computedSlices.map((slice) => (
            <circle key={slice.id} cx="50" cy="50" r={radius} fill="transparent" stroke={slice.color || '#94a3b8'}
              strokeWidth="10" strokeDasharray={`${slice.strokeLength} ${circumference}`} strokeDashoffset={slice.strokeDashoffset}
              className="hallmark-donut-segment">
              <title>{`${slice.label}: ${slice.displayValue || slice.value} (${slice.percentage}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="hallmark-chart-center"><span className="hallmark-center-val">{centerValue}</span><span className="hallmark-center-lbl">{centerLabel}</span></div>
      </div>
      <div className="hallmark-legend-list">
        {computedSlices.map((slice) => (
          <div key={slice.id} className="hallmark-legend-row">
            <div className="hallmark-legend-identity"><span className="hallmark-color-dot" style={{ backgroundColor: slice.color }} /><span className="hallmark-role-title">{slice.label}</span></div>
            <div className="hallmark-legend-stats"><span className="hallmark-stats-count">{slice.displayValue || `${slice.value} ${unit}`}</span><span className="hallmark-stats-percent">({slice.percentage}%)</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportTable({ label, columns, rows, renderRow }) {
  return (
    <div className="admin-stat-table-wrap">
      <table aria-label={label}>
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map(renderRow) : (
            <tr><td colSpan={columns.length} className="admin-stat-empty">Chưa có dữ liệu trong kỳ này.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProductTable({ rows }) {
  return <ReportTable
    label="Sản phẩm bán chạy"
    columns={['Sản phẩm', 'Danh mục', 'Màu', 'Cỡ', 'Số lượng', 'Doanh thu']}
    rows={rows}
    renderRow={(row) => <tr key={JSON.stringify([row.productId, row.color, row.size])}>
      <td><strong>{row.productName || 'Sản phẩm'}</strong></td>
      <td>{row.categoryName || '—'}</td>
      <td>{row.color || 'Chưa phân loại'}</td>
      <td>{row.size || '—'}</td>
      <td>{row.quantitySold || 0}</td>
      <td>{formatMoney(row.totalRevenue)}</td>
    </tr>}
  />;
}

function CustomerTable({ rows }) {
  return <ReportTable
    label="Khách hàng chi tiêu nhiều"
    columns={['Khách hàng', 'Email', 'Số đơn', 'Tổng mua']}
    rows={rows}
    renderRow={(row) => <tr key={row.customerId}>
      <td><strong>{row.fullName || 'Khách hàng'}</strong></td>
      <td>{row.email || '—'}</td>
      <td>{row.orderCount || 0}</td>
      <td>{formatMoney(row.totalSpent)}</td>
    </tr>}
  />;
}

function EmployeeTable({ rows }) {
  return <ReportTable
    label="Hoạt động nhập kho theo nhân viên"
    columns={['Người lập phiếu', 'Email', 'Số phiếu nhập', 'Tổng giá trị phiếu']}
    rows={rows}
    renderRow={(row, index) => <tr key={row.employeeId ?? `unknown-${index}`}>
      <td><strong>{row.fullName || 'Hệ thống / Không xác định'}</strong></td>
      <td>{row.email || '—'}</td>
      <td>{row.receiptCount || 0}</td>
      <td>{formatMoney(row.totalReceiptCost)}</td>
    </tr>}
  />;
}

function QuickLinks({ go, managerUrl }) {
  return (
    <section className="admin-stat-panel" aria-labelledby="admin-stat-quick-links">
      <div className="admin-stat-heading">
        <div><h2 id="admin-stat-quick-links">Lối tắt quản trị</h2><p>Mở nhanh các khu vực quản trị hệ thống.</p></div>
      </div>
      <div className="admin-stat-quick-links">
        <button type="button" onClick={() => go('/admin/accounts')}><ShieldCheck size={17} /><span>Tài khoản nội bộ</span><ChevronRight size={16} /></button>
        <button type="button" onClick={() => go('/admin/products')}><Package size={17} /><span>Danh mục sản phẩm</span><ChevronRight size={16} /></button>
        <a href={managerUrl}><Layers size={17} /><span>Cổng quản lý Manager</span><ChevronRight size={16} /></a>
      </div>
      <div className="admin-stat-governance"><ShieldCheck size={16} /><span>Admin quản trị tài khoản và hệ thống; nghiệp vụ bán hàng, đơn hàng và kho thực hiện trong Manager Portal.</span></div>
    </section>
  );
}

export default function AdminDashboard({ session, go, managerUrl }) {
  const [activeTab, setActiveTab] = useState('roles');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [periodType, setPeriodType] = useState('year');
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setLocalRetry] = useState(0);

  const roleChartData = useMemo(() => ({
    slices: [
      { id: 'ADMIN', label: 'Admin hệ thống', value: 1, displayValue: '1 vị trí (10%)', color: '#6366f1' },
      { id: 'MANAGER_SALES', label: 'Quản lý Bán hàng', value: 1, displayValue: '1 vị trí (10%)', color: '#0ea5e9' },
      { id: 'MANAGER_WAREHOUSE', label: 'Quản lý Kho', value: 1, displayValue: '1 vị trí (10%)', color: '#f59e0b' },
      { id: 'MANAGER_HR', label: 'Quản lý Nhân sự', value: 1, displayValue: '1 vị trí (10%)', color: '#10b981' },
      { id: 'EMPLOYEE_SALES', label: 'Nhân viên Bán hàng', value: 3, displayValue: '3 nhân sự (30%)', color: '#38bdf8' },
      { id: 'EMPLOYEE_WAREHOUSE', label: 'Nhân viên Kiểm kho', value: 3, displayValue: '3 nhân sự (30%)', color: '#fbbf24' },
    ],
    totalNumber: 10,
    centerValue: '10',
    centerLabel: 'Nhân sự',
    unit: '',
  }), []);

  const paymentChartData = useMemo(() => {
    const payosAmount = 18450000;
    const codAmount = 8250000;
    const totalRevenue = payosAmount + codAmount;
    return {
      slices: [
        { id: 'PAYOS', label: 'Cổng PayOS QR (Trực tuyến)', value: payosAmount, displayValue: formatVnd(payosAmount), color: '#6366f1' },
        { id: 'COD', label: 'Tiền mặt khi nhận hàng (COD)', value: codAmount, displayValue: formatVnd(codAmount), color: '#10b981' },
      ],
      totalNumber: totalRevenue,
      centerValue: formatCompactMoney(totalRevenue),
      centerLabel: 'Tổng thu',
      unit: '',
    };
  }, []);

  const orderChartData = useMemo(() => {
    const completed = 142;
    const processing = 35;
    const cancelled = 15;
    const totalOrders = completed + processing + cancelled;
    return {
      slices: [
        { id: 'COMPLETED', label: 'Hoàn tất / Đã giao', value: completed, displayValue: `${completed} đơn`, color: '#10b981' },
        { id: 'PROCESSING', label: 'Đang xử lý / Đang giao', value: processing, displayValue: `${processing} đơn`, color: '#0284c7' },
        { id: 'CANCELLED', label: 'Đã hủy / Thất bại', value: cancelled, displayValue: `${cancelled} đơn`, color: '#f43f5e' },
      ],
      totalNumber: totalOrders,
      centerValue: String(totalOrders),
      centerLabel: 'Đơn hàng',
      unit: 'đơn',
    };
  }, []);

  const currentChart = useMemo(() => {
    if (activeTab === 'payments') return {
      title: 'Cơ cấu Doanh thu theo Kênh Thanh toán',
      description: 'Tỷ trọng dòng tiền thanh toán trực tuyến PayOS QR và tiền mặt COD.',
      ...paymentChartData,
    };
    if (activeTab === 'orders') return {
      title: 'Tỷ lệ Đơn hàng theo Trạng thái',
      description: 'Đánh giá tỷ lệ đơn giao thành công, đang giao và đơn bị hủy.',
      ...orderChartData,
    };
    return {
      title: 'Cơ cấu Tổ chức & Phân bổ Nhân sự (10 vị trí)',
      description: 'Phân bổ nhân sự: 4 Quản trị viên (40%) & 6 Nhân viên tác nghiệp Bán hàng / Kiểm kho (60%).',
      ...roleChartData,
    };
  }, [activeTab, roleChartData, paymentChartData, orderChartData]);

  const reportPath = useMemo(() => {
    const params = new URLSearchParams({ year: String(year) });
    if (periodType === 'quarter') params.set('quarter', String(quarter));
    if (periodType === 'month') params.set('month', String(month));
    return `/api/admin/reports?${params.toString()}`;
  }, [year, periodType, quarter, month]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError('');
    adminApi(reportPath, { signal: controller.signal })
      .then((report) => { if (current) setData(report); })
      .catch((failure) => {
        if (current && !controller.signal.aborted) setError(failure.message || 'Không tải được số liệu thống kê.');
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [reportPath, retry]);

  const years = useMemo(() => {
    const available = data?.availableYears || [];
    return [...new Set([CURRENT_YEAR, year, ...available])]
      .sort((left, right) => left === CURRENT_YEAR ? -1 : right === CURRENT_YEAR ? 1 : right - left);
  }, [data?.availableYears, year]);
  const trend = data?.trend || [];
  const maxTrend = Math.max(1, ...trend.flatMap((bucket) => [Number(bucket.income) || 0, Number(bucket.expense) || 0]));
  const periodLabel = periodType === 'quarter' ? `Quý ${quarter} · ${year}`
    : periodType === 'month' ? `Tháng ${month} · ${year}` : `Năm ${year}`;

  return (
    <div className="hallmark-dashboard admin-stat-dashboard">
      <section className="hallmark-hero-banner">
        <div className="hallmark-hero-text">
          <span className="hallmark-eyebrow">BÁO CÁO HỆ THỐNG</span>
          <h2>Xin chào, {session?.email?.split('@')[0] || 'Admin'}!</h2>
          <p>Theo dõi thu chi, sản phẩm, khách hàng và hoạt động nhân viên theo kỳ.</p>
        </div>
        <button type="button" className="hallmark-link-btn admin-stat-refresh" onClick={() => setLocalRetry((value) => value + 1)}>
          <RefreshCw size={14} /> Làm mới
        </button>
      </section>

      <section className="admin-stat-panel admin-stat-toolbar" aria-label="Bộ lọc kỳ báo cáo">
        <div><span className="admin-stat-eyebrow">KỲ BÁO CÁO</span><p>Số liệu được tính theo múi giờ Việt Nam.</p></div>
        <div className="admin-stat-filters">
          <label>Năm<select aria-label="Năm báo cáo" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((value) => <option key={value} value={value}>{value}{value === CURRENT_YEAR ? ' · Hiện hành' : ''}</option>)}
          </select></label>
          <label>Khoảng thời gian<select aria-label="Loại kỳ báo cáo" value={periodType} onChange={(event) => setPeriodType(event.target.value)}>
            {PERIOD_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {periodType === 'quarter' ? <label>Quý<select aria-label="Quý báo cáo" value={quarter} onChange={(event) => setQuarter(Number(event.target.value))}>
            {QUARTERS.map((value) => <option key={value} value={value}>Quý {value}</option>)}
          </select></label> : null}
          {periodType === 'month' ? <label>Tháng<select aria-label="Tháng báo cáo" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}
          </select></label> : null}
        </div>
      </section>

      <div className="hallmark-split-grid admin-stat-overview-grid">
        <section className="hallmark-section-box" aria-label="Biểu đồ tròn thống kê Admin">
          <div className="hallmark-section-header">
            <div><h3>{currentChart.title}</h3><p>{currentChart.description}</p></div>
            {activeTab === 'roles' ? <button className="hallmark-link-btn" onClick={() => go('/admin/accounts')}>Quản lý</button> : null}
          </div>
          <div className="hallmark-tab-control" role="tablist" aria-label="Chọn sơ đồ thống kê">
            <button type="button" role="tab" aria-selected={activeTab === 'roles'} className={`hallmark-tab-btn ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
              <Users size={14} /><span>Vai trò nội bộ</span>
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'payments'} className={`hallmark-tab-btn ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
              <CreditCard size={14} /><span>Kênh thanh toán</span>
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'orders'} className={`hallmark-tab-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
              <ShoppingBag size={14} /><span>Trạng thái đơn</span>
            </button>
          </div>
          <MultiViewDonutChart slices={currentChart.slices} totalNumber={currentChart.totalNumber}
            centerValue={currentChart.centerValue} centerLabel={currentChart.centerLabel} unit={currentChart.unit} />
        </section>
        <QuickLinks go={go} managerUrl={managerUrl} />
      </div>

      {loading ? <div className="admin-stat-panel admin-stat-message" role="status"><RefreshCw size={17} className="admin-stat-spin" />Đang tải thống kê {periodLabel.toLowerCase()}...</div> : null}
      {!loading && error ? <div className="admin-stat-panel admin-stat-error" role="alert"><AlertTriangle size={19} /><div><strong>Không tải được thống kê</strong><p>{error}</p></div><button type="button" className="hallmark-link-btn" onClick={() => setLocalRetry((value) => value + 1)}>Thử lại</button></div> : null}

      {!loading && !error && data ? <>
        <section className="admin-stat-panel" aria-labelledby="admin-stat-income-heading">
          <div className="admin-stat-heading"><div><span className="admin-stat-eyebrow">01 · TÀI CHÍNH</span><h2 id="admin-stat-income-heading">Tổng thu chi</h2><p>{periodLabel} · Thu theo ngày ghi nhận thanh toán, chi theo ngày lập phiếu nhập kho.</p></div></div>
          <div className="admin-stat-summary">
            <article className="admin-stat-metric income"><div><span>Tổng thu</span><ArrowUpRight size={17} /></div><strong>{formatMoney(data.summary?.totalIncome)}</strong><small>{data.summary?.paidOrdersCount || 0} đơn đã thu tiền</small></article>
            <article className="admin-stat-metric expense"><div><span>Tổng chi nhập kho</span><ArrowDownRight size={17} /></div><strong>{formatMoney(data.summary?.totalExpense)}</strong><small>{data.summary?.stockReceiptsCount || 0} phiếu nhập kho</small></article>
            <article className="admin-stat-metric balance"><div><span>Chênh lệch</span><Activity size={17} /></div><strong>{formatMoney(data.summary?.netBalance)}</strong><small>Tổng thu trừ chi nhập kho</small></article>
          </div>
          <div className="admin-stat-trend-heading"><div><BarChart3 size={17} /><strong>Xu hướng thu chi</strong><span>{periodType === 'month' ? 'Theo ngày' : 'Theo tháng'}</span></div><div className="admin-stat-legend"><span><i className="income" />Thu</span><span><i className="expense" />Chi</span></div></div>
          <div className="admin-stat-chart-scroll">
            <div className={`admin-stat-chart${periodType === 'month' ? ' is-month' : ''}`} style={{ '--report-bucket-count': trend.length }} role="img" aria-label={`Xu hướng thu chi ${periodLabel}`}>
              {trend.map((bucket, index) => <div className="admin-stat-bucket" key={`${bucket.label}-${index}`} aria-label={`${bucket.label}: thu ${formatMoney(bucket.income)}, chi ${formatMoney(bucket.expense)}`}>
                <div className="admin-stat-bars"><i className="income" style={{ height: `${Math.max(0, (Number(bucket.income) || 0) / maxTrend * 100)}%` }} /><i className="expense" style={{ height: `${Math.max(0, (Number(bucket.expense) || 0) / maxTrend * 100)}%` }} /></div>
                <span>{bucket.label}</span>
              </div>)}
            </div>
          </div>
        </section>

        <section className="admin-stat-panel" aria-labelledby="admin-stat-products-heading">
          <div className="admin-stat-heading"><div><span className="admin-stat-eyebrow">02 · SẢN PHẨM</span><h2 id="admin-stat-products-heading">Sản phẩm bán chạy</h2><p>Top biến thể theo doanh thu trong {periodLabel.toLowerCase()}.</p></div><Package size={20} /></div>
          <ProductTable rows={data.topProducts || []} />
        </section>

        <section className="admin-stat-panel" aria-labelledby="admin-stat-customers-heading">
          <div className="admin-stat-heading"><div><span className="admin-stat-eyebrow">03 · KHÁCH HÀNG</span><h2 id="admin-stat-customers-heading">Khách hàng mua nhiều</h2><p>Xếp hạng theo tổng giá trị đơn hàng hợp lệ trong {periodLabel.toLowerCase()}.</p></div><Users size={20} /></div>
          <CustomerTable rows={data.topCustomers || []} />
        </section>

        <section className="admin-stat-panel" aria-labelledby="admin-stat-employees-heading">
          <div className="admin-stat-heading"><div><span className="admin-stat-eyebrow">04 · NHÂN VIÊN</span><h2 id="admin-stat-employees-heading">Hoạt động nhập kho</h2><p>Thống kê theo người lập phiếu nhập kho; không phải doanh số bán hàng theo nhân viên.</p></div><Users size={20} /></div>
          <EmployeeTable rows={data.employeeActivities || []} />
        </section>
      </> : null}

      <AdminOrganizationOverview go={go} />
      <AdminSecurityOverview />

    </div>
  );
}
