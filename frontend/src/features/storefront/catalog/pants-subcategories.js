export const PANTS_SUBCATEGORIES = [
  { value: "JEANS", label: "Quần Jeans" },
  { value: "SHORT", label: "Quần Short" },
  { value: "KAKI_CHINO", label: "Quần Kaki & Chino" },
  { value: "JOGGER_LONG", label: "Quần Jogger - Quần Dài" },
  { value: "TROUSERS", label: "Quần Tây" },
  { value: "BOXER", label: "Quần Boxer" },
  { value: "CARGO", label: "Quần Cargo" },
];

export const pantsSubcategoryLabel = value =>
  PANTS_SUBCATEGORIES.find(category => category.value === value)?.label || "";
