import React, { useEffect, useRef, useState } from 'react';
import { UserRound, Package, Heart, Bell, MapPin, ClipboardList, KeyRound, LogOut, LogIn, UserPlus, ChevronRight } from 'lucide-react';

export default function AccountDropdown({ user, unreadCount = 0, onAction }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const items = user ? [
    ['profile', 'Hồ sơ của tôi', UserRound], ['orders', 'Đơn hàng của tôi', Package],
    ['wishlist', 'Sản phẩm yêu thích', Heart], ['notifications', 'Thông báo', Bell],
    ['addresses', 'Địa chỉ giao hàng', MapPin], ['surveys', 'Khảo sát phong cách', ClipboardList],
    ['password', 'Bảo mật tài khoản', KeyRound], ['logout', 'Đăng xuất', LogOut],
  ] : [['login', 'Đăng nhập', LogIn], ['register', 'Tạo tài khoản', UserPlus]];
  return <div className="shop-account" ref={root}
    onMouseEnter={() => { if (!window.matchMedia || window.matchMedia('(hover: hover)').matches) setOpen(true); }}
    onMouseLeave={() => { if (!root.current?.contains(document.activeElement)) setOpen(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    }}>
    <button ref={trigger} className={`icon-button account-button${user ? ' signed-in' : ''}`} aria-label="Tài khoản" aria-expanded={open} aria-controls="shop-account-panel"
      onClick={event => { if (event.detail > 0 && window.matchMedia?.('(hover: hover)').matches) setOpen(true); else setOpen(value => !value); }}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
      <UserRound size={20} strokeWidth={1.8}/>
      <span className="account-btn-label">
        {user ? (user.fullName ? user.fullName.split(' ').slice(-1)[0] : 'Tài khoản') : 'Tài khoản'}
      </span>
      {user && <span className="account-status-dot" aria-hidden="true"/>}
    </button>
    {open && <div className="shop-account-panel" id="shop-account-panel" aria-label="Chức năng tài khoản">
      <div className="shop-account-heading"><span className="shop-account-avatar">{user?.fullName?.slice(0, 1).toUpperCase() || <UserRound size={22}/>}</span><div><small>{user ? 'Xin chào,' : 'Chào mừng đến với'}</small><strong>{user?.fullName || 'ANH LỚN SHOP'}</strong><p>{user?.email || 'Đăng nhập để mua sắm thuận tiện hơn'}</p></div></div>
      <nav aria-label="Menu tài khoản">{items.map(([key, label, Icon]) => <button key={key} className={key === 'logout' ? 'shop-account-logout' : ''} onClick={() => { setOpen(false); onAction(key); }}><Icon size={18}/><span>{label}</span>{key === 'notifications' && unreadCount > 0 ? <b className="shop-account-count">{unreadCount > 99 ? '99+' : unreadCount}</b> : <ChevronRight size={14}/>}</button>)}</nav>
    </div>}
  </div>;
}
