import React, { useEffect, useState } from 'react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import { ListError, PageControls, PanelLoading, PanelTitle, Table } from './ManagerComponents';

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const emptyForm = () => ({
  fullName: '', email: '', phone: '', temporaryPassword: '', employeeCode: '', educationLevel: '', jobTitle: '',
  permissionProfile: 'STAFF', workArea: 'GENERAL', employmentStatus: 'ACTIVE', hireDate: localDate(), resignationDate: '',
  monthlyBaseSalary: '0', insuranceSalaryBase: '0', reportsToEmployeeId: '', emergencyContactName: '',
  emergencyContactPhone: '', emergencyContactRelationship: '',
});
const editableFields = [
  ['fullName', 'Họ và tên', 'text'], ['email', 'Email', 'email'], ['phone', 'Điện thoại', 'tel'],
  ['employeeCode', 'Mã nhân viên', 'text'], ['educationLevel', 'Trình độ', 'text'], ['jobTitle', 'Chức danh', 'text'],
  ['hireDate', 'Ngày nhận việc', 'date'], ['resignationDate', 'Ngày nghỉ việc', 'date'],
  ['monthlyBaseSalary', 'Lương tháng', 'number'], ['insuranceSalaryBase', 'Mức lương đóng bảo hiểm', 'number'],
  ['reportsToEmployeeId', 'ID nhân viên trưởng nhóm', 'number'], ['emergencyContactName', 'Người liên hệ khẩn cấp', 'text'],
  ['emergencyContactPhone', 'Số điện thoại khẩn cấp', 'tel'], ['emergencyContactRelationship', 'Mối quan hệ', 'text'],
];

