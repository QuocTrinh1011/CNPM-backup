export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const currentYear = () => new Date().getFullYear();
export const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
export const monthNames = Array.from({ length: 12 }, (_, index) => index + 1);
export const employmentStatusLabel = status => ({ ACTIVE: 'Đang làm việc', RESIGNED: 'Nghỉ việc', TERMINATED: 'Đã chấm dứt' })[status] || status;
