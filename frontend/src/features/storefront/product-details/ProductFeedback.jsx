import React from 'react';
import { Check, ShieldCheck, Star } from 'lucide-react';
import { formatReviewDate } from './productDetailsUtils';

export function ProductFeedback({ data, user, submitFeedback, showAllFeedback, setShowAllFeedback }) {
  const feedbackList = data.feedback || [];
  const feedbackCount = feedbackList.length;
  const avgRating = feedbackCount > 0
    ? (feedbackList.reduce((sum, f) => sum + (Number(f.rating) || 5), 0) / feedbackCount).toFixed(1)
    : null;
  const visibleFeedback = showAllFeedback ? feedbackList : feedbackList.slice(0, 3);
  return (
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
                          <b>NOVA SHOP trả lời</b>
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
  );
}
