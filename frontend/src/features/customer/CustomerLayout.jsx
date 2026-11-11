import React from 'react';
import { UserRound, MapPin, KeyRound, Package, Heart, Bell, ClipboardList } from 'lucide-react';
import { customerLinks } from '../../app/customer-routing';
const icons = [UserRound, MapPin, KeyRound, Package, Heart, Bell, ClipboardList];
export default function CustomerLayout({ children, pathname, user, navigate }) {
  return (
    <main className="customer-layout">
      <aside className="customer-sidebar">
        <div className="customer-identity">
          <UserRound size={26} />
          <div>
            <strong>{user?.fullName || 'Tài khoản của bạn'}</strong>
            <span>ANH LỚN SHOP</span>
          </div>
        </div>
        <nav aria-label="Chức năng tài khoản">
          {customerLinks.map(([href, label], index) => {
            const Icon = icons[index] || ClipboardList;
            const active =
              pathname === href ||
              (['/don-hang', '/khao-sat', '/ho-tro'].includes(href) &&
                pathname.startsWith(href + '/'));
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={event => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  navigate(href);
                }}
              >
                <Icon size={19} />
                {label}
              </a>
            );
          })}
        </nav>
      </aside>
      <div className="customer-content">{children}</div>
    </main>
  );
}
