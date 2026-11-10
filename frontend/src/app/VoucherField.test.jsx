// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VoucherField, { useCheckoutVoucher } from "../features/storefront/VoucherField";
import CustomerVouchers from "../features/customer/CustomerVouchers";
import { api } from "../api/api";
vi.mock("../api/api",async original=>({...await original(),api:vi.fn()}));
const cart = {subtotal:100000,items:[{productId:1,quantity:1,lineTotal:100000}]};
it("selects a general voucher alongside rewards then explicitly applies it",async()=>{
  api.mockImplementation(async path=>path.startsWith('/api/customers/me/vouchers')
    ? {content:[{code:'SHOP10',source:'GENERAL',state:'ACTIVE',discountType:'PERCENTAGE',discountValue:10},{code:'KS-1',source:'SURVEY',state:'USED',discountType:'PERCENTAGE',discountValue:20}],totalPages:1}
    : {code:'SHOP10',discountAmount:10000});
  function Form(){const model=useCheckoutVoucher(cart);return <VoucherField model={model} VoucherWallet={CustomerVouchers}/>;}
  render(<Form/>);
  fireEvent.click(screen.getByText('Chọn voucher của tôi'));
  await screen.findByText('Ưu đãi cửa hàng');expect(screen.getByText('Thưởng khảo sát')).toBeTruthy();
  const buttons=screen.getAllByText('Chọn mã');expect(buttons[1].disabled).toBe(true);
  fireEvent.click(buttons[0]);expect(screen.getByPlaceholderText('Nhập mã voucher').value).toBe('SHOP10');
  expect(api).not.toHaveBeenCalledWith(expect.stringContaining('/validate'));
  fireEvent.click(screen.getByText('ÁP DỤNG'));await screen.findByText('Đã áp dụng SHOP10');
});
beforeEach(()=>vi.resetAllMocks());
afterEach(cleanup);
it("applies and removes a code with customer endpoints only",async()=>{
  api.mockResolvedValue({code:"SHOP10",discountAmount:10000});
  function Form(){const model=useCheckoutVoucher(cart);return <VoucherField model={model}/>;}
  render(<Form/>);
  fireEvent.change(screen.getByPlaceholderText("Nhập mã voucher"),{target:{value:"shop10"}});
  fireEvent.click(screen.getByText("ÁP DỤNG"));
  await screen.findByText("Đã áp dụng SHOP10");
  expect(api).toHaveBeenCalledWith("/api/vouchers/validate?code=SHOP10&amount=100000");
  fireEvent.click(screen.getByText("Bỏ mã"));
  expect(screen.queryByText("Đã áp dụng SHOP10")).toBeNull();
});
it("invalidates an old discount immediately and rechecks a changed cart",async()=>{
  api.mockResolvedValueOnce({code:"SHOP10",discountAmount:10000});
  const view=renderHook(({cart})=>useCheckoutVoucher(cart),{initialProps:{cart}});
  act(()=>view.result.current.change("SHOP10"));await act(()=>view.result.current.apply());
  expect(view.result.current.voucher.discountAmount).toBe(10000);
  let finish;api.mockImplementation(()=>new Promise(resolve=>finish=resolve));
  view.rerender({cart:{...cart,subtotal:200000}});
  expect(view.result.current.voucher).toBeNull();
  await act(()=>finish({code:"SHOP10",discountAmount:20000}));
  expect(view.result.current.voucher.discountAmount).toBe(20000);
});
it("ignores a stale response after code edits or removing the voucher",async()=>{
  let finish;api.mockImplementation(()=>new Promise(resolve=>finish=resolve));
  const {result}=renderHook(()=>useCheckoutVoucher(cart));
  act(()=>result.current.change("OLD"));
  let pending;act(()=>{pending=result.current.apply();});
  act(()=>result.current.change("NEW"));
  await act(async()=>{finish({code:"OLD",discountAmount:10000});await pending;});
  expect(result.current.voucher).toBeNull();expect(result.current.code).toBe("NEW");
});
it("shows an eligibility error and allows retry",async()=>{
  api.mockRejectedValueOnce(new Error("Mã đã tắt")).mockResolvedValue({code:"SHOP",discountAmount:1000});
  const {result}=renderHook(()=>useCheckoutVoucher(cart));
  act(()=>result.current.change("SHOP"));
  await act(()=>result.current.apply());expect(result.current.error).toBe("Mã đã tắt");
  await act(()=>result.current.apply());expect(result.current.error).toBe("");expect(result.current.voucher.code).toBe("SHOP");
});
