import React, { useEffect, useState } from 'react';
import { adminApi, adminEndpoints } from '../../../api/manager-api';
import { ListError, PanelLoading, PanelTitle } from '../ManagerComponents';
import { useApiData } from './useApiData';
export function EmployeeSelfProfile() {
  const [reload, setReload] = useState(0);
  const { data, error, loading } = useApiData(adminEndpoints.myProfile(), reload);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (data) setForm({ phone: data.phone || '', emergencyContactName: data.emergencyContactName || '', emergencyContactPhone: data.emergencyContactPhone || '', emergencyContactRelationship: data.emergencyContactRelationship || '' });
  }, [data]);
  const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const save = async event => {
    event.preventDefault(); setNotice('');
    try { await adminApi(adminEndpoints.myProfile(), { method: 'PUT', body: form }); setNotice('Đã cập nhật thông tin liên hệ.'); setReload(value => value + 1); }
    catch (failure) { setNotice(failure.message || 'Không thể lưu hồ sơ.'); }
  };
  if (loading) return <PanelLoading />;
  if (error && !data) return <ListError message={error} onRetry={() => setReload(value => value + 1)} />;
  return <section className="admin-panel hr-workspace">
    <PanelTitle title="Thông tin của tôi" subtitle="Xem hồ sơ công việc và tự cập nhật thông tin liên hệ của bạn." />
    <div className="hr-profile-summary"><b>{data?.fullName}</b><span>{data?.employeeCode} · {data?.jobTitle}</span><span>{data?.employmentStatus === 'ACTIVE' ? 'Đang làm việc' : data?.employmentStatus}</span></div>
    {form && <form className="hr-form-grid" onSubmit={save}>
      <label>Điện thoại<input value={form.phone} onChange={event => update('phone', event.target.value)} /></label>
      <label>Người liên hệ khẩn cấp<input value={form.emergencyContactName} onChange={event => update('emergencyContactName', event.target.value)} /></label>
      <label>Số điện thoại khẩn cấp<input value={form.emergencyContactPhone} onChange={event => update('emergencyContactPhone', event.target.value)} /></label>
      <label>Mối quan hệ<input value={form.emergencyContactRelationship} onChange={event => update('emergencyContactRelationship', event.target.value)} /></label>
      <button className="admin-primary" type="submit">Lưu thông tin</button>
    </form>}
    {notice && <p role="status" className="hr-notice">{notice}</p>}
  </section>;
}
