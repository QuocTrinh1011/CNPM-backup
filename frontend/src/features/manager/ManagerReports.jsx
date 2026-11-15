import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, RefreshCw } from "lucide-react";
import { adminApi, adminEndpoints } from "../../api/manager-api";
import { money } from "./manager-data";
import "./manager-reports.css";

const CURRENT_YEAR = new Date().getFullYear();
const DETAIL_OPTIONS = [
  ["products", "Sản phẩm nổi bật"],
  ["customers", "Khách hàng mua nhiều"],
  ["employees", "Hoạt động nhập kho theo nhân viên"],
];
const MONTHS = [
  ["", "Tất cả tháng"],
  ...Array.from({ length: 12 }, (_, index) => [String(index + 1), `Tháng ${index + 1}`]),
];

function routeFilters(location) {
  const search = String(location || "").split("?")[1] || "";
  const params = new URLSearchParams(search);
  const parsedYear = Number.parseInt(params.get("year"), 10);
  const parsedMonth = Number.parseInt(params.get("month"), 10);
  return {
    params,
    year: Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 9999 ? parsedYear : CURRENT_YEAR,
    month: Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : null,
  };
}

function ReportTable({ name, headers, rows, renderRow }) {
  return (
    <div className="manager-report-table-wrap">
      <table aria-label={name}>
        <thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(renderRow) : (
          <tr><td colSpan={headers.length} className="manager-report-empty">Chưa có dữ liệu trong kỳ này.</td></tr>
        )}</tbody>
      </table>
    </div>
  );
}

function DetailReport({ type, data }) {
  if (type === "customers") {
    return <ReportTable name="Khách hàng mua nhiều" headers={["Khách hàng", "Email", "Số đơn", "Tổng mua"]}
      rows={data.topCustomers || []} renderRow={row => <tr key={row.customerId}>
        <td>{row.fullName || "Khách hàng"}</td><td>{row.email || "—"}</td><td>{row.orderCount}</td><td>{money(row.totalSpent)}</td>
      </tr>} />;
  }
  if (type === "employees") {
    return <ReportTable name="Hoạt động nhập kho theo nhân viên" headers={["Người lập phiếu", "Email", "Số phiếu", "Tổng chi nhập"]}
      rows={data.employeeActivities || []} renderRow={(row, index) => <tr key={row.employeeId ?? `unknown-${index}`}>
        <td>{row.fullName || "Hệ thống / Không xác định"}</td><td>{row.email || "—"}</td><td>{row.receiptCount}</td><td>{money(row.totalReceiptCost)}</td>
      </tr>} />;
  }
  return <ReportTable name="Sản phẩm nổi bật" headers={["Sản phẩm", "Danh mục", "Màu", "Cỡ", "Đã bán", "Doanh thu"]}
    rows={data.topProducts || []} renderRow={row => <tr key={`${row.productId}-${row.color || ""}-${row.size || ""}`}>
      <td><b>{row.productName || "Sản phẩm"}</b></td><td>{row.categoryName || "—"}</td>
      <td><span className="manager-report-color"><i className="manager-report-color-dot" data-color={row.color || "unknown"} />{row.color || "Chưa phân loại"}</span></td>
      <td>{row.size || "—"}</td><td>{row.quantitySold}</td><td>{money(row.totalRevenue)}</td>
    </tr>} />;
}