export default function ManagerEmployees() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [formMode, setFormMode] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [confirmEmployee, setConfirmEmployee] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    adminApi(adminEndpoints.employees({ q: query, page, size: 15 }), { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Không tải được danh sách nhân viên.'); });
    return () => controller.abort();
  }, [query, page, reload]);

  const beginCreate = () => { setSelectedId(null); setForm(emptyForm()); setFormMode('create'); setNotice(''); };
  const beginEdit = employee => {
    setSelectedId(employee.id);
    setForm({ ...emptyForm(), ...employee, temporaryPassword: '', reportsToEmployeeId: employee.reportsToEmployeeId || '', hireDate: employee.hireDate || '', resignationDate: employee.resignationDate || '' });
    setFormMode('edit');
    setNotice('');
  };
  const setField = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const save = async event => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const { temporaryPassword, resignationDate, employmentStatus, ...profileFields } = form;
    const body = {
      ...profileFields,
      monthlyBaseSalary: Number(form.monthlyBaseSalary),
      insuranceSalaryBase: Number(form.insuranceSalaryBase),
      reportsToEmployeeId: form.reportsToEmployeeId ? Number(form.reportsToEmployeeId) : null,
      ...(formMode === 'create' ? { temporaryPassword } : { resignationDate: resignationDate || null, employmentStatus }),
    };
    for (const key of ['monthlyBaseSalary', 'insuranceSalaryBase']) if (!Number.isFinite(body[key])) delete body[key];
    try {
      await adminApi(formMode === 'create' ? adminEndpoints.createEmployee() : adminEndpoints.updateEmployee(selectedId), {
        method: formMode === 'create' ? 'POST' : 'PUT', body,
      });
      setNotice(formMode === 'create' ? 'Đã tạo hồ sơ và tài khoản nhân viên.' : 'Đã cập nhật hồ sơ nhân viên.');
      setFormMode(null);
      setReload(value => value + 1);
    } catch (failure) {
      setNotice(failure.message || 'Không thể lưu hồ sơ nhân viên.');
    } finally { setBusy(false); }
  };
  const deactivate = async () => {
    if (!confirmEmployee) return;
    setBusy(true);
    try {
      await adminApi(adminEndpoints.deactivateEmployee(confirmEmployee.id), { method: 'DELETE' });
      setNotice(`Đã ngừng hoạt động ${confirmEmployee.fullName}.`);
      setConfirmEmployee(null);
      setReload(value => value + 1);
    } catch (failure) { setNotice(failure.message || 'Không thể ngừng hoạt động nhân viên.'); }
    finally { setBusy(false); }
  };

  if (!data && !error) return <PanelLoading />;

  return (
    <section className="admin-panel hr-workspace">
      <PanelTitle title="Danh sách nhân viên" subtitle="HR quản lý hồ sơ và tình trạng làm việc. Admin quản lý quyền truy cập hệ thống." />
      <div className="hr-directory-toolbar">
        <label className="admin-search-wrap">Tìm nhân viên
          <input type="search" aria-label="Tìm nhân viên" value={query} placeholder="Tên hoặc email" onChange={event => { setPage(0); setQuery(event.target.value); }} />
        </label>
        <button className="admin-primary" type="button" onClick={beginCreate}>Thêm nhân viên</button>
      </div>
      {formMode && <form className="hr-form-grid hr-employee-form" onSubmit={save}>
        <h3>{formMode === 'create' ? 'Thêm hồ sơ nhân viên' : 'Cập nhật hồ sơ nhân viên'}</h3>
        {editableFields.filter(([field]) => formMode === 'create' ? field !== 'resignationDate' : true).map(([field, label, type]) => <label key={field}>{label}
          <input required={['fullName','email','employeeCode','jobTitle','hireDate'].includes(field)} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '1000' : undefined} value={form[field] ?? ''} onChange={event => setField(field, event.target.value)} />
        </label>)}
        {formMode === 'create' && <label>Mật khẩu tạm thời<input aria-label="Mật khẩu tạm thời" type="password" required minLength="8" autoComplete="new-password" value={form.temporaryPassword} onChange={event => setField('temporaryPassword', event.target.value)} /></label>}
        <label>Quyền trong nhóm<select value={form.permissionProfile || 'STAFF'} onChange={event => setField('permissionProfile', event.target.value)}><option value="STAFF">Nhân viên</option><option value="TEAM_LEAD">Trưởng nhóm</option></select></label>
        <label>Khu vực làm việc<select aria-label="Khu vực làm việc" value={form.workArea || 'GENERAL'} onChange={event => setField('workArea', event.target.value)}><option value="GENERAL">Chung</option><option value="SALES">Bán hàng</option><option value="WAREHOUSE">Kho</option></select></label>
        <p className="hr-form-help">Để gán trưởng nhóm, nhập ID hồ sơ của nhân viên có quyền Trưởng nhóm. Bỏ trống nếu không thuộc nhóm.</p>
        {formMode === 'edit' && <label>Tình trạng<select value={form.employmentStatus || 'ACTIVE'} onChange={event => setField('employmentStatus', event.target.value)}><option value="ACTIVE">Đang làm việc</option><option value="RESIGNED">Nghỉ việc</option><option value="TERMINATED">Đã chấm dứt</option></select></label>}
        <div className="hr-form-actions"><button className="admin-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : formMode === 'create' ? 'Tạo hồ sơ' : 'Lưu hồ sơ'}</button><button type="button" disabled={busy} onClick={() => setFormMode(null)}>Hủy</button></div>
      </form>}
      {error ? <ListError message={error} onRetry={() => setReload(value => value + 1)} /> : <>
        {data.content?.length ? <Table headers={['ID','Mã NV','Nhân viên','Chức danh','Điện thoại','Tình trạng','Thao tác']}>
          {data.content.map(employee => <tr key={employee.id}>
            <td>{employee.id}</td>
            <td>{employee.employeeCode || '—'}</td>
            <td><b>{employee.fullName}</b><small>{employee.email || '—'}</small></td>
            <td>{employee.jobTitle || '—'}<small>{employee.permissionProfile === 'TEAM_LEAD' ? 'Trưởng nhóm' : 'Nhân viên'}</small></td>
            <td>{employee.phone || '—'}</td>
            <td>{employee.employmentStatus === 'ACTIVE' && !employee.locked ? 'Đang làm việc' : employee.employmentStatus === 'RESIGNED' ? 'Nghỉ việc' : employee.employmentStatus === 'TERMINATED' ? 'Đã chấm dứt' : 'Đã khóa'}</td>
            <td className="hr-inline-actions"><button type="button" onClick={() => beginEdit(employee)} aria-label={`Sửa ${employee.fullName}`}>Sửa</button><button type="button" className="hr-danger" onClick={() => setConfirmEmployee(employee)} aria-label={`Ngừng hoạt động ${employee.fullName}`}>Ngừng hoạt động</button></td>
          </tr>)}
        </Table> : <p className="admin-table-empty">Chưa có nhân viên phù hợp.</p>}
        <PageControls page={page} totalPages={data.totalPages || 0} totalElements={data.totalElements} onPage={setPage} />
      </>}
      {notice && <p role="status" className="hr-notice">{notice}</p>}
      {confirmEmployee && <div className="hr-confirm-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="hr-deactivate-title" className="hr-confirm-dialog">
        <h3 id="hr-deactivate-title">Ngừng hoạt động nhân viên?</h3><p>{confirmEmployee.fullName} sẽ không thể tiếp tục đăng nhập. Hồ sơ chấm công và phiếu lương cũ vẫn được giữ lại.</p>
        <div className="hr-form-actions"><button type="button" className="hr-danger" disabled={busy} onClick={deactivate}>{busy ? 'Đang xử lý…' : 'Xác nhận ngừng hoạt động'}</button><button type="button" disabled={busy} onClick={() => setConfirmEmployee(null)}>Hủy</button></div>
      </div></div>}
    </section>
  );
}
