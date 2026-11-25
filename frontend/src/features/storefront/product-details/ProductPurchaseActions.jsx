import React from 'react';
import { Minus, Plus } from 'lucide-react';

export function ProductPurchaseActions({ page, quickView, purchaseIntent, product, quantity, setQuantity, purchasing, purchase }) {
  const addButton = (
    <button
      type="button"
      className={quickView ? "button quick-view-add-button" : page ? "button product-add-button" : "button button-dark add-modal"}
      disabled={!product.stock || purchasing}
      onClick={() => purchase()}
    >
      {product.stock ? quickView ? "THÊM VÀO GIỎ" : `THÊM ${quantity} VÀO GIỎ` : "TẠM HẾT HÀNG"}
    </button>
  );
  const buyButton = (
    <button
      type="button"
      className={quickView ? "button quick-view-add-button buy-now-btn" : page ? "buy-now-btn product-page-buy-button" : "buy-now-btn"}
      disabled={!product.stock || purchasing}
      onClick={() => purchase(true)}
    >
      MUA NGAY
    </button>
  );
  return (
    <>
          {quickView ? (
            <div className="quick-view-purchase-row">
              <div className="quantity product-quantity-control" aria-label={`Số lượng ${quantity}`}>
                <button
                  type="button"
                  aria-label="Giảm số lượng sản phẩm"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                >
                  <Minus size={17} />
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  aria-label="Tăng số lượng sản phẩm"
                  disabled={quantity >= product.stock}
                  onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))}
                >
                  <Plus size={17} />
                </button>
              </div>
              {purchaseIntent === 'buy' ? buyButton : addButton}
            </div>
          ) : page ? (
            <div className="product-page-purchase">
              <div className="product-page-purchase-row">
                <div className="quantity product-quantity-control" aria-label={`Số lượng ${quantity}`}>
                  <button
                    type="button"
                    aria-label="Giảm số lượng sản phẩm"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  >
                    <Minus size={17} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    aria-label="Tăng số lượng sản phẩm"
                    disabled={quantity >= product.stock}
                    onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))}
                  >
                    <Plus size={17} />
                  </button>
                </div>
                {addButton}
              </div>
              <small className="product-stock-count">Còn {product.stock} sản phẩm trong kho</small>
              {buyButton}
            </div>
          ) : (
            <>
              <div className="product-quantity">
                <label>SỐ LƯỢNG <b>{quantity}</b></label>
                <div className="quantity product-quantity-control">
                  <button
                    type="button"
                    aria-label="Giảm số lượng sản phẩm"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  >
                    <Minus size={17} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    aria-label="Tăng số lượng sản phẩm"
                    disabled={quantity >= product.stock}
                    onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))}
                  >
                    <Plus size={17} />
                  </button>
                </div>
                <small>Còn {product.stock} sản phẩm trong kho</small>
              </div>
              <div className="product-modal-actions">
                {addButton}
                {buyButton}
              </div>
            </>
          )}

    </>
  );
}
