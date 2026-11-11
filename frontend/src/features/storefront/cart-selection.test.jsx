// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import {
  cartLineKey,
  reconcileSelection,
  useCartSelection,
  subtractPurchased,
  summarizeCart,
  transferGuestSelection,
  saveSelection,
  readSelection,
} from './cart-selection';
import { CartDrawer } from '../../app/App';
const items = [
  {
    productId: 1,
    name: 'Áo',
    color: 'Đen',
    size: 'M',
    stock: 8,
    quantity: 2,
    unitPrice: 100,
    lineTotal: 200,
  },
  {
    productId: 1,
    name: 'Áo',
    color: 'Đen',
    size: 'L',
    stock: 8,
    quantity: 1,
    unitPrice: 100,
    lineTotal: 100,
  },
  { productId: 2, name: 'Quần', stock: 0, quantity: 1, unitPrice: 300, lineTotal: 300 },
];
beforeEach(() => sessionStorage.clear());
afterEach(cleanup);
it.each([0, 698999, 699000, 699001, 1400000])(
  'does not advertise free shipping at subtotal %i in either cart layout',
  total => {
    for (const page of [true, false]) {
      const cart = summarizeCart(
        total ? [{ ...items[0], quantity: 1, unitPrice: total, lineTotal: total }] : [],
      );
      const checkout = vi.fn();
      const view = render(<CartDrawer page={page} cart={cart} onCheckout={checkout} />);
      expect(view.container.textContent).not.toMatch(
        /FREESHIP|MIỄN PHÍ VẬN CHUYỂN|Mua thêm|Phí vận chuyển sẽ/i,
      );
      expect(
        view.container.querySelector('[class*="freeship"], [class*="free-shipping"]'),
      ).toBeNull();
      if (total) {
        expect(view.container.textContent.replace(/\s/g, '')).toContain(
          new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
            .format(total)
            .replace(/\s/g, ''),
        );
        fireEvent.click(screen.getByRole('button', { name: /TIẾN HÀNH ĐẶT HÀNG/ }));
        expect(checkout).toHaveBeenCalledOnce();
      }
      view.unmount();
    }
  },
);
function Fixture({ owner = 'guest', initialize = true }) {
  const cart = summarizeCart(items),
    selection = useCartSelection({ owner, cart, ready: true, initialize });
  return <CartDrawer page cart={cart} selection={selection} />;
}
it('keeps checkout based on selected products, without shipping threshold side effects', () => {
  const cart = summarizeCart([
    { ...items[0], quantity: 1, unitPrice: 400000, lineTotal: 400000 },
    { ...items[1], quantity: 1, unitPrice: 400000, lineTotal: 400000 },
  ]);
  function SelectedCart() {
    const selection = useCartSelection({
      owner: 'shipping-test',
      cart,
      ready: true,
      initialize: true,
    });
    return <CartDrawer page cart={cart} selection={selection} />;
  }
  const view = render(<SelectedCart />);
  const subtotal = () => view.container.querySelector('.subtotal strong').textContent;
  expect(subtotal()).toContain('800.000');
  fireEvent.click(screen.getByLabelText('Chọn Áo Đen M'));
  expect(subtotal()).toContain('400.000');
  expect(view.container.textContent).not.toMatch(/freeship|miễn phí vận chuyển|mua thêm/i);
  fireEvent.click(screen.getByLabelText('Chọn Áo Đen L'));
  expect(screen.getByRole('button', { name: /TIẾN HÀNH ĐẶT HÀNG/ }).disabled).toBe(true);
});
it('selects eligible variants, supports partial and no selection, and persists across remounts', () => {
  const view = render(<Fixture />);
  const all = screen.getByLabelText('Chọn tất cả (2)');
  expect(all.checked).toBe(true);
  fireEvent.click(screen.getByLabelText('Chọn Áo Đen M'));
  expect(all.indeterminate).toBe(true);
  expect(screen.getByText('Đã chọn 1 sản phẩm (1 phân loại).')).toBeTruthy();
  view.unmount();
  render(<Fixture />);
  expect(screen.getByLabelText('Chọn Áo Đen M').checked).toBe(false);
  fireEvent.click(screen.getByLabelText('Chọn tất cả (2)'));
  fireEvent.click(screen.getByLabelText('Chọn tất cả (2)'));
  expect(screen.getByRole('button', { name: /TIẾN HÀNH ĐẶT HÀNG/ }).disabled).toBe(true);
});
it('does not initialize a selection when opening checkout directly', () => {
  render(<Fixture initialize={false} />);
  expect(screen.getByRole('button', { name: /TIẾN HÀNH ĐẶT HÀNG/ }).disabled).toBe(true);
});
it('keeps variant choices separate and only removes purchased quantities', () => {
  const remaining = subtractPurchased(summarizeCart(items), [{ ...items[0], quantity: 1 }]);
  expect(remaining.items.map(item => item.quantity)).toEqual([1, 1, 1]);
  expect(remaining.subtotal).toBe(500);
  const value = { known: items.map(cartLineKey), selected: [cartLineKey(items[0])] };
  expect(reconcileSelection(value, [{ ...items[0], stock: 1 }, items[1]]).selected).toEqual([]);
});
it('transfers guest choices without mixing another customer account', () => {
  saveSelection('guest', { known: items.map(cartLineKey), selected: [cartLineKey(items[1])] });
  transferGuestSelection(2);
  expect(readSelection('customer-2').selected).toEqual([cartLineKey(items[1])]);
  expect(readSelection('customer-3')).toBeNull();
});
