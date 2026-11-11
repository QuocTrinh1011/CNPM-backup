import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { managerQuery, useManagerFilters, vietnamDateRange } from '../../shared/hooks/useManagerFilters';
import { useManagerList } from '../../shared/hooks/useManagerResource';
import { money, date, orderLabels, paymentLabels } from './ManagerOrderDetail';
import ManagerInvoiceDetail from './ManagerInvoiceDetail';
import './manager-invoices.css';

const paymentOptions = [
  ['', 'Tất cả'],
  ['COD', 'COD'],
  ['PENDING', 'Chờ thanh toán'],
  ['PAID', 'Đã thanh toán'],
  ['EXPIRED', 'Hết hạn'],
  ['FAILED', 'Thất bại'],
  ['CANCELLED', 'Đã hủy thanh toán'],
];
const methodLabels = { COD: 'COD', PAYOS: 'PayOS / VietQR' };

export default function ManagerInvoices() {
  const [filters, changeFilters] = useManagerFilters({ q: '', paymentStatus: '', fromDate: '', toDate: '', page: '0' });
  const [search, setSearch] = useState(filters.q);
  const [invoiceSelection, setInvoiceSelection] = useState(null);
  const invoiceId = invoiceSelection?.id ?? null;
  useEffect(() => setSearch(filters.q), [filters.q]);
  const page = Math.max(0, Number(filters.page) || 0);
  const range = vietnamDateRange(filters.fromDate, filters.toDate);
  const endpoint = useCallback(() => `/api/manager/orders?${managerQuery({
    q: filters.q,
    paymentStatus: filters.paymentStatus,
    from: range.from,
    to: range.to,
    sort: 'createdAt',
    direction: 'DESC',
    page,
    size: 20,
  })}`, [filters.q, filters.paymentStatus, range.from, range.to, page]);
  const { data, loading, error, load, refreshing } = useManagerList(endpoint, { keepPreviousData: true });
  const invoices = data?.content || [];
  const totalPages = data?.totalPages || 0;
  const totalElements = data?.totalElements ?? 0;

  const submitSearch = event => {
    event.preventDefault();
    changeFilters({ q: search.trim() });
  };
  const clearSearch = () => {
    setSearch('');
    changeFilters({ q: '' });
  };
  const setPage = next => changeFilters({ page: String(next) });

  return (
    <div className="admin-panel manager-invoices">
      <div className="admin-panel-title">
        <span className="admin-eyebrow">BÁN HÀNG</span>
        <h2>Hóa đơn</h2>
        <p>Tra cứu hóa đơn theo mã đơn, khách hàng, ngày lập và trạng thái thanh toán.</p>
      </div>
      <form className="admin-order-toolbar" onSubmit={submitSearch}>
        <div className="admin-search-wrap">
          <Search size={15} className="admin-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="admin-search-input"
            placeholder="Tìm mã hóa đơn, tên hoặc email khách..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          {search && <button type="button" className="admin-search-clear" onClick={clearSearch} aria-label="Xóa tìm kiếm"><X size={13} /></button>}
        </div>
        <button type="submit" className="admin-action">Tìm hóa đơn</button>
        <span>{totalElements} hóa đơn</span>
      </form>
      <div className="manager-advanced-filters invoice-filters">
        <label>Thanh toán
          <select value={filters.paymentStatus} onChange={event => changeFilters({ paymentStatus: event.target.value })}>
            {paymentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Từ ngày<input type="date" value={filters.fromDate} onChange={event => changeFilters({ fromDate: event.target.value })} /></label>
        <label>Đến ngày<input type="date" value={filters.toDate} onChange={event => changeFilters({ toDate: event.target.value })} /></label>
        <button type="button" className="admin-action" onClick={() => load()} disabled={refreshing} aria-label="Tải lại danh sách hóa đơn">
          <RefreshCw size={16} className={refreshing ? 'admin-spinner' : ''} /> Tải lại
        </button>
      </div>
      <div className={`invoice-layout${invoiceId !== null ? ' has-detail' : ''}`}>
        <div className="invoice-list">
          {loading && !data ? (
            <div className="invoice-loading" role="status"><RefreshCw size={18} className="admin-spinner" /> Đang tải hóa đơn...</div>
          ) : error && !data ? (
            <div className="admin-list-error" role="alert"><p>{error}</p><button className="admin-action" onClick={() => load()}>Thử lại</button></div>
          ) : (
            <>
              <div className="admin-table-wrap invoice-table">
                <table>
                  <thead>
                    <tr>
                      <th>Mã hóa đơn</th>
                      <th>Khách hàng</th>
                      <th>Tạm tính</th>
                      <th>Giảm giá</th>
                      <th>Tổng thanh toán</th>
                      <th>Thanh toán</th>
                      <th>Trạng thái đơn</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(invoice => {
                      const discount = Number(invoice.discountAmount || 0);
                      const subtotal = Number(invoice.totalAmount || 0) + discount;
                      return (
                        <tr key={invoice.id}>
                          <td data-label="Mã hóa đơn">
                            <span className="admin-order-code-badge">#{invoice.orderCode}</span>
                            <small className="admin-table-subline">{date(invoice.createdAt)}</small>
                          </td>
                          <td data-label="Khách hàng">
                            <b>{invoice.customer?.fullName || '—'}</b>
                            <small className="admin-table-subline">{invoice.customer?.email || ''}</small>
                          </td>
                          <td data-label="Tạm tính">{money(subtotal)}</td>
                          <td data-label="Giảm giá">
                            {discount > 0 ? `-${money(discount)}` : '—'}
                            {invoice.voucherCode && <small className="admin-table-subline">{invoice.voucherCode}</small>}
                          </td>
                          <td data-label="Tổng thanh toán"><strong>{money(invoice.totalAmount)}</strong></td>
                          <td data-label="Thanh toán">
                            <span>{methodLabels[invoice.paymentMethod] || invoice.paymentMethod || '—'}</span>
                            <small className={`admin-table-subline admin-payment-status-pill ${invoice.paymentStatus === 'PAID' ? 'is-paid' : invoice.paymentStatus === 'PENDING' ? 'is-pending' : ''}`}>
                              {paymentLabels[invoice.paymentStatus] || invoice.paymentStatus || '—'}
                            </small>
                          </td>
                          <td data-label="Trạng thái đơn">
                            <span className={`admin-status admin-status-${(invoice.status || '').toLowerCase()}`}>
                              <span className="admin-badge-dot" />
                              {orderLabels[invoice.status] || invoice.status}
                            </span>
                          </td>
                          <td data-label="Thao tác">
                            <button className="admin-action" onClick={event => setInvoiceSelection({ id: invoice.id, opener: event.currentTarget })}>Xem hóa đơn</button>
                          </td>
                        </tr>
                      );
                    })}
                    {!invoices.length && (
                      <tr><td colSpan={8} className="admin-table-empty"><b>Không có hóa đơn phù hợp.</b><small>Thử đổi từ khóa, trạng thái thanh toán hoặc khoảng ngày.</small></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(totalPages > 1 || page > 0) && (
                <div className="admin-pagination invoice-pagination">
                  <span>Trang {page + 1}/{Math.max(1, totalPages)} · {totalElements} hóa đơn</span>
                  <div>
                    <button disabled={page <= 0 || loading} onClick={() => setPage(page - 1)}>Trước</button>
                    <button disabled={page + 1 >= totalPages || loading} onClick={() => setPage(page + 1)}>Sau</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {invoiceSelection && (
          <ManagerInvoiceDetail
            orderId={invoiceSelection.id}
            focusTarget={invoiceSelection.opener}
            onClose={() => setInvoiceSelection(null)}
          />
        )}
      </div>
    </div>
  );
}
