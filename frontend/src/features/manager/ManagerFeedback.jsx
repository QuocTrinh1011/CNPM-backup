import React, { useCallback, useState } from "react";
import { useManagerList as useAdminList } from "../../shared/hooks/useManagerResource";
import { pageData } from "./manager-data";
import { PanelLoading, Table, ListError, PageControls, PanelTitle } from "./ManagerComponents";
import { adminApi, adminEndpoints } from "../../api/manager-api";

export default function Feedback({ notify }) {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [replying, setReplying] = useState(null);
  const [reply, setReply] = useState("");
  const [actionError, setActionError] = useState("");
  const endpoint = useCallback(() => adminEndpoints.feedback({ page }), [page]);
  const { data, load, loading, error } = useAdminList(endpoint);
  const update = async (item, changes) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await adminApi(adminEndpoints.feedbackItem(item.id), {
        method: "PATCH",
        body: changes,
      });
      notify("Đã cập nhật phản hồi.");
      setReplying(null);
      await load();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (busy || !deleting) return;
    setBusy(true);
    setActionError("");
    try {
      await adminApi(adminEndpoints.feedbackItem(deleting.id), {
        method: "DELETE",
      });
      setDeleting(null);
      notify("Đã xóa phản hồi khỏi trang sản phẩm và danh sách quản lý.");
      if (page > 0 && pageData(data).length === 1) setPage(page - 1);
      else await load();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <PanelLoading />;
  if (error)
    return (
      <div className="admin-panel">
        <ListError message={error} onRetry={load} />
      </div>
    );
  return (
    <div className="admin-panel admin-feedback-panel">
      <PanelTitle
        title="Phản hồi"
        subtitle="Theo dõi đánh giá và quản lý nội dung hiển thị."
      />
      {actionError && !deleting && !replying && (
        <p role="alert" className="danger-text">
          {actionError}
        </p>
      )}
      <Table
        headers={[
          "Khách hàng",
          "Sản phẩm",
          "Đánh giá",
          "Nội dung",
          "Trạng thái",
          "Hiển thị",
          "Thao tác",
        ]}
      >
        {pageData(data).map((item) => (
          <tr key={item.id}>
            <td>
              <div className="admin-table-customer">
                <span className="admin-customer-avatar">
                  {(item.customer?.fullName || "C").trim().slice(0, 1).toUpperCase()}
                </span>
                <span>{item.customer?.fullName || "Customer"}</span>
              </div>
            </td>
            <td>
              <b>{item.product?.name || "—"}</b>
            </td>
            <td>
              <span
                className="admin-star-rating"
                aria-label={`${item.rating} trên 5 sao`}
              >
                {"★".repeat(item.rating)}
              </span>
            </td>
            <td className="admin-feedback-content">
              {item.comment || "—"}
              {item.adminResponse && (
                <div className="admin-feedback-reply">
                  <b>Shop trả lời</b>
                  <p>{item.adminResponse}</p>
                </div>
              )}
            </td>
            <td>
              <select
                className="admin-inline-status-select"
                aria-label={`Trạng thái phản hồi ${item.id}`}
                value={item.status || "NEW"}
                disabled={busy}
                onChange={(event) =>
                  update(item, { status: event.target.value })
                }
              >
                <option value="NEW">Mới</option>
                <option value="IN_PROGRESS">Đang xử lý</option>
                <option value="RESOLVED">Đã xử lý</option>
              </select>
            </td>
            <td>
              <span
                className={`admin-badge ${item.hidden ? "danger" : "success"}`}
              >
                <span className="admin-badge-dot" />
                {item.hidden ? "Đã ẩn" : "Công khai"}
              </span>
            </td>
            <td>
              <div className="admin-feedback-actions">
                <button
                  className="admin-action"
                  disabled={busy}
                  onClick={() => {
                    setActionError("");
                    setReplying(item);
                    setReply(item.adminResponse || "");
                  }}
                >
                  {item.adminResponse ? "Sửa trả lời" : "Trả lời"}
                </button>
                <button
                  className="admin-action"
                  disabled={busy}
                  onClick={() => update(item, { hidden: !item.hidden })}
                >
                  {item.hidden ? "Hiện lại" : "Ẩn"}
                </button>
                <button
                  className="admin-action danger-text"
                  disabled={busy}
                  onClick={() => {
                    setActionError("");
                    setDeleting(item);
                  }}
                >
                  Xóa
                </button>
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
        disabled={busy}
      />
      {replying && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setReplying(null);
          }}
        >
          <form
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reply-title"
            onSubmit={(event) => {
              event.preventDefault();
              if (reply.trim())
                update(replying, { adminResponse: reply.trim() });
            }}
          >
            <h2 id="admin-reply-title">
              {replying.adminResponse
                ? "Sửa câu trả lời"
                : "Trả lời khách hàng"}
            </h2>
            <p className="admin-feedback-quote">
              <b>{replying.customer?.fullName || "Khách hàng"}</b>:{" "}
              {replying.comment}
            </p>
            <label htmlFor="admin-feedback-reply">Nội dung trả lời</label>
            <textarea
              id="admin-feedback-reply"
              required
              maxLength={4000}
              disabled={busy}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
            <small>
              {reply.length}/4000 ký tự · Câu trả lời hiển thị cùng đánh giá
              công khai.
            </small>
            {actionError && (
              <p role="alert" className="danger-text">
                {actionError}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setReplying(null)}
              >
                Quay lại
              </button>
              <button
                className="admin-primary"
                disabled={busy || !reply.trim()}
              >
                {busy ? "Đang lưu..." : "Lưu trả lời"}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleting && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setDeleting(null);
          }}
        >
          <div
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-delete-feedback-title"
          >
            <h2 id="admin-delete-feedback-title">Xóa phản hồi?</h2>
            <p>
              Phản hồi của {deleting.customer?.fullName || "khách hàng"} sẽ bị gỡ
              khỏi trang sản phẩm và danh sách quản lý. Dữ liệu lịch sử vẫn được
              giữ lại.
            </p>
            {actionError && (
              <p role="alert" className="danger-text">
                {actionError}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button disabled={busy} onClick={() => setDeleting(null)}>
                Quay lại
              </button>
              <button
                className="admin-primary admin-danger-button"
                disabled={busy}
                onClick={remove}
              >
                {busy ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
