import React from 'react';
import { useInternalDirectory } from './internal-directory/useInternalDirectory';
import { DirectoryHeader } from './internal-directory/DirectoryHeader';
import { DirectoryAccountTabs } from './internal-directory/DirectoryAccountTabs';
import { DirectoryFilters } from './internal-directory/DirectoryFilters';
import { DirectoryForm } from './internal-directory/DirectoryForm';
import { DirectoryTable } from './internal-directory/DirectoryTable';

export default function InternalDirectory({ kind, manager = false }) {
  const directory = useInternalDirectory({ kind, manager });
  const {
    filters, change, page, setPage, accountGroup, setAccountGroup,
    data, error, setReload, busy, form, setForm, promotingEmployee,
    setPromotingEmployee, remove, toggleCustomerLock,
    customerAccount, canCreateCurrentGroup, canEditCurrentGroup,
    labels, heading, description, KindIcon, supplierOptions, clearFilters,
  } = directory;

  return (
    <section className="admin-card internal-directory-panel">
      <DirectoryHeader
        kind={kind}
        heading={heading}
        description={description}
        KindIcon={KindIcon}
        canCreateCurrentGroup={canCreateCurrentGroup}
        accountGroup={accountGroup}
        setPromotingEmployee={setPromotingEmployee}
        setForm={setForm}
      />
      <DirectoryAccountTabs
        kind={kind}
        accountGroup={accountGroup}
        setAccountGroup={setAccountGroup}
        setPage={setPage}
        setForm={setForm}
      />
      <DirectoryFilters kind={kind} filters={filters} change={change} clear={clearFilters} suppliers={supplierOptions} />

      {error && !(kind === 'accounts' && form) && (
        <div role="alert" style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            Thử lại
          </button>
        </div>
      )}

      <DirectoryForm
        form={form}
        save={directory.save}
        labels={labels}
        kind={kind}
        promotingEmployee={promotingEmployee}
        setForm={setForm}
        busy={busy}
        customerAccount={customerAccount}
        error={error}
      />
      <DirectoryTable
        data={data}
        error={error}
        kind={kind}
        canEditCurrentGroup={canEditCurrentGroup}
        page={page}
        setPage={setPage}
        busy={busy}
        customerAccount={customerAccount}
        setPromotingEmployee={setPromotingEmployee}
        setForm={setForm}
        toggleCustomerLock={toggleCustomerLock}
        remove={remove}
        suppliers={supplierOptions}
      />
    </section>
  );
}
