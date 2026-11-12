import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../api/api';

export function useShopResource(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadedPath, setLoadedPath] = useState(null);
  const generation = useRef(0);
  const active = useRef(null);
  const load = useCallback(async () => {
    active.current?.abort();
    const controller=new AbortController();active.current=controller;
    const id = ++generation.current;
    setError('');
    setLoading(true);
    try { const result = await api(path,{signal:controller.signal}); if (id === generation.current) {setData(result);setLoadedPath(path);} }
    catch (error) { if (id === generation.current) setError(error.message); }
    finally {if(id===generation.current)setLoading(false);}
  }, [path]);
  useEffect(() => {
    load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate this path's pending response during cleanup.
      generation.current++;
      active.current?.abort();
    };
  }, [load]);
  return { data:loadedPath===path?data:null, setData, error, load, loading:loading || loadedPath!==path };
}

// Existing storefront dialogs share the same overlay structure.
export function useStorefrontDialogs() {
  useEffect(() => {
    const shell = document.querySelector('.site-shell');
    if (!shell) return;
    let active = null;
    let previous = null;
    const originalOverflow = document.body.style.overflow;
    const focusable = () => [...active.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length);
    const sync = () => {
      const overlays = shell.querySelectorAll('.modal-backdrop,.drawer-backdrop');
      const next = overlays[overlays.length - 1]?.firstElementChild || (window.matchMedia?.('(max-width: 680px)').matches ? shell.querySelector('.filter-panel') : null);
      if (next === active) {
        // An address editor can replace the list inside the same dialog.
        if (active && !active.contains(document.activeElement)) (focusable()[0] || active).focus();
        return;
      }
      if (!active && next) previous = document.activeElement;
      active = next;
      document.body.style.overflow = active ? 'hidden' : originalOverflow;
      if (active) {
        active.setAttribute('role', 'dialog');
        active.setAttribute('aria-modal', 'true');
        active.setAttribute('aria-label', active.querySelector('h2,h3')?.textContent || 'Thông tin cửa hàng');
        active.tabIndex = -1;
        (focusable()[0] || active).focus();
      } else previous?.focus();
    };
    const keydown = event => {
      if (!active) return;
      if (event.key === 'Escape') active.querySelector('.close-button,.drawer-head button,.shop-filter-close')?.click();
      if (event.key === 'Tab') {
        const items = focusable();
        if (!items.length) { event.preventDefault(); active.focus(); return; }
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === active)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(shell, { childList: true, subtree: true });
    document.addEventListener('keydown', keydown);
    sync();
    return () => { observer.disconnect(); document.removeEventListener('keydown', keydown); document.body.style.overflow = originalOverflow; };
  }, []);
}
