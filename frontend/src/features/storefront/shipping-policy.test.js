import { describe, expect, it } from "vitest";

describe("threshold shipping", () => {
  it("charges below 399000 and waives at or above the threshold", async () => {
    const { getShippingFee } = await import("./shipping-policy").catch(() => ({}));
    expect(getShippingFee).toBeTypeOf("function");
    expect(getShippingFee(398999)).toBe(30000);
    expect(getShippingFee(399000)).toBe(0);
    expect(getShippingFee(500000)).toBe(0);
  });
});
