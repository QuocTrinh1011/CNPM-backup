export const returnLabels = {
  NONE: 'Không có', REQUESTED: 'Đã yêu cầu đổi trả — chờ xử lý',
  APPROVED: 'Đổi trả đã được chấp thuận', REJECTED: 'Yêu cầu đổi trả đã bị từ chối',
  COMPLETED: 'Đổi trả đã xử lý',
};
export const hasReturn = order => !!order?.returnStatus && order.returnStatus !== 'NONE';
export const showReturn = order => order?.status !== 'CANCELLED' && hasReturn(order);
export const returnLabel = status => returnLabels[status] || 'Đang đổi trả';
export const displayOrderLabel = (order, labels) => showReturn(order) ? returnLabel(order.returnStatus) : labels[order.status] || order.status;
export const deliveryLabel = (order, labels) => hasReturn(order) && order.status === 'DELIVERED' ? 'Đã giao' : labels[order.status] || order.status;
