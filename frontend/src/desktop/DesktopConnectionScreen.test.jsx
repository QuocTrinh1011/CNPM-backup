// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DesktopConnectionScreen from './DesktopConnectionScreen';

afterEach(cleanup);

describe('DesktopConnectionScreen', () => {
  it('offers accessible retry and change-server actions', () => {
    const onRetry = vi.fn();
    const onChangeServer = vi.fn();
    render(<DesktopConnectionScreen onRetry={onRetry} onChangeServer={onChangeServer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đổi địa chỉ máy chủ' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onChangeServer).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
