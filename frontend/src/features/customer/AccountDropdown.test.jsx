// @vitest-environment jsdom
import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import AccountDropdown from './AccountDropdown';
afterEach(cleanup);
it('opens customer shortcuts on hover and closes after an action', () => {
  const action=vi.fn(); const {container}=render(<AccountDropdown user={{fullName:'Khách thử',email:'test@example.com'}} onAction={action}/>);
  fireEvent.mouseEnter(container.firstChild);
  expect(screen.getByText('Hồ sơ của tôi')).toBeTruthy();
  fireEvent.click(screen.getByText('Đơn hàng của tôi'));
  expect(action).toHaveBeenCalledWith('orders');
  expect(screen.queryByText('Đơn hàng của tôi')).toBeNull();
});
it('supports tap, Escape, outside click and guest registration', () => {
  const action=vi.fn(); render(<AccountDropdown onAction={action}/>);
  const button=screen.getByLabelText('Tài khoản');
  fireEvent.click(button); fireEvent.click(screen.getByText('Tạo tài khoản'));
  expect(action).toHaveBeenCalledWith('register');
  fireEvent.click(button); fireEvent.keyDown(button,{key:'Escape'});
  expect(button.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(button); fireEvent.pointerDown(document.body);
  expect(button.getAttribute('aria-expanded')).toBe('false');
});
it('shows all authenticated actions and unread count', () => {
  render(<AccountDropdown user={{fullName:'Khách'}} unreadCount={3} onAction={vi.fn()}/>);
  fireEvent.keyDown(screen.getByLabelText('Tài khoản'),{key:'ArrowDown'});
  for (const label of ['Địa chỉ giao hàng','Khảo sát phong cách','Bảo mật tài khoản','Đăng xuất']) expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText('3')).toBeTruthy();
});
