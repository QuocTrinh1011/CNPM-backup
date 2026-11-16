import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays } from 'lucide-react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import { ListError, PanelLoading, PanelTitle } from './ManagerComponents';
import './styles/warehouse-workspace.css';

const periodLabels = { MONTH: 'Tháng', QUARTER: 'Quý', YEAR: 'Năm' };
const movementLabels = {
  OPENING: 'Số dư đầu kỳ', MATERIAL_RECEIPT: 'Nhập nguyên liệu', MATERIAL_ISSUE: 'Cấp nguyên liệu',
  MATERIAL_RETURN: 'Trả nguyên liệu', PRODUCTION_CONSUMPTION: 'Tiêu hao sản xuất', PRODUCTION_OUTPUT: 'Nhập thành phẩm',
  FINISHED_GOODS_TRANSFER: 'Chuyển sang kho bán', SALE: 'Bán hàng', ORDER_RESERVATION: 'Giữ hàng',
  ORDER_RELEASE: 'Hoàn tồn hủy đơn', MANUAL_ADJUSTMENT: 'Điều chỉnh thủ công',
};
const number = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(value || 0));
const dateLabel = value => value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';

function BalanceTable({ name, rows, allocated = false }) {
  return <section className="warehouse-report-section">
    <div className="warehouse-section-head"><h3>{name}</h3><span>{rows.length} mặt hàng/vị trí</span></div>
    <div className="warehouse-table-scroll"><table aria-label={name}>
      <thead><tr><th>Mã</th><th>Mặt hàng</th>{allocated && <th>Phạm vi</th>}<th>ĐVT</th><th>Đầu kỳ</th><th>Nhập</th><th>Xuất</th><th>Cuối kỳ</th></tr></thead>
      <tbody>{rows.length ? rows.map(row => <tr key={`${row.itemType}-${row.itemId}-${row.location}-${row.scopeId || ''}`}>
        <td>{row.itemCode}</td><td>{row.itemName}</td>{allocated && <td>{row.scopeId ? `Kế hoạch #${row.scopeId}` : '—'}</td>}<td>{row.unit}</td>
        <td>{number(row.openingQuantity)}</td><td>{number(row.incomingQuantity)}</td><td>{number(row.outgoingQuantity)}</td><td><b>{number(row.closingQuantity)}</b></td>
      </tr>) : <tr><td className="admin-table-empty" colSpan={allocated ? 8 : 7}>Không có số dư trong kỳ này.</td></tr>}</tbody>
    </table></div>
  </section>;
}

