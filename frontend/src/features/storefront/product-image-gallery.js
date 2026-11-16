import { csv } from "../../shared/utils/storefront-display";

export function firstProductColor(product) {
  return csv(product?.colors)[0] || "Đen";
}

export function imagesForColor(product, color) {
  const images = product?.colorImages?.[color];
  const mappedImages = Array.isArray(images)
    ? images.filter((image) => typeof image === "string" && image.trim())
    : [];

  if (mappedImages.length) return mappedImages;
  return product?.imageUrl ? [product.imageUrl] : [];
}
