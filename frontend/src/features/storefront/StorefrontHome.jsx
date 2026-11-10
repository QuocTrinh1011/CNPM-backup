import React from 'react';
import { ArrowUpRight, ArrowRight, Shirt, Layers, MoveUpRight, Sparkles, Zap } from 'lucide-react';

const EDITORIAL_IMAGE = '/images/figma/daily-uniform.png';

export default function StorefrontHome({ products = [], onCatalog, onProduct, imageSrc = value => value }) {
  const featured = products.find(product => product.imageUrl) || null;
  return <>
    <section className="shop-editorial" aria-label="Khám phá phong cách Anh Lớn Shop">
      <div className="shop-editorial-copy">
        <div className="shop-signal"><span>DROP 01</span><i>NEW SEASON / ANH LỚN</i></div>
        <p className="shop-eyebrow"><span/> ANH LỚN / THE DAILY UNIFORM</p>
        <h1>Mặc khác đi.<br/><em>Theo cách của anh.</em></h1>
        <p className="shop-editorial-description">Những phom dáng mới cho tủ đồ mỗi ngày — dễ mặc, có chủ đích và đủ khác biệt để được nhớ đến.</p>
        <div className="shop-editorial-actions"><button className="button shop-primary" onClick={() => onCatalog('')}>Khám phá sản phẩm <ArrowUpRight size={19}/></button><button className="shop-text-link" onClick={() => onCatalog('Áo thun')}>Bắt đầu với áo thun <ArrowRight size={17}/></button></div>
        <div className="shop-tech-stats">
          <div><strong>Mỗi ngày</strong><span>Dễ mặc, dễ phối</span></div>
          <div><strong>04</strong><span>Danh mục khám phá</span></div>
          <div><strong>Chất riêng</strong><span>Theo cách của anh</span></div>
        </div>
      </div>
      <div className="shop-editorial-visual">
        <img
          className="shop-editorial-image"
          src={featured ? imageSrc(featured.imageUrl) : EDITORIAL_IMAGE}
          alt={featured ? featured.name : 'Phong cách menswear tối giản của Anh Lớn Shop'}
          fetchPriority="high"
          onError={event => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = EDITORIAL_IMAGE;
          }}
        />
        <span className="shop-editorial-stamp"><small>AL / 26</small><b>NEW FORM</b></span>
        <div className="shop-editorial-caption"><span>FORM / FUNCTION<br/><strong>DAILY<br/>ATTITUDE.</strong></span><MoveUpRight size={36} strokeWidth={1}/></div>
        {featured && <button className="shop-featured-link" type="button" aria-label={`KHÁM PHÁ THIẾT KẾ: ${featured.name}`} title={`Xem ${featured.name}`} onClick={() => onProduct(featured)}><span><small>KHÁM PHÁ THIẾT KẾ</small><b>{featured.name}</b></span><ArrowUpRight size={22} aria-hidden="true"/></button>}
      </div>
    </section>
    <div className="shop-style-line" aria-hidden="true"><span><Zap size={14}/> FORM FIRST</span><i/><span><Sparkles size={14}/> MADE TO MOVE</span><i/><span>YOUR DAILY ROTATION</span></div>
    <section className="shop-collections" aria-labelledby="shop-collection-title">
      <div className="shop-section-title"><div><p className="shop-eyebrow">TÌM PHONG CÁCH CỦA BẠN</p><h2 id="shop-collection-title">Tủ đồ, theo cách của bạn.</h2></div><button className="shop-text-link" onClick={() => onCatalog('')}>Tất cả danh mục <ArrowUpRight size={18}/></button></div>
      <div className="shop-collection-grid">{[
        ['Áo thun','Dễ mặc. Dễ là chính mình.','01',Shirt],
        ['Áo khoác','Thêm một lớp cá tính.','02',Layers],
        ['Áo polo','Chỉn chu, không gò bó.','03',Shirt],
        ['Quần','Thoải mái theo từng bước.','04',Layers],
      ].map(([name, subtitle, number, Icon]) => <button className="shop-collection-tile" key={name} onClick={() => onCatalog(name)}><div className="shop-collection-top"><span>{number}</span><Icon size={30} strokeWidth={1.3}/></div><div><h3>{name}</h3><p>{subtitle}</p></div><ArrowUpRight className="shop-collection-arrow" size={22}/></button>)}</div>
    </section>
  </>;
}
