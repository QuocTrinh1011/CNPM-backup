// @vitest-environment jsdom
import React, { StrictMode } from "react";
import { act, cleanup, configure, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminApp, { useAdminList } from "./ManagerApp";
import { adminApi, adminRefreshSession } from "./api/manager-api";

vi.mock("./api/manager-api", async (importOriginal) => ({
  ...(await importOriginal()),
  adminApi: vi.fn(),
  adminRefreshSession: vi.fn(),
}));
const wrapper = ({ children }) => <StrictMode>{children}</StrictMode>;
configure({ reactStrictMode: true });
const endpoint = () => "/api/manager/users";
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, "", "/manager");
  window.localStorage.clear();
  adminRefreshSession.mockResolvedValue({ manager: { fullName: "Test Admin" } });
  adminApi.mockResolvedValue({ content: [] });
});
afterEach(cleanup);
it('removes manager supplier tools and redirects the retired route', async () => {
  window.history.replaceState({}, '', '/manager/suppliers');
  render(<AdminApp/>);
  await waitFor(() => expect(window.location.pathname).toBe('/manager'));
  expect(screen.queryByText(/nhà cung cấp/i)).toBeNull();
  expect(screen.queryByText('Đối tác cung cấp')).toBeNull();
  expect(adminApi.mock.calls.some(([url]) => url.includes('/suppliers'))).toBe(false);
});

