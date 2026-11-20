export const formatReviewDate = (val) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
};

export const colorFallback = (value) => {
  const color = String(value || "").toLocaleLowerCase("vi-VN");
  if (color.includes("trắng") || color.includes("kem")) return "#eee9df";
  if (color.includes("đen")) return "#242424";
  if (color.includes("nâu") || color.includes("cà phê")) return "#76553f";
  if (color.includes("navy") || color.includes("xanh đen")) return "#27364d";
  if (color.includes("xanh")) return "#6486a1";
  if (color.includes("xám")) return "#a3a5a7";
  if (color.includes("đỏ")) return "#ad4944";
  return "#d8d3ca";
};
