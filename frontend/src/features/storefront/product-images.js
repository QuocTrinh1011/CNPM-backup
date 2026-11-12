const CATALOG = "/images/catalog";

const PRODUCT_IMAGES = {
  "ao khoac bomber essential": {
    den: `${CATALOG}/bomber-black.jpg`,
    olive: `${CATALOG}/bomber-olive.jpg`,
  },
  "ao khoac utility field": {
    be: `${CATALOG}/field-khaki.jpg`,
    xam: `${CATALOG}/field-gray.jpg`,
  },
  "ao thun heavyweight signature": {
    trang: `${CATALOG}/tee-white.png`,
    den: `${CATALOG}/tee-black.png`,
  },
  "ao thun graphic duong pho": {
    xam: `${CATALOG}/tee-gray.jpg`,
    den: `${CATALOG}/tee-black-graphic.jpg`,
  },
  "polo knit toi gian": {
    nau: `${CATALOG}/polo-brown-knit.jpg`,
    den: `${CATALOG}/polo-black.jpg`,
  },
  "polo pique everyday": {
    trang: `${CATALOG}/polo-white.webp`,
    navy: `${CATALOG}/polo-navy.jpg`,
  },
  "quan relaxed denim nhat": {
    indigo: `${CATALOG}/jeans-indigo.jpg`,
    den: `${CATALOG}/jeans-black.jpg`,
  },
  "quan tay suong daily": {
    den: `${CATALOG}/trousers-black.jpg`,
    xam: `${CATALOG}/trousers-gray.jpg`,
  },
  "ao khoac da dang dai urban": {
    nau: `${CATALOG}/coat-brown.jpg`,
    den: `${CATALOG}/coat-black.jpg`,
  },
  "ao khoac denim trucker": {
    "xanh denim": `${CATALOG}/denim-jacket-blue.png`,
    den: `${CATALOG}/denim-jacket-black.png`,
  },
  "ao thun relaxed premium": {
    kem: `${CATALOG}/tee-relaxed-cream.jpg`,
    navy: `${CATALOG}/tee-navy.jpg`,
  },
  "ao thun essential airy": {
    trang: `${CATALOG}/tee-airy-white.jpg`,
    xam: `${CATALOG}/tee-airy-gray.jpg`,
  },
  "polo det kim merino soft": {
    xam: `${CATALOG}/polo-gray.png`,
    nau: `${CATALOG}/polo-merino-brown.jpg`,
  },
  "polo soc nho weekend": {
    navy: `${CATALOG}/polo-striped.jpg`,
    trang: `${CATALOG}/polo-weekend-white.jpg`,
  },
  "quan cargo tapered flex": {
    olive: `${CATALOG}/cargo-olive.jpg`,
    den: `${CATALOG}/cargo-black.jpg`,
  },
  "quan short tech daily": {
    den: `${CATALOG}/shorts-black.webp`,
    xam: `${CATALOG}/shorts-gray.webp`,
  },
};

const normalize = (value) => String(value || "")
  .trim()
  .toLocaleLowerCase("vi")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .replace(/\s+/g, " ");

export function getProductImage(product, color) {
  if (!product) return "";
  const productName = typeof product === "string" ? product : product.name;
  const variants = PRODUCT_IMAGES[normalize(productName)];
  if (!variants) return "";
  return variants[normalize(color)] || Object.values(variants)[0] || "";
}

export function shouldContainProductImage(product, color) {
  const image = getProductImage(product, color);
  return image.startsWith(`${CATALOG}/`);
}

