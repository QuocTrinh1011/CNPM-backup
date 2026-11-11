// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import CustomerVouchers from './CustomerVouchers';
import { useShopResource } from '../../shared/hooks/storefront-hooks';
vi.mock('../../shared/hooks/storefront-hooks', () => ({ useShopResource: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('keeps an active general voucher visible but disables selection when personal quota is used', () => {
  useShopResource.mockReturnValue({
    data: {
      content: [
        {
          code: 'SHOP1',
          source: 'GENERAL',
          state: 'ACTIVE',
          perCustomerLimit: 1,
          customerUses: 1,
          customerRemaining: 0,
          selectable: false,
          unavailableReason: 'VOUCHER_PER_CUSTOMER_LIMIT',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          minOrderAmount: 0,
        },
      ],
      totalPages: 1,
    },
  });
  render(<CustomerVouchers onSelect={vi.fn()} />);
  expect(screen.getByText('SHOP1')).toBeTruthy();
  expect(screen.getByText('Bạn đã dùng hết lượt của mã này.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Chọn mã' }).disabled).toBe(true);
  expect(screen.getByText(/Mỗi tài khoản/)).toBeTruthy();
});
it('keeps unlimited vouchers selectable and does not invent a remaining count', () => {
  useShopResource.mockReturnValue({
    data: {
      content: [
        {
          code: 'OPEN',
          source: 'GENERAL',
          state: 'ACTIVE',
          perCustomerLimit: null,
          customerUses: 7,
          customerRemaining: null,
          selectable: true,
          minOrderAmount: 0,
        },
      ],
      totalPages: 1,
    },
  });
  render(<CustomerVouchers onSelect={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Chọn mã' }).disabled).toBe(false);
  expect(screen.queryByText(/Mỗi tài khoản/)).toBeNull();
});
