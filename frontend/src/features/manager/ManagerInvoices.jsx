import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { managerQuery, useManagerFilters, vietnamDateRange } from '../../shared/hooks/useManagerFilters';
import { useManagerList } from '../../shared/hooks/useManagerResource';
import { money, date, orderLabels, paymentLabels } from './ManagerOrderDetail';
import ManagerInvoiceDetail from './ManagerInvoiceDetail';
import { PanelTitle, Table, ListError, PageControls } from './ManagerComponents';
import { FilterBar, DataTableSkeleton } from './ManagerKit';

const paymentOptions = [
  ['', 'Tất cả'],
  ['COD', 'COD'],
  ['PENDING', 'Chờ thanh toán'],
  ['PAID', 'Đã thanh toán'],
  ['EXPIRED', 'Hết hạn'],
  ['FAILED', 'Thất bại'],
  ['CANCELLED', 'Đã hủy thanh toán'],
];
const paymentOptionLabel = value => paymentOptions.find(([option]) => option === value)?.[1] || value;
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

  const submitSearch = () => changeFilters({ q: search.trim() });
  const setPage = next => changeFilters({ page: String(next) });
  const chips = [
    filters.paymentStatus && {
      key: 'paymentStatus',
      label: `Thanh toán: ${paymentOptionLabel(filters.paymentStatus)}`,
      onRemove: () => changeFilters({ paymentStatus: '' }),
    },
    filters.fromDate && { key: 'fromDate', label: `Từ ${filters.fromDate}`, onRemove: () => changeFilters({ fromDate: '' }) },
    filters.toDate && { key: 'toDate', label: `Đến ${filters.toDate}`, onRemove: () => changeFilters({ toDate: '' }) },
  ].filter(Boolean);

  return (
    <div className="admin-panel manager-invoices">
      <PanelTitle
        title="Danh sách hóa đơn"
        subtitle="Tra cứu hóa đơn theo mã đơn, khách hàng, ngày lập và trạng thái thanh toán."
      />
      <FilterBar
        search={search}
        onSearch={setSearch}
        onSubmit={submitSearch}
        placeholder="Tìm mã hóa đơn, tên hoặc email khách..."
        searchLabel="Tìm hóa đơn"
        filters={
          <>
            <label className="manager-inline-filter">Thanh toán
              <select value={filters.paymentStatus} onChange={event => changeFilters({ paymentStatus: event.target.value })}>
                {paymentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="manager-inline-filter">Từ ngày<input type="date" value={filters.fromDate} onChange={event => changeFilters({ fromDate: event.target.value })} /></label>
            <label className="manager-inline-filter">Đến ngày<input type="date" value={filters.toDate} onChange={event => changeFilters({ toDate: event.target.value })} /></label>
          </>
        }
        actions={
          <>
            <span className="manager-toolbar-count">{totalElements} hóa đơn</span>
            <button type="button" className="manager-icon-btn" onClick={() => load()} disabled={refreshing} aria-label="Tải lại danh sách hóa đơn">
              <RefreshCw size={16} className={refreshing ? 'admin-spinner' : ''} />
            </button>
            <button type="submit" className="admin-action">Tìm hóa đơn</button>
          </>
        }
        chips={chips}
      />
      <div className={`invoice-layout${invoiceId !== null ? ' has-detail' : ''}`}>
        <div className="invoice-list">
          {loading && !data ? (
            <DataTableSkeleton rows={6} cols={8} />
          ) : error && !data ? (
            <div role="alert"><ListError message={error} onRetry={() => load()} /></div>
          ) : (
            <>
              <Table
                className="invoice-table"
                headers={['Mã hóa đơn', 'Khách hàng', 'Tạm tính', 'Giảm giá', 'Tổng thanh toán', 'Thanh toán', 'Trạng thái đơn', 'Thao tác']}
                empty={{ description: 'Thử đổi từ khóa, trạng thái thanh toán hoặc khoảng ngày.' }}
              >
                {invoices.map(invoice => {
                  const discount = Number(invoice.discountAmount || 0);
                  const shippingFee = Number(invoice.shippingFee || 0);
                  const subtotal = Number(invoice.totalAmount || 0) + discount - shippingFee;
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
              </Table>
              <PageControls variant="compact" page={page} totalPages={totalPages} totalElements={totalElements} onPage={setPage} disabled={loading} />
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
