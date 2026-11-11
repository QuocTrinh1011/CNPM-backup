import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  MapPin,
  Package,
  ShieldCheck,
  CreditCard,
  Truck,
} from 'lucide-react';
import { api } from '../../api/api';
import VoucherField, { useCheckoutVoucher } from './VoucherField';
import {
  useAddresses,
  AddressPicker,
  AddressSummary,
  preferredAddress,
  addressValid,
  deliveryText,
} from '../customer/CustomerAddresses';
import PaymentQr from './PaymentQr';
import './styles/checkout-page.css';

const money = value =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

export default function CheckoutPage({ cart, onPlaced, onShop, onOrders, onCart }) {
  const resource = useAddresses();
  const [selected, setSelected] = useState(null),
    [picker, setPicker] = useState(false);
  const [method, setMethod] = useState('COD'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState(null);
  const [paid, setPaid] = useState(false);
  const voucherModel = useCheckoutVoucher(cart);
  const lock = useRef(false),
    alive = useRef(true);
  const addressInitialized = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!resource.items) return;
    if (!addressInitialized.current) {
      addressInitialized.current = true;
      setSelected(preferredAddress(resource.items));
    } else
      setSelected(current =>
        current ? resource.items.find(item => item.id === current.id) || null : null,
      );
  }, [resource.items]);
  const submit = async event => {
    event.preventDefault();
    if (
      lock.current ||
      voucherModel.busy ||
      resource.loading ||
      resource.error ||
      !addressValid(selected) ||
      !cart.items.length
    )
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await api('/api/orders', {
        method: 'POST',
        body: {
          deliveryAddress: deliveryText(selected),
          paymentMethod: method,
          voucherCode: voucherModel.voucher?.code || undefined,
          items: cart.items.map(({ productId, quantity, size, color }) => ({
            productId,
            quantity,
            size,
            color,
          })),
        },
      });
      if (alive.current) {
        voucherModel.remove();
        setResult(response);
      }
      onPlaced?.(response, cart.items);
    } catch (err) {
      if (alive.current) setError(err.message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  if (result)
    return (
      <main className="shop-checkout-page">
        <section className="shop-checkout-success">
          <span className="shop-checkout-success-icon">
            <Check size={32} />
          </span>
          <p className="kicker">ĐẶT HÀNG THÀNH CÔNG</p>
          <h1>Đơn hàng #{result.order.orderCode}</h1>
          <p>Chờ xác nhận · Cửa hàng sẽ kiểm tra và xác nhận đơn của bạn.</p>
          <strong>{money(result.order.totalAmount)}</strong>
          {result.order.paymentStatus === 'PAID' && Number(result.order.totalAmount) === 0 && (
            <p>Đơn hàng đã được giảm còn 0đ. Bạn không cần thanh toán thêm.</p>
          )}
          {paid && (
            <p role="status" className="shop-payment-label is-paid">
              Thanh toán thành công! Cửa hàng sẽ xác nhận đơn hàng.
            </p>
          )}
          {result.order.paymentMethod === 'PAYOS' && result.order.paymentStatus === 'PENDING' && (
            <PaymentQr
              orderId={result.order.id}
              onPaid={() => setPaid(true)}
              initial={{
                orderCode: result.order.orderCode,
                amount: result.order.totalAmount,
                paymentStatus: result.order.paymentStatus,
                qrCode: result.qrCode,
                paymentUrl: result.paymentUrl,
                expiresAt: result.expiresAt,
              }}
            />
          )}
          <div className="shop-address-actions">
            <button className="button button-light" onClick={onShop}>
              Tiếp tục mua sắm
            </button>
            <button className="button button-dark" onClick={onOrders}>
              Xem đơn hàng
            </button>
          </div>
        </section>
      </main>
    );
  if (!cart.items.length)
    return (
      <CheckoutState
        title={onCart ? 'Chưa chọn sản phẩm để đặt hàng' : 'Giỏ hàng đang trống'}
        message="Quay lại giỏ hàng và chọn sản phẩm muốn mua."
        action={onCart ? 'Chọn sản phẩm trong giỏ' : 'Tiếp tục mua sắm'}
        onAction={onCart || onShop}
      />
    );
  const total = Math.max(
    0,
    Number(cart.subtotal) - Number(voucherModel.voucher?.discountAmount || 0),
  );
  const ready =
    addressValid(selected) && !resource.loading && !resource.error && !busy && !voucherModel.busy;
  return (
    <main className="shop-checkout-page">
      <button className="shop-address-link" disabled={busy} onClick={onCart || onShop}>
        <ArrowLeft size={16} /> {onCart ? 'Quay lại giỏ để đổi lựa chọn' : 'Tiếp tục mua sắm'}
      </button>
      <div className="shop-checkout-title">
        <p className="kicker">ANH LỚN SHOP / ĐẶT HÀNG</p>
        <h1>Hoàn tất đơn hàng</h1>
        <p>Kiểm tra địa chỉ và thông tin trước khi đặt hàng.</p>
      </div>
      <div className="shop-checkout-grid">
        <div className="shop-checkout-sections">
          <section className="shop-checkout-card shop-delivery-card">
            <div className="shop-checkout-heading">
              <h2>
                <MapPin size={21} /> Địa chỉ nhận hàng
              </h2>
              {selected && !resource.loading && !resource.error && (
                <button
                  className="shop-address-link"
                  disabled={busy}
                  onClick={() => setPicker(true)}
                >
                  Thay đổi
                </button>
              )}
            </div>
            {resource.loading ? (
              <p role="status">Đang tải địa chỉ...</p>
            ) : resource.error ? (
              <div className="shop-inline-error" role="alert">
                {resource.error}
                <button className="button button-light" onClick={resource.load}>
                  Thử lại địa chỉ
                </button>
              </div>
            ) : selected ? (
              <AddressSummary address={selected} />
            ) : (
              <div>
                <p>Bạn chưa có địa chỉ nhận hàng.</p>
                <button
                  className="button button-light"
                  disabled={busy}
                  onClick={() => setPicker(true)}
                >
                  Thêm địa chỉ nhận hàng
                </button>
              </div>
            )}
          </section>
          <section className="shop-checkout-card">
            <h2>
              <Package size={21} /> Sản phẩm <small>({cart.items.length})</small>
            </h2>
            <div className="shop-checkout-products">
              {cart.items.map(item => (
                <article
                  className="shop-checkout-product"
                  key={[item.productId, item.size, item.color].join('-')}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} />
                  ) : (
                    <span className="shop-checkout-image-placeholder">
                      <Package size={24} />
                    </span>
                  )}
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {[item.color, item.size && 'Size ' + item.size].filter(Boolean).join(' · ')}
                    </p>
                    <small>Số lượng: {item.quantity}</small>
                  </div>
                  <b>{money(item.lineTotal)}</b>
                </article>
              ))}
            </div>
          </section>
          <section className="shop-checkout-card">
            <h2>
              <CreditCard size={21} /> Phương thức thanh toán
            </h2>
            <fieldset className="shop-checkout-methods" disabled={busy}>
              <legend className="shop-sr-only">Chọn phương thức thanh toán</legend>
              <label className={method === 'COD' ? 'is-selected' : ''}>
                <input
                  type="radio"
                  name="payment-method"
                  checked={method === 'COD'}
                  onChange={() => setMethod('COD')}
                />
                <Truck size={21} />
                <span>
                  <b>Thanh toán khi nhận hàng</b>
                  <small>Thanh toán cho đơn vị giao hàng (COD).</small>
                </span>
              </label>
              <label className={method === 'PAYOS' ? 'is-selected' : ''}>
                <input
                  type="radio"
                  name="payment-method"
                  checked={method === 'PAYOS'}
                  onChange={() => setMethod('PAYOS')}
                />
                <CreditCard size={21} />
                <span>
                  <b>payOS / VietQR</b>
                  <small>Quét mã QR ngay sau khi đặt hàng.</small>
                </span>
              </label>
            </fieldset>
          </section>
        </div>
        <aside className="shop-checkout-card shop-checkout-totals">
          <h2>Tóm tắt đơn hàng</h2>
          <VoucherField model={voucherModel} disabled={busy} />
          <dl>
            <div>
              <dt>Tạm tính</dt>
              <dd>{money(cart.subtotal)}</dd>
            </div>
            {voucherModel.voucher && (
              <div className="shop-checkout-discount">
                <dt>Giảm giá ({voucherModel.voucher.code})</dt>
                <dd>−{money(voucherModel.voucher.discountAmount)}</dd>
              </div>
            )}
            <div className="shop-checkout-total">
              <dt>Tổng thanh toán</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
          <form onSubmit={submit}>
            {error && (
              <p className="shop-inline-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-dark" type="submit" disabled={!ready}>
              {busy ? 'ĐANG ĐẶT HÀNG...' : 'ĐẶT HÀNG'}
              <ArrowUpRight size={17} />
            </button>
          </form>
          {!selected && !resource.loading && !resource.error && (
            <p>Vui lòng thêm địa chỉ để tiếp tục.</p>
          )}
          <p className="shop-checkout-secure">
            <ShieldCheck size={16} /> Đơn hàng chỉ được xác nhận sau khi cửa hàng kiểm tra.
          </p>
        </aside>
      </div>
      {picker && (
        <AddressPicker
          resource={resource}
          selected={selected}
          onSelect={address => {
            setSelected(address);
            setPicker(false);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </main>
  );
}

export function CheckoutState({ title, message, action, onAction, loading = false }) {
  return (
    <main className="shop-checkout-page">
      <section className="shop-checkout-state">
        <ShoppingStateIcon />
        <h1>{title}</h1>
        <p role={loading ? 'status' : undefined}>{message}</p>
        {action && (
          <button className="button button-dark" onClick={onAction}>
            {action}
          </button>
        )}
      </section>
    </main>
  );
}
function ShoppingStateIcon() {
  return <Package size={36} aria-hidden="true" />;
}