describe("admin list lifecycle", () => {
  it("mounts and cleans up under StrictMode without returning a Promise cleanup", async () => {
    const { result, unmount } = renderHook(() => useAdminList(endpoint), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ content: [] });
    expect(() => unmount()).not.toThrow();
  });

  it("ignores StrictMode's obsolete first request", async () => {
    const old = deferred();
    adminApi.mockReturnValueOnce(old.promise).mockResolvedValue({ content: [{ id: 2 }] });
    const { result } = renderHook(() => useAdminList(endpoint), { wrapper });
    await waitFor(() => expect(result.current.data?.content[0]?.id).toBe(2));
    await act(async () => old.reject(new Error("stale error")));
    expect(result.current.error).toBe("");
    expect(result.current.data.content[0].id).toBe(2);
  });

  it("keeps the latest reload result when requests finish out of order", async () => {
    const { result } = renderHook(() => useAdminList(endpoint), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const old = deferred(), latest = deferred();
    adminApi.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    act(() => { void result.current.load(); void result.current.load(); });
    await act(async () => old.resolve({ content: [{ id: 1 }] }));
    expect(result.current.loading).toBe(true);
    await act(async () => latest.resolve({ content: [{ id: 2 }] }));
    expect(result.current.data.content[0].id).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it("does not request again through a callback retained after unmount", async () => {
    const pending = deferred();
    adminApi.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useAdminList(endpoint), { wrapper });
    const reload = result.current.load;
    unmount();
    const calls = adminApi.mock.calls.length;
    await act(async () => { pending.resolve({ content: [] }); await reload(); });
    expect(adminApi).toHaveBeenCalledTimes(calls);
  });
});

const pages = [
  ["Khách hàng", "users"], ["Sản phẩm", "products"],
  ["Đơn hàng", "orders"], ["Phản hồi", "feedback"], ["Khảo sát", "surveys"],
];
describe("admin navigation", () => {
  it("requires a reason before locking a customer and sends it to the admin API", async () => {
    window.history.replaceState({}, "", "/manager/users");
    adminApi.mockResolvedValue({ content: [{ id: 5, fullName: "Khách thử", email: "customer@example.com", locked: false }], totalPages: 1 });
    render(<AdminApp />, { wrapper });
    await screen.findByText("Khách thử");
    fireEvent.click(screen.getByRole("button", { name: "Khóa", exact: true }));
    const confirm = screen.getByRole("button", { name: "Xác nhận khóa" });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Lý do khóa gửi đến người dùng"), { target: { value: "Vi phạm quy định" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(adminApi).toHaveBeenCalledWith("/api/manager/users/5/lock", { method: "PATCH", body: { locked: true, reason: "Vi phạm quy định" } }));
  });

  it("confirms soft deletion and calls the customer delete endpoint", async () => {
    window.history.replaceState({}, "", "/manager/users");
    adminApi.mockResolvedValue({ content: [{ id: 5, fullName: "Khách thử", email: "customer@example.com", locked: false }], totalPages: 1 });
    render(<AdminApp />, { wrapper });
    await screen.findByText("Khách thử");
    fireEvent.click(screen.getByRole("button", { name: "Xóa", exact: true }));
    expect(screen.getByText(/Đơn hàng cũ vẫn được giữ lại/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa tài khoản" }));
    await waitFor(() => expect(adminApi).toHaveBeenCalledWith("/api/manager/users/5", { method: "DELETE" }));
  });

  it("filters orders, pages and loads details from real admin endpoints", async () => {
    window.history.replaceState({}, "", "/manager/orders");
    adminApi.mockImplementation(async url => url === "/api/manager/orders/9" ? { id: 9, orderCode: 9009, status: "CONFIRMED", customer: { fullName: "Khách thử" }, paymentMethod: "COD", paymentStatus: "COD", totalAmount: 299000, items: [] } : { content: [{ id: 9, orderCode: 9009, status: "CONFIRMED", customer: { fullName: "Khách thử" }, totalAmount: 299000 }], totalPages: 2, totalElements: 11 });
    render(<AdminApp />, { wrapper });
    await waitFor(() => expect(screen.getAllByText("#9009").length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Lọc trạng thái"), { target: { value: "CONFIRMED" } });
    await waitFor(() => expect(adminApi.mock.calls.some(([url]) => url.includes("status=CONFIRMED"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(adminApi.mock.calls.some(([url]) => url.includes("page=1"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết" }));
    await screen.findByRole("dialog");
    expect(screen.getByRole("dialog").textContent).toContain("Thanh toán khi nhận hàng");
    expect(adminApi).toHaveBeenCalledWith("/api/manager/orders/9", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("shows PayOS payment state separately from order processing and can refresh it", async () => {
    window.history.replaceState({}, "", "/manager/orders");
    let paid = false;
    adminApi.mockImplementation(async () => ({ content: [{ id: 9, orderCode: 9009, status: "PENDING", paymentMethod: "PAYOS", paymentStatus: paid ? "PAID" : "PENDING", customer: { fullName: "Khách thử" }, totalAmount: 299000 }], totalPages: 1, totalElements: 1 }));
    render(<AdminApp />, { wrapper });
    await waitFor(() => expect(screen.getAllByLabelText("Trạng thái thanh toán")[0].textContent).toBe("Chờ thanh toán"));
    paid = true;
    fireEvent.click(screen.getByRole("button", { name: "Tải lại trạng thái thanh toán" }));
    await waitFor(() => expect(screen.getAllByLabelText("Trạng thái thanh toán")[0].textContent).toBe("Đã thanh toán"));
    expect(screen.getAllByText("Chờ xác nhận").length).toBeGreaterThan(0);
  });

  it("requires a cancellation reason, preserves it on failure and confirms before sending", async () => {
    window.history.replaceState({}, "", "/manager/orders");
    const order = { id: 9, orderCode: 9009, status: "CONFIRMED", items: [] };
    adminApi.mockImplementation(async (url, options) => {
      if (options?.method === "PATCH") throw new Error("Không lưu được");
      return { content: [order], totalPages: 1 };
    });
    render(<AdminApp />, { wrapper });
    const selects = await screen.findAllByLabelText("Cập nhật trạng thái đơn 9009");
    fireEvent.change(selects[0], { target: { value: "CANCELLED" } });
    expect(adminApi.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(false);
    expect(screen.getByRole("button", { name: "Xác nhận hủy" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.change(selects[0], { target: { value: "CANCELLED" } });
    fireEvent.change(screen.getByLabelText("Lý do hủy đơn"), { target: { value: " Hết hàng " } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Lý do hủy đơn").value).toBe(" Hết hàng ");
    expect(adminApi).toHaveBeenCalledWith("/api/manager/orders/9/status", { method: "PATCH", body: { status: "CANCELLED", reason: "Hết hàng" } });
  });

  it("supplements the reason on a legacy cancelled order", async () => {
    window.history.replaceState({}, "", "/manager/orders");
    const order = { id: 9, orderCode: 9009, status: "CANCELLED", items: [] };
    adminApi.mockImplementation(async (url, options) => {
      if (options?.method === "PATCH") { order.cancelReason = options.body.reason; return { ...order }; }
      return url === "/api/manager/orders/9" ? { ...order } : { content: [order], totalPages: 1 };
    });
    render(<AdminApp />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Chi tiết" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bổ sung lý do", exact: true }));
    fireEvent.change(screen.getByLabelText("Lý do hủy đơn"), { target: { value: "Không giao được" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu lý do" }));
    await screen.findByText("Không giao được");
    expect(screen.queryByRole("button", { name: "Bổ sung lý do", exact: true })).toBeNull();
  });

  it("saves and edits a reply while preserving the draft after an API error", async () => {
    window.history.replaceState({}, "", "/manager/feedback");
    const item = { id: 7, rating: 5, comment: "Đánh giá thử", status: "NEW" };
    let fail = true;
    adminApi.mockImplementation(async (url, options) => {
      if (options?.method === "PATCH") { if (fail) throw new Error("Chưa lưu được"); Object.assign(item, options.body); return { ...item }; }
      return { content: [{ ...item }], totalPages: 1 };
    });
    render(<AdminApp />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Trả lời", exact: true }));
    expect(screen.getByRole("button", { name: "Lưu trả lời" }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nội dung trả lời"), { target: { value: " Cảm ơn bạn " } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu trả lời" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Nội dung trả lời").value).toBe(" Cảm ơn bạn ");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Lưu trả lời" }));
    await screen.findByText("Cảm ơn bạn");
    expect(adminApi).toHaveBeenCalledWith("/api/manager/feedback/7", { method: "PATCH", body: { adminResponse: "Cảm ơn bạn" } });
    fireEvent.click(screen.getByRole("button", { name: "Sửa trả lời" }));
    expect(screen.getByLabelText("Nội dung trả lời").value).toBe("Cảm ơn bạn");
  });

  it("hides and restores feedback without changing its processing status", async () => {
    window.history.replaceState({}, "", "/manager/feedback");
    const item = { id: 7, rating: 5, comment: "Đánh giá thử", status: "RESOLVED", hidden: false };
    adminApi.mockImplementation(async (url, options) => {
      if (options?.method === "PATCH") { Object.assign(item, options.body); return { ...item }; }
      return { content: [{ ...item }], totalPages: 1 };
    });
    render(<AdminApp />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Ẩn", exact: true }));
    await screen.findByText("Đã ẩn");
    expect(adminApi).toHaveBeenCalledWith("/api/manager/feedback/7", { method: "PATCH", body: { hidden: true } });
    expect(screen.getByLabelText("Trạng thái phản hồi 7").value).toBe("RESOLVED");
    fireEvent.click(screen.getByRole("button", { name: "Hiện lại" }));
    await screen.findByText("Công khai");
  });

  it("confirms feedback deletion, retains errors and returns from an emptied last page", async () => {
    window.history.replaceState({}, "", "/manager/feedback");
    let fail = true, deleted = false;
    adminApi.mockImplementation(async (url, options) => {
      if (options?.method === "DELETE") { if (fail) throw new Error("Xóa thất bại"); deleted = true; return null; }
      return { content: [{ id: 7, rating: 5, comment: "Phản hồi cuối", hidden: false }], totalPages: deleted ? 1 : 2, totalElements: 11 };
    });
    render(<AdminApp />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Sau" }));
    await waitFor(() => expect(adminApi.mock.calls.some(([url]) => url.includes("page=1"))).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: "Xóa", exact: true }));
    expect(adminApi.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("dialog")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(adminApi.mock.calls.at(-1)[0]).toContain("page=0"));
  });

  it("creates choice questions and explicitly unpublishes surveys", async () => {
    window.history.replaceState({}, "", "/manager/surveys");
    adminApi.mockResolvedValue({ content: [{ id: 8, title: "Khảo sát cũ", status: "PUBLISHED" }], totalPages: 1 });
    render(<AdminApp />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Gỡ phát hành" }));
    await waitFor(() => expect(adminApi).toHaveBeenCalledWith("/api/manager/surveys/8/publish?value=false", { method: "PATCH" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo khảo sát" }));
    fireEvent.change(screen.getByLabelText("Tên khảo sát"), { target: { value: "Khảo sát mới" } });
    fireEvent.change(screen.getByLabelText("Nội dung câu hỏi 1"), { target: { value: "Bạn thích gì?" } });
    fireEvent.change(screen.getByLabelText("Câu 1, phương án 1"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Câu 1, phương án 2"), { target: { value: "B" } });
    fireEvent.change(screen.getByLabelText("Kiểu câu hỏi 1"), { target: { value: "MULTIPLE_CHOICE" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
    await waitFor(() => expect(adminApi).toHaveBeenCalledWith("/api/manager/surveys", { method: "POST", body: { title: "Khảo sát mới", description: "", audience: "ALL", customerIds: [], reward: expect.objectContaining({enabled:false}), questions: [{ text: "Bạn thích gì?", type: "MULTIPLE_CHOICE", required: true, optionsJson: '["A","B"]' }] } }));
  });

  it("opens and closes survey creation dialog and allows adding questions", async () => {
    window.history.replaceState({}, "", "/manager/surveys");
    adminApi.mockResolvedValue({ content: [], totalPages: 0, totalElements: 0 });
    render(<AdminApp />, { wrapper });
    await screen.findByRole("heading", { name: "Khảo sát", level: 1 });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tạo khảo sát" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Tạo khảo sát mới")).toBeTruthy();

    expect(screen.getByText("Câu hỏi 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thêm câu hỏi mới" }));
    expect(screen.getByText("Câu hỏi 2")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Xóa câu hỏi" })[1]);
    expect(screen.queryByText("Câu hỏi 2")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("loads customer analytics and switches to anonymous survey results", async () => {
    window.history.replaceState({}, "", "/manager/reports");
    adminApi.mockImplementation(async url => {
      if (url.endsWith("/customers")) return { total: 4, active: 3, locked: 1, knownAge: 2, knownPreferences: 1, ages: [{ label: "18–24", count: 2, percent: 50 }], preferences: [] };
      if (url.includes("/results")) return { title: "Khảo sát thử", responses: 2, questions: [{ id: 1, text: "Chọn màu", type: "MULTIPLE_CHOICE", answered: 2, skipped: 0, invalid: 0, options: [{ label: "Đen", count: 2, percent: 100 }] }] };
      return { content: [{ id: 8, title: "Khảo sát thử", status: "PUBLISHED", responses: 2 }], totalPages: 1 };
    });
    render(<AdminApp />, { wrapper });
    await screen.findByText("Phân bố độ tuổi");
    fireEvent.click(screen.getByRole("button", { name: "Kết quả khảo sát" }));
    fireEvent.change(await screen.findByLabelText("Chọn khảo sát"), { target: { value: "8" } });
    await screen.findByText("Đen");
    expect(screen.getByText(/Tổng tỷ lệ có thể vượt 100%/)).toBeTruthy();
    expect(adminApi.mock.calls.every(([url]) => url.startsWith("/api/manager/reports/") || url === '/api/manager/notifications/summary')).toBe(true);
  });

  it("renders actual report values and recent orders, and opens their management page", async () => {
    adminApi.mockImplementation(async (url) => {
      if (url.includes("reports/revenue")) return { totalRevenue: 1250000, orders: 7 };
      if (url.includes("reports/users")) return { customers: 42, admins: 2, lockedCustomers: 1 };
      if (url.includes("surveys/stats")) return { total: 4, published: 3, draft: 1 };
      return { content: [{ id: 11, orderCode: "ORDER-11", customer: { fullName: "Khách kiểm thử" }, totalAmount: 1250000, status: "CONFIRMED" }] };
    });
    render(<AdminApp />, { wrapper });
    await screen.findByText("#ORDER-11");
    expect(screen.getByText("Khách kiểm thử")).toBeTruthy();
    expect(screen.getByText("Tổng khách hàng")).toBeTruthy();
    expect(screen.getByText("Phân bố trạng thái trong 1 đơn mới nhất")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả" }));
    expect(window.location.pathname).toBe("/manager/orders");
  });

  it("defaults to light theme, persists a toggle and closes the mobile menu on navigation", async () => {
    const { container } = render(<AdminApp />, { wrapper });
    await screen.findByRole("heading", { name: "Tổng quan", level: 1 });
    expect(container.querySelector(".admin-shell").dataset.theme).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang giao diện tối" }));
    expect(window.localStorage.getItem("manager-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Mở menu quản lý" }));
    expect(screen.getByRole("button", { name: "Đóng menu quản lý" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(screen.getByRole("button", { name: "Đóng menu quản lý" }), { key: 'Escape' });
    expect(screen.getByRole("button", { name: "Mở menu quản lý" }).getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Mở menu quản lý" }));
    fireEvent.click(screen.getByRole("button", { name: "Khách hàng", exact: true }));
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Mở menu quản lý" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Khách hàng", exact: true }).getAttribute("aria-current")).toBe("page");
  });

  it("collapses the sidebar from the brand, keeps navigation accessible and restores the state", async () => {
    const view = render(<AdminApp />, { wrapper });
    await screen.findByRole("heading", { name: "Tổng quan", level: 1 });
    const toggle = screen.getByRole("button", { name: "Thu gọn thanh điều hướng" });
    expect(toggle.closest(".admin-brand")).toBeTruthy();
    expect(toggle.getAttribute("aria-controls")).toBe("manager-sidebar");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(view.container.querySelector("#manager-sidebar").className).toContain("is-collapsed");
    expect(window.localStorage.getItem("manager-sidebar-collapsed")).toBe("true");
    expect(screen.getByRole("button", { name: "Mở rộng thanh điều hướng" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Khách hàng", exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đăng xuất", exact: true })).toBeTruthy();
    view.unmount();
    const remount = render(<AdminApp />, { wrapper });
    await screen.findByRole("heading", { name: "Tổng quan", level: 1 });
    expect(remount.container.querySelector("#manager-sidebar").className).toContain("is-collapsed");
    fireEvent.click(screen.getByRole("button", { name: "Mở rộng thanh điều hướng" }));
    expect(remount.container.querySelector("#manager-sidebar").className).not.toContain("is-collapsed");
    expect(window.localStorage.getItem("manager-sidebar-collapsed")).toBe("false");
  });

  it("navigates through every sidebar page using only admin APIs", async () => {
    render(<AdminApp />, { wrapper });
    await screen.findByRole("heading", { name: "Tổng quan", level: 1 });
    for (const [label, route] of pages) {
      fireEvent.click(screen.getByRole("button", { name: label, exact: true }));
      expect(window.location.pathname).toBe(`/manager/${route}`);
      expect(screen.getByRole("heading", { name: label, level: 1 })).toBeTruthy();
      await screen.findByRole("table");
      expect(adminApi.mock.calls.some(([url]) => url.startsWith(`/api/manager/${route}`))).toBe(true);
    }
    expect(adminApi.mock.calls.every(([url]) => url.startsWith("/api/manager/"))).toBe(true);
  });

  it.each(pages)("renders %s when loaded directly", async (label, route) => {
    window.history.replaceState({}, "", `/manager/${route}`);
    render(<AdminApp />, { wrapper });
    await screen.findByRole("heading", { name: label, level: 1 });
    await screen.findByRole("table");
  });

  it("shows an API failure and recovers using Retry", async () => {
    window.history.replaceState({}, "", "/manager/users");
    adminApi.mockRejectedValue(new Error("API unavailable"));
    render(<AdminApp />, { wrapper });
    await screen.findByText("API unavailable");
    adminApi.mockResolvedValue({ content: [] });
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("table");
    expect(screen.queryByText("API unavailable")).toBeNull();
  });

  it("handles popstate and falls back from invalid routes", async () => {
    render(<AdminApp />, { wrapper });
    await screen.findByRole("heading", { name: "Tổng quan", level: 1 });
    act(() => {
      window.history.replaceState({}, "", "/manager/orders");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await screen.findByRole("table");
    expect(screen.getByRole("heading", { name: "Đơn hàng", level: 1 })).toBeTruthy();
    act(() => {
      window.history.replaceState({}, "", "/manager/invalid");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await screen.findByRole("heading", { name: "Tổng quan", level: 1 });
    expect(window.location.pathname).toBe("/manager");
  });
});

it.each(['getItem', 'setItem'])('keeps the sidebar usable when %s fails', async (method) => {
 const original = Storage.prototype[method];
 const storage = vi.spyOn(Storage.prototype, method).mockImplementation(function (key, ...args) {
   if (key === 'manager-sidebar-collapsed') throw new DOMException('Storage unavailable', 'SecurityError');
   return original.call(this, key, ...args);
 });
 try {
   const view = render(<AdminApp/>);
   const toggle = await screen.findByRole('button', {name:'Thu gọn thanh điều hướng'});
   expect(toggle.getAttribute('aria-expanded')).toBe('true');
   fireEvent.click(toggle);
   expect(screen.getByRole('button', {name:'Mở rộng thanh điều hướng'}).getAttribute('aria-expanded')).toBe('false');
   expect(view.container.querySelector('#manager-sidebar').className).toContain('is-collapsed');
   fireEvent.click(screen.getByRole('button', {name:'Mở rộng thanh điều hướng'}));
   expect(screen.getByRole('button', {name:'Thu gọn thanh điều hướng'}).getAttribute('aria-expanded')).toBe('true');
   expect(storage.mock.calls.some(([key]) => key === 'manager-sidebar-collapsed')).toBe(true);
 } finally {
   storage.mockRestore();
 }
});
