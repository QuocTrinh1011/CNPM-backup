import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import { ListError, PanelLoading, PanelTitle, Table } from './ManagerComponents';
import './styles/warehouse-workspace.css';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const emptyForm = () => ({ productId: '', targetQuantity: '', assignedEmployeeId: '', dueDate: '', note: '' });
const statusLabel = status => ({ PLANNED: 'Chờ thực hiện', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' })[status] || status;

export default function WarehouseProductionPlans() {
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([
      adminApi(adminEndpoints.productionPlans(), { signal: controller.signal }),
      adminApi(adminEndpoints.products({ page: 0, size: 100, active: true }), { signal: controller.signal }),
      adminApi(adminEndpoints.employees({ page: 0, size: 100 }), { signal: controller.signal }),
    ]).then(([plans, productPage, employeePage]) => {
      if (controller.signal.aborted) return;
      setData(plans);
      setProducts((productPage?.content || []).filter(product => product.active !== false));
      const warehouseEmployees = (employeePage?.content || []).filter(employee => employee.workArea === 'WAREHOUSE' && employee.employmentStatus === 'ACTIVE' && !employee.locked);
      setEmployees(warehouseEmployees);
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || 'Không tải được kế hoạch sản xuất.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  const hasValidForm = useMemo(() => Boolean(form.productId && Number(form.targetQuantity) > 0 && form.assignedEmployeeId), [form]);
  const create = async event => {
    event.preventDefault(); setNotice('');
    if (!hasValidForm) { setNotice('Chọn sản phẩm, số lượng dương và nhân viên kho phụ trách.'); return; }
    setSaving(true);
    try {
      const result = await adminApi(adminEndpoints.createProductionPlan(), { method: 'POST', body: {
        productId: Number(form.productId), targetQuantity: Number(form.targetQuantity), assignedEmployeeId: Number(form.assignedEmployeeId),
        dueDate: form.dueDate || null, note: form.note.trim() || null,
      } });
      setNotice(`Đã tạo kế hoạch ${result.planCode}.`); setShowForm(false); setForm(emptyForm()); setReload(value => value + 1);
    } catch (failure) { setNotice(failure.message || 'Không thể tạo kế hoạch. Hãy kiểm tra công thức sản phẩm đang hoạt động.'); }
    finally { setSaving(false); }
  };
  const cancel = async plan => {
    setNotice('');
    try {
      await adminApi(adminEndpoints.cancelProductionPlan(plan.id), { method: 'PATCH' });
      setNotice(`Đã hủy kế hoạch ${plan.planCode}.`); setReload(value => value + 1);
    } catch (failure) { setNotice(failure.message || 'Không thể hủy kế hoạch.'); }
  };

  if (loading) return <PanelLoading />;
  return <section className="admin-panel warehouse-workspace">
    <PanelTitle title="Kế hoạch sản xuất" subtitle="Giao chỉ tiêu sản xuất theo công thức hiện hành cho nhân viên kho." />
    <div className="warehouse-section-head"><span>{data?.totalElements || 0} kế hoạch</span><button className="admin-primary" type="button" onClick={() => { setShowForm(value => !value); setNotice(''); }}><Plus size={16}/> Tạo kế hoạch sản xuất</button></div>
    {showForm && <form className="warehouse-form-card" onSubmit={create}>
      <h3>Kế hoạch mới</h3>
      <div className="warehouse-form-grid">
        <label>Sản phẩm<select aria-label="Sản phẩm" required value={form.productId} onChange={event => setForm(current => ({ ...current, productId: event.target.value }))}><option value="">Chọn sản phẩm</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label>Số lượng cần sản xuất<input aria-label="Số lượng cần sản xuất" type="number" min="1" max="1000000" step="1" required value={form.targetQuantity} onChange={event => setForm(current => ({ ...current, targetQuantity: event.target.value }))}/></label>
        <label>Nhân viên kho phụ trách<select aria-label="Nhân viên kho phụ trách" required value={form.assignedEmployeeId} onChange={event => setForm(current => ({ ...current, assignedEmployeeId: event.target.value }))}><option value="">Chọn nhân viên kho</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.employeeCode}</option>)}</select></label>
        <label>Hạn hoàn thành<input type="date" min={today()} value={form.dueDate} onChange={event => setForm(current => ({ ...current, dueDate: event.target.value }))}/></label>
      </div>
      <label className="warehouse-notes">Ghi chú<textarea rows="2" maxLength="2000" value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))}/></label>
      {!products.length && <p className="warehouse-notice is-error" role="alert">Chưa có sản phẩm đang kinh doanh để lập kế hoạch.</p>}
      {!employees.length && <p className="warehouse-notice is-error" role="alert">Chưa có nhân viên kho đang làm việc.</p>}
      <div className="warehouse-actions"><button className="admin-primary" disabled={saving || !products.length || !employees.length}>{saving ? 'Đang lưu…' : 'Lưu kế hoạch'}</button><button type="button" className="admin-action" disabled={saving} onClick={() => setShowForm(false)}>Hủy</button></div>
    </form>}
    {error ? <ListError message={error} onRetry={() => setReload(value => value + 1)} /> : <Table headers={['Kế hoạch', 'Sản phẩm', 'Chỉ tiêu', 'Đã hoàn thành', 'Nhân viên kho', 'Hạn', 'Trạng thái', 'Thao tác']}>
      {(data?.content || []).map(plan => <tr key={plan.id}><td><b>{plan.planCode}</b></td><td>{plan.productName}<small>Công thức v{plan.recipeVersion}</small></td><td>{plan.targetQuantity}</td><td>{plan.completedQuantity}</td><td>{plan.assignedEmployeeName}</td><td>{plan.dueDate || '—'}</td><td>{statusLabel(plan.status)}</td><td>{plan.status === 'PLANNED' && <button type="button" className="admin-action warehouse-danger-action" onClick={() => cancel(plan)}>Hủy kế hoạch</button>}</td></tr>)}
    </Table>}
    {!error && data?.content?.length === 0 && <p className="warehouse-empty"><ClipboardList size={18}/> Chưa có kế hoạch sản xuất.</p>}
    {notice && <p className="warehouse-notice" role="status">{notice}</p>}
  </section>;
}
