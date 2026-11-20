import React from 'react';
import { imageSrc, protectImage } from '../../../shared/utils/storefront-display';

export function ProductGallery({ product, color, galleryImages, activeImageIndex, setActiveImageIndex, activeImage }) {
  return (
        <div className="product-image-gallery">
          <div className="product-modal-image">
            <img
              src={imageSrc(activeImage)}
              onError={protectImage}
              alt={`${product.name} màu ${color}`}
            />
            {product.badge && <span>{product.badge}</span>}
          </div>
          <div className="product-image-thumbnails" role="group" aria-label={`Ảnh sản phẩm màu ${color}`}>
            {galleryImages.map((image, index) => (
              <button
                type="button"
                className={index === activeImageIndex ? "product-gallery-thumbnail active" : "product-gallery-thumbnail"}
                key={`${color}-${image}-${index}`}
                aria-label={`Ảnh ${index + 1} màu ${color}`}
                aria-pressed={index === activeImageIndex}
                onClick={() => setActiveImageIndex(index)}
              >
                <img src={imageSrc(image)} alt="" onError={protectImage} />
              </button>
            ))}
          </div>
        </div>
  );
}
