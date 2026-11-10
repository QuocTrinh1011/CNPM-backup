import React, { useEffect, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import { api } from '../../api/api';
import { useShopResource } from '../../shared/hooks/storefront-hooks';

const STAR_LABELS = { 1: 'Tệ', 2: 'Không hài lòng', 3: 'Bình thường', 4: 'Hài lòng', 5: 'Tuyệt vời' };
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85';
const imgSrc = v => typeof v === 'string' && v.trim() ? v : FALLBACK_IMG;

function StarRating({ value, hover, disabled, onChange, onHover, onLeave }) {
  return (
    <div className="review-stars" role="radiogroup" aria-label="Đánh giá sao">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`review-star${n <= (hover || value) ? ' active' : ''}`}
          disabled={disabled}
          aria-label={`${n} sao — ${STAR_LABELS[n]}`}
          onMouseEnter={() => onHover?.(n)}
          onMouseLeave={() => onLeave?.()}
          onClick={() => onChange?.(n)}
        >
          <Star size={28} fill={n <= (hover || value) ? '#FFD700' : 'none'} stroke={n <= (hover || value) ? '#FFD700' : '#ccc'} />
        </button>
      ))}
    </div>
  );
}

export default function OrderReviews({ order, autoOpen = false, onAutoOpened, onReviewStatus }) {
  const { data, error, load } = useShopResource(`/api/orders/${order.id}/reviews`);
  const [product, setProduct] = useState(null);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const lock = useRef(false);
  const autoConsumed = useRef(false);
  const dialogRef = useRef(null);
  const sectionRef = useRef(null);
  const [submitted, setSubmitted] = useState([]);

  const open = item => { setProduct(item); setRating(5); setHoverRating(0); setComment(''); setFailure(''); };
  const close = () => { if (!busy) setProduct(null); };

  const submit = async e => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailure('');
    try {
      await api(`/api/products/${product.productId}/feedback`, {
        method: 'POST',
        body: { orderId: order.id, rating, comment },
      });
      setProduct(null);
      setSubmitted(previous => [...previous, product.productId]);
      await load();
    } catch (err) {
      setFailure(err.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const items = [...new Map((order.items || []).map(i => [i.productId, i])).values()];
  const reviewedCount = new Set([...(Array.isArray(data) ? data.filter(v => v.reviewed).map(v => v.productId) : []), ...submitted]).size;
  const totalCount = items.length;
  useEffect(() => {
    if (Array.isArray(data) || submitted.length) onReviewStatus?.(reviewedCount > 0);
  }, [data, submitted.length, reviewedCount, onReviewStatus]);
  const nextItem = items.find(item => !submitted.includes(item.productId) && data?.find?.(state => state.productId === item.productId && state.canReview && !state.reviewed));
  useEffect(() => {
    if (!autoOpen || autoConsumed.current || error || !Array.isArray(data)) return;
    autoConsumed.current = true;
    if (order.status === 'COMPLETED' && nextItem) open(nextItem);
    onAutoOpened?.();
  }, [autoOpen, data, error, nextItem, order.status, onAutoOpened]);
  useEffect(() => {
    if (!product) return;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.focus();
    const keydown = event => {
      if (event.key === 'Escape' && !lock.current) { event.preventDefault(); setProduct(null); }
      if (event.key !== 'Tab') return;
      const nodes = [...dialog.querySelectorAll('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),[tabindex="0"]')];
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      dialog.removeEventListener('keydown', keydown);
      if (previous?.isConnected && previous !== document.body) previous.focus();
      else sectionRef.current?.focus();
    };
  }, [product]);

  return (
    <section className="review-section" ref={sectionRef} tabIndex={-1} aria-label="Đánh giá sản phẩm trong đơn">
      <div className="review-section-header">
        <div>
          <h3><Star size={18} /> Đánh giá sản phẩm</h3>
          <p>Chia sẻ trải nghiệm của bạn về từng sản phẩm trong đơn.</p>
        </div>
        {data && <span className="review-progress">{reviewedCount}/{totalCount} đã đánh giá</span>}
      </div>

      {error ? (
        <div className="review-error" role="alert">
          <p>{autoOpen ? 'Đơn đã xác nhận thành công. Chưa tải được phần đánh giá. ' : ''}{error}</p>
          <button type="button" className="button button-light" onClick={load}>Thử lại</button>
        </div>
      ) : !Array.isArray(data) ? (
        <div className="review-loading">Đang tải...</div>
      ) : (
        <div className="review-product-list">
          {items.map(item => {
            const state = data.find(v => v.productId === item.productId);
            return (
              <div className="review-product-card" key={item.productId}>
                <img
                  src={imgSrc(item.imageUrl)}
                  alt={item.name}
                  onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMG; }}
                />
                <div className="review-product-info">
                  <b>{item.name}</b>
                  <small>{[item.size, item.color].filter(Boolean).join(' · ') || 'Phân loại tiêu chuẩn'}</small>
                </div>
                <div className="review-product-action">
                  {state?.reviewed || submitted.includes(item.productId) ? (
                    <span className="review-badge-done"><span aria-hidden="true">✓</span> Đã đánh giá</span>
                  ) : (
                    <button
                      type="button"
                      className="button button-dark review-btn"
                      disabled={!state?.canReview || busy}
                      onClick={() => open(item)}
                    >
                      <Star size={14} /> Đánh giá {item.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {submitted.length > 0 && <div role="status"><p>Đã gửi đánh giá thành công.</p>{!error && nextItem && <button type="button" className="button button-dark" onClick={() => open(nextItem)}>Đánh giá sản phẩm tiếp theo</button>}</div>}

      {product && (
        <div className="review-dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
          <div className="review-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Đánh giá ${product.name}`}>
            <button type="button" className="review-dialog-close" aria-label="Đóng" disabled={busy} onClick={close}>
              <X size={20} />
            </button>

            <h3 className="review-dialog-title">Đánh giá sản phẩm</h3>

            <div className="review-dialog-product">
              <img
                src={imgSrc(product.imageUrl)}
                alt={product.name}
                onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMG; }}
              />
              <div>
                <b>{product.name}</b>
                <small>{[product.size, product.color].filter(Boolean).join(' · ') || 'Phân loại tiêu chuẩn'}</small>
              </div>
            </div>

            <form onSubmit={submit}>
              <div className="review-dialog-rating">
                <label>Chất lượng sản phẩm</label>
                <StarRating
                  value={rating}
                  hover={hoverRating}
                  disabled={busy}
                  onChange={setRating}
                  onHover={setHoverRating}
                  onLeave={() => setHoverRating(0)}
                />
                <span className="review-star-label">{STAR_LABELS[hoverRating || rating]}</span>
              </div>

              <div className="review-dialog-comment">
                <label htmlFor="review-comment">Bình luận (tùy chọn)</label>
                <textarea
                  id="review-comment"
                  maxLength={4000}
                  rows={4}
                  placeholder="Chia sẻ thêm về trải nghiệm sản phẩm..."
                  value={comment}
                  disabled={busy}
                  onChange={e => setComment(e.target.value)}
                />
                <span className="review-char-count">{comment.length} / 4000</span>
              </div>

              {failure && <p className="review-dialog-error" role="alert">{failure}</p>}

              <div className="review-dialog-actions">
                <button type="button" className="button button-light" disabled={busy} onClick={close}>Hủy</button>
                <button type="submit" className="button button-dark" disabled={busy}>
                  {busy ? 'Đang gửi...' : 'Gửi đánh giá'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
