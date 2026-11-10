const progress = { PENDING_PAYMENT:0, PENDING:1, CONFIRMED:2, PREPARING:3, SHIPPED:4, DELIVERING:4, DELIVERED:5, COMPLETED:6 };
export function canAdvanceOrder(current, next) {
  if (next === 'CANCELLED' && ['SHIPPED', 'DELIVERING'].includes(current)) return false;
  if (next === 'COMPLETED') return false;
  if (current === next) return true;
  if (current === 'DELIVERED') return false;
  if (next === 'DELIVERED') return ['SHIPPED', 'DELIVERING'].includes(current);
  if (current === 'PENDING_PAYMENT') return next === 'CANCELLED';
  if (current === 'PENDING') return next === 'CONFIRMED' || next === 'CANCELLED';
  if (current === 'CANCELLED' || current === 'COMPLETED' || progress[current] === undefined) return false;
  return next === 'CANCELLED' || (progress[next] ?? -1) > progress[current];
}
export const isFinalOrder = status => ['CANCELLED', 'COMPLETED', 'DELIVERED'].includes(status);
