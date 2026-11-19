import { useState, useEffect, useRef, useCallback } from "react";
import { api, endpoints } from "../../../api/api";
export default function useWishlist(user, wishlistOpen) {
  const [wishlist, setWishlist] = useState([]);
  const [wishlistError, setWishlistError] = useState('');
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const wishlistRequest = useRef(0);
  const loadWishlist = useCallback(async () => {
    const request = ++wishlistRequest.current;
    if (!user?.id) return;
    setWishlistLoading(true);
    setWishlistError('');
    try {
      const items = await api(endpoints.wishlist);
      if (request === wishlistRequest.current) setWishlist(items);
    } catch (error) {
      if (request === wishlistRequest.current) setWishlistError(error.message);
    } finally {
      if (request === wishlistRequest.current) setWishlistLoading(false);
    }
  }, [user?.id]);
  const userId = user?.id;
  useEffect(() => {
    if (userId) void loadWishlist();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate an in-flight request when the user or wishlist route changes.
      wishlistRequest.current++;
    };
  }, [userId, wishlistOpen, loadWishlist]);
  return {
    wishlist,
    setWishlist,
    wishlistError,
    wishlistLoading,
    loadWishlist
  };
}
