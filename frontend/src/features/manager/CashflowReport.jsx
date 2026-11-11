import React, { useCallback, useMemo } from 'react';
import { adminApi } from '../../api/manager-api';
import { useManagerResource } from '../../shared/hooks/useManagerResource';
import {
  useManagerFilters,
  managerQuery,
  vietnamDateRange,
} from '../../shared/hooks/useManagerFilters';
import './cashflow-report.css';
const money = value =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
const defaults = () => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    tab: 'customers',
    fromDate: from.toISOString().slice(0, 10),
    toDate: today,
    groupBy: 'day',
  };
};
export default function CashflowReport() {
  const [filters, change] = useManagerFilters(useMemo(defaults, []));
  const range = vietnamDateRange(filters.fromDate, filters.toDate),
    valid =
      !!range.from &&
      !!range.to &&
      range.from < range.to &&
      Date.parse(range.to) - Date.parse(range.from) <= 366 * 86400000 &&
      ['day', 'month'].includes(filters.groupBy);
  const fetcher = useCallback(
    signal =>
      adminApi(
        '/api/manager/reports/cashflow?' +
          managerQuery({
            ...vietnamDateRange(filters.fromDate, filters.toDate),
            groupBy: filters.groupBy,
          }),
        { signal },
      ),
    [filters.fromDate, filters.toDate, filters.groupBy],
  );
  const { data, loading, error, backgroundError, load } = useManagerResource(fetcher, {
    enabled: valid,
  });
  const max = Math.max(
    1,
    ...(data?.series || []).flatMap(p => [Number(p.collected), Number(p.refunded)]),
  );
  return (
    <section className="cashflow-report" aria-label="Báo cáo thu–hoàn tiền">
      <h3>Thu – hoàn tiền</h3>
      <p>
        Theo thời điểm hệ thống xác nhận thu và ghi nhận hoàn, không khẳng định là ngày giao dịch
        ngân hàng thực tế.
      </p>
      <div className="cashflow-filters">
        <label>
          Từ ngày
          <input
            type="date"
            value={filters.fromDate}
            onChange={e => change({ fromDate: e.target.value })}
          />
        </label>
        <label>
          Đến hết ngày
          <input
            type="date"
            value={filters.toDate}
            onChange={e => change({ toDate: e.target.value })}
          />
        </label>
        <label>
          Nhóm theo
          <select value={filters.groupBy} onChange={e => change({ groupBy: e.target.value })}>
            <option value="day">Ngày</option>
            <option value="month">Tháng</option>
          </select>
        </label>
      </div>
      {!valid && <p role="alert">Chọn ngày hợp lệ, tối đa 366 ngày.</p>}
      {valid && (error || backgroundError) && (
        <div role="alert">
          {data && 'Đang giữ số liệu gần nhất. '}
          {error || backgroundError}{' '}
          <button className="admin-action" onClick={() => load(true)}>
            Thử lại
          </button>
        </div>
      )}
      {valid && loading && !data && <p role="status">Đang tải báo cáo thu–hoàn tiền…</p>}
      {valid && data && (
        <>
          <div className="cashflow-metrics">
            {[
              ['Đã xác nhận thu', money(data.collected)],
              ['Đã ghi nhận hoàn', money(data.refunded)],
              ['Thu ròng trong kỳ', money(data.net)],
              ['Đơn có thu tiền', data.collectedOrders],
            ].map(([label, value]) => (
              <article key={label}>
                <h4>{label}</h4>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          {Number(data.collectedOrders) === 0 && Number(data.refunded) === 0 && (
            <p>Không phát sinh thu hoặc hoàn trong kỳ.</p>
          )}
          <p>
            PayOS tính khi xác nhận PAID; COD chỉ tính khi Manager xác nhận đã thu. Khoản hoàn tính
            vào ngày ghi nhận đã hoàn; thu ròng có thể âm. Đơn 0 đồng không tính lượt thu.
          </p>
          <div className="cashflow-warning">
            <b>Dữ liệu cũ chưa xác định mốc (toàn thời gian)</b>
            <p>
              {data.unknownMilestone?.orders || 0} đơn · {money(data.unknownMilestone?.amount)}
            </p>
            <p>Không đưa vào kỳ báo cáo và không đoán ngày thu từ ngày cập nhật đơn.</p>
          </div>
          <h4>Diễn biến thu và hoàn</h4>
          <p>Thanh xanh: thu; thanh cam: hoàn. Bảng hiển thị số tiền chính xác.</p>
          <div className="cashflow-series">
            {(data.series || []).map(p => (
              <div key={p.period}>
                <span>{p.period}</span>
                <div aria-hidden="true">
                  <i style={{ width: `${(Math.max(0, Number(p.collected)) / max) * 100}%` }} />
                  <i
                    className="is-refund"
                    style={{ width: `${(Math.max(0, Number(p.refunded)) / max) * 100}%` }}
                  />
                </div>
                <small>
                  Thu {money(p.collected)} · Hoàn {money(p.refunded)}
                </small>
              </div>
            ))}
          </div>
          <div className="cashflow-table">
            <table>
              <caption>
                Số liệu theo {filters.groupBy === 'month' ? 'tháng' : 'ngày'} Việt Nam
              </caption>
              <thead>
                <tr>
                  <th>Kỳ</th>
                  <th>Đơn có thu</th>
                  <th>Thu</th>
                  <th>Hoàn</th>
                  <th>Ròng</th>
                </tr>
              </thead>
              <tbody>
                {(data.series || []).map(p => (
                  <tr key={p.period}>
                    <td>{p.period}</td>
                    <td>{p.collectedOrders}</td>
                    <td>{money(p.collected)}</td>
                    <td>{money(p.refunded)}</td>
                    <td>{money(p.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4>Top 10 sản phẩm theo số lượng</h4>
          <p>
            Chỉ đơn đã thu, chưa hủy; giá trị sản phẩm trước giảm giá cấp đơn và hoàn tiền, chưa trừ
            hàng đổi trả. Không phải doanh thu ròng sản phẩm.
          </p>
          {!data.topProducts?.length ? (
            <p>Chưa có sản phẩm phù hợp trong kỳ.</p>
          ) : (
            <div className="cashflow-table">
              <table>
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Số lượng</th>
                    <th>Giá trị trước giảm/hoàn</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map(p => (
                    <tr key={p.productId}>
                      <td>{p.name}</td>
                      <td>{p.quantity}</td>
                      <td>{money(p.grossItemValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <small>
            Cập nhật{' '}
            {data.updatedAt
              ? new Date(data.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
              : '—'}
            . Tự cập nhật mỗi 5 giây khi tab đang mở. Dashboard và chỉ số CRM cũ không thay đổi.
          </small>
        </>
      )}
    </section>
  );
}
