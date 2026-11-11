import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, FileText, LoaderCircle, Search } from 'lucide-react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import './manager-invoices.css';

const PAGE_SIZE = 10;

const money = value =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateLabel = value =>
  value
    ? new Date(value).toLocaleString('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : '—';

const orderStatus = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPED: 'Đang giao',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const paymentStatus = {
  PENDING: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
  COD: 'Thanh toán khi nhận hàng',
};

export default function ManagerInvoices() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadInvoices = useCallback(async signal => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi(
        adminEndpoints.orders({
          q: query.trim(),
          page,
          size: PAGE_SIZE,
          sort: 'createdAt',
          direction: 'DESC',
        }),
        { signal },
      );
      setResult(data);
      setSelectedId(current => {
        if (current != null && data.content?.some(invoice => invoice.id === current)) return current;
        return null;
      });
    } catch (failure) {
      if (failure.name !== 'AbortError') setError(failure.message || 'Không tải được danh sách hóa đơn.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadInvoices(controller.signal), 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadInvoices]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      setDetailLoading(false);
      setDetailError('');
      return undefined;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError('');
    adminApi(adminEndpoints.order(selectedId), { signal: controller.signal })
      .then(data => setDetail(data))
      .catch(failure => {
        if (failure.name !== 'AbortError') setDetailError(failure.message || 'Không tải được chi tiết hóa đơn.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selectedId]);

  const invoices = result?.content || [];
  const totalPages = Number(result?.totalPages || 0);

  return (
    <section className="manager-invoices" aria-label="Quản lý hóa đơn">
      <div className="manager-invoices-heading">
        <div>
          <span className="manager-invoices-kicker">QUẢN LÝ CỬA HÀNG</span>
          <h2>Danh sách hóa đơn</h2>
          <p>Chọn một hóa đơn để xem thông tin và các sản phẩm trong đơn.</p>
        </div>
        <label className="manager-invoices-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Tìm mã hóa đơn, khách hàng..."
            aria-label="Tìm hóa đơn"
            onChange={event => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>

      <div className={`manager-invoices-layout${selectedId == null ? '' : ' has-detail'}`}>
        <section className="manager-invoices-list-card" aria-label="Danh sách hóa đơn">
          <div className="manager-invoices-list-title">
            <h3>Hóa đơn</h3>
            <span>{Number(result?.totalElements || 0).toLocaleString('vi-VN')} hóa đơn</span>
          </div>
          {error ? (
            <div className="manager-invoices-message is-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button type="button" onClick={() => void loadInvoices(new AbortController().signal)}>
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="manager-invoices-table-scroll">
                <table className="manager-invoices-table">
                  <thead>
                    <tr>
                      <th>Mã hóa đơn</th>
                      <th>Khách hàng</th>
                      <th>Ngày lập</th>
                      <th className="is-amount">Tổng tiền</th>
                      <th className="manager-invoices-view-heading">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !result ? (
                      <tr>
                        <td colSpan="5" className="manager-invoices-empty">
                          <LoaderCircle className="is-spinning" size={18} /> Đang tải hóa đơn...
                        </td>
                      </tr>
                    ) : invoices.length ? (
                      invoices.map(invoice => (
                        <tr
                          key={invoice.id}
                          className={selectedId === invoice.id ? 'is-selected' : ''}
                        >
                          <td>
                            <b>#{invoice.orderCode ?? invoice.id}</b>
                            <span className="manager-invoices-row-status">
                              {orderStatus[invoice.status] || invoice.status || '—'}
                            </span>
                          </td>
                          <td>{invoice.customer?.fullName || 'Khách lẻ'}</td>
                          <td>{dateLabel(invoice.createdAt)}</td>
                          <td className="is-amount">{money(invoice.totalAmount)}</td>
                          <td className="manager-invoices-view-cell">
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                setSelectedId(current => current === invoice.id ? null : invoice.id);
                              }}
                              aria-label={`${selectedId === invoice.id ? 'Ẩn' : 'Xem'} hóa đơn ${invoice.orderCode ?? invoice.id}`}
                            >
                              {selectedId === invoice.id ? 'Ẩn' : 'Xem'}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="manager-invoices-empty">
                          {query ? 'Không tìm thấy hóa đơn phù hợp.' : 'Chưa có hóa đơn.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="manager-invoices-pagination">
                <span>
                  Trang {totalPages ? page + 1 : 0} / {totalPages}
                </span>
                <div>
                  <button
                    type="button"
                    aria-label="Trang trước"
                    disabled={page <= 0 || loading}
                    onClick={() => setPage(value => Math.max(0, value - 1))}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={page + 1 >= totalPages || loading}
                    onClick={() => setPage(value => value + 1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {selectedId != null && (
          <section className="manager-invoice-detail-card" aria-label="Chi tiết hóa đơn">
            {detailLoading ? (
              <div className="manager-invoices-detail-state">
                <LoaderCircle className="is-spinning" size={22} /> Đang tải chi tiết hóa đơn...
              </div>
            ) : detailError ? (
              <div className="manager-invoices-message is-error" role="alert">
                <AlertCircle size={18} /> {detailError}
              </div>
            ) : detail ? (
              <InvoiceDetail invoice={detail} />
            ) : (
              <div className="manager-invoices-detail-state">
                <FileText size={25} />
                <b>Chọn một hóa đơn</b>
                <span>Thông tin chi tiết sẽ hiển thị ở đây.</span>
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}

function InvoiceDetail({ invoice }) {
  const items = invoice.items || [];
  const discount = Number(invoice.discountAmount || 0);
  return (
    <>
      <div className="manager-invoice-detail-heading">
        <div className="manager-invoice-detail-icon">
          <FileText size={20} />
        </div>
        <div>
          <span>CHI TIẾT HÓA ĐƠN</span>
          <h3>#{invoice.orderCode ?? invoice.id}</h3>
          <p>{dateLabel(invoice.createdAt)}</p>
        </div>
        <span className={`manager-invoice-status status-${String(invoice.status || '').toLowerCase()}`}>
          {orderStatus[invoice.status] || invoice.status || '—'}
        </span>
      </div>

      <div className="manager-invoice-customer">
        <h4>Thông tin khách hàng</h4>
        <b>{invoice.customer?.fullName || 'Khách lẻ'}</b>
        {invoice.customer?.email && <span>{invoice.customer.email}</span>}
        {invoice.deliveryAddress && <span>{invoice.deliveryAddress}</span>}
      </div>

      <div className="manager-invoice-items-wrap">
        <h4>Sản phẩm ({items.length})</h4>
        {items.length ? (
          <div className="manager-invoice-items">
            {items.map((item, index) => {
              const name = item.product?.name || `Sản phẩm ${index + 1}`;
              const quantity = Number(item.quantity || 0);
              const unitPrice = Number(item.unitPrice || 0);
              const options = [item.size, item.color].filter(Boolean).join(' · ');
              return (
                <div className="manager-invoice-item" key={item.id ?? `${name}-${index}`}>
                  <div className="manager-invoice-item-copy">
                    <b>{name}</b>
                    <span>{options ? `${options} · ` : ''}{quantity} × {money(unitPrice)}</span>
                  </div>
                  <b>{money(quantity * unitPrice)}</b>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="manager-invoice-no-items">Hóa đơn không có thông tin sản phẩm.</p>
        )}
      </div>

      <div className="manager-invoice-payment">
        <div><span>Phương thức thanh toán</span><b>{invoice.paymentMethod || '—'}</b></div>
        <div><span>Trạng thái thanh toán</span><b>{paymentStatus[invoice.paymentStatus] || invoice.paymentStatus || '—'}</b></div>
        {invoice.voucherCode && <div><span>Mã giảm giá</span><b>{invoice.voucherCode}</b></div>}
      </div>

      <div className="manager-invoice-total">
        {discount > 0 && <div><span>Giảm giá</span><span>− {money(discount)}</span></div>}
        <div className="manager-invoice-grand-total"><b>Tổng thanh toán</b><strong>{money(invoice.totalAmount)}</strong></div>
      </div>
    </>
  );
}
