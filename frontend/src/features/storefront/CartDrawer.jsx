import React, { useEffect, useRef } from "react";
import { ArrowUpRight, Minus, PackageOpen, Plus, Trash2, X } from "lucide-react";
import { canBuyLine, cartLineKey } from "./cart-selection";
import { imageSrc, money, protectImage } from "../../shared/utils/storefront-display";

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
