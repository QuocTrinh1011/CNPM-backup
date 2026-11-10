import { useCallback, useEffect, useState } from 'react';

export const customerLinks = [
  ['/tai-khoan', 'Hồ sơ của tôi'], ['/tai-khoan/dia-chi', 'Địa chỉ'],
  ['/tai-khoan/doi-mat-khau', 'Đổi mật khẩu'], ['/don-hang', 'Đơn hàng của tôi'],
  ['/yeu-thich', 'Yêu thích'], ['/thong-bao', 'Thông báo'], ['/khao-sat', 'Khảo sát'],
  ['/tai-khoan/voucher', 'Voucher của tôi'],
  ['/ho-tro', 'Yêu cầu hỗ trợ'],
];
export const actionPaths = { profile: '/tai-khoan', addresses: '/tai-khoan/dia-chi', password: '/tai-khoan/doi-mat-khau', orders: '/don-hang', wishlist: '/yeu-thich', notifications: '/thong-bao', surveys: '/khao-sat', checkout: '/dat-hang' };
export const isAccountPath = path => customerLinks.some(([href]) => path === href || ['/don-hang','/khao-sat','/ho-tro'].includes(href) && path.startsWith(`${href}/`));
export const needsCustomer = path => isAccountPath(path) && path !== '/khao-sat' || path === '/dat-hang';
export const isKnownPath = path => ['/', '/san-pham', '/gio-hang', '/dat-hang', '/thanh-toan', '/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau', ...customerLinks.map(([href]) => href)].includes(path) || /^\/(san-pham|don-hang|khao-sat|ho-tro)\/\d+$/.test(path);
export function safeReturn(value, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || !isKnownPath(url.pathname) || ['/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau'].includes(url.pathname)) return fallback;
  return url.pathname + url.search;
}
export function useCustomerRouter() {
  const [location, setLocation] = useState(() => ({ pathname: window.location.pathname, search: window.location.search }));
  useEffect(() => {
    const sync = () => setLocation({ pathname: window.location.pathname, search: window.location.search });
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const navigate = useCallback((href, { replace = false } = {}) => {
    if (href !== window.location.pathname + window.location.search) window.history[replace ? 'replaceState' : 'pushState'](replace ? window.history.state : { customerFrom: window.location.pathname + window.location.search }, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  return { ...location, navigate };
}
