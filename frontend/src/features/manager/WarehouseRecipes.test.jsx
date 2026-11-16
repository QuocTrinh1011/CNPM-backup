// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WarehouseRecipes from './WarehouseRecipes';
import { adminApi } from '../../api/manager-api';

vi.mock('../../api/manager-api', async importOriginal => ({ ...(await importOriginal()), adminApi: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  adminApi.mockImplementation(async url => {
    if (url.includes('/products?')) return { content: [{ id: 3, name: 'Áo thun', active: true }], totalPages: 1 };
    if (url.includes('/raw-materials')) return [{ id: 8, code: 'FABRIC', name: 'Vải', unit: 'm', active: true }, { id: 9, code: 'THREAD', name: 'Chỉ', unit: 'cuộn', active: true }];
    if (url.endsWith('/products/3/recipe')) return { productId: 3, productName: 'Áo thun', recipeId: 5, version: 2, active: true, items: [{ id: 6, materialId: 8, materialName: 'Vải', unit: 'm', quantityPerProduct: 1.4 }] };
    return {};
  });
});
afterEach(cleanup);

it('loads a product recipe and saves edits as a new version', async () => {
  render(<WarehouseRecipes />);
  fireEvent.change(await screen.findByLabelText('Sản phẩm'), { target: { value: '3' } });
  expect(await screen.findByText('Phiên bản hiện tại: 2')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Định mức dòng 1'), { target: { value: '1.75' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu phiên bản công thức' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/products/3/recipe', expect.objectContaining({
    method: 'PUT', body: { items: [{ materialId: 8, quantityPerProduct: 1.75 }] },
  })));
});
