import React, { useEffect, useRef, useState } from "react";
import { MapPin, Plus, X, Pencil, Check } from "lucide-react";
import { api, endpoints } from "./api/api";
import ShippingFields, { PhoneField, prepareAddress, shippingErrors } from "./ShippingFields";
import "./checkout-page.css";

export const addressText = address => [address.addressLine, address.ward, address.district, address.province].filter(Boolean).join(", ");
export const deliveryText = address => [address.recipientName?.trim(), address.phone, address.addressLine?.trim(), address.ward, address.province].filter(Boolean).join(", ");
export const addressValid = address => !!address && Object.keys(shippingErrors(address)).length === 0;
export const preferredAddress = items => items.find(item => item.defaultAddress) || items[0] || null;

export function useAddresses() {
  const [items, setItems] = useState(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const generation = useRef(0), alive = useRef(true);
  const load = async () => {
    const request = ++generation.current;
    setLoading(true); setError("");
    try {
      const data = await api(endpoints.addresses);
      if (!Array.isArray(data)) throw new Error("Không tải được danh sách địa chỉ. Vui lòng thử lại.");
      if (alive.current && request === generation.current) setItems(data);
      return data;
    } catch (err) { if (alive.current && request === generation.current) setError(err.message); return null; }
    finally { if (alive.current && request === generation.current) setLoading(false); }
  };
  const saved = item => setItems(current => {
    const rest = (current || []).filter(value => value.id !== item.id).map(value => item.defaultAddress ? { ...value, defaultAddress: false } : value);
    return [item, ...rest];
  });
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, []);
  return { items, error, loading, load, saved };
}

export function AddressSummary({ address }) {
  return <div className="shop-address-summary">
    <div><strong>{address.recipientName}</strong><span>{address.phone}</span>{address.defaultAddress && <small className="shop-address-default">Mặc định</small>}</div>
    <p>{addressText(address)}</p>
    {!addressValid(address) && <p className="shop-field-error">Địa chỉ cần cập nhật số điện thoại hoặc Tỉnh/Thành phố, Phường/Xã trước khi đặt hàng.</p>}
  </div>;
}

