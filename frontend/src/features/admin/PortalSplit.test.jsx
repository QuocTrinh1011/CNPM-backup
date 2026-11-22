// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {it,expect,vi,afterEach,beforeEach} from 'vitest';
import SystemAdminApp from './SystemAdminApp';
import {adminApi,adminRefreshSession} from '../../api/api';
vi.mock('../../api/api',()=>({adminApi:vi.fn(),adminRefreshSession:vi.fn(),adminSignIn:vi.fn(),adminSignOut:vi.fn()}));
const mockAdminDashboard = (fallback = {}) => adminApi.mockImplementation(async url =>
 url.includes('/api/admin/reports/quarterly?') ? { products: [], employeeActivities: [] } : fallback);
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
 mockAdminDashboard({accounts:2,products:3});
 render(<SystemAdminApp/>);
 expect((await screen.findByRole('link',{name:'Cổng quản lý (Manager)'})).getAttribute('href')).toBe(managerUrl);
 expect(screen.getByRole('link',{name:/Cổng quản lý Manager/}).getAttribute('href')).toBe(managerUrl);
 expect(screen.getByRole('link',{name:'Xem trang bán hàng'}).getAttribute('href')).toBe(storefrontUrl);
});
it.each([
 ['Tài khoản nội bộ', '/admin/accounts'],
 ['Loại sản phẩm', '/admin/products'],
])('dashboard shortcut opens its own function: %s', async (name, path) => {
 window.history.replaceState({}, '', '/admin');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>url.includes('overview')?{}:{content:[],totalPages:0});
 render(<SystemAdminApp/>);
 const shortcut=await screen.findByRole('button',{name:new RegExp(name)});
 fireEvent.click(shortcut);
 await waitFor(()=>expect(window.location.pathname).toBe(path));
 await screen.findByText('Chưa có dữ liệu phù hợp.');
 expect(adminApi.mock.calls.some(([url])=>url.startsWith('/api'+path))).toBe(true);
});
it('provides a read-only supplier directory in Admin', async () => {
 window.history.replaceState({}, '', '/admin/suppliers');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockResolvedValue({content:[{id:2,code:'NCC-02',name:'Vải Việt',email:'vai@example.test',phone:'0900000000',address:'Hà Nội',active:true}],totalPages:1,totalElements:1});
 render(<SystemAdminApp/>);
 expect(await screen.findByText('Vải Việt')).toBeTruthy();
 expect(window.location.pathname).toBe('/admin/suppliers');
 expect(screen.getByRole('link',{name:'Nhà cung cấp'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Thêm mới'})).toBeNull();
 expect(adminApi.mock.calls.some(([url])=>url.startsWith('/api/admin/suppliers'))).toBe(true);
});
it('lets Admin filter products by their supplier without exposing edit actions', async () => {
 window.history.replaceState({}, '', '/admin/products');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>{
  const request=new URL(url,'http://localhost');
  if(request.pathname.endsWith('/suppliers'))return request.searchParams.get('page')==='0'
   ? {content:[],totalPages:2,totalElements:101}
   : {content:[{id:101,code:'NCC-101',name:'Nhà cung cấp trang sau',active:true}],totalPages:2,totalElements:101};
  return {content:[{id:1,name:'Test product',category:'Áo thun',price:100,stock:2,supplierId:101,active:true}],totalPages:2,totalElements:16};
 });
 render(<SystemAdminApp/>);
 expect(await screen.findByText('Test product')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/Tìm kiếm nâng cao/}));
 const supplierFilter=screen.getByLabelText('Nhà cung cấp');
 expect(await screen.findByRole('option',{name:'NCC-101 · Nhà cung cấp trang sau'})).toBeTruthy();
 const productRow=screen.getByText('Test product').closest('tr');
 expect(within(productRow).getByText(/NCC-101 · Nhà cung cấp trang sau/)).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Thêm mới'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Trang sau'}));
 await waitFor(()=>expect(screen.getByText('2/2')).toBeTruthy());
 fireEvent.change(supplierFilter,{target:{value:'101'}});
 await waitFor(()=>expect(adminApi.mock.calls.some(([url])=>{
  const request=new URL(url,'http://localhost');
  return request.pathname==='/api/admin/products'&&request.searchParams.get('supplierId')==='101'&&request.searchParams.get('page')==='0';
 })).toBe(true));
});
it('shows reset when only product sorting changes and restores its default', async () => {
 window.history.replaceState({}, '', '/admin/products');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>url.includes('/suppliers')?{content:[],totalPages:1}:{content:[],totalPages:1});
 render(<SystemAdminApp/>);
 await screen.findByText('Chưa có dữ liệu phù hợp.');
 fireEvent.change(screen.getByLabelText('Sắp xếp theo'),{target:{value:'price'}});
 const clear=await screen.findByRole('button',{name:/Xóa bộ lọc/});
 fireEvent.click(clear);
 await waitFor(()=>expect(screen.getByLabelText('Sắp xếp theo').value).toBe('createdAt'));
});
it('admin has only system navigation and accounts use admin APIs',async()=>{
 window.history.replaceState({},'', '/admin/accounts');adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>url.includes('overview')?{accounts:2,products:3,suppliers:1}:{content:[],totalPages:0});
 render(<SystemAdminApp/>);await screen.findByText('Chưa có dữ liệu phù hợp.');
 expect(screen.queryByRole('link',{name:'Khách hàng'})).toBeNull();expect(screen.queryByRole('link',{name:'Đơn hàng'})).toBeNull();
 expect(adminApi.mock.calls.every(([url])=>url.startsWith('/api/admin/'))).toBe(true);
 fireEvent.click(screen.getByText('Thêm mới'));expect(screen.getByLabelText('Vai trò').value).toBe('MANAGER_SALES');
});
it('splits admin accounts into manager, employee, and customer tabs',async()=>{
 window.history.replaceState({},'', '/admin/accounts');adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>{
  if(url.includes('/overview'))return {};
  const group=new URL(url,'http://localhost').searchParams.get('group');
  const rows={
   managers:[{id:1,fullName:'System admin',email:'admin@example.test',role:'ADMIN',locked:false},{id:2,fullName:'Sales manager',email:'sales@example.test',role:'MANAGER_SALES',locked:false}],
   employees:[{id:3,fullName:'Shop employee',email:'employee@example.test',role:'EMPLOYEE',locked:false}],
   customers:[{id:4,fullName:'Store customer',email:'customer@example.test',role:'CUSTOMER',locked:false}],
  }[group]||[];
  return {content:rows,totalPages:1,totalElements:rows.length};
 });
 render(<SystemAdminApp/>);
 expect(await screen.findByText('System admin')).toBeTruthy();
 expect(screen.getByText('Sales manager')).toBeTruthy();
 const adminRow=screen.getByText('System admin').closest('tr');
 const managerRow=screen.getByText('Sales manager').closest('tr');
 expect(within(adminRow).queryByRole('button',{name:'Sửa'})).toBeNull();
 expect(within(adminRow).queryByRole('button',{name:'Xóa mềm'})).toBeNull();
 expect(within(managerRow).getByRole('button',{name:'Sửa'})).toBeTruthy();
 expect(within(managerRow).getByRole('button',{name:'Xóa mềm'})).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'Tài khoản nhân viên'}));
 expect(await screen.findByText('Shop employee')).toBeTruthy();
 expect(screen.queryByText('Sales manager')).toBeNull();
 expect(adminApi.mock.calls.some(([url])=>new URL(url,'http://localhost').searchParams.get('group')==='employees')).toBe(true);
 fireEvent.click(screen.getByRole('tab',{name:'Tài khoản khách hàng'}));
 expect(await screen.findByText('Store customer')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Thêm mới'})).toBeNull();
 const customerRow=screen.getByText('Store customer').closest('tr');
 expect(within(customerRow).getByRole('button',{name:'Sửa'})).toBeTruthy();
 expect(within(customerRow).getByRole('button',{name:'Khóa tài khoản'})).toBeTruthy();
 expect(within(customerRow).queryByRole('button',{name:'Xóa mềm'})).toBeNull();
 expect(adminApi.mock.calls.some(([url])=>new URL(url,'http://localhost').searchParams.get('group')==='customers')).toBe(true);
});
it('lets Admin edit, lock, and unlock customers without a delete action',async()=>{
 window.history.replaceState({},'', '/admin/accounts');adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 let customer={id:4,fullName:'Store customer',email:'customer@example.test',phone:'0900000000',preferences:'Neutral colors',role:'CUSTOMER',locked:false};
 adminApi.mockImplementation(async (url,options={})=>{
  if(url.includes('/overview'))return {};
  if(url==='/api/admin/customers/4'){
   customer={...customer,...options.body};return customer;
  }
  if(url==='/api/admin/customers/4/lock'){
   customer={...customer,locked:options.body.locked};return customer;
  }
  const group=new URL(url,'http://localhost').searchParams.get('group');
  return {content:group==='customers'?[customer]:[],totalPages:1,totalElements:group==='customers'?1:0};
 });
 const previousPrompt=window.prompt;window.prompt=vi.fn().mockReturnValue('Verify customer identity');
 try{
  render(<SystemAdminApp/>);
  await screen.findByRole('tab',{name:'Tài khoản khách hàng'});
  fireEvent.click(screen.getByRole('tab',{name:'Tài khoản khách hàng'}));
  await screen.findByText('Store customer');
  const row=screen.getByText('Store customer').closest('tr');
  fireEvent.click(within(row).getByRole('button',{name:'Sửa'}));
  fireEvent.change(screen.getByLabelText('Họ tên'),{target:{value:'Updated customer'}});
  fireEvent.change(screen.getByLabelText('Email'),{target:{value:'updated@example.test'}});
  fireEvent.click(screen.getByRole('button',{name:'Lưu'}));
  await waitFor(()=>expect(adminApi.mock.calls.some(([url,options])=>url==='/api/admin/customers/4'&&options?.method==='PUT')).toBe(true));
  const [,update]=adminApi.mock.calls.find(([url,options])=>url==='/api/admin/customers/4'&&options?.method==='PUT');
  expect(update.body).toEqual({fullName:'Updated customer',email:'updated@example.test',phone:'0900000000',preferences:'Neutral colors'});

  const updatedRow=(await screen.findByText('Updated customer')).closest('tr');
  fireEvent.click(within(updatedRow).getByRole('button',{name:'Khóa tài khoản'}));
  await waitFor(()=>expect(adminApi.mock.calls.some(([url,options])=>url==='/api/admin/customers/4/lock'&&options?.method==='PATCH')).toBe(true));
  const [,lock]=adminApi.mock.calls.find(([url,options])=>url==='/api/admin/customers/4/lock'&&options?.method==='PATCH');
  expect(lock.body).toEqual({locked:true,reason:'Verify customer identity'});
  const lockedRow=screen.getByText('Updated customer').closest('tr');
  await waitFor(()=>expect(within(lockedRow).getByRole('button',{name:'Mở khóa'})).toBeTruthy());
  fireEvent.click(within(lockedRow).getByRole('button',{name:'Mở khóa'}));
  await waitFor(()=>expect(adminApi.mock.calls.some(([url,options])=>url==='/api/admin/customers/4/lock'&&options?.method==='PATCH'&&options.body.locked===false)).toBe(true));
  expect(screen.queryByRole('button',{name:'Xóa mềm'})).toBeNull();
 }finally{window.prompt=previousPrompt;}
});
it('offers the split internal roles and creates Employee without a password',async()=>{
 window.history.replaceState({},'', '/admin/accounts');adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>url.includes('/overview')?{accounts:1,products:3,suppliers:1}:{content:[],totalPages:0});
 render(<SystemAdminApp/>);await screen.findByText('Chưa có dữ liệu phù hợp.');fireEvent.click(screen.getByText('Thêm mới'));
 const role=screen.getByLabelText('Vai trò');expect(role.value).toBe('MANAGER_SALES');
 expect(Array.from(role.options,option=>option.value)).toEqual(['MANAGER_HR','MANAGER_WAREHOUSE','MANAGER_SALES','EMPLOYEE','ADMIN']);
 fireEvent.change(role,{target:{value:'EMPLOYEE'}});expect(screen.queryByLabelText(/Mật khẩu/)).toBeNull();
 fireEvent.change(screen.getByLabelText('Loại nhân viên'),{target:{value:'SALES'}});
 fireEvent.change(screen.getByLabelText('Họ tên'),{target:{value:'Directory employee'}});
 fireEvent.change(screen.getByLabelText('Email'),{target:{value:'employee@example.test'}});
 fireEvent.click(screen.getByRole('button',{name:'Lưu'}));
 await waitFor(()=>expect(adminApi.mock.calls.some(([url,options])=>url==='/api/admin/accounts'&&options?.method==='POST')).toBe(true));
 const [,options]=adminApi.mock.calls.find(([url,request])=>url==='/api/admin/accounts'&&request?.method==='POST');
 expect(options.body).toMatchObject({fullName:'Directory employee',email:'employee@example.test',role:'EMPLOYEE',workArea:'SALES'});expect(options.body).not.toHaveProperty('password');
});
it('requires a new password when promoting Employee to a login role',async()=>{
 window.history.replaceState({},'', '/admin/accounts');adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async url=>url.includes('/overview')?{accounts:1,products:3,suppliers:1}:{content:[{id:7,fullName:'Directory employee',email:'employee@example.test',role:'EMPLOYEE',locked:false}],totalPages:1});
 render(<SystemAdminApp/>);await screen.findByText('Directory employee');fireEvent.click(screen.getByRole('button',{name:/Sửa/}));
 fireEvent.change(screen.getByLabelText('Vai trò'),{target:{value:'MANAGER_SALES'}});
 const password=screen.getByLabelText(/Mật khẩu/);expect(password.required).toBe(true);
 fireEvent.change(password,{target:{value:'NewPass123!'}});fireEvent.click(screen.getByRole('button',{name:'Lưu'}));
 await waitFor(()=>expect(adminApi.mock.calls.some(([url,options])=>url==='/api/admin/accounts/7'&&options?.method==='PATCH')).toBe(true));
 const [,options]=adminApi.mock.calls.find(([url,request])=>url==='/api/admin/accounts/7'&&request?.method==='PATCH');expect(options.body.password).toBe('NewPass123!');
});
it('shows and saves employee subtype from work area',async()=>{
 window.history.replaceState({},'', '/admin/accounts');adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockImplementation(async (url,options={})=>{
  if(url.includes('/overview'))return {};
  if(url==='/api/admin/accounts/7'&&options.method==='PATCH')return {};
  const group=new URL(url,'http://localhost').searchParams.get('group');
  const rows=group==='employees'?[{id:7,fullName:'Warehouse employee',email:'warehouse@example.test',role:'EMPLOYEE',workArea:'WAREHOUSE',locked:false}]:[];
  return {content:rows,totalPages:1,totalElements:rows.length};
 });
 render(<SystemAdminApp/>);
 await screen.findByRole('tab',{name:'Tài khoản nhân viên'});
 fireEvent.click(screen.getByRole('tab',{name:'Tài khoản nhân viên'}));
 expect(await screen.findByText('Nhân viên kho')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Sửa'}));
 const type=screen.getByLabelText('Loại nhân viên');expect(type.value).toBe('WAREHOUSE');
 fireEvent.change(type,{target:{value:'SALES'}});fireEvent.click(screen.getByRole('button',{name:'Lưu'}));
 await waitFor(()=>expect(adminApi.mock.calls.some(([url,options])=>url==='/api/admin/accounts/7'&&options?.method==='PATCH'&&options.body.workArea==='SALES')).toBe(true));
});
it('collapses the admin sidebar from the brand and restores the saved state', async () => {
 window.history.replaceState({}, '', '/admin');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 mockAdminDashboard({accounts:2,products:3});
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
 mockAdminDashboard({accounts:2,products:3});
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

it('adds the saved organization and security panels alongside current reports', async () => {
 window.history.replaceState({}, '', '/admin');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 mockAdminDashboard({accounts:2,products:3,summary:{},trend:[],topProducts:[],topCustomers:[],employeeActivities:[]});
 render(<SystemAdminApp/>);
 expect(await screen.findByRole('heading',{name:/Sơ đồ Cơ cấu Tổ chức/})).toBeTruthy();
 expect(screen.getByText('Chính sách an toàn thông tin')).toBeTruthy();
 expect(await screen.findByRole('heading',{name:'Tổng thu chi'})).toBeTruthy();
});

it('shows saved preferences for account rows', async () => {
 window.history.replaceState({}, '', '/admin/accounts');
 adminRefreshSession.mockResolvedValue({admin:{email:'admin@test.vn'}});
 adminApi.mockResolvedValue({content:[{id:42,fullName:'Manager',email:'manager@test.vn',role:'MANAGER_SALES',preferences:'Saved local preference'}],totalPages:1,totalElements:1});
 render(<SystemAdminApp/>);
 expect(await screen.findByText('Saved local preference')).toBeTruthy();
});
