import { useEffect, useState } from 'react';

export const cartLineKey = item => JSON.stringify([String(item.productId), (item.size || '').trim(), (item.color || '').trim()]);
export const canBuyLine = item => Number(item.quantity) > 0 && Number(item.stock) >= Number(item.quantity);
const storageKey = owner => `anh-lon-cart-selection:${owner}`;
export function readSelection(owner) {
  try { const data = JSON.parse(sessionStorage.getItem(storageKey(owner))); return Array.isArray(data?.known) && Array.isArray(data?.selected) ? data : null; } catch { return null; }
}
export function saveSelection(owner, value) {
  try { sessionStorage.setItem(storageKey(owner), JSON.stringify(value)); } catch { /* Selection still works in memory. */ }
}
export function reconcileSelection(value, items) {
  const known = items.map(cartLineKey);
  const selected = items.filter(item => canBuyLine(item) && (!value || !value.known.includes(cartLineKey(item)) || value.selected.includes(cartLineKey(item)))).map(cartLineKey);
  return { known, selected };
}
export function transferGuestSelection(customerId) {
  const guest = readSelection('guest');
  if (!guest) return;
  const owner = `customer-${customerId}`, current = readSelection(owner);
  const guestKeys = new Set(guest.known);
  saveSelection(owner, { known: [...new Set([...(current?.known || []), ...guest.known])], selected: [...(current?.selected || []).filter(key => !guestKeys.has(key)), ...guest.selected] });
}
export function summarizeCart(items) {
  return { items, subtotal: items.reduce((sum, item) => sum + Number(item.lineTotal), 0), itemCount: items.reduce((sum, item) => sum + Number(item.quantity), 0) };
}
export function subtractPurchased(cart, purchased) {
  const counts = new Map(purchased.map(item => [cartLineKey(item), Number(item.quantity)]));
  return summarizeCart(cart.items.map(item => { const quantity = Math.max(0, item.quantity - (counts.get(cartLineKey(item)) || 0)); return { ...item, quantity, lineTotal: Number(item.unitPrice) * quantity }; }).filter(item => item.quantity > 0));
}
export function useCartSelection({ owner, cart, ready, initialize }) {
  ready = ready && Array.isArray(cart?.items);
  const [state, setState] = useState(() => ({ owner, value: readSelection(owner) }));
  const stored = state.owner === owner ? state.value : readSelection(owner);
  const value = ready && (stored || initialize) ? reconcileSelection(stored, cart.items) : stored;
  const signature = JSON.stringify(value);
  useEffect(() => {
    if (!ready) return;
    setState({ owner, value });
    if (value) saveSelection(owner, value);
  }, [owner, ready, signature]);
  const commit = next => { setState({ owner, value: next }); saveSelection(owner, next); };
  const selected = ready ? new Set(value?.selected || []) : new Set();
  return {
    selected,
    cart: summarizeCart(ready ? cart.items.filter(item => selected.has(cartLineKey(item)) && canBuyLine(item)) : []),
    toggle(item) { if (!canBuyLine(item)) return; const key = cartLineKey(item); const next = new Set(selected); if (next.has(key)) next.delete(key); else next.add(key); commit({ known: cart.items.map(cartLineKey), selected: [...next] }); },
    all(checked) { commit({ known: cart.items.map(cartLineKey), selected: checked ? cart.items.filter(canBuyLine).map(cartLineKey) : [] }); },
    only(item, nextCart) { commit({ known: nextCart.items.map(cartLineKey), selected: [cartLineKey(item)] }); },
  };
}
