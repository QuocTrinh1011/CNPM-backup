const FREE_SHIPPING_THRESHOLD = 399000;
const SHIPPING_FEE = 30000;

export function getShippingFee(merchandiseTotalAfterVoucher) {
  const amount = Math.max(0, Number(merchandiseTotalAfterVoucher) || 0);
  const amountInCents = Math.round((amount + Number.EPSILON) * 100);
  return amountInCents < FREE_SHIPPING_THRESHOLD * 100 ? SHIPPING_FEE : 0;
}
