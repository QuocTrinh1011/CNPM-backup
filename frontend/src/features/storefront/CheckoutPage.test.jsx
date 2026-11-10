// @vitest-environment jsdom
import React, { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../../app/App";
import CheckoutPage from "./CheckoutPage";
import AddressModal from "../customer/CustomerAddresses";
import { api, refreshSession, signIn } from "../../api/api";
import { saveSelection, cartLineKey } from "./cart-selection";
vi.mock("../../api/api", async original => ({ ...await original(), api:vi.fn(), refreshSession:vi.fn(), signIn:vi.fn() }));
const home = {id:1,recipientName:"Khách ở nhà",phone:"0912345678",addressLine:"12 Đường Nhà",ward:"Phường Ba Đình",province:"Thành phố Hà Nội",defaultAddress:true};
const office = {...home,id:2,recipientName:"Khách văn phòng",addressLine:"34 Đường Công Ty",defaultAddress:false};
const cart = {items:[{productId:1,name:"Áo kiểm thử",stock:10,quantity:1,size:"M",color:"Đen",unitPrice:100000,lineTotal:100000}],subtotal:100000,itemCount:1};
const customer = {id:10,fullName:"Khách thử"};
const deferred = () => {let resolve;const promise = new Promise(r=>{resolve=r;});return {promise,resolve};};
beforeEach(()=>{
  vi.resetAllMocks();localStorage.clear();window.history.replaceState({},"","/dat-hang");window.scrollTo=vi.fn();
  sessionStorage.clear();
  saveSelection('customer-10', {known:cart.items.map(cartLineKey),selected:cart.items.map(cartLineKey)});
  refreshSession.mockResolvedValue({customer});
  api.mockImplementation(async path=>{
    if(path.includes("/addresses")) return [home,office];
    if(path==="/api/cart") return cart;
    if(path.includes("/categories") || path.includes("/wishlist")) return [];
    if(path.includes("/notifications")) return {unreadCount:0};
    return {content:[],totalPages:0};
  });
});
afterEach(cleanup);
it("requires an explicit cart selection on a fresh direct checkout",async()=>{
  sessionStorage.clear();render(<App/>);
  await screen.findByText("Chưa chọn sản phẩm để đặt hàng");
  expect(screen.queryByText("ĐẶT HÀNG")).toBeNull();
});
it("checks out only selected lines and leaves other lines in the cart",async()=>{
  sessionStorage.clear();window.history.replaceState({},"","/gio-hang");
  const second={...cart.items[0],productId:2,name:"Áo còn lại",lineTotal:200000,unitPrice:200000};
  let serverCart={items:[cart.items[0],second],subtotal:300000,itemCount:2};
  const base=api.getMockImplementation();
  api.mockImplementation(async(path,options)=>{
    if(path==='/api/cart') return serverCart;
    if(path==='/api/orders'&&options?.method==='POST') {
      expect(options.body.items).toEqual([{productId:1,quantity:1,size:'M',color:'Đen'}]);
      serverCart={items:[second],subtotal:200000,itemCount:1};
      return {order:{id:99,orderCode:9900,totalAmount:100000,status:'PENDING',paymentMethod:'COD',paymentStatus:'COD'}};
    }
    return base(path,options);
  });
  render(<App/>);
  const remainingCheckbox=await screen.findByLabelText('Chọn Áo còn lại Đen M');
  await waitFor(()=>expect(remainingCheckbox.checked).toBe(true));
  fireEvent.click(remainingCheckbox);
  expect(remainingCheckbox.checked).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:/TIẾN HÀNH ĐẶT HÀNG/}));
  await screen.findByText(home.recipientName);
  expect(screen.queryByText('Áo còn lại')).toBeNull();
  fireEvent.click(screen.getByText('ĐẶT HÀNG'));
  await screen.findByText(/Chờ xác nhận · Cửa hàng/);
  act(()=>{window.history.pushState({},'', '/gio-hang');window.dispatchEvent(new PopStateEvent('popstate'));});
  await screen.findByText('Áo còn lại');
  expect(screen.queryByText('Áo kiểm thử')).toBeNull();
});
const writes = () => api.mock.calls.filter(([,options])=>options?.method);
it("shows the default address without an edit form or automatic writes",async()=>{
  render(<CheckoutPage cart={cart}/>);
  await screen.findByText(home.recipientName);
  expect(screen.queryByLabelText("NGƯỜI NHẬN")).toBeNull();
  expect(screen.queryByText(office.recipientName)).toBeNull();
  expect(writes()).toHaveLength(0);
});
it("shows PayOS QR after placing an order without creating a second order",async()=>{
  const created={order:{id:7,orderCode:7007,totalAmount:100000,status:"PENDING",paymentMethod:"PAYOS",paymentStatus:"PENDING"},qrCode:"000201010212",paymentUrl:"https://pay.payos.vn/web/test",expiresAt:new Date(Date.now()+600000).toISOString()};
  api.mockImplementation(async (path,options)=>path.includes("/addresses")?[home]:path==="/api/orders" && options?.method==="POST"?created:path==="/api/orders/7/payment"?{orderCode:7007,amount:100000,paymentStatus:"PENDING",qrCode:created.qrCode,paymentUrl:created.paymentUrl,expiresAt:created.expiresAt}:{content:[]});
  render(<CheckoutPage cart={cart} onPlaced={vi.fn()}/>);
  await screen.findByText(home.recipientName);
  fireEvent.click(screen.getByText("payOS / VietQR"));fireEvent.click(screen.getByText("ĐẶT HÀNG"));
  await screen.findByTitle("Mã QR thanh toán đơn 7007");
  expect(screen.getByText("Chờ xác nhận · Cửa hàng sẽ kiểm tra và xác nhận đơn của bạn.")).toBeTruthy();
  expect(api.mock.calls.filter(([path,options])=>path==="/api/orders"&&options?.method==="POST")).toHaveLength(1);
});
it("cancelling a choice preserves the previous address; confirmation changes only this order",async()=>{
  render(<CheckoutPage cart={cart}/>);
  await screen.findByText(home.recipientName);
  fireEvent.click(screen.getByText("Thay đổi"));
  fireEvent.click(screen.getByRole("radio",{name:/Khách văn phòng/}));
  fireEvent.click(screen.getByLabelText("Đóng chọn địa chỉ"));
  expect(screen.getByText(home.recipientName)).toBeTruthy();
  expect(screen.queryByText(office.recipientName)).toBeNull();
  fireEvent.click(screen.getByText("Thay đổi"));fireEvent.click(screen.getByRole("radio",{name:/Khách văn phòng/}));
  fireEvent.click(screen.getByText("Giao đến địa chỉ này"));
  expect(screen.getByText(office.recipientName)).toBeTruthy();expect(writes()).toHaveLength(0);
});
it("falls back to the first address without making it the stored default",async()=>{
  api.mockResolvedValue([{...office,defaultAddress:false}]);
  render(<CheckoutPage cart={cart}/>);await screen.findByText(office.recipientName);
  expect(screen.queryByText("Mặc định")).toBeNull();expect(writes()).toHaveLength(0);
});
it("distinguishes load failure from no address and retries",async()=>{
  api.mockRejectedValueOnce(new Error("Mất kết nối địa chỉ")).mockResolvedValue([home]);
  render(<CheckoutPage cart={cart}/>);await screen.findByText("Mất kết nối địa chỉ");
  expect(screen.queryByText("Bạn chưa có địa chỉ nhận hàng.")).toBeNull();expect(screen.getByText("ĐẶT HÀNG").disabled).toBe(true);
  fireEvent.click(screen.getByText("Thử lại địa chỉ"));await screen.findByText(home.recipientName);
});
it("only opens the first-address form on request and saves before allowing selection",async()=>{
  api.mockResolvedValue([]);
  render(<CheckoutPage cart={cart}/>);await screen.findByText("Bạn chưa có địa chỉ nhận hàng.");
  expect(screen.getByText("ĐẶT HÀNG").disabled).toBe(true);
  fireEvent.click(screen.getByText("Thêm địa chỉ nhận hàng"));fireEvent.click(screen.getByText("Thêm địa chỉ mới"));
  fireEvent.change(screen.getByLabelText("NGƯỜI NHẬN"),{target:{value:home.recipientName}});
  fireEvent.change(screen.getByLabelText("SỐ ĐIỆN THOẠI"),{target:{value:"09a12 345678"}});
  fireEvent.change(screen.getByLabelText("ĐỊA CHỈ"),{target:{value:home.addressLine}});
  fireEvent.change(screen.getByLabelText("TỈNH/THÀNH PHỐ"),{target:{value:"01"}});
  fireEvent.change(screen.getByLabelText("PHƯỜNG/XÃ"),{target:{value:"00004"}});
  expect(writes()).toHaveLength(0);
  api.mockResolvedValue(home);fireEvent.click(screen.getByText("LƯU ĐỊA CHỈ"));
  await screen.findByText("Giao đến địa chỉ này");
  expect(api).toHaveBeenCalledWith("/api/customers/me/addresses",expect.objectContaining({method:"POST",body:expect.objectContaining({phone:home.phone,district:"",defaultAddress:true})}));
  fireEvent.click(screen.getByText("Giao đến địa chỉ này"));
  expect(screen.getByText("ĐẶT HÀNG").disabled).toBe(false);
});
it("keeps saved-address edits on failure and makes no change when closed without saving",async()=>{
  render(<AddressModal onClose={vi.fn()}/>);
  await screen.findByText(home.recipientName);
  expect(screen.queryByLabelText("NGƯỜI NHẬN")).toBeNull();
  fireEvent.click(screen.getAllByText("Sửa")[0]);
  fireEvent.change(screen.getByLabelText("NGƯỜI NHẬN"),{target:{value:"Tên mới"}});
  fireEvent.click(screen.getByText("Quay lại"));expect(writes()).toHaveLength(0);
  fireEvent.click(screen.getAllByText("Sửa")[0]);
  fireEvent.change(screen.getByLabelText("NGƯỜI NHẬN"),{target:{value:"Tên mới"}});
  api.mockRejectedValueOnce(new Error("Không lưu được"));
  fireEvent.click(screen.getByText("LƯU ĐỊA CHỈ"));await screen.findByText("Không lưu được");
  expect(screen.getByLabelText("NGƯỜI NHẬN").value).toBe("Tên mới");
});
it.each(["COD","PAYOS"])("submits the confirmed address and voucher for %s, retaining them on API error",async method=>{
  render(<CheckoutPage cart={cart}/>);
  await screen.findByText(home.recipientName);fireEvent.click(screen.getByText("Thay đổi"));
  fireEvent.click(screen.getByRole("radio",{name:/Khách văn phòng/}));fireEvent.click(screen.getByText("Giao đến địa chỉ này"));
  if(method==="PAYOS") fireEvent.click(screen.getByText("payOS / VietQR"));
  fireEvent.change(screen.getByPlaceholderText("Nhập mã voucher"),{target:{value:"SHOP10"}});
  api.mockResolvedValueOnce({code:"SHOP10",discountAmount:10000});fireEvent.click(screen.getByText("ÁP DỤNG"));
  await screen.findByText("Đã áp dụng SHOP10");
  api.mockRejectedValueOnce(new Error("Đặt hàng thất bại"));fireEvent.click(screen.getByText("ĐẶT HÀNG"));
  await screen.findByText("Đặt hàng thất bại");
  expect(screen.getByText(office.recipientName)).toBeTruthy();expect(screen.getByText("Đã áp dụng SHOP10")).toBeTruthy();
  expect(api).toHaveBeenCalledWith("/api/orders",expect.objectContaining({method:"POST",body:expect.objectContaining({paymentMethod:method,voucherCode:"SHOP10",deliveryAddress:"Khách văn phòng, 0912345678, 34 Đường Công Ty, Phường Ba Đình, Thành phố Hà Nội"})}));
});
it("supports direct route and refresh without creating an order",async()=>{
  const first=render(<App/>);await screen.findByText("Hoàn tất đơn hàng");
  expect(screen.queryByText("Những món đồ")).toBeNull();
  first.unmount();render(<App/>);await screen.findByText("Hoàn tất đơn hàng");
  expect(writes()).toHaveLength(0);
});
it("waits for session restoration and guest-cart merge before mounting checkout",async()=>{
  const session=deferred(),merge=deferred();
  localStorage.setItem("anh-lon-shop-guest-cart",JSON.stringify(cart));
  refreshSession.mockReturnValue(session.promise);
  const base=api.getMockImplementation();
  api.mockImplementation((path,options)=>path==="/api/cart" && options?.method==="PUT"?merge.promise:base(path,options));
  render(<StrictMode><App/></StrictMode>);
  expect(screen.getByText("Đang khôi phục phiên đăng nhập...")).toBeTruthy();
  await act(()=>session.resolve({customer}));
  await screen.findByText("Đang tải và đồng bộ giỏ hàng...");
  expect(screen.queryByText("ĐẶT HÀNG")).toBeNull();
  await act(()=>merge.resolve({...cart,itemCount:2}));
  await screen.findByText("Hoàn tất đơn hàng");
  expect(api.mock.calls.filter(([path,options])=>path==="/api/cart" && options?.method==="PUT")).toHaveLength(1);
});
it("shows a recoverable cart error and does not pretend it is empty",async()=>{
  const base=api.getMockImplementation();let fail=true;
  api.mockImplementation((path,options)=>path==="/api/cart" && fail?Promise.reject(new Error("Lỗi giỏ hàng")):base(path,options));
  render(<App/>);await screen.findByText("Chưa tải được giỏ hàng");
  expect(screen.queryByText("Giỏ hàng đang trống")).toBeNull();
  fail=false;fireEvent.click(screen.getByText("Thử lại giỏ hàng"));await screen.findByText("Hoàn tất đơn hàng");
});
it("shows guest sign-in and preserves checkout destination after login",async()=>{
  refreshSession.mockResolvedValue(null);signIn.mockResolvedValue({customer});
  render(<App/>);await screen.findByText("Chào mừng trở lại.");
  // Auth modal's actual fields and submit are intentionally exercised.
  fireEvent.change(screen.getByLabelText("EMAIL"),{target:{value:"test@example.test"}});
  fireEvent.change(screen.getByLabelText("MẬT KHẨU"),{target:{value:"Test12345"}});
  fireEvent.click(screen.getByRole("button",{name:"ĐĂNG NHẬP →",exact:true}));
  await screen.findByText("Hoàn tất đơn hàng");expect(window.location.pathname).toBe("/dat-hang");
});
it("handles back/forward and leaves the PayOS return URL outside checkout",async()=>{
  render(<App/>);await screen.findByText("Hoàn tất đơn hàng");
  act(()=>{window.history.pushState({},"","/san-pham");window.dispatchEvent(new PopStateEvent("popstate"));});
  expect(screen.queryByText("Hoàn tất đơn hàng")).toBeNull();
  act(()=>{window.history.pushState({},"","/dat-hang");window.dispatchEvent(new PopStateEvent("popstate"));});
  await screen.findByText("Hoàn tất đơn hàng");
  act(()=>{window.history.pushState({},"","/thanh-toan?orderCode=123");window.dispatchEvent(new PopStateEvent("popstate"));});
  expect(screen.queryByText("Hoàn tất đơn hàng")).toBeNull();expect(writes()).toHaveLength(0);
});
