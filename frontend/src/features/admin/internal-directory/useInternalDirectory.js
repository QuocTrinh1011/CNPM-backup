import { useEffect, useState } from 'react';
import { adminApi } from '../../../api/api';
import { adminApi as managerApi } from '../../../api/manager-api';
import { ACCOUNT_GROUPS, DIRECTORY_TITLES } from './internalDirectoryConfig';
import { Package } from 'lucide-react';

export function useInternalDirectory({ kind, manager = false }) {
  const api = manager ? managerApi : adminApi;
  const base = `/api/${manager ? 'manager' : 'admin'}/${kind}`;
  const defaultFilters = () => ({
    q: '', category: '', supplierId: '', minPrice: '', maxPrice: '', stock: '',
    code: '', email: '', phone: '', address: '', active: '',
    sort: kind === 'products' ? 'createdAt' : 'name', desc: 'false',
  });
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(0);
  const [accountGroup, setAccountGroup] = useState('managers');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [promotingEmployee, setPromotingEmployee] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState([]);

  useEffect(() => {
    if (kind !== 'products') {
      setSupplierOptions([]);
      return undefined;
    }
    let alive = true;
    const supplierBase = `/api/${manager ? 'manager' : 'admin'}/suppliers`;
    const loadSuppliers = async () => {
      const suppliers = [];
      let page = 0;
      let totalPages = 1;
      do {
        const result = await api(`${supplierBase}?page=${page}&size=100&sort=name&desc=false`);
        suppliers.push(...(result?.content || []));
        totalPages = Math.max(page + 1, Number(result?.totalPages) || 1);
        page += 1;
      } while (alive && page < totalPages);
      if (alive) setSupplierOptions(suppliers);
    };
    loadSuppliers().catch(() => {
      if (alive) setSupplierOptions([]);
    });
    return () => {
      alive = false;
    };
  }, [api, kind, manager]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    const params = new URLSearchParams({ page, size: 15 });
    if (kind === 'accounts') params.set('group', accountGroup);
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '') params.set(k, v);
    });
    api(`${base}?${params}`)
      .then((v) => {
        if (alive) setData(v);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [base, api, page, filters, reload, kind, accountGroup]);

  const change = (k, v) => {
    setPage(0);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  const clearFilters = () => {
    setPage(0);
    setFilters(defaultFilters());
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const customerAccount = kind === 'accounts' && accountGroup === 'customers';
      const body = customerAccount
        ? { fullName: form.fullName, email: form.email, phone: form.phone || null, preferences: form.preferences || null }
        : { ...form };
      if (kind === 'accounts' && body.role === 'EMPLOYEE') delete body.password;
      await api(customerAccount ? `/api/admin/customers/${form.id}` : form.id ? `${base}/${form.id}` : base, {
        method: customerAccount ? 'PUT' : form.id ? (kind === 'accounts' ? 'PATCH' : 'PUT') : 'POST',
        body,
      });
      setForm(null);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm('Vô hiệu hóa tài khoản này?')) return;
    setBusy(true);
    try {
      await api(`${base}/${row.id}`, { method: 'DELETE' });
      setPage(0);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleCustomerLock = async (row) => {
    const locked = !row.locked;
    const reason = locked ? window.prompt('Nhập lý do khóa tài khoản khách hàng:') : null;
    if (locked && (reason === null || !reason.trim())) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/customers/${row.id}/lock`, {
        method: 'PATCH',
        body: { locked, reason: locked ? reason.trim() : null },
      });
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const editable = kind === 'accounts' || (manager && kind === 'suppliers');
  const customerAccount = kind === 'accounts' && accountGroup === 'customers';
  const canCreateCurrentGroup = editable && !customerAccount;
  const canEditCurrentGroup = (editable && !customerAccount) || (customerAccount && !manager);
  const labels =
    customerAccount
      ? { fullName: 'Họ tên', email: 'Email', phone: 'Số điện thoại', preferences: 'Sở thích' }
      : kind === 'accounts'
      ? { fullName: 'Họ tên', email: 'Email', password: 'Mật khẩu mới' }
      : {
          code: 'Mã nhà cung cấp',
          name: 'Tên nhà cung cấp',
          email: 'Email',
          phone: 'Điện thoại',
          address: 'Địa chỉ',
          notes: 'Ghi chú',
        };
  const currentMeta = DIRECTORY_TITLES[kind] || { title: kind, desc: '', icon: Package };
  const accountMeta = ACCOUNT_GROUPS.find((group) => group.id === accountGroup) || ACCOUNT_GROUPS[0];
  const heading = kind === 'accounts' ? accountMeta.title : currentMeta.title;
  const description = kind === 'accounts' ? accountMeta.description : currentMeta.desc;
  const KindIcon = currentMeta.icon;

  return {
    api, base, filters, change, page, setPage, accountGroup, setAccountGroup,
    data, error, setError, reload, setReload, busy, setBusy, form, setForm,
    promotingEmployee, setPromotingEmployee, save, remove, toggleCustomerLock,
    editable, customerAccount, canCreateCurrentGroup, canEditCurrentGroup, labels, supplierOptions,
    clearFilters,
    currentMeta, heading, description, KindIcon,
  };
}
