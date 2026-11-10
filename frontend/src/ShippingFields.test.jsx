// @vitest-environment jsdom
import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { it, expect, afterEach, beforeEach, vi } from 'vitest';
import ShippingFields, { PhoneField, phoneDigits, validPhone, prepareAddress, shippingErrors } from './ShippingFields';
import provinces from './data/vietnam-addresses.json';
import { AddressModal } from './app/App';
import CheckoutPage from './CheckoutPage';
import { api } from './api/api';
vi.mock('./api/api', async original => ({...(await original()), api:vi.fn()}));
beforeEach(() => { vi.clearAllMocks(); api.mockResolvedValue([]); });
afterEach(cleanup);
const saved={ id:1,recipientName:'Khách thử',phone:'0912345678',addressLine:'12 Đường thử',province:'Thành phố Hà Nội',ward:'Phường Ba Đình',district:'Quận cũ',defaultAddress:true };
const cart={items:[{productId:1,name:'Áo',quantity:1,lineTotal:100}],subtotal:100};
it('has complete unique province and ward identifiers', () => {
  expect(provinces).toHaveLength(34);
  const wards=provinces.flatMap(p=>p.wards);
  expect(wards).toHaveLength(3321);
  expect(new Set(wards.map(w=>w.code)).size).toBe(3321);
  expect(new Set(provinces.map(p=>p.code)).size).toBe(34);
  expect(provinces.every(p=>p.name && p.wards.length && p.wards.every(w=>w.name))).toBe(true);
});
it('keeps leading zero, removes pasted letters and rejects invalid lengths', () => {
  expect(phoneDigits('09a12 345-678')).toBe('0912345678');
  for(const value of ['1234567890','091234567','09123456789','test','']) expect(validPhone(value)).toBe(false);
  expect(validPhone('0912345678')).toBe(true);
  const change=vi.fn(); render(<PhoneField value="" onChange={change}/>);
  fireEvent.change(screen.getByLabelText('SỐ ĐIỆN THOẠI'),{target:{value:'09a12 345-678'}});
  expect(change).toHaveBeenCalledWith('0912345678');
});
it('resets ward on province change and disables it until province is selected', () => {
  function Form(){ const [form,setForm]=useState({}); return <ShippingFields form={form} onChange={next=>setForm({...form,...next})}/>; }
  render(<Form/>);
  expect(screen.getByLabelText('PHƯỜNG/XÃ').disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('TỈNH/THÀNH PHỐ'),{target:{value:'01'}});
  fireEvent.change(screen.getByLabelText('PHƯỜNG/XÃ'),{target:{value:'00004'}});
  expect(screen.getByLabelText('PHƯỜNG/XÃ').value).toBe('00004');
  fireEvent.change(screen.getByLabelText('TỈNH/THÀNH PHỐ'),{target:{value:'04'}});
  expect(screen.getByLabelText('PHƯỜNG/XÃ').value).toBe('');
});
it('matches exact normalized names only and preserves old recipient data', () => {
  expect(prepareAddress(saved)).toMatchObject({...saved,district:''});
  const result=prepareAddress({...saved,province:'Tỉnh cũ',ward:'Xã cũ'});
  expect(result).toMatchObject({phone:saved.phone,addressLine:saved.addressLine,province:'',ward:'',district:''});
  expect(shippingErrors(result).location).toBeTruthy();
});
it('blocks checkout when phone or location is invalid', async () => {
  api.mockResolvedValue([{...saved,phone:"invalid"}]);
  render(<CheckoutPage cart={cart}/>);
  await screen.findByText(/Địa chỉ cần cập nhật/);
  expect(screen.getByText("ĐẶT HÀNG").disabled).toBe(true);
  expect(api.mock.calls.some(([path])=>path==='/api/orders')).toBe(false);
});
it.each(['COD','PAYOS'])('sends a two-level address for %s without a stale district', async method => {
  api.mockImplementation(async path=>path.includes('addresses')?[saved]:{order:{orderCode:1},paymentUrl:null});
  const {container}=render(<CheckoutPage cart={cart}/>);
  await screen.findByText(saved.phone);
  if(method==='PAYOS')fireEvent.click(screen.getByText('payOS / VietQR'));
  fireEvent.submit(container.querySelector('form'));
  await waitFor(()=>expect(api.mock.calls.some(([path])=>path==='/api/orders')).toBe(true));
  const body=api.mock.calls.find(([path])=>path==='/api/orders')[1].body;
  expect(body.paymentMethod).toBe(method);
  expect(body.deliveryAddress).toBe('Khách thử, 0912345678, 12 Đường thử, Phường Ba Đình, Thành phố Hà Nội');
});
it('updates a saved address only on save and clears district', async () => {
  api.mockImplementation(async (path,options)=>options?.method ? {...saved,...options.body} : [saved]);
  const {container}=render(<AddressModal onClose={vi.fn()} onNotice={vi.fn()}/>);
  fireEvent.click(await screen.findByText('Sửa'));
  expect(api.mock.calls.every(([,options])=>!options?.method)).toBe(true);
  fireEvent.submit(container.querySelector('form'));
  await waitFor(()=>expect(api.mock.calls.some(([,options])=>options?.method==='PUT')).toBe(true));
  expect(api.mock.calls.find(([,options])=>options?.method==='PUT')[1].body.district).toBe('');
});

it('searches and selects province and ward using search queries with and without tones', async () => {
  function AddressForm() {
    const [form, setForm] = useState({});
    return <ShippingFields form={form} onChange={next => setForm(current => ({ ...current, ...next }))} />;
  }
  render(<AddressForm />);

  // Open province search
  fireEvent.click(screen.getByRole('button', { name: /Chọn Tỉnh\/Thành phố/i }));
  const provinceSearch = screen.getByPlaceholderText('Tìm kiếm tỉnh, thành phố...');
  // Search without tones
  fireEvent.change(provinceSearch, { target: { value: 'ha noi' } });
  const hanoiOption = screen.getAllByRole('option').find(el => el.classList.contains('shop-searchable-option') && el.textContent.includes('Thành phố Hà Nội'));
  expect(hanoiOption).toBeDefined();
  fireEvent.click(hanoiOption);

  // Now ward is enabled, open ward search
  fireEvent.click(screen.getByRole('button', { name: /Chọn Phường\/Xã/i }));
  const wardSearch = screen.getByPlaceholderText('Tìm kiếm phường, xã...');
  // Search with partial keyword
  fireEvent.change(wardSearch, { target: { value: 'ba dinh' } });
  const badinhOption = screen.getAllByRole('option').find(el => el.classList.contains('shop-searchable-option') && el.textContent.includes('Phường Ba Đình'));
  expect(badinhOption).toBeDefined();
  fireEvent.click(badinhOption);

  // Verify ward is selected and shown on trigger
  expect(screen.getAllByText('Phường Ba Đình').length).toBeGreaterThan(0);
});

it('shows empty message when search yields no match and can clear search query', async () => {
  render(<ShippingFields form={{}} onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Chọn Tỉnh\/Thành phố/i }));
  const searchInput = screen.getByPlaceholderText('Tìm kiếm tỉnh, thành phố...');
  fireEvent.change(searchInput, { target: { value: 'diachi_khong_ton_tai' } });
  expect(await screen.findByText('Không tìm thấy kết quả phù hợp')).toBeDefined();

  // Clear search
  fireEvent.click(screen.getByLabelText('Xóa tìm kiếm'));
  expect(searchInput.value).toBe('');
  expect(screen.getAllByText('Thành phố Hà Nội').length).toBeGreaterThan(0);
});
