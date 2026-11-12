import React, { useRef, useState } from "react";
import { ArrowUpRight, ArrowLeft, ChevronRight, Heart, Minus, Plus, RefreshCw, ShieldCheck, Star, Truck, X, Check } from "lucide-react";
import { csv, discount, imageSrc, money, protectImage } from "../../shared/utils/storefront-display";

export function ProductCard({ product, onOpen, onAdd, isWishlisted, onWishlist }) {
  const sale = discount(product);
  return (
    <article className="product-card">
      <div className="product-image">
        <img
          src={imageSrc(product.imageUrl)}
          onError={protectImage}
          alt={product.name}
          loading="lazy"
        />
        <button type="button" className="product-image-open" aria-label={`Xem chi tiết ${product.name}`} onClick={onOpen} />
        <div className="product-labels">
          {product.badge && <span>{product.badge}</span>}
          {sale > 0 && <span className="sale-badge">-{sale}%</span>}
          {product.stock <= 0 && <span>HẾT HÀNG</span>}
        </div>
        <button
          className={isWishlisted ? "heart active" : "heart"}
          type="button"
          aria-label={isWishlisted ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
          onClick={onWishlist}
        >
          <Heart size={19} fill={isWishlisted ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <div className="product-meta">
          <span>{product.category || "HÀNG NAM"}</span>
          {csv(product.colors).length > 1 && (
            <span className="product-colors-pill">
              {csv(product.colors).length} màu sắc
            </span>
          )}
          <span className={product.stock > 0 ? "" : "is-out-of-stock"}>{product.stock > 0 ? "CÒN HÀNG" : "HẾT HÀNG"}</span>
        </div>
        <h3><button type="button" onClick={onOpen}>{product.name}</button></h3>
        <div className="price-row">
          <strong>{money(product.salePrice || product.price)}</strong>
          {sale > 0 && <del>{money(product.price)}</del>}
        </div>
        <div className="product-card-actions">
          <button type="button" className="product-card-detail" aria-label={`Chi tiết ${product.name}`} onClick={onOpen}>Chi tiết <ArrowUpRight size={15}/></button>
          <button type="button" className="product-card-add" aria-label={`Thêm ${product.name} vào giỏ`} title={product.stock > 0 ? "Thêm vào giỏ" : "Hết hàng"} disabled={product.stock <= 0} onClick={onAdd}><Plus size={18}/></button>
        </div>
      </div>
    </article>
  );
}

const formatReviewDate = (val) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
};

export function ProductModal({ page = false, data, user, onClose, onAdd, onBuyNow, onLogin }) {
  const product = data.product;
  const [size, setSize] = useState(
    csv(product.sizes)[1] || csv(product.sizes)[0] || "M",
  );
  const [color, setColor] = useState(csv(product.colors)[0] || "Đen");
  const [quantity, setQuantity] = useState(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const purchaseLock = useRef(false);
  const [purchasing, setPurchasing] = useState(false);
  const purchase = async (buy = false) => {
    if (purchaseLock.current) return;
    purchaseLock.current = true; setPurchasing(true);
    try { await (buy && onBuyNow ? onBuyNow : onAdd)({ size, color }, quantity); if (!page) onClose(); }
    finally { purchaseLock.current = false; setPurchasing(false); }
  };
  const sale = discount(product);
  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!user) return onLogin();
    window.history.pushState({},'', '/don-hang?tab=COMPLETED');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const feedbackList = data.feedback || [];
  const feedbackCount = feedbackList.length;
  const avgRating = feedbackCount > 0
    ? (feedbackList.reduce((sum, f) => sum + (Number(f.rating) || 5), 0) / feedbackCount).toFixed(1)
    : null;
  const visibleFeedback = showAllFeedback ? feedbackList : feedbackList.slice(0, 3);
  return (
    <div
      className={page ? "customer-page-body" : "modal-backdrop"}
      onMouseDown={(event) => !page && event.target === event.currentTarget && onClose()}
    >
      <div className="product-modal">
        <button
          className="close-button"
          aria-label="Đóng chi tiết sản phẩm"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="product-modal-image">
          <img
            src={imageSrc(product.imageUrl)}
            onError={protectImage}
            alt={product.name}
          />
          {product.badge && <span>{product.badge}</span>}
        </div>
        <div className="product-modal-content">
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
            {product.category || "HÀNG NAM"} / ANH LỚN SHOP
          </p>
          <h2>{product.name}</h2>
          <div className="modal-price">
            <strong>{money(product.salePrice || product.price)}</strong>
            {sale > 0 && (
              <>
                <del>{money(product.price)}</del>
                <em>Tiết kiệm {sale}%</em>
              </>
            )}
          </div>
          <p className="modal-description">
            {product.description ||
              "Thiết kế cân bằng giữa công năng và vẻ ngoài hiện đại, phù hợp cho tủ đồ hằng ngày."}
          </p>
          <div className="choice">
            <label>
              MÀU SẮC <b>{color}</b>
            </label>
            <div className="choice-row">
              {csv(product.colors).map((item) => (
                <button
                  className={
                    color === item ? "choice-chip active" : "choice-chip"
                  }
                  key={item}
                  onClick={() => setColor(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="choice">
            <label>
              KÍCH THƯỚC <b>{size}</b>
            </label>
            <div className="choice-row">
              {csv(product.sizes).map((item) => (
                <button
                  className={
                    size === item ? "choice-chip active" : "choice-chip"
                  }
                  key={item}
                  onClick={() => setSize(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="size-guide-link"
              onClick={() => setShowSizeGuide(true)}
            >
              Không chắc size? Xem bảng hướng dẫn kích thước <ChevronRight size={14} />
            </button>
          </div>
          <div className="product-quantity">
            <label>
              SỐ LƯỢNG <b>{quantity}</b>
            </label>
            <div className="quantity product-quantity-control">
              <button
                type="button"
                aria-label="Giảm số lượng sản phẩm"
                disabled={quantity <= 1}
                onClick={() =>
                  setQuantity((current) => Math.max(1, current - 1))
                }
              >
                <Minus size={17} />
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                aria-label="Tăng số lượng sản phẩm"
                disabled={quantity >= product.stock}
                onClick={() =>
                  setQuantity((current) => Math.min(product.stock, current + 1))
                }
              >
                <Plus size={17} />
              </button>
            </div>
            <small>Còn {product.stock} sản phẩm trong kho</small>
          </div>
          <div className="product-modal-actions">
            <button
              className="button button-dark add-modal"
              disabled={!product.stock || purchasing}
              onClick={() => purchase()}
            >
              {product.stock
                ? `THÊM ${quantity} VÀO GIỎ`
                : "TẠM HẾT HÀNG"}
            </button>
            <button
              type="button"
              className="buy-now-btn"
              disabled={!product.stock || purchasing}
              onClick={() => purchase(true)}
            >
              MUA NGAY
            </button>
          </div>

          {showSizeGuide && (
            <div
              className="modal-backdrop"
              onClick={() => setShowSizeGuide(false)}
            >
              <div
                className="size-guide-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="size-guide-header">
                  <h3>Bảng Hướng Dẫn Kích Thước</h3>
                  <button
                    type="button"
                    className="close-button"
                    aria-label="Đóng bảng kích thước"
                    onClick={() => setShowSizeGuide(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="size-guide-table-wrap">
                  <table className="size-guide-table">
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th>Chiều cao</th>
                        <th>Cân nặng</th>
                        <th>Vòng ngực</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><b>S</b></td>
                        <td>1m55 – 1m65</td>
                        <td>48 – 55 kg</td>
                        <td>86 – 90 cm</td>
                      </tr>
                      <tr>
                        <td><b>M</b></td>
                        <td>1m64 – 1m72</td>
                        <td>55 – 65 kg</td>
                        <td>90 – 94 cm</td>
                      </tr>
                      <tr>
                        <td><b>L</b></td>
                        <td>1m70 – 1m78</td>
                        <td>65 – 75 kg</td>
                        <td>94 – 98 cm</td>
                      </tr>
                      <tr>
                        <td><b>XL</b></td>
                        <td>1m75 – 1m85</td>
                        <td>75 – 85 kg</td>
                        <td>98 – 104 cm</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="size-guide-tip">
                  💡 <b>Gợi ý:</b> Nếu bạn ở giữa 2 size, hãy chọn size lớn hơn để có cảm giác mặc rộng rãi và thoải mái nhất.
                </p>
              </div>
            </div>
          )}
          <div className="product-details">
            <span>
              <ShieldCheck size={15} />{" "}
              {product.material || "Chất liệu chọn lọc"}
            </span>
            <span>
              <RefreshCw size={15} /> Đổi size trong 30 ngày
            </span>
            <span>
              <Truck size={15} /> Giao hàng toàn quốc
            </span>
          </div>
          <div className="feedback-section">
            <div className="feedback-heading">
              <div className="feedback-header-left">
                <h3>ĐÁNH GIÁ KHÁCH HÀNG</h3>
                <span className="feedback-count-badge">
                  {feedbackCount > 0 ? `(${feedbackCount})` : "Chưa có đánh giá"}
                </span>
              </div>
              {avgRating && (
                <div className="feedback-rating-summary">
                  <span className="feedback-avg-score">{avgRating}</span>
                  <div className="feedback-stars-summary" aria-label={`Đánh giá trung bình ${avgRating} trên 5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={13}
                        className={i < Math.round(Number(avgRating)) ? "star-filled" : "star-empty"}
                      />
                    ))}
                  </div>
                  <span className="feedback-rating-scale">/ 5</span>
                </div>
              )}
            </div>

            {feedbackCount === 0 ? (
              <div className="feedback-empty-card">
                <div className="feedback-empty-icon">
                  <Star size={22} className="star-filled" />
                </div>
                <p className="feedback-empty-title">Chưa có đánh giá nào cho sản phẩm này</p>
                <span className="feedback-empty-subtitle">
                  Hãy là người đầu tiên trải nghiệm và chia sẻ cảm nhận!
                </span>
              </div>
            ) : (
              <div className="feedback-list">
                {visibleFeedback.map((item) => (
                  <div className="feedback-item" key={item.id}>
                    <div className="feedback-item-header">
                      <div className="feedback-avatar">
                        {(item.customerName || "K").trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="feedback-user-meta">
                        <div className="feedback-user-row">
                          <b className="feedback-author-name">{item.customerName || "Khách hàng"}</b>
                          <span className="feedback-verified-tag">
                            <Check size={11} strokeWidth={2.5} /> Đã mua hàng
                          </span>
                        </div>
                        <div className="feedback-rating-row">
                          <span className="feedback-item-stars" aria-label={`${item.rating} trên 5 sao`}>
                            {Array.from({ length: 5 }, (_, index) => (
                              <Star
                                key={index}
                                size={13}
                                className={index < item.rating ? "star-filled" : "star-empty"}
                              />
                            ))}
                          </span>
                          {item.createdAt && (
                            <span className="feedback-time">
                              {formatReviewDate(item.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="feedback-comment">{item.comment || "Sản phẩm rất ổn."}</p>
                    {item.adminResponse && (
                      <section className="shop-feedback-reply" aria-label="Phản hồi của shop">
                        <div className="shop-reply-header">
                          <ShieldCheck size={13} className="shop-reply-badge-icon" />
                          <b>ANH LỚN SHOP trả lời</b>
                        </div>
                        <p className="shop-reply-text">{item.adminResponse}</p>
                      </section>
                    )}
                  </div>
                ))}
                {feedbackCount > 3 && (
                  <button
                    type="button"
                    className="feedback-toggle-btn"
                    onClick={() => setShowAllFeedback((prev) => !prev)}
                  >
                    {showAllFeedback
                      ? "Thu gọn đánh giá"
                      : `Xem thêm ${feedbackCount - 3} đánh giá khác`}
                  </button>
                )}
              </div>
            )}

            <form className="feedback-form" onSubmit={submitFeedback}>
              <div className="feedback-cta-card">
                <div className="feedback-cta-header">
                  <Star size={15} className="star-filled feedback-cta-icon" />
                  <small className="feedback-help">
                    Đánh giá từng sản phẩm trong đơn sau khi xác nhận đã nhận hàng.
                  </small>
                </div>
                <button type="submit" className="button feedback-submit-btn">
                  {!user ? "ĐĂNG NHẬP ĐỂ ĐÁNH GIÁ" : "ĐẾN ĐƠN HOÀN THÀNH ĐỂ ĐÁNH GIÁ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
