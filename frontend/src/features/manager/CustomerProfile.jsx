import React, { useCallback, useState } from 'react';
import { displayOrderLabel } from '../../shared/utils/order-display';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import { useManagerResource } from '../../shared/hooks/useManagerResource';
import ManagerOrderDetail, {
  money,
  date,
  orderLabels,
  paymentLabels,
  returnLabels,
} from './ManagerOrderDetail';
import './customer-profile.css';
import CustomerLifecycle, { lifecycleExplanation } from './CustomerLifecycle';
const CustomerCare = React.lazy(() => import('./CustomerCare'));

const tabs = [
  ['orders', 'Đơn hàng'],
  ['activities', 'Lịch sử hoạt động'],
  ['addresses', 'Địa chỉ'],
  ['feedback', 'Đánh giá'],
  ['surveys', 'Khảo sát'],
  ['vouchers', 'Voucher'],
  ['care', 'Chăm sóc'],
];
const voucherLabels = {
  AVAILABLE: 'Còn sử dụng',
  USED: 'Đã dùng',
  EXPIRED: 'Hết hạn',
  DISABLED: 'Đã tắt',
  UPCOMING: 'Chưa đến hạn',
};
const feedbackLabels = { NEW: 'Mới', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã xử lý' };
const releaseLabels = {
  UNKNOWN: 'Chưa có dữ liệu hoàn lượt',
  RELEASED: 'Đã hoàn lượt',
  COUNTED: 'Đang tính lượt',
};
const text = value => (value == null || value === '' ? 'Chưa khai báo' : value);
function ErrorBox({ message, retry }) {
  return (
    <div className="admin-list-error" role="alert">
      <p>{message}</p>
      <button className="admin-action" onClick={retry}>
        Thử lại
      </button>
    </div>
  );
}
function useProfileData(url, enabled = true) {
  const fetcher = useCallback(signal => adminApi(url, { signal }), [url]);
  return useManagerResource(fetcher, { enabled });
}
export default function CustomerProfile({ customerId, location, go }) {
  const validId = /^[1-9][0-9]*$/.test(customerId);
  const base = `/api/manager/users/${customerId}/profile`;
  const resource = useProfileData(base, validId);
  const params = new URLSearchParams(location.split('?')[1]);
  const tab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'orders';
  const page = Math.max(0, Number.parseInt(params.get('historyPage'), 10) || 0);
  const [detailId, setDetailId] = useState(null);
  const detail = useProfileData(detailId ? adminEndpoints.order(detailId) : '', !!detailId);
  const navigate = (nextTab, nextPage = 0) => {
    const next = new URLSearchParams(params);
    next.set('tab', nextTab);
    next.set('historyPage', String(nextPage));
    go(`users/${customerId}?${next}`);
  };
  const back = () => {
    const next = new URLSearchParams(params);
    next.delete('tab');
    next.delete('historyPage');
    for (const key of [...next.keys()]) if (key.startsWith('care_')) next.delete(key);
    if (!next.has('q')) next.set('q', '');
    if (!next.has('page')) next.set('page', '0');
    go(`users?${next}`);
  };
  const { data, error, loading, load } = resource;
  const customer = data?.customer,
    summary = data?.summary;
  return (
    <section className="customer-profile">
      <button className="admin-action" onClick={back}>
        ← Danh sách khách hàng
      </button>
      {!validId ? (
        <p role="alert">Không tìm thấy khách hàng.</p>
      ) : loading && !data ? (
        <p role="status">Đang tải hồ sơ...</p>
      ) : error && !data ? (
        <ErrorBox message={error} retry={() => load()} />
      ) : (
        customer && (
          <>
            <div className="admin-panel profile-identity">
              <button
                className="admin-action"
                onClick={() => go(`support-tickets?customerId=${customer.id}`)}
              >
                Phiếu hỗ trợ của khách
              </button>
              <div>
                <h2>{customer.fullName}</h2>
                <span className="admin-status">
                  {customer.locked ? 'Đã khóa' : 'Đang hoạt động'}
                </span>
              </div>
              <CustomerLifecycle segment={data.segmentation} />
              {data.segmentation && <p className="profile-explanation">{lifecycleExplanation}</p>}
              <dl className="profile-fields">
                <div>
                  <dt>Email</dt>
                  <dd>{text(customer.email)}</dd>
                </div>
                <div>
                  <dt>Điện thoại</dt>
                  <dd>{text(customer.phone)}</dd>
                </div>
                <div>
                  <dt>Tuổi</dt>
                  <dd>{text(customer.age)}</dd>
                </div>
                <div>
                  <dt>Ngày đăng ký</dt>
                  <dd>{date(customer.createdAt)}</dd>
                </div>
                <div className="profile-wide">
                  <dt>Sở thích</dt>
                  <dd>{text(customer.preferences)}</dd>
                </div>
                {customer.locked && (
                  <div className="profile-wide">
                    <dt>Lý do khóa</dt>
                    <dd>{text(customer.lockReason)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="profile-metrics">
              {[
                ['Tổng đơn', summary.totalOrders],
                ['Đơn hoàn thành', summary.completedOrders],
                ['Đơn hủy', summary.cancelledOrders],
                ['Đơn có yêu cầu đổi trả', summary.returnOrders],
                ['Giá trị đơn hoàn thành', money(summary.completedValue)],
                ['Ngày đặt gần nhất (đơn hoàn thành)', date(summary.lastCompletedOrderAt)],
              ].map(([label, value]) => (
                <div className="admin-panel" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="profile-explanation">
              Giá trị đơn hoàn thành là tổng tiền sau giảm giá của đơn COMPLETED, chưa trừ hoàn
              tiền; bao gồm đơn có yêu cầu đổi trả. Đây không phải số tiền đã thu.
            </p>
            <div className="admin-panel">
              <nav className="profile-tabs" aria-label="Nội dung hồ sơ">
                {tabs.map(([key, label]) => (
                  <button
                    key={key}
                    className={tab === key ? 'admin-primary' : 'admin-action'}
                    aria-current={tab === key ? 'page' : undefined}
                    onClick={() => navigate(key)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {tab === 'care' ? (
                <CustomerCare customer={customer} go={go} location={location} />
              ) : tab === 'vouchers' ? (
                <div className="profile-voucher-sections">
                  <ProfileList key="issued" base={base} kind="vouchers" title="Voucher được cấp" />
                  <ProfileList
                    key="usage"
                    base={base}
                    kind="voucher-usages"
                    title="Lịch sử sử dụng"
                    onDetail={setDetailId}
                  />
                </div>
              ) : (
                <ProfileList
                  key={tab}
                  base={base}
                  kind={tab}
                  title={tabs.find(([key]) => key === tab)[1]}
                  controlledPage={page}
                  onPage={next => navigate(tab, next)}
                  onDetail={setDetailId}
                  go={go}
                />
              )}
            </div>
          </>
        )
      )}
      {detailId && (
        <ManagerOrderDetail
          detail={detail.data || { id: detailId }}
          loading={detail.loading && !detail.data}
          error={detail.error}
          onRetry={() => detail.load()}
          onClose={() => setDetailId(null)}
        />
      )}
    </section>
  );
}

function ActivityRecord({ row, onDetail, go }) {
  const types = {
    ORDER: 'Đơn hàng',
    FEEDBACK: 'Đánh giá',
    SURVEY: 'Khảo sát',
    SUPPORT_TICKET: 'Phiếu hỗ trợ',
    CARE_TASK: 'Công việc chăm sóc',
  };
  const actions = {
    CREATED: 'Đã tạo',
    SUBMITTED: 'Đã hoàn thành khảo sát',
    COMPLETED: 'Đã hoàn thành',
    UPDATE: 'Đã cập nhật',
    ORDER_STATUS: 'Đổi trạng thái đơn',
    RETURN_PROCESS: 'Xử lý đổi trả',
    DELETE: 'Đã xóa',
    HIDE: 'Đã ẩn',
    SHOW: 'Đã hiện',
    CUSTOMER_CANCEL: 'Khách hàng đã hủy đơn',
    CUSTOMER_RECEIPT: 'Khách hàng đã xác nhận nhận hàng',
  };
  return (
    <>
      <h3>
        {types[row.type] || 'Hoạt động'} #{row.targetId}
      </h3>
      <p>
        {actions[row.action] || 'Đã cập nhật'} ·{' '}
        <time dateTime={row.createdAt}>{date(row.createdAt)}</time>
      </p>
      {row.type === 'ORDER' && (
        <button className="admin-action" onClick={() => onDetail(row.targetId)}>
          Chi tiết đơn
        </button>
      )}
      {row.type === 'SUPPORT_TICKET' && (
        <button className="admin-action" onClick={() => go(`support-tickets?id=${row.targetId}`)}>
          Xem phiếu hỗ trợ
        </button>
      )}
      {row.type === 'CARE_TASK' && (
        <button className="admin-action" onClick={() => go(`care?taskId=${row.targetId}`)}>
          Xem công việc
        </button>
      )}
    </>
  );
}
function ProfileList({ base, kind, title, controlledPage, onPage, onDetail, go }) {
  const [localPage, setLocalPage] = useState(0);
  const page = controlledPage ?? localPage;
  const setPage = onPage || setLocalPage;
  const { data, loading, error, load } = useProfileData(`${base}/${kind}?page=${page}&size=10`);
  return (
    <section className="profile-history" aria-label={title}>
      <h2>{title}</h2>
      {loading && !data ? (
        <p role="status">Đang tải {title.toLowerCase()}...</p>
      ) : error && !data ? (
        <ErrorBox message={error} retry={() => load()} />
      ) : (
        data && (
          <>
            <p>{data.totalElements} bản ghi</p>
            {kind === 'activities' && (
              <p>
                Chỉ hiển thị sự kiện đã lưu; không suy đoán thay đổi trước khi có nhật ký. Không
                hiển thị đáp án khảo sát hoặc nội dung trao đổi riêng.
              </p>
            )}
            {!data.content.length ? (
              <p className="profile-empty">Chưa có dữ liệu trong mục này.</p>
            ) : (
              <div className="profile-records">
                {data.content.map(row => (
                  <article className="profile-record" key={row.id ?? row.orderId}>
                    {kind === 'addresses' && (
                      <>
                        <h3>
                          {row.recipientName}{' '}
                          {row.defaultAddress && <span className="admin-status">Mặc định</span>}
                        </h3>
                        <p>{row.phone}</p>
                        <p>
                          {[row.addressLine, row.ward, row.district, row.province]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        {row.label && <small>{row.label}</small>}
                      </>
                    )}
                    {kind === 'orders' && (
                      <>
                        <div className="profile-row">
                          <h3>Đơn #{row.orderCode}</h3>
                          <strong>{money(row.totalAmount)}</strong>
                        </div>
                        <p>{date(row.createdAt)}</p>
                        <p>
                          {displayOrderLabel(row, orderLabels)} ·{' '}
                          {paymentLabels[row.paymentStatus] || row.paymentStatus}
                        </p>
                        <p>
                          {row.paymentMethod === 'COD'
                            ? 'Thanh toán khi nhận hàng'
                            : row.paymentMethod}{' '}
                          · Đổi trả: {returnLabels[row.returnStatus || 'NONE'] || row.returnStatus}
                        </p>
                        <button className="admin-action" onClick={() => onDetail(row.id)}>
                          Chi tiết đơn
                        </button>
                      </>
                    )}
                    {kind === 'activities' && (
                      <ActivityRecord row={row} onDetail={onDetail} go={go} />
                    )}
                    {kind === 'feedback' && (
                      <>
                        <h3>{row.productName}</h3>
                        <p>
                          {row.rating}/5 sao · {date(row.createdAt)}
                        </p>
                        <p>{row.comment || 'Không có bình luận'}</p>
                        <p>
                          {feedbackLabels[row.status] || row.status} ·{' '}
                          {row.hidden ? 'Đã ẩn' : 'Công khai'}
                        </p>
                        {row.adminResponse && (
                          <div className="profile-reply">
                            <b>Phản hồi của shop</b>
                            <p>{row.adminResponse}</p>
                          </div>
                        )}
                      </>
                    )}
                    {kind === 'surveys' && (
                      <>
                        <h3>
                          {row.title} {row.deleted && <span className="admin-status">Đã xóa</span>}
                        </h3>
                        <p>Hoàn thành: {date(row.createdAt)}</p>
                        <p>
                          {row.rewarded
                            ? 'Đã nhận voucher thưởng'
                            : 'Không có voucher thưởng được cấp'}
                        </p>
                      </>
                    )}
                    {kind === 'vouchers' && (
                      <>
                        <h3>{row.code}</h3>
                        <strong>
                          {row.discountType === 'PERCENTAGE'
                            ? `${row.discountValue}%`
                            : money(row.discountValue)}
                        </strong>
                        <p>{row.description}</p>
                        <p>
                          Đơn tối thiểu: {money(row.minOrderAmount)}
                          {row.maxDiscountAmount != null &&
                            ` · Giảm tối đa: ${money(row.maxDiscountAmount)}`}
                        </p>
                        <p>
                          Từ {date(row.startsAt)} · Hạn dùng:{' '}
                          {row.expiresAt ? date(row.expiresAt) : 'Không giới hạn'}
                        </p>
                        <span className="admin-status">
                          {voucherLabels[row.status] || row.status}
                        </span>
                      </>
                    )}
                    {kind === 'voucher-usages' && (
                      <>
                        <h3>{row.code}</h3>
                        <p>
                          Đơn #{row.orderCode} · {date(row.createdAt)}
                        </p>
                        <p>Tiền giảm trên đơn: {money(row.discountAmount)}</p>
                        <p>
                          {orderLabels[row.orderStatus] || row.orderStatus} ·{' '}
                          {releaseLabels[row.releaseStatus]}
                        </p>
                        <button className="admin-action" onClick={() => onDetail(row.orderId)}>
                          Chi tiết đơn
                        </button>
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
            {(data.totalPages > 1 || page > 0) && (
              <div className="admin-pagination">
                <span>
                  Trang {page + 1}/{Math.max(1, data.totalPages)}
                </span>
                <div>
                  <button disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>
                    Trước
                  </button>
                  <button
                    disabled={page + 1 >= data.totalPages || loading}
                    onClick={() => setPage(page + 1)}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
