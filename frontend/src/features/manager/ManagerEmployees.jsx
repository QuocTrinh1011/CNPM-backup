import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/manager-api';
import { ListError, PageControls, PanelLoading, PanelTitle, Table } from './ManagerComponents';

export default function ManagerEmployees() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, page: String(page), size: '15' });
    setData(null);
    setError('');
    adminApi(`/api/manager/employees?${params}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message || 'Không tải được danh sách nhân viên.');
      });
    return () => controller.abort();
  }, [query, page, reload]);

  if (!data && !error) return <PanelLoading />;

  return (
    <section className="admin-panel">
      <PanelTitle title="Nhân viên" subtitle="Danh bạ nhân viên nội bộ. Chỉ Admin quản lý tài khoản và phân quyền." />
      <label className="admin-search-wrap">
        Tìm nhân viên
        <input
          type="search"
          aria-label="Tìm nhân viên"
          value={query}
          placeholder="Tên hoặc email"
          onChange={(event) => { setPage(0); setQuery(event.target.value); }}
        />
      </label>
      {error ? (
        <ListError message={error} onRetry={() => setReload((value) => value + 1)} />
      ) : (
        <>
          {data.content?.length ? (
            <Table headers={['Nhân viên', 'Email', 'Điện thoại', 'Trạng thái']}>
              {data.content.map((employee) => (
                <tr key={employee.id}>
                  <td><b>{employee.fullName}</b></td>
                  <td>{employee.email || '—'}</td>
                  <td>{employee.phone || '—'}</td>
                  <td>{employee.locked ? 'Đã khóa' : 'Hoạt động'}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="admin-table-empty">Chưa có nhân viên phù hợp.</p>
          )}
          <PageControls
            page={page}
            totalPages={data.totalPages || 0}
            totalElements={data.totalElements}
            onPage={setPage}
          />
        </>
      )}
    </section>
  );
}
