// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProductCard, ProductModal } from "./ProductDetails";

const product = {
  id: 42,
  name: "Polo dệt kim",
  category: "Áo polo",
  description: "Mẫu polo mềm, dễ mặc.",
  price: 599000,
  stock: 5,
  imageUrl: "/brown-front.jpg",
  colors: "Nâu,Đen",
  sizes: "S,M,L",
  colorImages: {
    Nâu: ["/brown-front.jpg", "/brown-detail.jpg"],
    Đen: ["/black-front.jpg", "/black-detail.jpg"],
  },
};

afterEach(cleanup);

it("uses the first color gallery image on the product card", () => {
  render(<ProductCard product={{ ...product, imageUrl: "/legacy.jpg" }} onOpen={vi.fn()} />);

  expect(screen.getByRole("img", { name: "Polo dệt kim" }).getAttribute("src"))
    .toBe("/brown-front.jpg");
});

it("switches image galleries by color and sends the selected color and size to the cart", async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined);
  render(
    <ProductModal
      page
      data={{ product, feedback: [] }}
      user={null}
      onClose={vi.fn()}
      onAdd={onAdd}
      onLogin={vi.fn()}
    />
  );

  expect(screen.getByRole("img", { name: "Polo dệt kim màu Nâu" }).getAttribute("src"))
    .toBe("/brown-front.jpg");
  fireEvent.click(screen.getByRole("button", { name: "Đen" }));
  expect(screen.getByRole("img", { name: "Polo dệt kim màu Đen" }).getAttribute("src"))
    .toBe("/black-front.jpg");
  expect(screen.getByRole("button", { name: "Đen" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "M" }).getAttribute("aria-pressed")).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Ảnh 2 màu Đen" }));
  expect(screen.getByRole("img", { name: "Polo dệt kim màu Đen" }).getAttribute("src"))
    .toBe("/black-detail.jpg");
  fireEvent.click(screen.getByRole("button", { name: "THÊM 1 VÀO GIỎ" }));

  await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ size: "M", color: "Đen" }, 1));
});

it("shows the legacy product image after selecting a color without a mapped gallery", () => {
  render(
    <ProductModal
      page
      data={{ product: { ...product, imageUrl: "/legacy.jpg", colorImages: {} }, feedback: [] }}
      user={null}
      onClose={vi.fn()}
      onAdd={vi.fn()}
      onLogin={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Đen" }));
  expect(screen.getByRole("img", { name: "Polo dệt kim màu Đen" }).getAttribute("src"))
    .toBe("/legacy.jpg");
});
