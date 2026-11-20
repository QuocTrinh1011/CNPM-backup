import React from 'react';
import { ChevronRight } from 'lucide-react';
import { csv, imageSrc, protectImage } from '../../../shared/utils/storefront-display';
import { imagesForColor } from '../product-image-gallery';
import { colorFallback } from './productDetailsUtils';

export function ProductOptions({ product, color, setColor, size, setSize, setActiveImageIndex, setShowSizeGuide }) {
  return (
    <>
          <div className="choice">
            <label>
              MÀU SẮC <b>{color}</b>
            </label>
            <div className="choice-row product-color-swatches">
              {csv(product.colors).map((item) => (
                <button
                  type="button"
                  className={
                    color === item ? "product-color-swatch active" : "product-color-swatch"
                  }
                  key={item}
                  aria-pressed={color === item}
                  aria-label={item}
                  title={item}
                  onClick={() => { setColor(item); setActiveImageIndex(0); }}
                >
                  {imagesForColor(product, item)[0] ? (
                    <img src={imageSrc(imagesForColor(product, item)[0])} alt="" onError={protectImage} />
                  ) : (
                    <span aria-hidden="true" style={{ backgroundColor: colorFallback(item) }} />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="choice">
            <div className="product-option-heading">
              <label>
                KÍCH THƯỚC <b>{size}</b>
              </label>
              <button
                type="button"
                className="size-guide-link"
                onClick={() => setShowSizeGuide(true)}
              >
                Hướng dẫn chọn size <ChevronRight size={14} />
              </button>
            </div>
            <div className="choice-row product-size-choices">
              {csv(product.sizes).map((item) => (
                <button
                  className={
                    size === item ? "choice-chip product-size-chip active" : "choice-chip product-size-chip"
                  }
                  key={item}
                  aria-pressed={size === item}
                  onClick={() => setSize(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
    </>
  );
}
