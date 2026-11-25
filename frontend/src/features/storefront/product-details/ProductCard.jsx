import React from 'react';
import { Heart } from 'lucide-react';
import { csv, discount, imageSrc, protectImage } from '../../../shared/utils/storefront-display';
import { firstProductColor, imagesForColor } from '../product-image-gallery';

const SWATCH_COLORS = [
  [/\b(?:den|black|charcoal)\b/, '#242424'],
  [/\b(?:trang|white|ivory)\b/, '#f7f6f2'],
  [/\b(?:xam|grey|gray|ash)\b/, '#aaa9a5'],
  [/\b(?:nau|brown|tan)\b/, '#8b6048'],
  [/\b(?:be|beige|kem|cream)\b/, '#d8c6a6'],
  [/\b(?:do|red|burgundy)\b/, '#b9323c'],
  [/\b(?:xanh la|green|olive)\b/, '#58704d'],
  [/\b(?:hong|pink)\b/, '#d698a7'],
  [/\b(?:vang|yellow)\b/, '#d0ad4d'],
  [/\b(?:xanh|blue|denim|navy|indigo)\b/, '#48617c'],
];

function swatchColor(color) {
  const value = String(color || '').trim();
  if (/^#[\da-f]{3,8}$/i.test(value)) return value;
  const normalized = value.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd');
  return SWATCH_COLORS.find(([pattern]) => pattern.test(normalized))?.[1] || '#c5c7c8';
}

function cardPrice(value) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value || 0))}đ`;
}

export function ProductCard({ product, onOpen, onQuickView, isWishlisted, onWishlist, onAddToCart, onBuyNow }) {
  const sale = discount(product);
  const coverImage = imagesForColor(product, firstProductColor(product))[0] || product.imageUrl;
  const colors = csv(product.colors);
  const outOfStock = Number(product.stock) <= 0;
  return (
    <article className="product-card">
      <div className="product-image">
        <img
          src={imageSrc(coverImage)}
          onError={protectImage}
          alt={product.name}
          loading="lazy"
        />
        <button type="button" className="product-image-open" aria-label={`Xem chi tiết ${product.name}`} onClick={onOpen} />
        <div className="product-labels">
          {sale > 0 && <span className="sale-badge">SALE</span>}
          {product.stock <= 0 && <span className="stock-label">HẾT HÀNG</span>}
        </div>
        {(sale > 0 || product.badge) && (
          <div className="product-image-promo" aria-label={sale > 0 ? `Giảm ${sale}%${product.badge ? `, ${product.badge}` : ''}` : product.badge}>
            {sale > 0 && <strong>-{sale}%</strong>}
            <span>{product.badge || 'ƯU ĐÃI'}</span>
          </div>
        )}
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
        <h3><button type="button" onClick={onOpen}>{product.name}</button></h3>
        <div className="price-row">
          <strong>{cardPrice(product.salePrice || product.price)}</strong>
          {sale > 0 && <del>{cardPrice(product.price)}</del>}
          {sale > 0 && <span className="product-discount">-{sale}%</span>}
        </div>
        {colors.length > 0 && (
          <div className="product-swatches" role="list" aria-label={`Màu sắc: ${colors.join(', ')}`}>
            {colors.slice(0, 5).map((color) => (
              <span
                className="product-swatch"
                key={color}
                role="listitem"
                title={color}
                aria-label={color}
                style={{ '--product-swatch-color': swatchColor(color) }}
              >
                {Array.isArray(product.colorImages?.[color]) && product.colorImages[color][0] && (
                  <img
                    src={imageSrc(product.colorImages[color][0])}
                    alt=""
                    loading="lazy"
                    onError={event => { event.currentTarget.style.display = 'none'; }}
                  />
                )}
              </span>
            ))}
            {colors.length > 5 && <span className="product-swatch-more">+{colors.length - 5}</span>}
          </div>
        )}
      </div>
      <div className="product-card-cta">
        <button
          type="button"
          className="product-card-buy"
          disabled={outOfStock}
          onClick={() => onBuyNow?.(product)}
        >
          MUA NGAY
        </button>
        <button
          type="button"
          className="product-card-cart"
          disabled={outOfStock}
          onClick={() => onAddToCart?.(product)}
        >
          THÊM VÀO GIỎ HÀNG
        </button>
      </div>
    </article>
  );
}
