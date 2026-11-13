// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DesktopConfigScreen from './DesktopConfigScreen';

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

describe('DesktopConfigScreen', () => {
  it('requires an explicit first-launch confirmation and prefills the local API address', async () => {
    render(<DesktopConfigScreen><p>Portal content</p></DesktopConfigScreen>);

    expect(await screen.findByRole('heading', { name: 'Kết nối máy chủ CRM' })).toBeTruthy();
    expect(screen.getByLabelText('Địa chỉ API')).toHaveProperty('value', 'http://localhost:8080');
    expect(screen.queryByText('Portal content')).toBeNull();
    expect(desktopConfig.load).toHaveBeenCalledOnce();
  });

  it('shows the portal after the validated API origin is saved', async () => {
    render(<DesktopConfigScreen><p>Portal content</p></DesktopConfigScreen>);
    await screen.findByRole('button', { name: 'Lưu và kết nối' });
    fireEvent.change(screen.getByLabelText('Địa chỉ API'), { target: { value: 'https://api.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và kết nối' }));

    expect(await screen.findByText('Portal content')).toBeTruthy();
    expect(desktopConfig.saveApiBaseUrl).toHaveBeenCalledWith('https://api.example.com');
  });

  it('opens the portal immediately when a saved valid origin is present', async () => {
    desktopConfig.load.mockResolvedValue({ apiBaseUrl: 'https://api.example.com' });
    render(<DesktopConfigScreen><p>Portal content</p></DesktopConfigScreen>);
    expect(await screen.findByText('Portal content')).toBeTruthy();
    expect(screen.queryByLabelText('Địa chỉ API')).toBeNull();
  });

  it('shows a safe validation message when the main process rejects an insecure remote origin', async () => {
    desktopConfig.saveApiBaseUrl.mockResolvedValue({ errorCode: 'INSECURE_REMOTE_HTTP' });
    render(<DesktopConfigScreen />);
    await screen.findByRole('button', { name: 'Lưu và kết nối' });
    fireEvent.change(screen.getByLabelText('Địa chỉ API'), { target: { value: 'http://api.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và kết nối' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('HTTPS'));
  });
});
