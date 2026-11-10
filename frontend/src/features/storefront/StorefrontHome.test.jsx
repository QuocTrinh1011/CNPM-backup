// @vitest-environment jsdom
import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import StorefrontHome from './StorefrontHome';
afterEach(cleanup);
it('keeps local editorial artwork when the API has no product image', () => {
  render(<StorefrontHome onCatalog={vi.fn()}/>);
  expect(screen.getByRole('img').getAttribute('src')).toBe('/images/figma/daily-uniform.png');
});
it('keeps collection actions and catalog navigation functional', () => {
  const onCatalog=vi.fn();
  render(<StorefrontHome onCatalog={onCatalog}/>);
  fireEvent.click(screen.getByRole('button',{name:/Khám phá sản phẩm/}));
  expect(onCatalog).toHaveBeenLastCalledWith('');
  fireEvent.click(screen.getByRole('button',{name:/Bắt đầu với áo thun/}));
  expect(onCatalog).toHaveBeenLastCalledWith('Áo thun');
  fireEvent.click(screen.getByRole('button',{name:/01.*Áo thun/}));
  expect(onCatalog).toHaveBeenLastCalledWith('Áo thun');
});
it('opens the real featured product and uses the existing image resolver', () => {
  const product = { id: 7, name: 'Áo từ API', imageUrl: '/uploads/ao.jpg' };
  const onProduct = vi.fn();
  render(<StorefrontHome products={[product]} onCatalog={vi.fn()} onProduct={onProduct} imageSrc={src => `http://localhost:8080${src}`}/>);
  expect(screen.getByRole('img').getAttribute('src')).toBe('http://localhost:8080/uploads/ao.jpg');
  fireEvent.click(screen.getByRole('button',{name:'KHÁM PHÁ THIẾT KẾ: Áo từ API'}));
  expect(onProduct).toHaveBeenCalledWith(product);
  expect(screen.queryByText('08')).toBeNull();
});
