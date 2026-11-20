// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManagerProducts from "./ManagerProducts";
import { adminEndpoints } from "../../../api/manager-api";

const mocks = vi.hoisted(() => ({
  adminApi: vi.fn(),
  useManagerList: vi.fn(),
  changeFilters: vi.fn(),
  filters: {
    q: "",
    category: "",
    minPrice: "",
    maxPrice: "",
    stock: "ALL",
    active: "true",
    sort: "createdAt",
    direction: "DESC",
    page: "0",
  },
  product: {
    id: 7,
    name: "Polo dệt kim",
    category: "Áo polo",
    price: 599000,
    stock: 12,
    description: "Mẫu polo dệt kim.",
    imageUrl: "https://images.example.test/default.jpg",
    colors: "Nâu,Đen",
    colorImages: {
      Nâu: ["https://images.example.test/brown.jpg"],
      "Đen": ["https://images.example.test/black.jpg"],
    },
  },
}));

vi.mock("../../../shared/hooks/useManagerResource", () => ({
  useManagerList: mocks.useManagerList,
  useManagerReadPause: vi.fn(),
}));

vi.mock("../../../shared/hooks/useManagerFilters", () => ({
  useManagerFilters: () => [mocks.filters, mocks.changeFilters],
}));

vi.mock("../../../api/manager-api", () => ({
  adminApi: mocks.adminApi,
  adminEndpoints: {
    products: vi.fn(() => "/api/manager/products"),
    product: id => `/api/manager/products/${id}`,
  },
}));

function renderProducts() {
  const notify = vi.fn();
  render(<ManagerProducts notify={notify} />);
  return { notify };
}

beforeEach(() => {
  mocks.filters.stock = "ALL";
  mocks.adminApi.mockResolvedValue({});
  mocks.useManagerList.mockImplementation(endpoint => {
    const path = endpoint();
    if (path === "/api/manager/products/categories") return { data: [] };
    return { data: { content: [mocks.product], totalElements: 1 }, loading: false, error: null, stale: false, load: vi.fn() };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("edits color galleries, previews URLs, and submits ordered image lists", async () => {
  renderProducts();
  fireEvent.click(screen.getByRole("button", { name: "Sửa" }));

  const brownImage = screen.getByLabelText("URL ảnh Nâu 1");
  expect(brownImage.value).toBe("https://images.example.test/brown.jpg");
  expect(screen.getByRole("img", { name: "Ảnh xem trước màu Nâu 1" }).getAttribute("src"))
    .toBe("https://images.example.test/brown.jpg");

  fireEvent.click(screen.getByRole("button", { name: "Thêm ảnh cho màu Nâu" }));
  const secondBrownImage = screen.getByLabelText("URL ảnh Nâu 2");
  fireEvent.change(secondBrownImage, { target: { value: "/uploads/brown-detail.jpg" } });
  expect(secondBrownImage.checkValidity()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Xóa ảnh Nâu 1" }));

  fireEvent.click(screen.getByRole("button", { name: "Cập nhật sản phẩm" }));
  await waitFor(() => expect(mocks.adminApi).toHaveBeenCalledTimes(1));
  expect(mocks.adminApi).toHaveBeenCalledWith("/api/manager/products/7", expect.objectContaining({
    method: "PUT",
    body: expect.objectContaining({
      colors: "Nâu,Đen",
      colorImages: {
        Nâu: ["/uploads/brown-detail.jpg"],
        Đen: ["https://images.example.test/black.jpg"],
      },
    }),
  }));
});

it("creates a product with colors and no gallery URLs", async () => {
  renderProducts();
  fireEvent.click(screen.getByRole("button", { name: "Thêm sản phẩm" }));
  fireEvent.change(screen.getByLabelText("TÊN SẢN PHẨM *"), { target: { value: "Áo mới" } });
  fireEvent.change(screen.getByLabelText("DANH MỤC *"), { target: { value: "Áo thun" } });
  fireEvent.change(screen.getByLabelText("GIÁ BÁN (VNĐ) *"), { target: { value: "300000" } });
  fireEvent.change(screen.getByLabelText("TỒN KHO *"), { target: { value: "8" } });
  fireEvent.change(screen.getByLabelText("MÀU SẮC (phân cách bằng dấu phẩy)"), { target: { value: "Đen,Trắng" } });

  fireEvent.click(screen.getByRole("button", { name: "Tạo sản phẩm mới" }));
  await waitFor(() => expect(mocks.adminApi).toHaveBeenCalledTimes(1));
  expect(mocks.adminApi).toHaveBeenCalledWith("/api/manager/products", expect.objectContaining({
    method: "POST",
    body: expect.objectContaining({ colors: "Đen,Trắng", colorImages: {} }),
  }));
});

it("blocks submission when a color image URL is invalid", () => {
  renderProducts();
  fireEvent.click(screen.getByRole("button", { name: "Thêm sản phẩm" }));
  fireEvent.change(screen.getByLabelText("TÊN SẢN PHẨM *"), { target: { value: "Áo mới" } });
  fireEvent.change(screen.getByLabelText("DANH MỤC *"), { target: { value: "Áo thun" } });
  fireEvent.change(screen.getByLabelText("GIÁ BÁN (VNĐ) *"), { target: { value: "300000" } });
  fireEvent.change(screen.getByLabelText("TỒN KHO *"), { target: { value: "8" } });
  fireEvent.change(screen.getByLabelText("MÀU SẮC (phân cách bằng dấu phẩy)"), { target: { value: "Đen" } });
  const imageInput = screen.getByLabelText("URL ảnh Đen 1");
  fireEvent.change(imageInput, { target: { value: "not a URL" } });

  expect(imageInput.checkValidity()).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Tạo sản phẩm mới" }));
  expect(mocks.adminApi).not.toHaveBeenCalled();
});

function setProductRows(rows) {
  mocks.useManagerList.mockImplementation(endpoint => endpoint() === "/api/manager/products/categories"
    ? { data: [] }
    : { data: { content: rows, totalElements: rows.length }, loading: false, error: null, stale: false, load: vi.fn() });
}

it("includes stock five in the low-stock page filter and excludes zero and six", () => {
  mocks.filters.stock = "LOW";
  setProductRows([0, 5, 6].map(stock => ({ ...mocks.product, id: stock + 10, name: "Stock " + stock, stock })));
  renderProducts();
  expect(screen.getByText("Stock 5")).toBeTruthy();
  expect(screen.queryByText("Stock 0")).toBeNull();
  expect(screen.queryByText("Stock 6")).toBeNull();
  expect(adminEndpoints.products).toHaveBeenLastCalledWith(expect.objectContaining({ stock: "AVAILABLE" }));
});

it("opens the low-stock filter from the page warning", () => {
  setProductRows([{ ...mocks.product, stock: 5 }]);
  renderProducts();
  fireEvent.click(screen.getByRole("button", { name: "Lọc hàng sắp hết" }));
  expect(mocks.changeFilters).toHaveBeenCalledWith({ stock: "LOW" });
});
