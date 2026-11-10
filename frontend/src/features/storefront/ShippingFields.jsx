import React, { useId, useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import provinces from '../../data/vietnam-addresses.json';

export function normalizeSearchText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

const normalized = text => String(text || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
const unique = (items, name) => { const matches = items.filter(item => normalized(item.name) === normalized(name)); return matches.length === 1 ? matches[0] : null; };
export const phoneDigits = value => String(value || '').replace(/[^0-9]/g, '');
export const validPhone = value => /^0[0-9]{9}$/.test(value || '');
export function matchAddress(address) {
  const province = unique(provinces, address.province);
  const ward = province ? unique(province.wards, address.ward) : null;
  return { province, ward };
}
export function prepareAddress(address) {
  const { province, ward } = matchAddress(address);
  return { ...address, district: '', province: province?.name || '', ward: ward?.name || '' };
}
export function shippingErrors(form) {
  const errors = {};
  if (!validPhone(form.phone)) errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.';
  const { province, ward } = matchAddress(form);
  if (!province || !ward) errors.location = 'Vui lòng chọn Tỉnh/Thành phố và Phường/Xã hợp lệ.';
  if (!form.recipientName?.trim() || !form.addressLine?.trim()) errors.details = 'Vui lòng nhập người nhận và số nhà, tên đường.';
  return errors;
}
export function PhoneField({ value, onChange, error, disabled }) {
  const id = useId();
  return <div className="shop-shipping-field"><label htmlFor={id}>SỐ ĐIỆN THOẠI</label><input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" required pattern="0[0-9]{9}" value={value ?? ''} disabled={disabled} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => onChange(phoneDigits(event.target.value))} placeholder="Ví dụ: 0912345678"/>{error && <p className="shop-field-error" id={`${id}-error`} role="alert">{error}</p>}</div>;
}

function SearchableSelect({
  placeholder,
  searchPlaceholder,
  items = [],
  selectedCode = '',
  disabled = false,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedItem = items.find(item => String(item.code) === String(selectedCode));

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = normalizeSearchText(searchQuery);
    return items.filter(item => normalizeSearchText(item.name).includes(query));
  }, [items, searchQuery]);

  return (
    <div
      className={`shop-searchable-select ${disabled ? 'disabled' : ''} ${open ? 'is-open' : ''}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="shop-searchable-trigger"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedItem ? 'shop-searchable-val' : 'shop-searchable-ph'}>
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <ChevronDown size={17} className={`shop-searchable-arrow ${open ? 'rotated' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="shop-searchable-dropdown" role="listbox">
          <div className="shop-searchable-search-wrap">
            <Search size={15} className="shop-searchable-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="shop-searchable-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              onClick={e => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                className="shop-searchable-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="Xóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="shop-searchable-options">
            {filteredItems.length === 0 ? (
              <div className="shop-searchable-empty">
                Không tìm thấy kết quả phù hợp
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = String(item.code) === String(selectedCode);
                return (
                  <button
                    key={item.code}
                    type="button"
                    className={`shop-searchable-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span>{item.name}</span>
                    {isSelected && <Check size={16} className="shop-searchable-check" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShippingFields({ form, onChange, error, legacy, disabled }) {
  const id = useId();
  const { province, ward } = matchAddress(form);
  return <div className="shop-shipping-location">
    {legacy && <p className="shop-address-note">Địa chỉ đã lưu: {legacy}. Vui lòng kiểm tra và chọn lại tỉnh/phường theo danh mục mới; địa chỉ đã lưu chỉ thay đổi khi anh/chị bấm lưu.</p>}
    <div className="form-two-columns">
      <label htmlFor={`${id}-province`}>
        TỈNH/THÀNH PHỐ
        <select
          id={`${id}-province`}
          required
          disabled={disabled}
          value={province?.code || ''}
          aria-invalid={!!error}
          onChange={event => {
            const selected = provinces.find(p => String(p.code) === event.target.value);
            onChange({ province: selected?.name || '', ward: '', district: '' });
          }}
          className="shop-address-hidden-select"
        >
          <option value="">Chọn Tỉnh/Thành phố</option>
          {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <SearchableSelect
          placeholder="Chọn Tỉnh/Thành phố"
          searchPlaceholder="Tìm kiếm tỉnh, thành phố..."
          items={provinces}
          selectedCode={province?.code || ''}
          disabled={disabled}
          onSelect={selected => {
            onChange({ province: selected?.name || '', ward: '', district: '' });
          }}
        />
      </label>
      <label htmlFor={`${id}-ward`}>
        PHƯỜNG/XÃ
        <select
          id={`${id}-ward`}
          required
          disabled={disabled || !province}
          value={ward?.code || ''}
          aria-invalid={!!error}
          onChange={event => {
            const selected = province?.wards.find(w => String(w.code) === event.target.value);
            onChange({ ward: selected?.name || '', district: '' });
          }}
          className="shop-address-hidden-select"
        >
          <option value="">{province ? 'Chọn Phường/Xã' : 'Chọn tỉnh trước'}</option>
          {province?.wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
        </select>
        <SearchableSelect
          placeholder={province ? 'Chọn Phường/Xã' : 'Chọn tỉnh trước'}
          searchPlaceholder="Tìm kiếm phường, xã..."
          items={province?.wards || []}
          selectedCode={ward?.code || ''}
          disabled={disabled || !province}
          onSelect={selected => {
            onChange({ ward: selected?.name || '', district: '' });
          }}
        />
      </label>
    </div>
    {error && <p className="shop-field-error" role="alert">{error}</p>}
  </div>;
}
