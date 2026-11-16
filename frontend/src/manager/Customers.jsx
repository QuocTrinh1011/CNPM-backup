import React, { useCallback, useEffect, useState } from "react";
import { adminApi, adminEndpoints } from "../manager-api";
import CustomerLifecycle, { CustomerLifecycleFilters } from "../CustomerLifecycle";
import { useManagerList, useManagerReadPause } from "../useManagerResource";
import { CustomerCreate } from "../ManagerTools";
import { groupSurveyRoute } from "../SurveyRecipientGroup";
import { X, Search } from "lucide-react";
import { money, pageData, Table, ListError, PageControls, PanelTitle } from "./shared";

export function Users({ notify, location, go }) {
  const params = new URLSearchParams(location.split('?')[1]);
  const page = Math.max(0, Number.parseInt(params.get('page'), 10) || 0);
  const query = params.get('q') || '';
  const [search, setSearch] = useState(query);
  useEffect(() => setSearch(query), [query]);
  const changeFilters = patch => {const next=new URLSearchParams(params);Object.entries(patch).forEach(([k,v])=>v===''?next.delete(k):next.set(k,String(v)));if(!Object.hasOwn(patch,'page'))next.set('page','0');go(`users?${next}`);};
  const setPage = next => changeFilters({page:next});
  const searchUsers = value => changeFilters({q:value.trim()});
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const filterKey=params.toString();
  const endpoint = useCallback(() => {const filters=Object.fromEntries(new URLSearchParams(filterKey));return adminEndpoints.users({...filters,page,q:query});}, [page, query,filterKey]);
  const { data:previousData, load, loading, error,stale } = useManagerList(endpoint,{keepPreviousData:true});
  const data=stale?null:previousData;
  useManagerReadPause(!!dialog || busy);
  const closeDialog = () => {
    if (!busy) {
      setDialog(null);
      setReason("");
    }
  };
  const update = async (user, locked, lockReason = "") => {
    setBusy(true);
    try {
      await adminApi(adminEndpoints.lockUser(user.id), {
        method: "PATCH",
        body: { locked, reason: locked ? lockReason.trim() : null },
      });
      notify("Đã cập nhật trạng thái tài khoản.");
      setDialog(null);
      setReason("");
      await load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (user) => {
    setBusy(true);
    try {
      await adminApi(adminEndpoints.deleteUser(user.id), { method: "DELETE" });
      notify("Đã vô hiệu hóa tài khoản. Lịch sử đơn hàng được giữ lại.");
      setDialog(null);
      if (page > 0 && pageData(data).length === 1) setPage(page - 1);
      else await load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const users = pageData(data);
  const filteredUsers = users;

  return (
    <div className="admin-panel">
      <PanelTitle
        title="Khách hàng"
        subtitle="Theo dõi và kiểm soát tài khoản customer."
      />
      <CustomerCreate onSaved={load}/>
      <div className="admin-table-toolbar">
        <div className="admin-search-wrap">
          <Search size={15} className="admin-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="admin-search-input"
            placeholder="Tìm theo tên, email, SĐT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') searchUsers(search); }}
          />
          {search && (
            <button
              type="button"
              className="admin-search-clear"
              onClick={() => { setSearch(''); searchUsers(''); }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <span className="admin-toolbar-count">
          {data?.totalElements ?? filteredUsers.length} khách hàng
        </span>
        <button className="admin-action" onClick={() => searchUsers(search)}>Tìm khách hàng</button>
      </div>
      <CustomerLifecycleFilters params={params} onChange={changeFilters}/>
      <button type="button" className="admin-action" onClick={()=>go(groupSurveyRoute(params),{createGroupedSurvey:true})}>Tạo khảo sát cho nhóm này</button>
      {error&&!previousData&&<ListError message={error} onRetry={load}/>}
      {loading&&<p role="status">Đang tải khách hàng...</p>}
      {!loading&&!error&&!filteredUsers.length&&<p>Không có khách hàng phù hợp bộ lọc.</p>}
      <Table
        className="manager-customer-table"
        headers={["Họ tên", "Email", "Điện thoại", "Phân nhóm", "Mua hàng", "Trạng thái", "Thao tác"]}
      >
        {filteredUsers.map((user) => (
          <tr key={user.id}>
            <td>
              <div className="admin-table-customer">
                <span className="admin-customer-avatar">
                  {(user.fullName || "C").trim().slice(0, 1).toUpperCase()}
                </span>
                <b>{user.fullName}</b>
              </div>
            </td>
            <td>{user.email}</td>
            <td>{user.phone || "—"}</td>
            <td><CustomerLifecycle segment={user.segmentation}/></td>
            <td><div className="customer-purchase-metrics"><span>{user.completedOrders??0} đơn hoàn thành</span><strong>{money(user.completedValue??0)}</strong><span>{user.lastCompletedOrderAt?new Date(user.lastCompletedOrderAt).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa mua hàng'}</span></div></td>
            <td>
              <span
                className={`admin-badge ${user.locked ? "danger" : "success"}`}
              >
                <span className="admin-badge-dot" />
                {user.locked ? "Đã khóa" : "Hoạt động"}
              </span>
            </td>
            <td>
              <div className="admin-table-row-actions">
                <button
                  className="admin-action"
                  onClick={() =>
                    user.locked
                      ? update(user, false)
                      : setDialog({ type: "lock", user })
                  }
                >
                  {user.locked ? "Mở khóa" : "Khóa"}
                </button>
                <button
                  className="admin-action danger-text"
                  onClick={() => setDialog({ type: "delete", user })}
                >
                  Xóa
                </button>
                <CustomerCreate user={user} onSaved={load}/>
                <button className="admin-action" onClick={() => go(`users/${user.id}?${new URLSearchParams({q:query,page:String(page),...Object.fromEntries(params)})}`)}>Xem hồ sơ</button>
                {user.segmentation?.dormant&&<button className="admin-action" onClick={()=>go(`care?customerId=${user.id}`)}>Tạo chăm sóc</button>}
              </div>
            </td>
          </tr>
        ))}
      </Table>
      <PageControls
        page={page}
        totalPages={data?.totalPages || 0}
        totalElements={data?.totalElements}
        onPage={setPage}
      />
      {dialog && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-dialog-title"
          >
            <h2 id="admin-user-dialog-title">
              {dialog.type === "lock"
                ? "Khóa tài khoản"
                : "Vô hiệu hóa tài khoản"}
            </h2>
            <p>
              <strong>{dialog.user.fullName}</strong> · {dialog.user.email}
            </p>
            {dialog.type === "lock" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (reason.trim()) update(dialog.user, true, reason);
                }}
              >
                <label htmlFor="admin-lock-reason">
                  Lý do khóa gửi đến người dùng
                </label>
                <textarea
                  id="admin-lock-reason"
                  required
                  maxLength={2000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Nhập lý do cụ thể để người dùng thấy khi đăng nhập lại"
                />
                <small>{reason.length}/2000 ký tự</small>
                <div className="admin-dialog-actions">
                  <button type="button" onClick={closeDialog} disabled={busy}>
                    Hủy
                  </button>
                  <button
                    className="admin-primary"
                    disabled={busy || !reason.trim()}
                  >
                    {busy ? "Đang lưu..." : "Xác nhận khóa"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p>
                  Tài khoản sẽ không thể đăng nhập và biến mất khỏi danh sách.
                  Đơn hàng cũ vẫn được giữ lại.
                </p>
                <div className="admin-dialog-actions">
                  <button onClick={closeDialog} disabled={busy}>
                    Hủy
                  </button>
                  <button
                    className="admin-primary admin-danger-button"
                    disabled={busy}
                    onClick={() => remove(dialog.user)}
                  >
                    {busy ? "Đang xóa..." : "Xóa tài khoản"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
