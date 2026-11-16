import React, { useEffect, useRef, useState } from "react";
import { signIn, signUp } from "../api";
import { cartLineKey, canBuyLine } from "../cart-selection";
import { ArrowUpRight, Minus, PackageOpen, Plus, Trash2, X } from "lucide-react";
import { money, imageSrc, protectImage } from "./utils";

export function CartDrawer({ page = false, cart, onClose, onUpdate, updatingKeys = [], onCheckout, selection }) {
  const eligible = cart.items.filter(canBuyLine);
  const allSelected = eligible.length > 0 && eligible.every(item => selection?.selected.has(cartLineKey(item)));
  const selectAll = useRef(null);
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = !allSelected && !!selection?.selected.size; }, [allSelected, selection?.selected.size]);

  return (
    <div
      className={page ? "customer-page-body customer-cart" : "drawer-backdrop"}
      onMouseDown={(event) => !page && event.target === event.currentTarget && onClose()}
    >
      <aside className="cart-drawer">
        <div className="drawer-head">
          <div>
            <p className="kicker">GIỎ HÀNG CỦA BẠN</p>
            <h2>{cart.itemCount || 0} sản phẩm</h2>
          </div>
          <button type="button" className="close-button" aria-label="Đóng giỏ hàng" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="cart-items">
          {selection && <label className="cart-select-all"><input ref={selectAll} type="checkbox" checked={allSelected} disabled={!eligible.length || !!updatingKeys.length} onChange={event => selection.all(event.target.checked)}/> Chọn tất cả ({eligible.length})</label>}
          {cart.items.length ? (
            cart.items.map((item) => (
              <div
                className={`cart-line${selection ? ' selectable' : ''}`}
                key={`${item.productId}-${item.size || ""}-${item.color || ""}`}
              >
                {selection && <input className="cart-line-checkbox" type="checkbox" aria-label={`Chọn ${item.name} ${item.color || ''} ${item.size || ''}`} checked={selection.selected.has(cartLineKey(item))} disabled={!canBuyLine(item) || !!updatingKeys.length} onChange={() => selection.toggle(item)}/>}
                <img
                  src={imageSrc(item.imageUrl)}
                  onError={protectImage}
                  alt={item.name}
                />
                <div className="cart-line-info">
                  <h3>{item.name}</h3>
                  <small>{money(item.unitPrice)}</small>
                  <small>{[item.color, item.size].filter(Boolean).join(' · ')}</small>
                  {!canBuyLine(item) && <small className="shop-field-error">{Number(item.stock) > 0 ? `Chỉ còn ${item.stock} sản phẩm. Vui lòng giảm số lượng.` : 'Sản phẩm đã hết hàng.'}</small>}
                  <div className="quantity">
                    <button
                      type="button"
                      aria-label={`Giảm số lượng ${item.name}`}
                      disabled={updatingKeys.includes(`${item.productId}|${item.size || ""}|${item.color || ""}`)}
                      onClick={() => onUpdate(item, item.quantity - 1)}
                    >
                      <Minus size={15} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Tăng số lượng ${item.name}`}
                      disabled={
                        item.quantity >= item.stock ||
                        updatingKeys.includes(`${item.productId}|${item.size || ""}|${item.color || ""}`)
                      }
                      onClick={() => onUpdate(item, item.quantity + 1)}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
                <strong>{money(item.lineTotal)}</strong>
                <button
                  className="remove-line"
                  aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
                  type="button"
                  disabled={updatingKeys.includes(`${item.productId}|${item.size || ""}|${item.color || ""}`)}
                  onClick={() => onUpdate(item, 0)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))
          ) : (
            <div className="drawer-empty">
              <PackageOpen size={38} />
              <h3>Giỏ hàng còn trống</h3>
              <p>Thêm một món đồ bạn thích để bắt đầu.</p>
            </div>
          )}
        </div>
        <div className="drawer-foot">
          <div className="subtotal">
            <span>TẠM TÍNH</span>
            <strong>{money(selection ? selection.cart.subtotal : cart.subtotal)}</strong>
          </div>
          <p>Kiểm tra sản phẩm và áp dụng mã giảm giá ở bước đặt hàng.</p>
          {selection && <p>Đã chọn {selection.cart.itemCount} sản phẩm ({selection.cart.items.length} phân loại).</p>}
          <button
            className="button button-dark"
            disabled={!(selection ? selection.cart.items.length : cart.items.length) || !!updatingKeys.length}
            onClick={onCheckout}
          >
            TIẾN HÀNH ĐẶT HÀNG <ArrowUpRight size={16} />
          </button>
          <button type="button" className="continue-shopping" onClick={onClose}>
            Tiếp tục mua sắm
          </button>
        </div>
      </aside>
    </div>
  );
}

export function AuthModal({ page = false, mode, onModeChange, onClose, onAuthenticated, onNotice, onForgot }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    age: "",
  });
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setAuthError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await signUp({
          ...form,
          age: form.age === "" ? null : Number(form.age),
        });
        onNotice("Tạo tài khoản thành công.");
      }
      const data = await signIn({ email: form.email, password: form.password });
      if (alive.current) onAuthenticated(data.customer);
    } catch (error) {
      if (alive.current) setAuthError(error.message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div
      className={page ? "customer-page-body" : "modal-backdrop"}
      onMouseDown={(event) => !page && event.target === event.currentTarget && onClose()}
    >
      <div className="auth-modal">
        <button className="close-button" aria-label="Đóng đăng nhập" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="auth-mark">
          AL<span>SHOP</span>
        </div>
        <p className="kicker">ANH LỚN SHOP</p>
        <h2>
          {mode === "login" ? "Chào mừng trở lại." : "Tạo tài khoản mới."}
        </h2>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Đăng nhập để quản lý đơn hàng và lưu những món đồ yêu thích."
            : "Tham gia cộng đồng những người mặc đẹp theo cách riêng."}
        </p>
        <form onSubmit={submit}>
          {authError && <p className="auth-account-error" role="alert">{authError}</p>}
          {mode === "register" && (
            <>
              <label>
                HỌ VÀ TÊN
                <input
                  required
                  value={form.fullName}
                  onChange={(event) =>
                    setForm({ ...form, fullName: event.target.value })
                  }
                  placeholder="Nguyễn Minh Khang"
                />
              </label>
              <label>
                SỐ ĐIỆN THOẠI
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="09xx xxx xxx"
                />
              </label>
              <label>
                TUỔI <span className="optional-label">(không bắt buộc)</span>
                <input
                  type="number"
                  min="13"
                  max="120"
                  value={form.age}
                  onChange={(event) =>
                    setForm({ ...form, age: event.target.value })
                  }
                  placeholder="Ví dụ: 22"
                />
              </label>
            </>
          )}
          <label>
            EMAIL
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="ban@email.com"
            />
          </label>
          <label>
            MẬT KHẨU
            <input
              type="password"
              required
              minLength="8"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="Ít nhất 8 ký tự, gồm chữ và số"
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            {busy
              ? "ĐANG XỬ LÝ..."
              : mode === "login"
                ? "ĐĂNG NHẬP →"
                : "TẠO TÀI KHOẢN →"}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' && <button type="button" onClick={onForgot}>Quên mật khẩu?</button>}
          {mode === "login" ? "Chưa có tài khoản?" : "Bạn đã có tài khoản?"}{" "}
          <button
            onClick={() =>
              onModeChange(mode === "login" ? "register" : "login")
            }
          >
            {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
          </button>
        </div>
      </div>
    </div>
  );
}
