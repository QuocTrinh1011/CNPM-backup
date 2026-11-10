import React, { useEffect, useRef, useState } from "react";
import { api, endpoints } from "./api/api";
import CustomerVouchers from './CustomerVouchers';

export function useCheckoutVoucher(cart) {
  const [code, setCode] = useState(""), [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const version = useRef(0), alive = useRef(true), latest = useRef(null);
  const fingerprint = JSON.stringify([cart.subtotal, cart.items.map(item => [item.productId, item.quantity, item.size, item.color, item.lineTotal])]);
  latest.current = { fingerprint, code };
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++version.current; }; }, []);
  const apply = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) { setError("Vui lòng nhập mã giảm giá."); return; }
    const request = ++version.current, key = fingerprint;
    setBusy(true); setError(""); setResult(null);
    const current = () => alive.current && version.current === request && latest.current.fingerprint === key && latest.current.code.trim().toUpperCase() === normalized;
    try {
      const data = await api(endpoints.validateVoucher(normalized, cart.subtotal));
      if (current()) setResult({ data, fingerprint: key });
    } catch (err) { if (current()) setError(err.message); }
    finally { if (alive.current && version.current === request) setBusy(false); }
  };
  const previous = useRef(fingerprint);
  useEffect(() => {
    if (previous.current === fingerprint) return;
    previous.current = fingerprint;
    ++version.current; setBusy(false);
    if (result) { void apply(); }
    else { setResult(null); if (code.trim()) setError("Giỏ hàng đã thay đổi. Vui lòng áp dụng lại mã."); }
  }, [fingerprint]);
  const change = value => { ++version.current; setBusy(false); setCode(value.toUpperCase()); setResult(null); setError(""); };
  const voucher = result?.fingerprint === fingerprint ? result.data : null;
  return { code, voucher, busy, error, apply, change, subtotal:cart.subtotal, remove: () => change("") };
}

export default function VoucherField({ model, disabled }) {
  const [wallet,setWallet]=useState(false);
  return <div className="shop-voucher-field"><label>MÃ GIẢM GIÁ<div className="voucher-input">
    <input maxLength={40} value={model.code} disabled={disabled} onChange={e => model.change(e.target.value)} placeholder="Nhập mã voucher" />
    <button type="button" onClick={model.apply} disabled={disabled || model.busy}>{model.busy ? "ĐANG KIỂM TRA" : "ÁP DỤNG"}</button>
  </div></label>
  {model.error && <p className="shop-field-error" role="alert">{model.error}</p>}
  {model.voucher && <div className="shop-voucher-applied"><span role="status">Đã áp dụng {model.voucher.code}</span><button type="button" disabled={disabled} onClick={model.remove}>Bỏ mã</button></div>}
  <small>Mỗi đơn dùng một mã. Ưu đãi được kiểm tra lại khi đặt hàng.</small>
  <button type="button" className="button button-light" disabled={disabled} onClick={()=>setWallet(v=>!v)}>{wallet?'Đóng danh sách mã':'Chọn voucher của tôi'}</button>
  {wallet&&<CustomerVouchers subtotal={model.subtotal} onSelect={code=>{model.change(code);setWallet(false);}}/>}
  </div>;
}
