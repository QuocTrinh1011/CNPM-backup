import React, { useRef, useState } from "react";
import { X } from "lucide-react";
import { csv, discount } from "../../../shared/utils/storefront-display";
import { firstProductColor, imagesForColor } from "../product-image-gallery";
import { ProductGallery } from "./ProductGallery";
import { ProductSummary } from "./ProductSummary";
import { ProductOptions } from "./ProductOptions";
import { ProductPurchaseActions } from "./ProductPurchaseActions";
import { ProductSizeGuide } from "./ProductSizeGuide";
import { ProductBenefits } from "./ProductBenefits";
import { ProductFeedback } from "./ProductFeedback";

export function ProductModal({ page = false, data, user, onClose, onAdd, onBuyNow, onLogin }) {
  const product = data.product;
  const [size, setSize] = useState(
    csv(product.sizes)[1] || csv(product.sizes)[0] || "M",
  );
  const [color, setColor] = useState(firstProductColor(product));
  const [activeImageIndex, setActiveImageIndex] = useState(0);
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
  const galleryImages = imagesForColor(product, color);
  const activeImage = galleryImages[activeImageIndex] || galleryImages[0] || product.imageUrl;
  const openVoucherWallet = () => {
    if (!user) return onLogin();
    window.history.pushState({}, "", "/tai-khoan/voucher");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

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
        <ProductGallery
          product={product}
          color={color}
          galleryImages={galleryImages}
          activeImageIndex={activeImageIndex}
          setActiveImageIndex={setActiveImageIndex}
          activeImage={activeImage}
        />
        <div className="product-modal-content">
          <ProductSummary
            page={page}
            product={product}
            user={user}
            sale={sale}
            openVoucherWallet={openVoucherWallet}
            onClose={onClose}
          />
          <ProductOptions
            product={product}
            color={color}
            setColor={setColor}
            size={size}
            setSize={setSize}
            setActiveImageIndex={setActiveImageIndex}
            setShowSizeGuide={setShowSizeGuide}
          />
          <ProductPurchaseActions
            page={page}
            product={product}
            quantity={quantity}
            setQuantity={setQuantity}
            purchasing={purchasing}
            purchase={purchase}
          />
          <ProductSizeGuide showSizeGuide={showSizeGuide} setShowSizeGuide={setShowSizeGuide} />
          <ProductBenefits page={page} product={product} />
          <ProductFeedback
            data={data}
            user={user}
            submitFeedback={submitFeedback}
            showAllFeedback={showAllFeedback}
            setShowAllFeedback={setShowAllFeedback}
          />
        </div>
      </div>
    </div>
  );
}
