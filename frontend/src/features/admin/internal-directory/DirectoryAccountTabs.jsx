import React from 'react';
import { ACCOUNT_GROUPS } from './internalDirectoryConfig';

export function DirectoryAccountTabs({ kind, accountGroup, setAccountGroup, setPage, setForm }) {
  return (
    <>
      {kind === 'accounts' && (
        <div className="admin-account-tabs" role="tablist" aria-label="Nhóm tài khoản">
          {ACCOUNT_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={accountGroup === group.id}
              className={accountGroup === group.id ? 'admin-account-tab is-active' : 'admin-account-tab'}
              onClick={() => {
                setAccountGroup(group.id);
                setPage(0);
                setForm(null);
              }}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
