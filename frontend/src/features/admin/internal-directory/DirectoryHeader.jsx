import React from 'react';
import { Plus } from 'lucide-react';

export function DirectoryHeader({ kind, heading, description, KindIcon, canCreateCurrentGroup, accountGroup, setPromotingEmployee, setForm }) {
  return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--admin-primary-soft)', color: 'var(--admin-primary)', display: 'grid', placeItems: 'center' }}>
              <KindIcon size={18} />
            </span>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
              {kind === 'accounts'
                ? heading
                : kind === 'products'
                ? 'Tra cứu sản phẩm'
                : 'Nhà cung cấp'}
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--admin-muted)' }}>{description}</p>
        </div>

        {canCreateCurrentGroup && (
          <button
            type="button"
            className="admin-primary-btn"
            onClick={() => {
              setPromotingEmployee(false);
              setForm(
                kind === 'accounts'
                  ? { fullName: '', email: '', password: '', role: accountGroup === 'employees' ? 'EMPLOYEE' : 'MANAGER_SALES', workArea: '', locked: false }
                  : { code: '', name: '', email: '', phone: '', address: '', notes: '', active: true }
              );
            }}
          >
            <Plus size={16} /> Thêm mới
          </button>
        )}
      </div>
  );
}
