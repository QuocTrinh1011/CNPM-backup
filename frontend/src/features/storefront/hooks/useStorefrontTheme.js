import { useState, useEffect } from "react";
export default function useStorefrontTheme() {
  const [shopTheme, setShopTheme] = useState(() => {
    try {
      return localStorage.getItem('anh-lon-shop-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('anh-lon-shop-theme', shopTheme);
    } catch {/* Theme still works when storage is unavailable. */}
  }, [shopTheme]);
  return [shopTheme, setShopTheme];
}