export default function ManagerReports({ location, go }) {
  const { params, year, month } = useMemo(() => routeFilters(location), [location]);
  const [detailType, setDetailType] = useState("products");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError("");
    setData(null);
    adminApi(adminEndpoints.reports({ year, month }), { signal: controller.signal })
      .then(result => { if (current) setData(result); })
      .catch(failure => { if (current && !controller.signal.aborted) setError(failure.message || "Không tải được báo cáo."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [year, month, retry]);

  const updateFilters = changes => {
    const next = new URLSearchParams(params);
    next.set("year", String(changes.year ?? year));
    const nextMonth = Object.hasOwn(changes, "month") ? changes.month : month;
    if (nextMonth == null || nextMonth === "") next.delete("month");
    else next.set("month", String(nextMonth));
    const query = next.toString();
    go?.(`reports${query ? `?${query}` : ""}`);
  };

  const years = useMemo(() => {
    const known = new Set([CURRENT_YEAR, year, ...(data?.availableYears || [])]);
    return [...known].sort((left, right) => left === CURRENT_YEAR ? -1 : right === CURRENT_YEAR ? 1 : right - left);
  }, [data?.availableYears, year]);

  const trend = data?.trend || [];
  const maxTrend = Math.max(1, ...trend.flatMap(bucket => [Number(bucket.income) || 0, Number(bucket.expense) || 0]));
  const activeTitle = DETAIL_OPTIONS.find(([value]) => value === detailType)?.[1] || DETAIL_OPTIONS[0][1];

  return <div className="admin-content manager-reports">
    <section className="admin-panel manager-reports-toolbar" aria-label="Bộ lọc báo cáo">
      <div className="manager-reports-toolbar-copy"><span className="admin-eyebrow">PHÂN TÍCH CỬA HÀNG</span><p>Chọn kỳ để xem doanh thu, chi nhập và hiệu quả bán hàng.</p></div>
      <div className="manager-reports-filters">
        <label>Năm báo cáo<select aria-label="Năm báo cáo" value={String(year)} onChange={event => updateFilters({ year: Number(event.target.value) })}>
          {years.map(value => <option value={value} key={value}>{value}{value === CURRENT_YEAR ? " · Hiện hành" : ""}</option>)}
        </select></label>
        <label>Tháng báo cáo<select aria-label="Tháng báo cáo" value={month == null ? "" : String(month)} onChange={event => updateFilters({ month: event.target.value || null })}>
          {MONTHS.map(([value, label]) => <option value={value} key={value || "all"}>{label}</option>)}
        </select></label>
      </div>
    </section>

    {loading ? <div className="admin-panel manager-report-loading" role="status"><RefreshCw size={18} className="admin-spinner" />Đang tải báo cáo...</div> : null}
    {!loading && error ? <div className="admin-panel manager-report-error" role="alert"><AlertTriangle size={19} /><div><b>Không tải được báo cáo</b><p>{error}</p></div><button className="admin-action" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : null}
    {!loading && !error && data ? <>
      <section className="manager-report-summary" aria-label="Tổng quan thu chi">
        <article className="admin-panel manager-report-metric income"><div><span>TỔNG THU</span><ArrowUpRight size={18} /></div><h2 role="heading" aria-level="2" aria-label="Tổng thu">{money(data.summary?.totalIncome)}</h2><small>{data.summary?.paidOrdersCount || 0} đơn đã thu tiền</small></article>
        <article className="admin-panel manager-report-metric expense"><div><span>TỔNG CHI NHẬP KHO</span><ArrowDownRight size={18} /></div><h2 role="heading" aria-level="2" aria-label="Tổng chi nhập kho">{money(data.summary?.totalExpense)}</h2><small>{data.summary?.stockReceiptsCount || 0} phiếu nhập</small></article>
        <article className="admin-panel manager-report-metric balance"><div><span>CHÊNH LỆCH</span><Activity size={18} /></div><h2 role="heading" aria-level="2" aria-label="Chênh lệch">{money(data.summary?.netBalance)}</h2><small>Thu trừ chi nhập kho</small></article>
      </section>

      <section className="admin-panel manager-report-trend">
        <div className="manager-report-section-heading"><div><span className="manager-report-icon"><BarChart3 size={18} /></span><div><h2>Xu hướng thu chi</h2><p>{month == null ? `Theo tháng · ${year}` : `Theo ngày · ${month}/${year}`}</p></div></div>
          <div className="manager-report-legend"><span><i className="income" />Tổng thu</span><span><i className="expense" />Chi nhập kho</span></div>
        </div>
        {trend.length ? <div className={`manager-report-chart${month == null ? " is-year" : " is-month"}`} role="img" aria-label={`Xu hướng thu chi ${month == null ? "theo tháng" : "theo ngày"}`}>
          {trend.map((bucket, index) => <div className="manager-report-chart-bucket" key={`${bucket.label}-${index}`} aria-label={`${bucket.label}: thu ${money(bucket.income)}, chi ${money(bucket.expense)}`}>
            <div className="manager-report-bars"><i className="income" style={{ height: `${Math.max(0, (Number(bucket.income) || 0) / maxTrend * 100)}%` }} /><i className="expense" style={{ height: `${Math.max(0, (Number(bucket.expense) || 0) / maxTrend * 100)}%` }} /></div>
            <span>{bucket.label}</span>
          </div>)}
        </div> : <p className="manager-report-empty">Chưa có dữ liệu xu hướng trong kỳ này.</p>}
      </section>

      <section className="admin-panel manager-report-details">
        <div className="manager-report-section-heading"><div><span className="manager-report-icon"><Activity size={18} /></span><div><h2>{activeTitle}</h2><p>Chi tiết được tổng hợp trong kỳ đã chọn.</p></div></div>
          <label className="manager-report-detail-filter">Nhóm thống kê<select aria-label="Loại thống kê" value={detailType} onChange={event => setDetailType(event.target.value)}>
            {DETAIL_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
        </div>
        <DetailReport type={detailType} data={data} />
      </section>
    </> : null}
  </div>;
}
