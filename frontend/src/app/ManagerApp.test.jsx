// @vitest-environment jsdom
import React, { StrictMode } from "react";
import { act, cleanup, configure, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ManagerApp, { useAdminList } from "./ManagerApp";
import { adminApi, adminRefreshSession, managerChangePassword } from "../api/manager-api";

vi.mock("../api/manager-api", async (importOriginal) => ({
  ...(await importOriginal()),
  adminApi: vi.fn(),
  adminRefreshSession: vi.fn(),
  managerChangePassword: vi.fn(),
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
  window.history.replaceState({}, "", "/manager/dashboard");
  window.localStorage.clear();
  adminRefreshSession.mockResolvedValue({ manager: { fullName: "Test Admin", role: "MANAGER_SALES" } });
  adminApi.mockResolvedValue({ content: [] });
  managerChangePassword.mockResolvedValue(undefined);
});
afterEach(cleanup);
it('keeps care, support, and personal-task modules retired while restoring reports', async () => {
  window.history.replaceState({}, "", "/manager");
  render(<ManagerApp />);
  const navigation = await screen.findByRole("navigation", { name: "Chức năng quản lý" });
  for (const label of ["Chăm sóc khách hàng", "Việc của tôi", "Hiệu quả chăm sóc", "Phiếu hỗ trợ"]) {
    expect([...navigation.querySelectorAll("a,button")].some(item => item.textContent.includes(label))).toBe(false);
  }
  expect([...navigation.querySelectorAll("a,button")].some(item => item.textContent.includes("Báo cáo"))).toBe(true);
  expect(screen.queryByRole("heading", { name: "Việc của tôi" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Báo cáo khách hàng" })).toBeNull();
});

it('allows a manager to change their password from the account menu', async () => {
  window.history.replaceState({}, '', '/manager');
  render(<ManagerApp />, { wrapper });

  fireEvent.click(await screen.findByRole('button', { name: 'Đổi mật khẩu' }));
  const dialog = screen.getByRole('dialog', { name: 'Đổi mật khẩu cá nhân' });
  fireEvent.change(screen.getByLabelText('MẬT KHẨU HIỆN TẠI'), { target: { value: 'OldPassword123!' } });
  fireEvent.change(screen.getByLabelText('MẬT KHẨU MỚI (TỐI THIỂU 8 KÝ TỰ)'), { target: { value: 'NewPassword456!' } });
  fireEvent.change(screen.getByLabelText('XÁC NHẬN MẬT KHẨU MỚI'), { target: { value: 'NewPassword456!' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Đổi mật khẩu' }));

  await waitFor(() => expect(managerChangePassword).toHaveBeenCalledWith('OldPassword123!', 'NewPassword456!'));
});

it.each(["care", "my-tasks", "care-dashboard", "support-tickets"])("redirects retired manager route /manager/%s", async section => {
  window.history.replaceState({}, "", `/manager/${section}`);
  render(<ManagerApp />);
  await waitFor(() => expect(window.location.pathname).toBe("/manager/orders"));
  expect(screen.queryByText("Chăm sóc khách hàng")).toBeNull();
  expect(screen.queryByText("Phiếu hỗ trợ")).toBeNull();
});

it('opens the reports route and keeps its period filters in the URL', async () => {
  window.history.replaceState({}, '', '/manager/reports?year=2026&month=2');
  render(<ManagerApp/>);
  expect(await screen.findByRole('combobox', { name: 'Loại thống kê' })).toBeTruthy();
  expect(window.location.pathname).toBe('/manager/reports');
  expect(window.location.search).toBe('?year=2026&month=2');
  expect(screen.getByRole('button', { name: 'Báo cáo' }).getAttribute('aria-current')).toBe('page');
});

it('removes manager supplier tools and redirects the retired route', async () => {
  window.history.replaceState({}, '', '/manager/suppliers');
  render(<ManagerApp/>);
  await waitFor(() => expect(window.location.pathname).toBe('/manager'));
  expect(screen.queryByText(/nhà cung cấp/i)).toBeNull();
  expect(screen.queryByText('Đối tác cung cấp')).toBeNull();
  expect(adminApi.mock.calls.some(([url]) => url.includes('/suppliers'))).toBe(false);
});
it('keeps the invoices section instead of redirecting to the dashboard', async () => {
  window.history.replaceState({}, '', '/manager/invoices');
  render(<ManagerApp/>);
  await waitFor(() => expect(adminApi.mock.calls.some(([url]) => String(url).startsWith('/api/manager/orders?'))).toBe(true));
  expect(window.location.pathname).toBe('/manager/invoices');
});

it.each([
  ['MANAGER_SALES', '/manager/orders', ['Đơn hàng', 'Khách hàng', 'Báo cáo', 'Chiến dịch khuyến mãi'], ['Nhập kho', 'Nguyên liệu', 'Công thức sản phẩm', 'Kế hoạch sản xuất', 'Duyệt yêu cầu kho', 'Báo cáo kho', 'Nhân viên']],
  ['MANAGER_WAREHOUSE', '/manager/products', ['Sản phẩm', 'Nhập kho', 'Nguyên liệu', 'Công thức sản phẩm', 'Kế hoạch sản xuất', 'Duyệt yêu cầu kho', 'Báo cáo kho'], ['Đơn hàng', 'Nhân viên', 'Tổng quan']],
  ['MANAGER_HR', '/manager/employees', ['Nhân viên', 'Duyệt đơn nghỉ', 'Chấm công', 'Bảng lương', 'Báo cáo nhân sự'], ['Đơn hàng', 'Sản phẩm', 'Nhập kho', 'Nguyên liệu', 'Công thức sản phẩm', 'Kế hoạch sản xuất', 'Duyệt yêu cầu kho', 'Báo cáo kho', 'Tổng quan']],
])('routes %s to its landing page and filters navigation', async (role, landing, visible, hidden) => {
  window.history.replaceState({}, '', '/manager');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Role test', role } });
  render(<ManagerApp />, { wrapper });
  const heading = landing === '/manager/products' ? 'Sản phẩm' : landing === '/manager/employees' ? 'Nhân viên' : 'Đơn hàng';
  await screen.findByRole('heading', { name: heading, level: 1 });
  expect(window.location.pathname).toBe(landing);
  const navigation = screen.getByRole('navigation', { name: 'Chức năng quản lý' });
  for (const label of visible) expect([...navigation.querySelectorAll('button')].some(item => item.textContent.includes(label))).toBe(true);
  for (const label of hidden) expect([...navigation.querySelectorAll('button')].some(item => item.textContent.includes(label))).toBe(false);
});

it('routes employees to self-service pages without HR payroll navigation', async () => {
  window.history.replaceState({}, '', '/manager');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Employee', role: 'EMPLOYEE' } });
  adminApi.mockImplementation(async url => url === '/api/manager/me/profile'
    ? { id: 42, fullName: 'Employee', employeeCode: 'E-42', permissionProfile: 'STAFF', employmentStatus: 'ACTIVE' }
    : { content: [] });

  render(<ManagerApp />, { wrapper });

  await waitFor(() => expect(window.location.pathname).toBe('/manager/my-profile'));
  const navigation = screen.getByRole('navigation', { name: 'Chức năng quản lý' });
  for (const label of ['Thông tin của tôi', 'Đơn nghỉ của tôi', 'Chấm công của tôi', 'Phiếu lương của tôi']) {
    expect([...navigation.querySelectorAll('button')].some(item => item.textContent.includes(label))).toBe(true);
  }
  for (const label of ['Nguyên liệu', 'Công thức sản phẩm', 'Kế hoạch sản xuất', 'Duyệt yêu cầu kho', 'Báo cáo kho']) {
    expect([...navigation.querySelectorAll('button')].some(item => item.textContent.includes(label))).toBe(false);
  }
  for (const label of ['Bảng lương', 'Duyệt đơn nghỉ', 'Báo cáo nhân sự', 'Nhân viên trong nhóm']) {
    expect([...navigation.querySelectorAll('button')].some(item => item.textContent.includes(label))).toBe(false);
  }
});

it('adds the warehouse task page only to EMPLOYEE accounts assigned to the warehouse area', async () => {
  window.history.replaceState({}, '', '/manager');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Warehouse employee', role: 'EMPLOYEE' } });
  adminApi.mockImplementation(async url => url === '/api/manager/me/profile'
    ? { id: 43, fullName: 'Warehouse employee', employeeCode: 'E-43', workArea: 'WAREHOUSE', permissionProfile: 'STAFF', employmentStatus: 'ACTIVE' }
    : url.includes('/warehouse/me/plans?') ? { content: [], totalPages: 0, totalElements: 0 }
      : { content: [] });

  render(<ManagerApp />, { wrapper });
  const navigation = await screen.findByRole('navigation', { name: 'Chức năng quản lý' });
  expect([...navigation.querySelectorAll('button')].some(item => item.textContent.includes('Công việc kho'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Công việc kho' }));
  expect(await screen.findByRole('heading', { name: 'Công việc kho của tôi', level: 2 })).toBeTruthy();
});

it('lands team leads on their direct team directory while staff land on their own profile', async () => {
  window.history.replaceState({}, '', '/manager');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Team lead', role: 'EMPLOYEE' } });
  adminApi.mockImplementation(async url => url === '/api/manager/me/profile'
    ? { id: 42, fullName: 'Team lead', employeeCode: 'TL-42', permissionProfile: 'TEAM_LEAD', employmentStatus: 'ACTIVE' }
    : []);

  render(<ManagerApp />, { wrapper });

  await screen.findByRole('heading', { name: 'Nhân viên trong nhóm', level: 2 });
  expect(window.location.pathname).toBe('/manager/my-team');
});

it('adds team views only for employees with the TEAM_LEAD profile and redirects restricted paths', async () => {
  window.history.replaceState({}, '', '/manager/my-team');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Team lead', role: 'EMPLOYEE' } });
  adminApi.mockImplementation(async url => {
    if (url === '/api/manager/me/profile') return { id: 42, fullName: 'Team lead', employeeCode: 'TL-42', permissionProfile: 'TEAM_LEAD', employmentStatus: 'ACTIVE' };
    if (url === '/api/manager/me/team') return [];
    return { content: [] };
  });

  render(<ManagerApp />, { wrapper });

  await screen.findByRole('heading', { name: 'Nhân viên trong nhóm', level: 2 });
  const navigation = screen.getByRole('navigation', { name: 'Chức năng quản lý' });
  expect([...navigation.querySelectorAll('button')].some(item => item.textContent.includes('Nhân viên trong nhóm'))).toBe(true);
  expect([...navigation.querySelectorAll('button')].some(item => item.textContent.includes('Chấm công nhóm'))).toBe(true);
  expect([...navigation.querySelectorAll('button')].some(item => item.textContent.includes('Bảng lương'))).toBe(false);
});

it('keeps HR payroll inaccessible to a team lead even through a direct URL', async () => {
  window.history.replaceState({}, '', '/manager/payroll');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Team lead', role: 'EMPLOYEE' } });
  adminApi.mockImplementation(async url => url === '/api/manager/me/profile'
    ? { id: 42, fullName: 'Team lead', employeeCode: 'TL-42', permissionProfile: 'TEAM_LEAD', employmentStatus: 'ACTIVE' }
    : { content: [] });

  render(<ManagerApp />, { wrapper });

  await waitFor(() => expect(window.location.pathname).toBe('/manager/my-team'));
  expect(adminApi.mock.calls.some(([url]) => String(url).includes('/payroll-periods'))).toBe(false);
});

it.each([
  ['MANAGER_HR', '/manager/orders', '/manager/employees', '/api/manager/orders'],
  ['MANAGER_WAREHOUSE', '/manager/reports', '/manager/products', '/api/manager/reports'],
  ['MANAGER_SALES', '/manager/stock-receipts', '/manager/orders', '/api/manager/stock-receipts'],
  ['MANAGER_HR', '/manager/materials', '/manager/employees', '/api/manager/raw-materials'],
  ['MANAGER_SALES', '/manager/materials', '/manager/orders', '/api/manager/raw-materials'],
])('redirects %s away from restricted routes before loading their data', async (role, restricted, landing, forbiddenEndpoint) => {
  window.history.replaceState({}, '', restricted);
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Role test', role } });
  render(<ManagerApp />, { wrapper });
  await waitFor(() => expect(window.location.pathname).toBe(landing));
  expect(adminApi.mock.calls.some(([url]) => String(url).startsWith(forbiddenEndpoint))).toBe(false);
});

it('does not expose warehouse manager pages to employees outside the warehouse work area', async () => {
  window.history.replaceState({}, '', '/manager/materials');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Sales employee', role: 'EMPLOYEE' } });
  adminApi.mockImplementation(async url => url === '/api/manager/me/profile'
    ? { id: 42, fullName: 'Sales employee', employeeCode: 'E-42', workArea: 'SALES', permissionProfile: 'STAFF', employmentStatus: 'ACTIVE' }
    : { content: [] });

  render(<ManagerApp />, { wrapper });
  await waitFor(() => expect(window.location.pathname).toBe('/manager/my-profile'));
  expect(adminApi.mock.calls.some(([url]) => String(url).startsWith('/api/manager/raw-materials'))).toBe(false);
});

it('shows Sales product lookup without write controls while Warehouse retains them', async () => {
  window.history.replaceState({}, '', '/manager/products');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Sales', role: 'MANAGER_SALES' } });
  const sales = render(<ManagerApp />, { wrapper });
  await screen.findByRole('heading', { name: 'Sản phẩm', level: 1 });
  expect(screen.queryByRole('button', { name: 'Thêm sản phẩm' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Sửa', exact: true })).toBeNull();
  sales.unmount();

  window.history.replaceState({}, '', '/manager/products');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Warehouse', role: 'MANAGER_WAREHOUSE' } });
  render(<ManagerApp />, { wrapper });
  await screen.findByRole('heading', { name: 'Sản phẩm', level: 1 });
  expect(await screen.findByRole('button', { name: 'Thêm sản phẩm' })).toBeTruthy();
});

describe("manager list lifecycle", () => {
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
describe("manager navigation", () => {
  it("requires a reason before locking a customer and sends it to the manager API", async () => {
    window.history.replaceState({}, "", "/manager/users");
    adminApi.mockResolvedValue({ content: [{ id: 5, fullName: "Khách thử", email: "customer@example.com", locked: false }], totalPages: 1 });
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
    await screen.findByText("Khách thử");
    fireEvent.click(screen.getByRole("button", { name: "Xóa", exact: true }));
    expect(screen.getByText(/Đơn hàng cũ vẫn được giữ lại/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa tài khoản" }));
    await waitFor(() => expect(adminApi).toHaveBeenCalledWith("/api/manager/users/5", { method: "DELETE" }));
  });

  it("filters orders, pages and loads details from real manager endpoints", async () => {
    window.history.replaceState({}, "", "/manager/orders");
    adminApi.mockImplementation(async url => url === "/api/manager/orders/9" ? { id: 9, orderCode: 9009, status: "CONFIRMED", customer: { fullName: "Khách thử" }, paymentMethod: "COD", paymentStatus: "COD", totalAmount: 299000, items: [] } : { content: [{ id: 9, orderCode: 9009, status: "CONFIRMED", customer: { fullName: "Khách thử" }, totalAmount: 299000 }], totalPages: 2, totalElements: 11 });
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
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

  it("renders recent orders without report metrics and opens their management page", async () => {
    adminApi.mockImplementation(async (_url) => {
      return { content: [{ id: 11, orderCode: "ORDER-11", customer: { fullName: "Khách kiểm thử" }, totalAmount: 1250000, status: "CONFIRMED" }] };
    });
    render(<ManagerApp />, { wrapper });
    await screen.findByText("#ORDER-11");
    expect(screen.getByText("Khách kiểm thử")).toBeTruthy();
    expect(adminApi.mock.calls.every(([url]) => !url.includes("/reports/") && !url.endsWith("/surveys/stats"))).toBe(true);
    expect(screen.queryByText("Tổng khách hàng")).toBeNull();
    expect(screen.getByText("Phân bố trạng thái trong 1 đơn mới nhất")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả" }));
    expect(window.location.pathname).toBe("/manager/orders");
  });

  it("defaults to light theme, persists a toggle and closes the mobile menu on navigation", async () => {
    const { container } = render(<ManagerApp />, { wrapper });
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
    const view = render(<ManagerApp />, { wrapper });
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
    const remount = render(<ManagerApp />, { wrapper });
    await screen.findByRole("heading", { name: "Tổng quan", level: 1 });
    expect(remount.container.querySelector("#manager-sidebar").className).toContain("is-collapsed");
    fireEvent.click(screen.getByRole("button", { name: "Mở rộng thanh điều hướng" }));
    expect(remount.container.querySelector("#manager-sidebar").className).not.toContain("is-collapsed");
    expect(window.localStorage.getItem("manager-sidebar-collapsed")).toBe("false");
  });

  it("navigates through every sidebar page using only admin APIs", async () => {
    render(<ManagerApp />, { wrapper });
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
    render(<ManagerApp />, { wrapper });
    await screen.findByRole("heading", { name: label, level: 1 });
    await screen.findByRole("table");
  });

  it("shows an API failure and recovers using Retry", async () => {
    window.history.replaceState({}, "", "/manager/users");
    adminApi.mockRejectedValue(new Error("API unavailable"));
    render(<ManagerApp />, { wrapper });
    await screen.findByText("API unavailable");
    adminApi.mockResolvedValue({ content: [] });
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("table");
    expect(screen.queryByText("API unavailable")).toBeNull();
  });

  it("handles popstate and falls back from invalid routes", async () => {
    render(<ManagerApp />, { wrapper });
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
    await screen.findByRole("heading", { name: "Đơn hàng", level: 1 });
    expect(window.location.pathname).toBe("/manager/orders");
  });
});

it.each(['getItem', 'setItem'])('keeps the sidebar usable when %s fails', async (method) => {
 const original = Storage.prototype[method];
 const storage = vi.spyOn(Storage.prototype, method).mockImplementation(function (key, ...args) {
   if (key === 'manager-sidebar-collapsed') throw new DOMException('Storage unavailable', 'SecurityError');
   return original.call(this, key, ...args);
 });
 try {
   const view = render(<ManagerApp/>);
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
