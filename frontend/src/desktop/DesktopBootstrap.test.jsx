// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DesktopBootstrap from './DesktopBootstrap';

let desktopConfig;
beforeEach(() => {
  desktopConfig = {
    load: vi.fn().mockResolvedValue(null),
    saveApiBaseUrl: vi.fn().mockResolvedValue({ apiBaseUrl: 'https://api.example.com' }),
  };
  Object.defineProperty(window, 'desktopConfig', { configurable: true, value: desktopConfig });
});
afterEach(() => {
  cleanup();
  delete window.desktopConfig;
});

describe('DesktopBootstrap', () => {
  it('waits for validated configuration before mounting portal code', async () => {
    let resolveConfig;
    desktopConfig.load.mockReturnValue(new Promise(resolve => { resolveConfig = resolve; }));
    const onPortalMounted = vi.fn();
    function Portal() { onPortalMounted(); return <p>Portal loaded</p>; }
    render(<DesktopBootstrap><Portal /></DesktopBootstrap>);

    expect(screen.getByRole('status').textContent).toContain('Đang kiểm tra');
    expect(onPortalMounted).not.toHaveBeenCalled();
    await act(async () => resolveConfig({ apiBaseUrl: 'https://api.example.com' }));
    expect(await screen.findByText('Portal loaded')).toBeTruthy();
    expect(onPortalMounted).toHaveBeenCalled();
  });

  it.each([null, { apiBaseUrl: '' }])('shows configuration first for missing or invalid config: %s', async config => {
    desktopConfig.load.mockResolvedValue(config);
    const onPortalMounted = vi.fn();
    function Portal() { onPortalMounted(); return <p>Portal loaded</p>; }
    render(<DesktopBootstrap><Portal /></DesktopBootstrap>);

    expect(await screen.findByRole('heading', { name: 'Kết nối máy chủ CRM' })).toBeTruthy();
    expect(onPortalMounted).not.toHaveBeenCalled();
  });

  it('mounts the portal after the configuration screen saves a valid address', async () => {
    desktopConfig.load.mockResolvedValue(null);
    render(<DesktopBootstrap><p>Portal loaded</p></DesktopBootstrap>);
    await screen.findByRole('button', { name: 'Lưu và kết nối' });
    fireEvent.change(screen.getByLabelText('Địa chỉ API'), { target: { value: 'https://api.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và kết nối' }));
    expect(await screen.findByText('Portal loaded')).toBeTruthy();
  });

  it('shows the connection screen on a backend error and opens configuration on demand', async () => {
    desktopConfig.load.mockResolvedValue({ apiBaseUrl: 'https://api.example.com' });
    const reloadPage = vi.fn();
    render(<DesktopBootstrap reloadPage={reloadPage}><p>Portal loaded</p></DesktopBootstrap>);
    await screen.findByText('Portal loaded');
    act(() => window.dispatchEvent(new Event('shop-backend-unreachable')));

    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(reloadPage).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Đổi địa chỉ máy chủ' }));
    expect(await screen.findByLabelText('Địa chỉ API')).toHaveProperty('value', 'https://api.example.com');
  });
});
