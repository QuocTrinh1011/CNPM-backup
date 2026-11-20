// @vitest-environment jsdom
import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import StorefrontHome from './StorefrontHome';
afterEach(cleanup);
it('keeps local editorial artwork when the API has no product image', () => {
  render(<StorefrontHome onCatalog={vi.fn()}/>);
  const hero = screen.getByRole('region', { name: 'Khám phá phong cách NOVA Shop' });
  expect(hero.querySelector('img').getAttribute('src')).toBe('/images/figma/daily-uniform.png');
});
it('keeps collection actions and catalog navigation functional', () => {
  const onCatalog=vi.fn();
  render(<StorefrontHome onCatalog={onCatalog}/>);
  fireEvent.click(screen.getByRole('button',{name:/Khám phá sản phẩm/}));
  expect(onCatalog).toHaveBeenLastCalledWith('');
  expect(screen.queryByRole('button',{name:/Bắt đầu với áo thun/})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:/01.*Áo thun/}));
  expect(onCatalog).toHaveBeenLastCalledWith('Áo thun');
});
it('keeps the editorial hero artwork when real products load from the API', () => {
  const product = { id: 7, name: 'Áo từ API', imageUrl: '/uploads/ao.jpg' };
  const onProduct = vi.fn();
  render(<StorefrontHome products={[product]} onCatalog={vi.fn()} onProduct={onProduct} imageSrc={src => `http://localhost:8080${src}`}/>);
  const hero = screen.getByRole('region', { name: 'Khám phá phong cách NOVA Shop' });
  expect(hero.querySelector('img').getAttribute('src')).toBe('http://localhost:8080/images/figma/daily-uniform.png');
  expect(screen.queryByRole('button',{name:/KHÁM PHÁ THIẾT KẾ/})).toBeNull();
  expect(onProduct).not.toHaveBeenCalled();
});

it('uses a matching product photo in the collection tile', () => {
  const product = {
    id: 8,
    name: 'Áo thun trắng',
    category: 'Áo thun',
    imageUrl: '/legacy.jpg',
    colors: 'Trắng,Đen',
    colorImages: { Trắng: ['/white-tee.jpg'], Đen: ['/black-tee.jpg'] },
  };
  render(
    <StorefrontHome
      products={[product]}
      onCatalog={vi.fn()}
      imageSrc={src => `https://shop.test${src}`}
    />
  );

  const tile = screen.getByRole('button', { name: /01.*Áo thun/ });
  expect(tile.querySelector('img')).not.toBeNull();
  expect(tile.querySelector('img').getAttribute('src')).toBe('https://shop.test/white-tee.jpg');
});
