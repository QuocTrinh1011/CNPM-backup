import React, { useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Layers,
  Shirt,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ProductCard } from './ProductDetails';
import { firstProductColor, imagesForColor } from './product-image-gallery';

const EDITORIAL_IMAGE = '/images/figma/daily-uniform.png';
const COLLECTIONS = [
  ['Áo thun', 'Dễ mặc. Dễ là chính mình.', '01', Shirt],
  ['Áo khoác', 'Thêm một lớp cá tính.', '02', Layers],
  ['Áo polo', 'Chỉn chu, không gò bó.', '03', Shirt],
  ['Quần', 'Thoải mái theo từng bước.', '04', Layers],
];

export default function StorefrontHome({
  products = [],
  categories = [],
  wishlist = [],
  loading = false,
  catalogError = '',
  onCatalog,
  onProduct,
  onQuickView,
  onWishlist,
  onRetry,
  imageSrc = value => value,
}) {
  const shelfRefs = useRef({});

  const categoryNames = [...new Set([
    ...categories,
    ...products.map(product => product.category).filter(Boolean),
  ])];
  const productSections = categoryNames
    .map(category => ({
      category,
      products: products.filter(product => product.category === category).slice(0, 8),
    }))
    .filter(section => section.products.length)
    .slice(0, 3);
  if (!productSections.length && products.length) {
    productSections.push({ category: 'Sản phẩm mới', products: products.slice(0, 8) });
  }

  const scrollShelf = (index, direction) => {
    shelfRefs.current[index]?.scrollBy({ left: direction * 760, behavior: 'smooth' });
  };

  return <>
    <section className="shop-editorial" aria-label="Khám phá phong cách NOVA Shop">
      <div className="shop-editorial-copy">
        <div className="shop-signal"><span>DROP 01</span><i>NEW SEASON / NOVA SHOP</i></div>
        <p className="shop-eyebrow"><span /> NOVA / THE DAILY UNIFORM</p>
        <h1>Mặc đẹp đúng gu.<br /><em>Tự tin mỗi ngày.</em></h1>
        <p className="shop-editorial-description">Phom dáng dễ mặc, chất liệu thoải mái — để anh tự tin trong mọi nhịp sống.</p>
        <div className="shop-editorial-actions">
          <button className="button shop-primary" onClick={() => onCatalog('')}>Khám phá sản phẩm <ArrowUpRight size={19} /></button>
        </div>
      </div>
      <div className="shop-editorial-visual">
        <img
          className="shop-editorial-image"
          src={imageSrc(EDITORIAL_IMAGE)}
          alt="Phong cách menswear tối giản của NOVA Shop"
          fetchPriority="high"
        />
        <span className="shop-editorial-stamp"><small>NOVA / 26</small><b>NEW FORM</b></span>
      </div>
    </section>

    <div className="shop-style-line" aria-hidden="true">
      <span><Zap size={14} /> FORM FIRST</span><i /><span><Sparkles size={14} /> MADE TO MOVE</span><i /><span>YOUR DAILY ROTATION</span>
    </div>

    <section className="shop-collections" aria-labelledby="shop-collection-title">
      <div className="shop-section-title">
        <div><p className="shop-eyebrow">TÌM PHONG CÁCH CỦA BẠN</p><h2 id="shop-collection-title">Tủ đồ, theo cách của bạn.</h2></div>
        <button className="shop-text-link" onClick={() => onCatalog('')}>Tất cả danh mục <ArrowUpRight size={18} /></button>
      </div>
      <div className="shop-collection-grid">
        {COLLECTIONS.map(([name, subtitle, number, Icon]) => {
          const product = products.find(item => item.category === name && item.imageUrl);
          const image = product
            ? imagesForColor(product, firstProductColor(product))[0] || product.imageUrl
            : null;
          return <button
            className={`shop-collection-tile${image ? ' has-image' : ''}`}
            key={name}
            onClick={() => onCatalog(name)}
          >
            {image && <img
              className="shop-collection-image"
              src={imageSrc(image)}
              alt=""
              loading="lazy"
              onError={event => { event.currentTarget.style.display = 'none'; }}
            />}
            <div className="shop-collection-content">
              <div className="shop-collection-top"><span>{number}</span><Icon size={30} strokeWidth={1.3} /></div>
              <div><h3>{name}</h3><p>{subtitle}</p></div>
            </div>
            <ArrowUpRight className="shop-collection-arrow" size={22} />
          </button>;
        })}
      </div>
    </section>

    {loading && !products.length && <section className="shop-home-products" aria-label="Đang tải sản phẩm">
      <div className="loading-grid">{[1, 2, 3, 4].map(item => <div className="skeleton" key={item} />)}</div>
    </section>}
    {catalogError && <section className="shop-home-products" aria-label="Danh mục sản phẩm">
      <div className="empty-state error-state" role="alert">
        <h2>Chưa kết nối được cửa hàng</h2>
        <p>{catalogError}</p>
        <button className="button button-dark" onClick={onRetry}>THỬ KẾT NỐI LẠI</button>
      </div>
    </section>}
    {!loading && !catalogError && productSections.map((section, index) => <section
      className="shop-home-products"
      key={section.category}
      aria-labelledby={`home-products-${index}`}
    >
      <div className="shop-section-title">
        <div><p className="shop-eyebrow">NOVA SELECTS / {String(index + 1).padStart(2, '0')}</p><h2 id={`home-products-${index}`}>{section.category}</h2></div>
        <div className="shop-shelf-actions">
          <button className="shop-text-link" onClick={() => onCatalog(section.category)}>Xem tất cả <ArrowUpRight size={18} /></button>
          <button type="button" aria-label={`Sản phẩm ${section.category} trước`} onClick={() => scrollShelf(index, -1)}><ArrowLeft size={17} /></button>
          <button type="button" aria-label={`Sản phẩm ${section.category} tiếp`} onClick={() => scrollShelf(index, 1)}><ArrowRight size={17} /></button>
        </div>
      </div>
      <div className="shop-product-rail" ref={element => { shelfRefs.current[index] = element; }}>
        {section.products.map(product => <div className="shop-product-rail-item" key={product.id}>
          <ProductCard
            product={product}
            onOpen={() => onProduct(product)}
            onQuickView={() => onQuickView(product)}
            isWishlisted={wishlist.some(item => item.productId === product.id)}
            onWishlist={() => onWishlist(product)}
          />
        </div>)}
      </div>
    </section>)}
  </>;
}
