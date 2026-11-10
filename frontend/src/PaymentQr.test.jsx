// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PaymentQr from "./PaymentQr";
import { api } from "./api/api";

vi.mock("./api/api", async original => ({ ...await original(), api: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const pending = { orderCode: 1001, amount: 249000, paymentStatus: "PENDING", qrCode: "000201010212", paymentUrl: "https://pay.payos.vn/web/test", expiresAt: new Date(Date.now() + 600000).toISOString() };
it('hides QR and retry when payment needs manual reconciliation',async()=>{
 api.mockResolvedValue({...pending,reviewRequired:true,retryable:false,qrCode:null,paymentUrl:null});render(<PaymentQr orderId={5}/>);
 await screen.findByText('Thanh toán cần đối chiếu — vui lòng liên hệ cửa hàng');expect(screen.queryByTitle('Mã QR thanh toán đơn 1001')).toBeNull();expect(screen.queryByText('Tạo mã QR mới')).toBeNull();
});

it("shows a scannable QR immediately and removes it when payment is confirmed", async () => {
  let confirm;
  api.mockReturnValue(new Promise(resolve => { confirm = resolve; }));
  render(<PaymentQr orderId={5} initial={pending} />);
  expect(screen.getByTitle("Mã QR thanh toán đơn 1001")).toBeTruthy();
  expect(screen.getByText("Chưa thanh toán")).toBeTruthy();
  confirm({ ...pending, paymentStatus: "PAID", qrCode: null, paymentUrl: null });
  await screen.findByText("Thanh toán thành công");
  expect(screen.queryByTitle("Mã QR thanh toán đơn 1001")).toBeNull();
  expect(api).toHaveBeenCalledWith("/api/orders/5/payment", expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

it("lets a legacy order use its saved PayOS link without claiming a QR exists", async () => {
  api.mockResolvedValue({ ...pending, qrCode: null });
  render(<PaymentQr orderId={5} />);
  await screen.findByText(/chưa lưu mã QR/);
  expect(screen.getByRole("link", { name: /Thanh toán qua PayOS/ }).getAttribute("href")).toBe(pending.paymentUrl);
});

it("hides an expired QR even before the next server refresh", async () => {
  api.mockResolvedValue({ ...pending, expiresAt: new Date(Date.now() - 1000).toISOString() });
  render(<PaymentQr orderId={5} />);
  await screen.findByText("Mã thanh toán đã hết hạn");
  expect(screen.queryByTitle("Mã QR thanh toán đơn 1001")).toBeNull();
});

it("creates a new QR for an expired payment on the same order", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const expired = { ...pending, paymentStatus: "EXPIRED", qrCode: null, paymentUrl: null, retryable: true, expiresAt: new Date(Date.now() - 1000).toISOString() };
  api.mockResolvedValueOnce(expired).mockResolvedValueOnce({ ...pending, retryable: true });
  render(<PaymentQr orderId={5}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Tạo mã QR mới" }));
  await screen.findByTitle("Mã QR thanh toán đơn 1001");
  expect(api).toHaveBeenCalledWith("/api/orders/5/payment/retry", expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }));
});

it("notifies payment success once after checking the provider", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const onPaid = vi.fn();
  api.mockResolvedValueOnce(pending).mockResolvedValueOnce({ ...pending, paymentStatus: "PAID", qrCode: null, paymentUrl: null });
  render(<PaymentQr orderId={5} initial={pending} onPaid={onPaid}/>);
  await waitFor(() => expect(api).toHaveBeenCalledWith("/api/orders/5/payment", expect.objectContaining({ signal: expect.any(AbortSignal) })));
  fireEvent.click(screen.getByLabelText("Cập nhật trạng thái thanh toán"));
  await screen.findByText("Thanh toán thành công");
  expect(onPaid).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith("/api/orders/5/payment/sync", expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }));
});
