import { it, expect } from 'vitest';
import { canAdvanceOrder, isFinalOrder } from './order-transitions';
it('does not cancel an order already with the carrier', () => {
  for (const status of ['SHIPPED', 'DELIVERING']) {
    expect(canAdvanceOrder(status, 'CANCELLED')).toBe(false);
    expect(canAdvanceOrder(status, 'DELIVERED')).toBe(true);
  }
});
it('never reopens cancelled or completed orders', () => {
  for (const current of ['CANCELLED','COMPLETED']) {
    expect(isFinalOrder(current)).toBe(true);
    for (const next of ['PENDING_PAYMENT','CONFIRMED','SHIPPED','DELIVERED','COMPLETED','CANCELLED']) {
      expect(canAdvanceOrder(current,next)).toBe(current===next && next !== 'COMPLETED');
    }
  }
});
it('reserves completion for the customer and requires shipping before delivery', () => {
  expect(canAdvanceOrder('CONFIRMED','DELIVERED')).toBe(false);
  expect(canAdvanceOrder('SHIPPED','DELIVERED')).toBe(true);
  expect(canAdvanceOrder('DELIVERING','DELIVERED')).toBe(true);
  expect(canAdvanceOrder('DELIVERED','COMPLETED')).toBe(false);
  expect(canAdvanceOrder('DELIVERED','CANCELLED')).toBe(false);
  expect(isFinalOrder('DELIVERED')).toBe(true);
});
it('allows forward progress and cancellation but rejects backwards progress', () => {
  expect(canAdvanceOrder('PENDING','SHIPPED')).toBe(false);
  expect(canAdvanceOrder('PENDING_PAYMENT','CONFIRMED')).toBe(false);
  expect(canAdvanceOrder('PENDING_PAYMENT','PENDING')).toBe(false);
  expect(canAdvanceOrder('PENDING','CONFIRMED')).toBe(true);
  expect(canAdvanceOrder('CONFIRMED','SHIPPED')).toBe(true);
  expect(canAdvanceOrder('PENDING','CANCELLED')).toBe(true);
  expect(canAdvanceOrder('DELIVERED','SHIPPED')).toBe(false);
  expect(canAdvanceOrder('SHIPPED','CONFIRMED')).toBe(false);
  expect(canAdvanceOrder('UNKNOWN','CONFIRMED')).toBe(false);
});
