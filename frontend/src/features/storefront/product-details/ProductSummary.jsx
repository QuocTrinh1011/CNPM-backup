import React from 'react';
import { ArrowLeft, ChevronRight, TicketPercent } from 'lucide-react';
import { money } from '../../../shared/utils/storefront-display';

export function ProductSummary({ page, quickView, product, user, sale, openVoucherWallet, onClose }) {
  return (
    <>
          {page && (
            <button
              type="button"
              className="back-link product-back-button"
              onClick={onClose}
              aria-label="Quay lại danh sách sản phẩm"
            >
              <ArrowLeft size={18} />
              <span>Quay lại</span>
            </button>
          )}
          <p className="kicker">
            {product.category || "HÀNG NAM"} / NOVA SHOP
          </p>
          {page ? (
            <div className="product-title-row">
              <h2>{product.name}</h2>
              <span className={product.stock > 0 ? "product-stock-indicator" : "product-stock-indicator is-out-of-stock"}>
                {product.stock > 0 ? "Còn hàng" : "Hết hàng"}
              </span>
            </div>
          ) : <h2>{product.name}</h2>}
          {quickView && (
            <p className="quick-view-sku">SKU: {product.sku || product.productCode || product.code || product.id}</p>
          )}
          <div className="modal-price">
            <strong>{money(product.salePrice || product.price)}</strong>
            {sale > 0 && (
              <>
                <del>{money(product.price)}</del>
                <em>Tiết kiệm {sale}%</em>
              </>
            )}
          </div>
          {page && (
            <button type="button" className="product-voucher-link" onClick={openVoucherWallet}>
              <span className="product-voucher-icon"><TicketPercent size={18} /></span>
              <span className="product-voucher-copy">
                <b>Mã giảm giá</b>
                <small>{user ? "Xem voucher trong ví của bạn" : "Đăng nhập để xem voucher khả dụng"}</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}
          {!quickView && <p className="modal-description">
            {product.description ||
              "Thiết kế cân bằng giữa công năng và vẻ ngoài hiện đại, phù hợp cho tủ đồ hằng ngày."}
          </p>}
    </>
  );
}
