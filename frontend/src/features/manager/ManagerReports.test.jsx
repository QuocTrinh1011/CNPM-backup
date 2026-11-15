// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManagerReports from "./ManagerReports";
import { adminApi, adminEndpoints } from "../../api/manager-api";

vi.mock("../../api/manager-api", async importOriginal => ({
  ...(await importOriginal()),
  adminApi: vi.fn(),
}));

const report = year => ({
  year,
  month: 2,
  availableYears: [year, year - 1],
  summary: {
    totalIncome: 125000000,
    totalExpense: 80000000,
    netBalance: 45000000,
    paidOrdersCount: 142,
    stockReceiptsCount: 18,
  },
  trend: [
    { label: "01/02", income: 1000000, expense: 500000 },
    { label: "02/02", income: 0, expense: 0 },
  ],
  topProducts: [{ productId: 12, productName: "Áo Polo Classic", categoryName: "Áo Polo", color: "Xanh Navy", size: "L", quantitySold: 54, totalRevenue: 18900000 }],
  topCustomers: [{ customerId: 88, fullName: "Nguyễn Văn An", email: "an@example.test", orderCount: 6, totalSpent: 7500000 }],
  employeeActivities: [{ employeeId: null, fullName: "Hệ thống / Không xác định", email: null, receiptCount: 1, totalReceiptCost: 2500000 }],
});

const renderReports = (location = `/manager/reports?year=${new Date().getFullYear()}&month=2`) => {
  const go = vi.fn();
  render(<ManagerReports location={location} go={go} />);
  return { go };
};

beforeEach(() => {
  vi.clearAllMocks();
  adminApi.mockResolvedValue(report(new Date().getFullYear()));
});
afterEach(cleanup);

it("defaults to the current year, shows totals and popular products first", async () => {
  renderReports();

  expect(await screen.findByRole("heading", { name: "Tổng thu" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Tổng chi nhập kho" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Chênh lệch" })).toBeTruthy();
  const year = screen.getByRole("combobox", { name: "Năm báo cáo" });
  expect(year.value).toBe(String(new Date().getFullYear()));
  expect([...year.options].map(option => option.value)).toEqual([
    String(new Date().getFullYear()), String(new Date().getFullYear() - 1),
  ]);
  expect(await screen.findByRole("table", { name: "Sản phẩm nổi bật" })).toBeTruthy();
  expect(screen.getByText("Áo Polo Classic")).toBeTruthy();
  expect(screen.getByText("Xanh Navy")).toBeTruthy();
});

it("switches the detail report without reloading the shared report payload", async () => {
  renderReports();
  const type = await screen.findByRole("combobox", { name: "Loại thống kê" });
  expect(await screen.findByRole("table", { name: "Sản phẩm nổi bật" })).toBeTruthy();

  fireEvent.change(type, { target: { value: "customers" } });
  expect(await screen.findByRole("table", { name: "Khách hàng mua nhiều" })).toBeTruthy();
  expect(screen.getByText("Nguyễn Văn An")).toBeTruthy();
  fireEvent.change(type, { target: { value: "employees" } });
  expect(await screen.findByRole("table", { name: "Hoạt động nhập kho theo nhân viên" })).toBeTruthy();
  expect(screen.getByText("Hệ thống / Không xác định")).toBeTruthy();
  expect(adminApi).toHaveBeenCalledTimes(1);
});

it("keeps variants with null and empty color values as distinct rows", async () => {
  const payload = report(new Date().getFullYear());
  payload.topProducts = [
    { productId: 12, productName: "Áo", categoryName: "Áo", color: null, size: "M", quantitySold: 1, totalRevenue: 10 },
    { productId: 12, productName: "Áo", categoryName: "Áo", color: "", size: "M", quantitySold: 1, totalRevenue: 10 },
  ];
  adminApi.mockResolvedValueOnce(payload);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    renderReports();
    const table = await screen.findByRole("table", { name: "Sản phẩm nổi bật" });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(errorSpy.mock.calls.flat().join(" ")).not.toMatch(/same key/i);
  } finally {
    errorSpy.mockRestore();
  }
});

it("writes year and month filters to the Manager route", async () => {
  const { go } = renderReports("/manager/reports?year=2026&month=2");
  const month = await screen.findByRole("combobox", { name: "Tháng báo cáo" });
  fireEvent.change(month, { target: { value: "" } });
  expect(go).toHaveBeenLastCalledWith("reports?year=2026");
  fireEvent.change(screen.getByRole("combobox", { name: "Năm báo cáo" }), { target: { value: "2025" } });
  expect(go).toHaveBeenLastCalledWith("reports?year=2025&month=2");
});

it("offers retry after report API failure", async () => {
  adminApi.mockRejectedValueOnce(new Error("Máy chủ đang bận"))
    .mockResolvedValueOnce(report(new Date().getFullYear()));
  renderReports();

  expect(await screen.findByText("Máy chủ đang bận")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByRole("table", { name: "Sản phẩm nổi bật" })).toBeTruthy();
  await waitFor(() => expect(adminApi).toHaveBeenCalledTimes(2));
});

it("builds an encoded report URL and omits month for annual reports", () => {
  expect(adminEndpoints.reports({ year: 2026, month: 11 })).toBe("/api/manager/reports?year=2026&month=11");
  expect(adminEndpoints.reports({ year: 2026 })).toBe("/api/manager/reports?year=2026");
});
