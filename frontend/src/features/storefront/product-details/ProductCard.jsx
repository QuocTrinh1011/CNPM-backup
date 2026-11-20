import React from 'react';
import { ArrowUpRight, Heart, Plus } from 'lucide-react';
import { csv, discount, imageSrc, money, protectImage } from '../../../shared/utils/storefront-display';
import { firstProductColor, imagesForColor } from '../product-image-gallery';

export function ProductCard({ product, onOpen, onAdd, isWishlisted, onWishlist }) {
  const sale = discount(product);
  const coverImage = imagesForColor(product, firstProductColor(product))[0] || product.imageUrl;
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