export function AddressEditor({ address, firstAddress = false, onSaved, onCancel, onBusy = () => {} }) {
  const [form, setForm] = useState(() => address ? prepareAddress(address) : {
    label: "", recipientName: "", phone: "", addressLine: "", ward: "", province: "", district: "", defaultAddress: firstAddress,
  });
  const [errors, setErrors] = useState({}), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const change = values => { setForm(current => ({ ...current, ...values })); setErrors({}); };
  const save = async event => {
    event.preventDefault(); if (lock.current) return;
    const invalid = shippingErrors(form); setErrors(invalid);
    if (Object.keys(invalid).length) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      const body = { label: form.label, recipientName: form.recipientName.trim(), phone: form.phone, addressLine: form.addressLine.trim(), ward: form.ward, province: form.province, district: "", defaultAddress: !!form.defaultAddress };
      const result = await api(address ? endpoints.address(address.id) : endpoints.addresses, { method: address ? "PUT" : "POST", body });
      onSaved(result);
    } catch (err) { setError(err.message); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <form className="shop-address-editor" noValidate onSubmit={save}>
    <h3>{address ? "Sửa địa chỉ nhận hàng" : "Thêm địa chỉ nhận hàng"}</h3>
    {error && <p className="shop-inline-error" role="alert">{error}</p>}
    <fieldset disabled={busy}>
      <label>TÊN GỢI NHỚ<input maxLength={80} value={form.label || ""} placeholder="Nhà riêng, văn phòng..." onChange={e => change({ label: e.target.value })} /></label>
      <div className="shop-address-fields"><label>NGƯỜI NHẬN<input autoFocus required maxLength={150} autoComplete="name" value={form.recipientName || ""} onChange={e => change({ recipientName: e.target.value })} /></label>
        <PhoneField value={form.phone} error={errors.phone} disabled={busy} onChange={value => change({ phone: value })} /></div>
      <label>ĐỊA CHỈ<input required maxLength={500} autoComplete="street-address" value={form.addressLine || ""} placeholder="Số nhà, tên đường" onChange={e => change({ addressLine: e.target.value })} /></label>
      <ShippingFields form={form} error={errors.location} disabled={busy} legacy={address && !addressValid(address) ? addressText(address) : ""} onChange={change} />
      {errors.details && <p className="shop-field-error" role="alert">{errors.details}</p>}
      <label className="shop-address-checkbox"><input type="checkbox" checked={!!form.defaultAddress} disabled={firstAddress} onChange={e => change({ defaultAddress: e.target.checked })} /> Đặt làm địa chỉ mặc định</label>
      {firstAddress && <small>Địa chỉ đầu tiên sẽ được đặt làm mặc định.</small>}
      <div className="shop-address-actions"><button className="button button-light" type="button" onClick={onCancel}>Quay lại</button><button className="button button-dark" type="submit">{busy ? "ĐANG LƯU..." : "LƯU ĐỊA CHỈ"}</button></div>
    </fieldset>
  </form>;
}

export function AddressPicker({ resource, selected, onSelect, onClose }) {
  const [choice, setChoice] = useState(selected?.id ?? null), [editing, setEditing] = useState(undefined), [busy, setBusy] = useState(false);
  const { items, loading, error, load, saved } = resource;
  const chosen = items?.find(item => item.id === choice);
  return <div className="modal-backdrop"><section className="shop-address-dialog" role="dialog" aria-modal="true" aria-label="Chọn địa chỉ nhận hàng">
    <button className="close-button" type="button" aria-label="Đóng chọn địa chỉ" disabled={busy} onClick={onClose}><X size={20}/></button>
    <h2>Địa chỉ nhận hàng</h2><p className="shop-address-note">Lựa chọn này chỉ áp dụng cho đơn hiện tại.</p>
    {editing !== undefined ? <AddressEditor key={editing?.id ?? "new"} address={editing} firstAddress={!items?.length} onBusy={setBusy} onCancel={() => setEditing(undefined)} onSaved={item => { saved(item); setChoice(item.id); setEditing(undefined); }}/> : <>
      {loading ? <p role="status">Đang tải địa chỉ...</p> : error ? <div role="alert">{error}<button className="button button-light" onClick={load}>Thử lại</button></div> : <>
        <div className="shop-address-options" role="radiogroup" aria-label="Địa chỉ đã lưu">{items?.map(item => <article className={"shop-address-option" + (choice === item.id ? " is-selected" : "")} key={item.id}>
          <label className="shop-address-radio"><input type="radio" name="delivery-address" checked={choice === item.id} onChange={() => setChoice(item.id)} aria-label={item.recipientName + " · " + item.phone + " · " + item.addressLine} /><AddressSummary address={item}/></label>
          <button className="shop-address-link" onClick={() => setEditing(item)}><Pencil size={15}/> Sửa</button>
        </article>)}</div>
        {!items?.length && <p>Bạn chưa lưu địa chỉ nào.</p>}
        <button className="button button-light" type="button" onClick={() => setEditing(null)}><Plus size={16}/> Thêm địa chỉ mới</button>
        <div className="shop-address-actions"><button className="button button-light" type="button" onClick={onClose}>Quay lại</button><button className="button button-dark" type="button" disabled={!addressValid(chosen)} onClick={() => onSelect(chosen)}><Check size={16}/> Giao đến địa chỉ này</button></div>
      </>}
    </>}
  </section></div>;
}

export default function AddressModal({ page = false, onClose, onNotice = () => {} }) {
  const resource = useAddresses(), { items, loading, error, load, saved } = resource;
  const [editing, setEditing] = useState(undefined), [deleting, setDeleting] = useState(null), [busy, setBusy] = useState(false), [actionError, setActionError] = useState("");
  const lock = useRef(false);
  const mutate = async (path, method) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setActionError("");
    try { await api(path, { method }); setDeleting(null); await load(); onNotice("Đã cập nhật sổ địa chỉ."); }
    catch (err) { setActionError(err.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className={page ? 'customer-page-body' : 'modal-backdrop'}><section className="shop-address-dialog" role={page ? undefined : 'dialog'} aria-modal={page ? undefined : true} aria-label="Địa chỉ của tôi">
    {!page && <button className="close-button" aria-label="Đóng địa chỉ" disabled={busy} onClick={onClose}><X size={20}/></button>}
    <h2>Địa chỉ của tôi</h2>
    {actionError && <p role="alert" className="shop-inline-error">{actionError}</p>}
    {editing !== undefined ? <AddressEditor key={editing?.id ?? "new"} address={editing} firstAddress={!items?.length} onBusy={setBusy} onCancel={() => setEditing(undefined)} onSaved={item => { saved(item); setEditing(undefined); onNotice("Đã lưu địa chỉ giao hàng."); }}/> : <>
      {loading ? <p role="status">Đang tải địa chỉ...</p> : error ? <div role="alert">{error}<button className="button button-light" onClick={load}>Thử lại</button></div> : <>
        {items?.map(item => <article className="shop-address-option" key={item.id}><AddressSummary address={item}/><div className="shop-address-actions">
          <button className="shop-address-link" disabled={busy} onClick={() => { setDeleting(null); setEditing(item); }}>Sửa</button>
          {!item.defaultAddress && <button className="shop-address-link" disabled={busy} onClick={() => mutate(endpoints.defaultAddress(item.id), "PATCH")}>Đặt mặc định</button>}
          <button className="shop-address-link" disabled={busy} onClick={() => setDeleting(item)}>Xóa</button>
        </div></article>)}
        {!items?.length && <p>Bạn chưa lưu địa chỉ nào.</p>}
        {deleting && <div className="shop-address-confirm" role="group" aria-label="Xác nhận xóa địa chỉ"><p>Xóa địa chỉ {deleting.addressLine}?</p><button disabled={busy} className="button button-light" onClick={() => setDeleting(null)}>Quay lại</button><button disabled={busy} className="button button-dark" onClick={() => mutate(endpoints.address(deleting.id), "DELETE")}>Xác nhận xóa</button></div>}
        <button className="button button-light" disabled={busy} onClick={() => { setDeleting(null); setEditing(null); }}><Plus size={16}/> Thêm địa chỉ mới</button>
      </>}
    </>}
  </section></div>;
}
