import { describe, expect, it } from "vitest";
import { firstProductColor, imagesForColor } from "./product-image-gallery";

describe("product image gallery", () => {
  it("returns the ordered gallery for the selected color", () => {
    const product = {
      colors: "Nâu, Đen",
      imageUrl: "/default.jpg",
      colorImages: {
        Nâu: ["/brown-front.jpg", "/brown-detail.jpg"],
        Đen: ["/black-front.jpg"],
      },
    };

    expect(firstProductColor(product)).toBe("Nâu");
    expect(imagesForColor(product, "Nâu")).toEqual(["/brown-front.jpg", "/brown-detail.jpg"]);
    expect(imagesForColor(product, "Đen")).toEqual(["/black-front.jpg"]);
  });

  it("falls back to the legacy image when the color has no gallery", () => {
    expect(imagesForColor({ imageUrl: "/legacy.jpg", colorImages: {} }, "Trắng"))
      .toEqual(["/legacy.jpg"]);
    expect(imagesForColor({ imageUrl: "", colorImages: {} }, "Trắng")).toEqual([]);
  });
});
