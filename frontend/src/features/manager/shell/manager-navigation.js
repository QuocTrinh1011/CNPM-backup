import { TicketPercent } from "lucide-react";
import { LayoutDashboard, Users as UsersIcon, Package, Warehouse, FlaskConical, Factory, ShoppingCart, MessageSquare, ClipboardList, Sparkles, ReceiptText, BarChart3, UserRound, CalendarDays, Wallet, ClipboardCheck, UsersRound } from "lucide-react";
export const navItems = [["dashboard", "Tổng quan"], ["employees", "Nhân viên"], ["leave-requests", "Duyệt đơn nghỉ"], ["attendance", "Chấm công"], ["payroll", "Bảng lương"], ["hr-reports", "Báo cáo nhân sự"], ["my-profile", "Thông tin của tôi"], ["my-requests", "Đơn nghỉ của tôi"], ["my-attendance", "Chấm công của tôi"], ["my-payslips", "Phiếu lương của tôi"], ["warehouse-tasks", "Công việc kho"], ["my-team", "Nhân viên trong nhóm"], ["my-team-attendance", "Chấm công nhóm"], ["users", "Khách hàng"], ["products", "Sản phẩm"], ["stock-receipts", "Nhập kho"], ["materials", "Nguyên liệu"], ["recipes", "Công thức sản phẩm"], ["production-plans", "Kế hoạch sản xuất"], ["warehouse-approvals", "Duyệt yêu cầu kho"], ["warehouse-reports", "Báo cáo kho"], ["orders", "Đơn hàng"], ["invoices", "Hóa đơn"], ["feedback", "Phản hồi"], ["surveys", "Khảo sát"], ["vouchers", "Voucher"], ["promotions", "Chiến dịch khuyến mãi"], ["reports", "Báo cáo"]];
export const validSections = new Set(navItems.map(([key]) => key));
export const managerRoleSections = {
  MANAGER_SALES: new Set(["dashboard", "users", "products", "orders", "invoices", "feedback", "surveys", "vouchers", "promotions", "reports"]),
  MANAGER_WAREHOUSE: new Set(["products", "stock-receipts", "materials", "recipes", "production-plans", "warehouse-approvals", "warehouse-reports"]),
  MANAGER_HR: new Set(["employees", "leave-requests", "attendance", "payroll", "hr-reports"]),
  EMPLOYEE: new Set(["my-profile", "my-requests", "my-attendance", "my-payslips"])
};
export const managerLandingPaths = {
  MANAGER_SALES: "/manager/orders",
  MANAGER_WAREHOUSE: "/manager/products",
  MANAGER_HR: "/manager/employees",
  EMPLOYEE: "/manager/my-profile"
};
export const managerNavGroups = {
  MANAGER_SALES: [["Tổng quan", ["dashboard"]], ["Bán hàng", ["orders", "invoices"]], ["Khách hàng & CSKH", ["users", "feedback", "surveys"]], ["Danh mục", ["products", "vouchers", "promotions"]], ["Phân tích", ["reports"]]],
  MANAGER_WAREHOUSE: [["Tổng quan", ["dashboard"]], ["Danh mục", ["products"]], ["Kho", ["stock-receipts", "materials", "recipes"]], ["Sản xuất", ["production-plans", "warehouse-approvals"]], ["Phân tích", ["warehouse-reports"]]],
  MANAGER_HR: [["Nhân sự", ["employees", "leave-requests", "attendance", "payroll", "hr-reports"]]],
  EMPLOYEE: [["Của tôi", ["my-profile", "my-requests", "my-attendance", "my-payslips"]], ["Nhóm", ["my-team", "my-team-attendance"]], ["Công việc", ["warehouse-tasks"]]]
};
export const pageSubtitles = {
  orders: "Theo dõi và xử lý đơn hàng trong ngày.",
  products: "Danh mục, giá bán và tồn kho.",
  users: "Hồ sơ và lịch sử mua hàng của khách.",
  invoices: "Đối soát hóa đơn và thanh toán.",
  reports: "Hiệu quả bán hàng theo kỳ.",
  feedback: "Phản hồi mới từ khách hàng.",
  surveys: "Khảo sát và mức độ hài lòng.",
  employees: "Hồ sơ và tình trạng làm việc."
};
export const navIcons = {
  dashboard: LayoutDashboard,
  employees: UsersIcon,
  users: UsersIcon,
  products: Package,
  'stock-receipts': Package,
  materials: Warehouse,
  recipes: FlaskConical,
  'production-plans': Factory,
  'warehouse-approvals': ClipboardCheck,
  'warehouse-reports': BarChart3,
  orders: ShoppingCart,
  invoices: ReceiptText,
  feedback: MessageSquare,
  surveys: ClipboardList,
  vouchers: TicketPercent,
  promotions: Sparkles,
  reports: BarChart3,
  'leave-requests': ClipboardCheck,
  attendance: CalendarDays,
  payroll: Wallet,
  'hr-reports': BarChart3,
  'my-profile': UserRound,
  'my-requests': ClipboardCheck,
  'my-attendance': CalendarDays,
  'my-payslips': Wallet,
  'warehouse-tasks': Factory,
  'my-team': UsersRound,
  'my-team-attendance': CalendarDays
};
export const userOrigin = import.meta.env.VITE_USER_ORIGIN || "http://localhost:5173";
export const normalizeAdminPath = value => {
  if (value === "/manager/login") return value;
  if (/^\/manager\/users\/[^/]+$/.test(value)) return value;
  const pathname = value.split("?")[0];
  if (pathname === "/manager" || pathname === "/manager/") return "/manager";
  const key = pathname.replace(/^\/manager\/?/, "").split("/")[0] || "dashboard";
  return validSections.has(key) ? `/manager/${key}` : "/manager";
};
