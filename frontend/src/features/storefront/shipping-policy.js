const FREE_SHIPPING_THRESHOLD = 399000;
const SHIPPING_FEE = 30000;

export function getShippingFee(merchandiseTotalAfterVoucher) {
  return Math.max(0, Number(merchandiseTotalAfterVoucher) || 0) < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
}
