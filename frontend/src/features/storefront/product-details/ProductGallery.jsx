import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { imageSrc, protectImage } from '../../../shared/utils/storefront-display';

export function ProductGallery({ quickView, product, color, galleryImages, activeImageIndex, setActiveImageIndex, activeImage }) {
  return (
        <div className="product-image-gallery">
          <div className="product-modal-image">
            <img
              src={imageSrc(activeImage)}
              onError={protectImage}
              alt={`${product.name} màu ${color}`}
            />
            {product.badge && <span>{product.badge}</span>}
            {quickView && galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  className="quick-view-image-nav quick-view-image-nav--previous"
                  aria-label="Ảnh sản phẩm trước"
                  onClick={() => setActiveImageIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length)}
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  className="quick-view-image-nav quick-view-image-nav--next"
                  aria-label="Ảnh sản phẩm tiếp theo"
                  onClick={() => setActiveImageIndex((current) => (current + 1) % galleryImages.length)}
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
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
