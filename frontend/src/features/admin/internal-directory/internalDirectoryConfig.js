import { Package, ShieldCheck, Truck } from 'lucide-react';

export const ROLE_CONFIG = {
  ADMIN: { label: 'Admin hệ thống', bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' },
  MANAGER_SALES: { label: 'Quản lý Bán hàng', bg: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' },
  MANAGER_WAREHOUSE: { label: 'Quản lý Kho', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  MANAGER_HR: { label: 'Quản lý Nhân sự', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
  EMPLOYEE: { label: 'Nhân viên', bg: 'rgba(148, 163, 184, 0.15)', color: '#64748b' },
  CUSTOMER: { label: 'Khách hàng', bg: 'rgba(20, 184, 166, 0.15)', color: '#0f9f91' },
  MANAGER: { label: 'Quản lý cửa hàng', bg: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' },
};
export const WORK_AREA_LABELS = {
  SALES: 'Nhân viên bán hàng',
  WAREHOUSE: 'Nhân viên kho',
  GENERAL: 'Nhân viên chưa phân loại',
};
export const ACCOUNT_GROUPS = [
  { id: 'managers', label: 'Tài khoản quản lý', title: 'Tài khoản quản lý', description: 'Admin hệ thống và các vai trò Manager.' },
  { id: 'employees', label: 'Tài khoản nhân viên', title: 'Tài khoản nhân viên', description: 'Danh sách nhân viên nội bộ.' },
  { id: 'customers', label: 'Tài khoản khách hàng', title: 'Tài khoản khách hàng', description: 'Quản lý thông tin và trạng thái tài khoản khách hàng.' },
];

export const DIRECTORY_TITLES = {
  accounts: { title: 'Tài khoản nội bộ', desc: 'Quản trị Admin, các vai trò Manager và danh bạ nhân viên', icon: ShieldCheck },
  products: { title: 'Tra cứu sản phẩm', desc: 'Xem danh mục, giá bán và số lượng tồn kho', icon: Package },
  suppliers: { title: 'Nhà cung cấp', desc: 'Quản lý thông tin liên hệ và đối tác phân phối hàng hóa', icon: Truck },
};
