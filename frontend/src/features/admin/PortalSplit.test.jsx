// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {it,expect,vi,afterEach,beforeEach} from 'vitest';
import SystemAdminApp from './SystemAdminApp';
import {adminApi,adminRefreshSession} from '../../api/api';
vi.mock('../../api/api',()=>({adminApi:vi.fn(),adminRefreshSession:vi.fn(),adminSignIn:vi.fn(),adminSignOut:vi.fn()}));
beforeEach(()=>{window.localStorage.removeItem('admin-sidebar-collapsed');window.localStorage.removeItem('admin-theme')});
afterEach(()=>{cleanup();vi.resetAllMocks();vi.unstubAllEnvs()});
it.each([
 ['', '', 'http://localhost:5175/manager', 'http://localhost:5173/'],
 ['https://manager.example.test/', 'https://shop.example.test/', 'https://manager.example.test/manager', 'https://shop.example.test/'],
])('quick links use the correct portal origins (%s)', async (managerOrigin, userOrigin, managerUrl, storefrontUrl) => {
 vi.stubEnv('VITE_MANAGER_ORIGIN', managerOrigin);
 vi.stubEnv('VITE_USER_ORIGIN', userOrigin);
 window.history.replaceState({}, '', '/admin');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockResolvedValue({accounts:2,products:3});
 render(<SystemAdminApp/>);
 expect((await screen.findByRole('link',{name:'Cổng quản lý (Manager)'})).getAttribute('href')).toBe(managerUrl);
 expect(screen.getByRole('link',{name:/Chuyển sang Manager Portal/}).getAttribute('href')).toBe(managerUrl);
 expect(screen.getByRole('link',{name:'Xem trang bán hàng'}).getAttribute('href')).toBe(storefrontUrl);
});
it.each([
 ['Cấp tài khoản Admin & Manager', '/admin/accounts'],
 ['Xem danh mục, giá bán và tồn kho', '/admin/products'],
])('dashboard shortcut opens its own function: %s', async (name, path) => {
 window.history.replaceState({}, '', '/admin');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>url.includes('overview')?{}:{content:[],totalPages:0});
 render(<SystemAdminApp/>);
 const link=await screen.findByRole('link',{name:new RegExp(name)});
 expect(link.getAttribute('href')).toBe(path);
 fireEvent.click(link);
 await waitFor(()=>expect(window.location.pathname).toBe(path));
 await screen.findByText('Chưa có dữ liệu phù hợp.');
 expect(adminApi.mock.calls.some(([url])=>url.startsWith('/api'+path))).toBe(true);
});
it('removes supplier navigation and redirects the old supplier URL', async () => {
 window.history.replaceState({}, '', '/admin/suppliers');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockResolvedValue({accounts:2,products:3,suppliers:1});
 render(<SystemAdminApp/>);
 await waitFor(()=>expect(window.location.pathname).toBe('/admin'));
 expect(screen.queryByText(/nhà cung cấp/i)).toBeNull();
 expect(adminApi.mock.calls.some(([url])=>url.includes('/suppliers'))).toBe(false);
});
it('product lookup no longer displays supplier filters or IDs', async () => {
 window.history.replaceState({}, '', '/admin/products');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>url.includes('overview')?{}:{content:[{id:1,name:'Test product',price:100,stock:2,supplierId:3}],totalPages:1});
 render(<SystemAdminApp/>);
 await screen.findByText('Test product');
 expect(screen.queryByText(/nhà cung cấp/i)).toBeNull();
 expect(screen.queryByText(/NCC:/)).toBeNull();
});
it('admin has only system navigation and accounts use admin APIs',async()=>{
 window.history.replaceState({},'', '/admin/accounts');adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>url.includes('overview')?{accounts:2,products:3,suppliers:1}:{content:[],totalPages:0});
 render(<SystemAdminApp/>);await screen.findByText('Chưa có dữ liệu phù hợp.');
 expect(screen.queryByRole('link',{name:'Khách hàng'})).toBeNull();expect(screen.queryByRole('link',{name:'Đơn hàng'})).toBeNull();
 expect(adminApi.mock.calls.every(([url])=>url.startsWith('/api/admin/'))).toBe(true);
 fireEvent.click(screen.getByText('Thêm mới'));expect(screen.getByLabelText('Vai trò').value).toBe('MANAGER');
});
it('collapses the admin sidebar from the brand and restores the saved state', async () => {
 window.history.replaceState({}, '', '/admin');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockResolvedValue({accounts:2,products:3});
 const view=render(<SystemAdminApp/>);
 const toggle=await screen.findByRole('button',{name:'Thu gọn thanh điều hướng'});
 expect(toggle.closest('.internal-brand')).toBeTruthy();
 expect(toggle.getAttribute('aria-controls')).toBe('admin-sidebar');
 expect(toggle.getAttribute('aria-expanded')).toBe('true');
 fireEvent.click(toggle);
 expect(view.container.querySelector('#admin-sidebar').className).toContain('is-collapsed');
 expect(window.localStorage.getItem('admin-sidebar-collapsed')).toBe('true');
 expect(screen.getByRole('button',{name:'Mở rộng thanh điều hướng'}).getAttribute('aria-expanded')).toBe('false');
 expect(screen.getByRole('link',{name:'Tài khoản nội bộ'})).toBeTruthy();
 expect(screen.getByRole('link',{name:'Cổng quản lý (Manager)'})).toBeTruthy();
 expect(screen.getByRole('link',{name:'Xem trang bán hàng'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Đăng xuất'})).toBeTruthy();
 view.unmount();
 const remount=render(<SystemAdminApp/>);
 await screen.findByRole('button',{name:'Mở rộng thanh điều hướng'});
 expect(remount.container.querySelector('#admin-sidebar').className).toContain('is-collapsed');
});
it('admin redirects anonymous requests to its login',async()=>{
 window.history.replaceState({},'', '/admin/products');adminRefreshSession.mockResolvedValue(null);render(<SystemAdminApp/>);
 await screen.findByText('Đăng nhập Admin');await waitFor(()=>expect(window.location.pathname).toBe('/admin/login'));
});

it.each(['getItem', 'setItem'])('keeps the sidebar usable when %s fails', async (method) => {
 window.history.replaceState({}, '', '/admin');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockResolvedValue({accounts:2,products:3});
 const original = Storage.prototype[method];
 const storage = vi.spyOn(Storage.prototype, method).mockImplementation(function (key, ...args) {
   if (key === 'admin-sidebar-collapsed') throw new DOMException('Storage unavailable', 'SecurityError');
   return original.call(this, key, ...args);
 });
 try {
   const view = render(<SystemAdminApp/>);
   const toggle = await screen.findByRole('button', {name:'Thu gọn thanh điều hướng'});
   expect(toggle.getAttribute('aria-expanded')).toBe('true');
   fireEvent.click(toggle);
   expect(screen.getByRole('button', {name:'Mở rộng thanh điều hướng'}).getAttribute('aria-expanded')).toBe('false');
   expect(view.container.querySelector('#admin-sidebar').className).toContain('is-collapsed');
   fireEvent.click(screen.getByRole('button', {name:'Mở rộng thanh điều hướng'}));
   expect(screen.getByRole('button', {name:'Thu gọn thanh điều hướng'}).getAttribute('aria-expanded')).toBe('true');
   expect(storage.mock.calls.some(([key]) => key === 'admin-sidebar-collapsed')).toBe(true);
 } finally {
   storage.mockRestore();
 }
});