export default function WarehouseReports() {
  const currentDate = new Date();
  const [period, setPeriod] = useState('MONTH');
  const [year, setYear] = useState(String(currentDate.getFullYear()));
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [quarter, setQuarter] = useState(String(Math.floor(currentDate.getMonth() / 3) + 1));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const endpoint = useMemo(() => adminEndpoints.warehouseReport({
    period,
    year: Number(year),
    month: period === 'MONTH' ? Number(month) : undefined,
    quarter: period === 'QUARTER' ? Number(quarter) : undefined,
  }), [period, year, month, quarter]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true); setError(''); setData(null);
    adminApi(endpoint, { signal: controller.signal })
      .then(result => { if (current) setData(result); })
      .catch(failure => { if (current && !controller.signal.aborted) setError(failure.message || 'Không tải được báo cáo kho.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [endpoint, retry]);

  const balances = data?.balances || [];
  const materialsAvailable = balances.filter(row => row.itemType === 'MATERIAL' && row.location === 'RAW_MATERIAL_AVAILABLE');
  const materialsAllocated = balances.filter(row => row.itemType === 'MATERIAL' && row.location === 'PRODUCTION_ALLOCATED');
  const finishedStock = balances.filter(row => row.itemType === 'PRODUCT' && row.location === 'FINISHED_WAREHOUSE');
  const sellableStock = balances.filter(row => row.itemType === 'PRODUCT' && row.location === 'SELLABLE');

  return <section className="admin-panel warehouse-workspace">
    <PanelTitle title="Báo cáo kho" subtitle="Đối soát tồn đầu kỳ, nhập, xuất và tồn cuối kỳ theo vị trí lưu kho." />
    <div className="warehouse-report-filters">
      <label><CalendarDays size={15}/> Loại kỳ<select aria-label="Loại kỳ" value={period} onChange={event => setPeriod(event.target.value)}><option value="MONTH">Tháng</option><option value="QUARTER">Quý</option><option value="YEAR">Năm</option></select></label>
      <label>Năm<input aria-label="Năm báo cáo" type="number" min="1900" max="9999" value={year} onChange={event => setYear(event.target.value)}/></label>
      {period === 'MONTH' && <label>Tháng<select aria-label="Tháng" value={month} onChange={event => setMonth(event.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select></label>}
      {period === 'QUARTER' && <label>Quý<select aria-label="Quý" value={quarter} onChange={event => setQuarter(event.target.value)}>{[1, 2, 3, 4].map(value => <option key={value} value={value}>Quý {value}</option>)}</select></label>}
      <span className="warehouse-period-label">{periodLabels[period]} {period === 'MONTH' ? `${month}/${year}` : period === 'QUARTER' ? `${quarter}/${year}` : year}</span>
    </div>
    {loading && <PanelLoading />}
    {error && <ListError message={error} onRetry={() => setRetry(value => value + 1)} />}
    {!loading && !error && data && <>
      {!data.historyComplete && <p className="warehouse-notice is-warning" role="status">
        Lịch sử kho chỉ được ghi nhận từ {dateLabel(data.historyAvailableFrom)}. Kỳ báo cáo bắt đầu trước mốc này chỉ phản ánh phần dữ liệu từ {dateLabel(data.effectiveFromInclusive)}.
      </p>}
      {data.historyComplete && data.historyAvailableFrom && <p className="warehouse-notice" role="status">Lịch sử đầy đủ từ {dateLabel(data.historyAvailableFrom)}.</p>}
      <div className="warehouse-report-meta"><span>Kỳ: {dateLabel(data.fromInclusive)} – trước {dateLabel(data.toExclusive)}</span><span><Activity size={15}/> {data.balances?.length || 0} số dư vị trí</span></div>
      <BalanceTable name="Nguyên liệu khả dụng" rows={materialsAvailable} />
      <BalanceTable name="Nguyên liệu đã cấp theo kế hoạch" rows={materialsAllocated} allocated />
      <BalanceTable name="Thành phẩm trong kho" rows={finishedStock} />
      <BalanceTable name="Sản phẩm sẵn sàng bán" rows={sellableStock} />
      <section className="warehouse-report-section">
        <div className="warehouse-section-head"><h3>Tổng hợp luân chuyển</h3><span>{data.movementTotals?.length || 0} nhóm</span></div>
        <div className="warehouse-table-scroll"><table aria-label="Tổng hợp luân chuyển"><thead><tr><th>Loại hàng</th><th>Vị trí</th><th>Nghiệp vụ</th><th>Nhập</th><th>Xuất</th><th>Chênh lệch</th></tr></thead><tbody>
          {data.movementTotals?.length ? data.movementTotals.map((row, index) => <tr key={`${row.itemType}-${row.location}-${row.movementType}-${index}`}><td>{row.itemType === 'MATERIAL' ? 'Nguyên liệu' : 'Thành phẩm'}</td><td>{row.location}</td><td>{movementLabels[row.movementType] || row.movementType}</td><td>{number(row.incomingQuantity)}</td><td>{number(row.outgoingQuantity)}</td><td>{number(row.netQuantity)}</td></tr>) : <tr><td className="admin-table-empty" colSpan="6">Không có biến động trong kỳ này.</td></tr>}
        </tbody></table></div>
      </section>
    </>}
  </section>;
}
