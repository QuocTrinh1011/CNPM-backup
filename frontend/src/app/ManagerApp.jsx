import { showReturn } from '../shared/utils/order-display';
import CustomerLifecycle, {CustomerLifecycleFilters} from '../features/manager/CustomerLifecycle';
import { useManagerList, ManagerSyncStatus, useManagerReadPause } from "../shared/hooks/useManagerResource";
import {CustomerCreate,SurveyAudience} from '../features/manager/ManagerTools';
import SurveyRecipientGroup,{groupSurveyRoute,groupSurveySource} from '../features/manager/SurveyRecipientGroup';
import '../shared/styles/internal-portal.css';
import { TicketPercent } from "lucide-react";
import { money, pageData, statusLabels, statusColors } from '../features/manager/manager-data';
import { OrderBadge, PanelLoading, Table, ListError, PageControls, PanelTitle } from '../features/manager/ManagerComponents';
import SurveyRewardEditor, { RewardFields, emptyReward } from '../features/manager/SurveyRewardEditor';
import React, { useCallback, useEffect, useState } from "react";
import Products from "../features/manager/products/ManagerProducts";
import Orders from "../features/manager/orders/ManagerOrders";
import Feedback from "../features/manager/feedback/ManagerFeedback";
const AdminVouchers = React.lazy(() => import('../features/admin/AdminVouchers'));
const CustomerProfile = React.lazy(() => import('../features/manager/CustomerProfile'));
const StockReceiving = React.lazy(()=>import('../features/manager/StockReceiving'));
const ManagerInvoices = React.lazy(()=>import('../features/manager/ManagerInvoices'));
const PromotionCampaigns = React.lazy(() => import('../features/manager/PromotionCampaigns'));
const ManagerReports = React.lazy(() => import('../features/manager/ManagerReports'));
const ManagerEmployees = React.lazy(() => import('../features/manager/ManagerEmployees'));
const WarehouseMaterials = React.lazy(() => import('../features/manager/WarehouseMaterials'));
const WarehouseRecipes = React.lazy(() => import('../features/manager/WarehouseRecipes'));
const WarehouseProductionPlans = React.lazy(() => import('../features/manager/WarehouseProductionPlans'));
const WarehouseApprovals = React.lazy(() => import('../features/manager/WarehouseApprovals'));
const WarehouseReports = React.lazy(() => import('../features/manager/WarehouseReports'));
const EmployeeSelfProfile = React.lazy(() => import('../features/manager/EmployeeWorkspaces').then(module => ({ default: module.EmployeeSelfProfile })));
const EmployeeLeaveRequests = React.lazy(() => import('../features/manager/EmployeeWorkspaces').then(module => ({ default: module.EmployeeLeaveRequests })));
const EmployeeAttendancePage = React.lazy(() => import('../features/manager/EmployeeWorkspaces').then(module => ({ default: module.EmployeeAttendancePage })));
const EmployeePayrollPage = React.lazy(() => import('../features/manager/EmployeeWorkspaces').then(module => ({ default: module.EmployeePayrollPage })));
const EmployeeReportPage = React.lazy(() => import('../features/manager/EmployeeWorkspaces').then(module => ({ default: module.EmployeeReportPage })));
const WarehouseEmployeeWorkspace = React.lazy(() => import('../features/manager/WarehouseEmployeeWorkspace'));
import {
  Activity,
  LayoutDashboard,
  Users as UsersIcon,
  Package,
  Warehouse,
  FlaskConical,
  Factory,
  ShoppingCart,
  MessageSquare,
  ClipboardList,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ExternalLink,
  ArrowRight,
  Search,
  Plus,
  ChevronRight,
  Sparkles,
  ReceiptText,
  BarChart3,
  KeyRound,
  UserRound,
  CalendarDays,
  Wallet,
  ClipboardCheck,
  UsersRound
} from "lucide-react";
import {
  adminApi,
  adminEndpoints,
  adminRefreshSession,
  adminSignIn,
  adminSignOut,
  managerChangePassword,
} from "../api/manager-api";

const navItems = [
  ["dashboard", "Tổng quan"],
  ["employees", "Nhân viên"],
  ["leave-requests", "Duyệt đơn nghỉ"],
  ["attendance", "Chấm công"],
  ["payroll", "Bảng lương"],
  ["hr-reports", "Báo cáo nhân sự"],
  ["my-profile", "Thông tin của tôi"],
  ["my-requests", "Đơn nghỉ của tôi"],
  ["my-attendance", "Chấm công của tôi"],
  ["my-payslips", "Phiếu lương của tôi"],
  ["warehouse-tasks", "Công việc kho"],
  ["my-team", "Nhân viên trong nhóm"],
  ["my-team-attendance", "Chấm công nhóm"],
  ["users", "Khách hàng"],
  ["products", "Sản phẩm"],
  ["stock-receipts", "Nhập kho"],
  ["materials", "Nguyên liệu"],
  ["recipes", "Công thức sản phẩm"],
  ["production-plans", "Kế hoạch sản xuất"],
  ["warehouse-approvals", "Duyệt yêu cầu kho"],
  ["warehouse-reports", "Báo cáo kho"],
  ["orders", "Đơn hàng"],
  ["invoices", "Hóa đơn"],
  ["feedback", "Phản hồi"],
  ["surveys", "Khảo sát"],
  ["vouchers", "Voucher"],
  ["promotions", "Chiến dịch khuyến mãi"],
  ["reports", "Báo cáo"],
];
const validSections = new Set(navItems.map(([key]) => key));
const managerRoleSections = {
  MANAGER_SALES: new Set(["dashboard", "users", "products", "orders", "invoices", "feedback", "surveys", "vouchers", "promotions", "reports"]),
  MANAGER_WAREHOUSE: new Set(["products", "stock-receipts", "materials", "recipes", "production-plans", "warehouse-approvals", "warehouse-reports"]),
  MANAGER_HR: new Set(["employees", "leave-requests", "attendance", "payroll", "hr-reports"]),
  EMPLOYEE: new Set(["my-profile", "my-requests", "my-attendance", "my-payslips"]),
};
const managerLandingPaths = {
  MANAGER_SALES: "/manager/orders",
  MANAGER_WAREHOUSE: "/manager/products",
  MANAGER_HR: "/manager/employees",
  EMPLOYEE: "/manager/my-profile",
};
const managerNavGroups = {
  MANAGER_SALES: [
    ["Tổng quan", ["dashboard"]],
    ["Bán hàng", ["orders", "invoices"]],
    ["Khách hàng & CSKH", ["users", "feedback", "surveys"]],
    ["Danh mục", ["products", "vouchers", "promotions"]],
    ["Phân tích", ["reports"]],
  ],
  MANAGER_WAREHOUSE: [
    ["Tổng quan", ["dashboard"]],
    ["Danh mục", ["products"]],
    ["Kho", ["stock-receipts", "materials", "recipes"]],
    ["Sản xuất", ["production-plans", "warehouse-approvals"]],
    ["Phân tích", ["warehouse-reports"]],
  ],
  MANAGER_HR: [
    ["Nhân sự", ["employees", "leave-requests", "attendance", "payroll", "hr-reports"]],
  ],
  EMPLOYEE: [
    ["Của tôi", ["my-profile", "my-requests", "my-attendance", "my-payslips"]],
    ["Nhóm", ["my-team", "my-team-attendance"]],
    ["Công việc", ["warehouse-tasks"]],
  ],
};
const pageSubtitles = {
  orders: "Theo dõi và xử lý đơn hàng trong ngày.",
  products: "Danh mục, giá bán và tồn kho.",
  users: "Hồ sơ và lịch sử mua hàng của khách.",
  invoices: "Đối soát hóa đơn và thanh toán.",
  reports: "Hiệu quả bán hàng theo kỳ.",
  feedback: "Phản hồi mới từ khách hàng.",
  surveys: "Khảo sát và mức độ hài lòng.",
  employees: "Hồ sơ và tình trạng làm việc.",
};
const navIcons = {
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
  'my-team-attendance': CalendarDays,
};
const userOrigin = import.meta.env.VITE_USER_ORIGIN || "http://localhost:5173";
const normalizeAdminPath = (value) => {
  if (value === "/manager/login") return value;
  if (/^\/manager\/users\/[^/]+$/.test(value)) return value;
  const pathname = value.split("?")[0];
  if (pathname === "/manager" || pathname === "/manager/") return "/manager";
  const key = pathname.replace(/^\/manager\/?/, "").split("/")[0] || "dashboard";
  return validSections.has(key) ? `/manager/${key}` : "/manager";
};

export default function ManagerApp() {
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  const [admin, setAdmin] = useState(null);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [employeeProfileReady, setEmployeeProfileReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionError,setSessionError]=useState('');
  const [notice, setNotice] = useState(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => {
      try {
        return window.localStorage.getItem("manager-sidebar-collapsed") === "true";
      } catch {
        return false;
      }
    }
  );
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem("manager-theme") || "light"
  );
  const section =
    path === "/manager/login"
      ? "login"
      : path.split('?')[0].replace(/^\/manager\/?/, "").split("/")[0] || "dashboard";
  const profileMatch = path.split('?')[0].match(/^\/manager\/users\/([^/]+)$/);
  const go = (next, state = {}) => {
    const target = `/manager/${next}`;
    window.history.pushState(state, "", target);
    window.dispatchEvent(new Event('manager:navigation'));
    setPath(target);
    setMobileMenuOpen(false);
  };
  const notify = (message, type = "success") => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    window.localStorage.setItem("manager-theme", theme);
  }, [theme]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "manager-sidebar-collapsed",
        String(sidebarCollapsed)
      );
    } catch {
      // Keep the sidebar usable in memory when persistence is unavailable.
    }
  }, [sidebarCollapsed]);
  useEffect(() => {
    const onPop = () => {
      const current = window.location.pathname;
      const normalized = normalizeAdminPath(current);
      if (current !== normalized)
        window.history.replaceState({}, "", normalized + window.location.search);
      setPath(normalized + window.location.search);
    };
    onPop();
    window.addEventListener("popstate", onPop);
    adminRefreshSession()
      .then((session) => {
        if (session?.manager) setAdmin(session.manager);
        else {window.history.replaceState({},'', '/manager/login');setPath('/manager/login');}
      })
      .catch(e=>setSessionError(e.message))
      .finally(() => setChecking(false));
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (admin?.role !== "EMPLOYEE") {
      setEmployeeProfile(null);
      setEmployeeProfileReady(false);
      return undefined;
    }
    const controller = new AbortController();
    setEmployeeProfile(null);
    setEmployeeProfileReady(false);
    adminApi(adminEndpoints.myProfile(), { signal: controller.signal })
      .then(profile => { if (!controller.signal.aborted) setEmployeeProfile(profile); })
      .catch(() => { if (!controller.signal.aborted) setEmployeeProfile(null); })
      .finally(() => { if (!controller.signal.aborted) setEmployeeProfileReady(true); });
    return () => controller.abort();
  }, [admin?.id, admin?.role]);
  useEffect(() => {
    if (!admin || path.split('?')[0] === "/manager/login") return;
    if (admin.role === "EMPLOYEE" && !employeeProfileReady) return;
    const pathname = path.split('?')[0];
    const employeeSections = new Set([
      ...managerRoleSections.EMPLOYEE,
      ...(employeeProfile?.permissionProfile === "TEAM_LEAD" ? ["my-team", "my-team-attendance"] : []),
      ...(employeeProfile?.workArea === "WAREHOUSE" ? ["warehouse-tasks"] : []),
    ]);
    const allowed = admin.role === "EMPLOYEE" ? employeeSections : managerRoleSections[admin.role] || new Set();
    if (pathname === "/manager" || !allowed.has(section)) {
      const landing = admin.role === "EMPLOYEE" && employeeProfile?.permissionProfile === "TEAM_LEAD"
        ? "/manager/my-team"
        : managerLandingPaths[admin.role] || "/manager/login";
      window.history.replaceState({}, "", landing);
      setPath(landing);
    }
  }, [admin, employeeProfile, employeeProfileReady, path, section]);
  useEffect(() => {
    const expired = () => {
      setAdmin(null);
      window.history.replaceState({}, '', '/manager/login');
      setPath('/manager/login');
      setNotice({ message: 'Phiên quản lý đã hết hạn. Vui lòng đăng nhập lại.', type: 'error' });
    };
    window.addEventListener('manager:session-expired', expired);
    return () => window.removeEventListener('manager:session-expired', expired);
  }, []);
  if (checking)
    return <div className="admin-loading">Đang kiểm tra phiên quản trị...</div>;
  if(sessionError)return <div role="alert">{sessionError}<button onClick={()=>window.location.reload()}>Thử lại</button></div>;
  if (!admin || path === "/manager/login")
    return (
      <AdminLogin
        theme={theme}
        onAuthenticated={(session) => {
          setAdmin(session.manager);
          if (session.manager?.role === "EMPLOYEE") {
            window.history.replaceState({}, "", "/manager");
            setPath("/manager");
          } else {
            go((managerLandingPaths[session.manager?.role] || "/manager/login").replace("/manager/", ""));
          }
        }}
        onNotice={notify}
        error={notice?.message}
      />
    );
  const allowedSections = managerRoleSections[admin.role] || new Set();
  const employeeAllowedSections = new Set([
    ...managerRoleSections.EMPLOYEE,
    ...(employeeProfile?.permissionProfile === "TEAM_LEAD" ? ["my-team", "my-team-attendance"] : []),
    ...(employeeProfile?.workArea === "WAREHOUSE" ? ["warehouse-tasks"] : []),
  ]);
  const roleSections = admin.role === "EMPLOYEE" ? employeeAllowedSections : allowedSections;
  if (admin.role === "EMPLOYEE" && !employeeProfileReady) return <div className="admin-loading" role="status">Đang tải hồ sơ nhân viên...</div>;
  if (path.split('?')[0] === "/manager" || !roleSections.has(section)) {
    return <div className="admin-loading" role="status">Đang mở chức năng phù hợp với vai trò...</div>;
  }
  const renderNavItem = ([key, label]) => {
    const Icon = navIcons[key];
    return (
      <button
        key={key}
        className={section === key ? "active" : ""}
        aria-current={section === key ? "page" : undefined}
        title={sidebarCollapsed ? label : undefined}
        onClick={() => go(key)}
      >
        <Icon size={17} aria-hidden="true" />
        <span className="admin-nav-label">{label}</span>
      </button>
    );
  };
  const roleNavItems = navItems.filter(([key]) => roleSections.has(key));
  const dashboardNavItem = roleNavItems.find(([key]) => key === "dashboard");
  return (
    <div className={`admin-shell manager-shell${profileMatch ? ' manager-profile-page' : ''}`} data-theme={theme} onKeyDown={event=>{if(['DIV','SPAN'].includes(event.target.tagName)&&event.target.getAttribute('role')==='button'&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.click();}}}>
      <button
        className="admin-mobile-toggle"
        aria-label={mobileMenuOpen ? "Đóng menu quản lý" : "Mở menu quản lý"}
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((value) => !value)}
        onKeyDown={event => { if (event.key === 'Escape') setMobileMenuOpen(false); }}
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      {mobileMenuOpen && (
        <button
          className="admin-sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside id="manager-sidebar" className={`admin-sidebar${sidebarCollapsed ? " is-collapsed" : ""}${mobileMenuOpen ? " is-open" : ""}`} onKeyDown={event => { if (event.key === 'Escape') setMobileMenuOpen(false); }}>
        <div className="admin-brand">
          <span className="admin-brand-mark">
            <Activity size={18} />
          </span>
          <div className="admin-brand-copy">
            ANH LỚN<small>Quản lý cửa hàng · CRM</small>
          </div>
          <button
            type="button"
            className="admin-collapse-toggle"
            aria-label={sidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            aria-expanded={!sidebarCollapsed}
            aria-controls="manager-sidebar"
            title={sidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={16} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={16} aria-hidden="true" />
            )}
          </button>
        </div>
        <nav aria-label="Chức năng quản lý">
          {dashboardNavItem && renderNavItem(dashboardNavItem)}
          {(managerNavGroups[admin.role] || [])
            .map(([label, keys]) => [label, keys.filter(key => key !== "dashboard" && roleSections.has(key))])
            .filter(([, keys]) => keys.length > 0)
            .map(([label, keys]) => (
              <div className="manager-nav-group" role="group" aria-label={label} key={label}>
                <span className="manager-nav-group-label" aria-hidden="true">{label}</span>
                {keys.map(key => renderNavItem(navItems.find(item => item[0] === key)))}
              </div>
            ))}
        </nav>
        <div className="manager-sidebar-footer">
        <div className="admin-profile">
          <span>{admin.fullName?.slice(0, 1)?.toUpperCase() || "A"}</span>
          <div className="admin-profile-copy">
            <b>{admin.fullName}</b>
            <small>{admin.email || "Nhân viên quản lý"}</small>
          </div>
        </div>
        <div className="manager-sidebar-actions">
        <button
          type="button"
          className="admin-logout manager-change-pw-btn"
          title={sidebarCollapsed ? "Đổi mật khẩu" : undefined}
          aria-label="Đổi mật khẩu"
          onClick={() => setPasswordModalOpen(true)}
        >
          <KeyRound size={16} aria-hidden="true" />
          <span className="admin-logout-label">Đổi mật khẩu</span>
        </button>
        <button
          className="admin-logout"
          title={sidebarCollapsed ? "Đăng xuất" : undefined}
          onClick={async () => {
            setAdmin(null);
            go("login");
            await adminSignOut();
          }}
        >
          <LogOut size={16} aria-hidden="true" />
          <span className="admin-logout-label">Đăng xuất</span>
        </button>
        </div>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <span className="admin-breadcrumb">
              Quản lý <span>/</span>{" "}
              <b>
                {navItems.find((item) => item[0] === section)?.[1] ||
                  "Tổng quan"}
              </b>
            </span>
            <span className="manager-mobile-title">
              {navItems.find((item) => item[0] === section)?.[1] || "Tổng quan"}
            </span>
          </div>
          <div className="admin-topbar-actions">
            <span className="admin-live-dot">DỮ LIỆU TRỰC TIẾP</span>
            <button
              className="manager-theme-toggle"
              aria-label={`Chuyển sang giao diện ${
                theme === "dark" ? "sáng" : "tối"
              }`}
              onClick={() =>
                setTheme((value) => (value === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === "dark" ? "Sáng" : "Tối"}</span>
            </button>
            <a
              href={userOrigin}
              aria-label="Mở storefront"
              onClick={(event) => {
                event.preventDefault();
                window.location.href = userOrigin;
              }}
            >
              <span>Mở storefront</span> <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </header>
        <div className="admin-page-heading">
          <h1>
            {profileMatch ? 'Hồ sơ khách hàng 360°' : navItems.find((item) => item[0] === section)?.[1] || "Tổng quan"}
          </h1>
          <p>
            {section === "dashboard"
              ? `${new Date().toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })} — Xin chào, ${admin.fullName || "Admin"}`
              : pageSubtitles[section] || "Quản lý và cập nhật dữ liệu cửa hàng."}
          </p>
        </div>
        <ManagerSyncStatus />
        <React.Suspense fallback={<PanelLoading/>}>
        {section === "dashboard" && <Dashboard go={go} />}
        {section === "users" && (profileMatch ? <CustomerProfile key={profileMatch[1]} customerId={profileMatch[1]} location={path} go={go} /> : <Users notify={notify} location={path} go={go} />)}{" "}
        {section === "products" && <Products notify={notify} readOnly={admin.role === "MANAGER_SALES"} />}{" "}
        {section === "employees" && <ManagerEmployees />}
        {section === "leave-requests" && <EmployeeLeaveRequests hr />}
        {section === "attendance" && <EmployeeAttendancePage hr />}
        {section === "payroll" && <EmployeePayrollPage hr />}
        {section === "hr-reports" && <EmployeeReportPage />}
        {section === "my-profile" && <EmployeeSelfProfile />}
        {section === "my-requests" && <EmployeeLeaveRequests />}
        {section === "my-attendance" && <EmployeeAttendancePage />}
        {section === "my-payslips" && <EmployeePayrollPage />}
        {section === "warehouse-tasks" && <WarehouseEmployeeWorkspace />}
        {section === "my-team" && <EmployeeAttendancePage team />}
        {section === "my-team-attendance" && <EmployeeAttendancePage team teamAttendance />}
        {section === "stock-receipts" && <StockReceiving />}
        {section === "materials" && <WarehouseMaterials />}
        {section === "recipes" && <WarehouseRecipes />}
        {section === "production-plans" && <WarehouseProductionPlans />}
        {section === "warehouse-approvals" && <WarehouseApprovals />}
        {section === "warehouse-reports" && <WarehouseReports />}
        {section === "orders" && <Orders notify={notify} />}{" "}
        {section === "invoices" && <ManagerInvoices />}
        {section === "feedback" && <Feedback notify={notify} />}{" "}
        {section === "surveys" && <Surveys notify={notify} location={path} go={go} />}
        {section === "vouchers" && <AdminVouchers />}
        {section === "promotions" && <PromotionCampaigns />}
        {section === "reports" && <ManagerReports location={path} go={go} />}
        </React.Suspense>
      </main>
      {notice && (
        <div className={`admin-toast ${notice.type}`}>{notice.message}</div>
      )}
      {passwordModalOpen && (
        <ManagerChangePasswordDialog
          open={passwordModalOpen}
          userEmail={admin?.email}
          onClose={() => setPasswordModalOpen(false)}
          onSuccess={(message) => notify(message, "success")}
        />
      )}
    </div>
  );
}

function ManagerChangePasswordDialog({ open, onClose, onSuccess, userEmail }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    setBusy(true);
    try {
      await managerChangePassword(currentPassword, newPassword);
      onSuccess?.('Đổi mật khẩu thành công! Hãy lưu lại mật khẩu mới.');
      onClose();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="admin-modal-backdrop manager-change-password-backdrop"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'grid', placeItems: 'center', zIndex: 9999, padding: '16px',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="admin-card manager-change-password-dialog" role="dialog" aria-modal="true" aria-labelledby="manager-change-password-title" style={{ width: '100%', maxWidth: '440px', padding: '24px', position: 'relative' }}>
        <div className="manager-change-password-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ padding: '8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex' }}>
              <KeyRound size={20} aria-hidden="true" />
            </span>
            <div>
              <h3 id="manager-change-password-title" style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>Đổi mật khẩu cá nhân</h3>
              <small style={{ color: 'var(--admin-muted)', fontSize: '12px' }}>{userEmail}</small>
            </div>
          </div>
          <button className="manager-change-password-close" type="button" disabled={busy} onClick={onClose} aria-label="Đóng">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {error && <div role="alert" className="manager-change-password-error">{error}</div>}
        <form className="manager-change-password-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>MẬT KHẨU HIỆN TẠI
            <input type="password" required disabled={busy} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <label>MẬT KHẨU MỚI (TỐI THIỂU 8 KÝ TỰ)
            <input type="password" required minLength={8} disabled={busy} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <label>XÁC NHẬN MẬT KHẨU MỚI
            <input type="password" required minLength={8} disabled={busy} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" disabled={busy} onClick={onClose}>Hủy</button>
            <button type="submit" disabled={busy} className="admin-primary-btn">{busy ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminLogin({ theme, onAuthenticated, onNotice, error }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const session = await adminSignIn(form);
      onAuthenticated(session);
    } catch (error) {
      onNotice(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-login manager-login" data-theme={theme}>
      <div className="admin-login-card">
        <div className="admin-mark">
          AL<span>MANAGER</span>
        </div>
        <span className="admin-eyebrow">ANH LỚN SHOP / PRIVATE AREA</span>
        <h1>
          Không gian
          <br />
          <i>quản lý vận hành.</i>
        </h1>
        <p>Đăng nhập để quản lý cửa hàng và dữ liệu khách hàng.</p>
        {error&&<p role="alert">{error}</p>}
        <form onSubmit={submit}>
          <label>
            EMAIL
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
          <label>
            MẬT KHẨU
            <input
              type="password"
              required
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
          </label>
          <button className="admin-primary" disabled={busy}>
            {busy ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP QUẢN LÝ →"}
          </button>
        </form>
        <small className="admin-dev-note">
          Tài khoản quản lý do Admin hệ thống cấp.
        </small>
        <a href={userOrigin}>← Về storefront</a>
      </div>
    </div>
  );
}

const recentOrdersEndpoint = () => adminEndpoints.orders({ size: 100 });
const orderSummaryEndpoint = () => '/api/manager/orders/summary';
function Dashboard({ go }) {
  return (
    <div className="admin-content">
      {/* Quick Action Navigation Grid */}
      <section className="admin-panel admin-quick-actions-panel">
        <div className="admin-section-heading">
          <div>
            <h2>Lối tắt quản lý</h2>
            <p>Truy cập nhanh các phân hệ nghiệp vụ chính của cửa hàng</p>
          </div>
        </div>
        <div className="admin-quick-grid">
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("orders")} title="Đến trang xử lý đơn hàng">
            <div className="admin-quick-icon blue">
              <ShoppingCart size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Xử lý đơn hàng</b>
              <small>Theo dõi giao hàng & trạng thái</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("products")} title="Đến trang quản lý sản phẩm">
            <div className="admin-quick-icon green">
              <Package size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Kho sản phẩm</b>
              <small>Quản lý giá bán & tồn kho</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("vouchers")} title="Đến trang Voucher">
            <div className="admin-quick-icon violet">
              <TicketPercent size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Voucher cửa hàng</b>
              <small>Quản lý mã và lượt sử dụng</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("users")} title="Đến danh sách khách hàng">
            <div className="admin-quick-icon amber">
              <UsersIcon size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Hồ sơ khách hàng</b>
              <small>Tra cứu danh sách & phân quyền</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("surveys")} title="Đến trang khảo sát ý kiến">
            <div className="admin-quick-icon cyan">
              <ClipboardList size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Khảo sát ý kiến</b>
              <small>Tạo câu hỏi & xem phản hồi</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("feedback")} title="Đến trang phản hồi đánh giá">
            <div className="admin-quick-icon rose">
              <MessageSquare size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Phản hồi đánh giá</b>
              <small>Duyệt & trả lời khách hàng</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
        </div>
      </section>

      <RecentOrders go={go} />
    </div>
  );
}
function RecentOrders({ go }) {
  const { data, loading, error, load } = useAdminList(recentOrdersEndpoint);
  const {data:summary} = useAdminList(orderSummaryEndpoint);
  if (loading) return <PanelLoading />;
  if (error)
    return (
      <div className="admin-panel">
        <ListError message={error} onRetry={load} />
      </div>
    );
  const orders = pageData(data);
  const counts = Object.entries({...statusLabels,RETURN:'Đổi trả'}).filter(([status])=>status!=='PENDING_PAYMENT').map(([status, label]) => ({
    status,
    label,
    count: Number.isFinite(summary?.ALL) ? (summary[status]||0) : orders.filter((order) => status==='RETURN'?showReturn(order):!showReturn(order)&&order.status === status).length,
  }));
  return (
    <section className="admin-panel admin-recent-orders">
      <div className="admin-section-heading">
        <div>
          <h2>Đơn hàng gần đây</h2>
          <p>{Number.isFinite(summary?.ALL)?`Trạng thái toàn bộ ${summary.ALL} đơn hàng`:`Phân bố trạng thái trong ${orders.length} đơn mới nhất`}</p>
        </div>
        <button className="admin-action" onClick={() => go("orders")}>
          Xem tất cả <ArrowRight size={14} />
        </button>
      </div>
      <div className="admin-status-strip">
        {counts.map(({ status, label, count }) => (
          <button type="button"
            key={status}
            className="admin-status-chip"
            onClick={() => go(`orders?status=${encodeURIComponent(status)}`)}
            title={`Lọc đơn hàng: ${label}`}
          >
            <i style={{ background: statusColors[status] }} />
            {label}
            <b>{count}</b>
          </button>
        ))}
      </div>
      <Table headers={["Mã đơn", "Khách hàng", "Tổng tiền", "Trạng thái"]}>
        {orders.slice(0, 5).map((order) => {
          const initials = (order.customer?.fullName || "C").trim().slice(0, 1).toUpperCase();
          return (
            <tr key={order.id} className="admin-table-row-clickable" onClick={() => go("orders")} title="Nhấn để xem chi tiết đơn hàng">
              <td className="admin-code">
                <span className="admin-order-code-badge">#{order.orderCode}</span>
              </td>
              <td>
                <div className="admin-table-customer">
                  <span className="admin-customer-avatar">{initials}</span>
                  <span>{order.customer?.fullName || "Customer"}</span>
                </div>
              </td>
              <td className="admin-order-total-cell">
                <strong>{money(order.totalAmount)}</strong>
              </td>
              <td>
                <OrderBadge status={order.status} order={order} />
              </td>
            </tr>
          );
        })}
      </Table>
    </section>
  );
}
export const useAdminList = useManagerList;

function Users({ notify, location, go }) {
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
  const { data:previousData, load, loading, error,stale } = useAdminList(endpoint,{keepPreviousData:true});
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
        <CustomerCreate onSaved={load}/>
        <span className="admin-toolbar-count">
          {data?.totalElements ?? filteredUsers.length} khách hàng
        </span>
        <button className="admin-action" onClick={() => searchUsers(search)}>Tìm khách hàng</button>
      </div>
      <CustomerLifecycleFilters params={params} onChange={changeFilters}/>
      <div className="manager-survey-cta">
        <button type="button" className="admin-action" onClick={()=>go(groupSurveyRoute(params),{createGroupedSurvey:true})}>Tạo khảo sát cho nhóm này</button>
      </div>
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
                <button className="admin-action" onClick={() => go(`invoices?q=${encodeURIComponent(user.email || user.fullName)}`)}>Hóa đơn</button>                <button className="admin-action" onClick={() => go(`users/${user.id}?${new URLSearchParams({q:query,page:String(page),...Object.fromEntries(params)})}`)}>Xem hồ sơ</button>
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

function Surveys({ notify, location = '', go }) {
  const source=groupSurveySource(location);
  const [autoOpen]=useState(()=>!!source&&window.history.state?.createGroupedSurvey===true);
  useEffect(()=>{if(autoOpen)window.history.replaceState({...window.history.state,createGroupedSurvey:false},'',window.location.href);},[autoOpen]);
  const [reward,setReward]=useState(emptyReward);
  const [page, setPage] = useState(0);
  const endpoint = useCallback(() => adminEndpoints.surveys({ page }), [page]);
  const { data, load, loading, error } = useAdminList(endpoint);

  const [dialogOpen, setDialogOpen] = useState(autoOpen);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience,setAudience]=useState(()=>autoOpen?{audience:'SELECTED',recipientFilter:source.filter}:{audience:'ALL',customerIds:[]});
  const [groupReady,setGroupReady]=useState(false);
  const newQuestion = () => ({
    key: crypto.randomUUID(),
    text: "",
    type: "SINGLE_CHOICE",
    required: true,
    options: ["", ""],
  });
  const [questions, setQuestions] = useState(() => [newQuestion()]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(null);
  useManagerReadPause(dialogOpen || busy || !!deleting);

  const openCreate = (grouped = false) => {
    setGroupReady(false);
    setAudience(grouped&&source?{audience:'SELECTED',recipientFilter:source.filter}:{audience:'ALL',customerIds:[]});
    setReward(emptyReward());
    setFormError("");
    setTitle("");
    setDescription("");
    setQuestions([newQuestion()]);
    setDialogOpen(true);
  };

  const closeDialog = useCallback(() => {
    if (busy) return;
    setDialogOpen(false);
    setFormError("");
  }, [busy]);

  useEffect(() => {
    if (!dialogOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen, busy, closeDialog]);

  const change = (key, patch) =>
    setQuestions((current) =>
      current.map((q) => (q.key === key ? { ...q, ...patch } : q))
    );

  const create = async (event) => {
    event.preventDefault();
    if (busy || (audience.recipientFilter && !groupReady)) return;
    setFormError("");
    const prepared = questions.map((q) => ({
      text: q.text.trim(),
      type: q.type,
      required: q.required,
      optionsJson: JSON.stringify(q.options.map((o) => o.trim())),
    }));
    if (
      !title.trim() ||
      !prepared.length ||
      prepared.some(
        (q) =>
          !q.text ||
          JSON.parse(q.optionsJson).length < 2 ||
          JSON.parse(q.optionsJson).some((o) => !o) ||
          new Set(JSON.parse(q.optionsJson)).size !==
            JSON.parse(q.optionsJson).length ||
          q.optionsJson.length > 4000
      )
    ) {
      setFormError(
        "Nhập tiêu đề, ít nhất một câu hỏi và ít nhất hai phương án khác nhau, không trống cho mỗi câu. Danh sách phương án tối đa 4.000 ký tự."
      );
      return;
    }
    setBusy(true);
    try {
      const saved = await adminApi("/api/manager/surveys", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          questions: prepared,
          ...audience,
          reward,
        },
      });
      setTitle("");
      setDescription("");
      setQuestions([newQuestion()]);
      setDialogOpen(false);
      notify(audience.recipientFilter?`Đã lưu khảo sát nháp cho ${saved.recipientCount} khách hàng. Chưa phát hành.`:"Đã lưu khảo sát nháp.");
      if (page) setPage(0);
      else await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async (survey) => {
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      await adminApi(
        adminEndpoints.surveyPublish(survey.id) +
          "?value=" +
          (survey.status !== "PUBLISHED"),
        { method: "PATCH" }
      );
      notify("Đã cập nhật phát hành khảo sát.");
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !deleting) return;
    setBusy(true);
    setFormError("");
    try {
      await adminApi(adminEndpoints.survey(deleting.id), { method: "DELETE" });
      setDeleting(null);
      notify("Đã xóa khảo sát. Kết quả cũ được giữ lại.");
      if (page > 0 && pageData(data).length === 1) setPage(page - 1);
      else await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panel">
      <PanelTitle
        title="Khảo sát"
        subtitle="Tạo câu hỏi trắc nghiệm và phát hành cho khách hàng."
      />

      <div className="admin-table-toolbar">
        <span className="admin-toolbar-count">
          {data?.totalElements ?? pageData(data).length} khảo sát
        </span>
        <button
          type="button"
          className="admin-primary admin-btn-with-icon"
          onClick={()=>openCreate()}
        >
          <Plus size={16} /> Tạo khảo sát
        </button>
        {source&&<><button type="button" className="admin-action" onClick={()=>openCreate(true)}>Tạo khảo sát cho nhóm này</button><button type="button" className="admin-action" onClick={()=>go(source.back)}>Quay lại nhóm khách hàng</button></>}
      </div>

      {loading ? (
        <PanelLoading />
      ) : error ? (
        <ListError message={error} onRetry={load} />
      ) : (
        <>
          <Table headers={["Tiêu đề", "Trạng thái", "Thao tác"]}>
            {pageData(data).map((survey) => (
              <tr key={survey.id}>
                <td>
                  <b>{survey.title}</b>
                  <SurveyRewardEditor survey={survey} onSaved={load}/>
                  <small className="admin-table-subline">
                    {survey.questions?.length || 0} câu hỏi
                    {survey.description ? ` • ${survey.description}` : ""}
                  </small>
                </td>
                <td>
                  <span
                    className={`admin-badge ${
                      survey.status === "PUBLISHED" ? "is-active" : ""
                    }`}
                  >
                    {survey.status === "PUBLISHED" ? "Đã phát hành" : "Bản nháp"}
                  </span>
                </td>
                <td>
                  <div className="admin-table-row-actions">
                    <button
                      type="button"
                      className="admin-action"
                      disabled={busy}
                      onClick={() => publish(survey)}
                    >
                      {survey.status === "PUBLISHED"
                        ? "Gỡ phát hành"
                        : "Phát hành"}
                    </button>
                    <button
                      type="button"
                      className="admin-action danger-text"
                      disabled={busy}
                      onClick={() => {
                        setFormError("");
                        setDeleting(survey);
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
        </>
      )}

      {/* Modal Dialog Tạo Khảo Sát */}
      {dialogOpen && (
        <div className="admin-dialog-backdrop" onClick={closeDialog}>
          <div
            className="admin-dialog admin-survey-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="survey-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-dialog-header">
              <div className="admin-dialog-header-title">
                <ClipboardList size={20} className="admin-dialog-icon" />
                <h2 id="survey-dialog-title">Tạo khảo sát mới</h2>
              </div>
              <button
                type="button"
                className="admin-dialog-close"
                aria-label="Đóng"
                disabled={busy}
                onClick={closeDialog}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={create} className="admin-dialog-form">
              <div className="admin-survey-dialog-body">
                <RewardFields value={reward} onChange={setReward} disabled={busy}/>
                {audience.recipientFilter?<SurveyRecipientGroup filter={audience.recipientFilter} onReady={setGroupReady} disabled={busy} onOther={()=>setAudience({audience:'ALL',customerIds:[]})}/>:<SurveyAudience value={audience} onChange={setAudience} disabled={busy}/>}
                {formError && (
                  <p role="alert" className="danger-text" style={{ margin: 0 }}>
                    {formError}
                  </p>
                )}

                <fieldset disabled={busy} className="admin-survey-fieldset">
                  <div className="admin-form-group">
                    <label htmlFor="survey-title">Tên khảo sát</label>
                    <input
                      id="survey-title"
                      required
                      maxLength={255}
                      autoFocus
                      placeholder="Ví dụ: Khảo sát mức độ hài lòng về chất lượng dịch vụ"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="survey-desc">Mô tả</label>
                    <textarea
                      id="survey-desc"
                      maxLength={4000}
                      rows={2}
                      placeholder="Mô tả mục đích khảo sát hoặc thông điệp gửi tới khách hàng..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div
                    className="admin-survey-options-header"
                    style={{ marginTop: 8 }}
                  >
                    DANH SÁCH CÂU HỎI ({questions.length})
                  </div>

                  {questions.map((q, index) => (
                    <div className="admin-survey-card" key={q.key}>
                      <div className="admin-survey-card-header">
                        <div className="admin-survey-card-title">
                          <span className="admin-survey-card-badge">
                            #{index + 1}
                          </span>
                          <h3>Câu hỏi {index + 1}</h3>
                        </div>
                        {questions.length > 1 && (
                          <button
                            type="button"
                            className="admin-action danger-text"
                            onClick={() =>
                              setQuestions((current) =>
                                current.filter((item) => item.key !== q.key)
                              )
                            }
                          >
                            Xóa câu hỏi
                          </button>
                        )}
                      </div>

                      <div className="admin-form-group">
                        <label htmlFor={`survey-q-${index}`}>
                          Nội dung câu hỏi {index + 1}
                        </label>
                        <textarea
                          id={`survey-q-${index}`}
                          required
                          maxLength={1000}
                          rows={2}
                          placeholder="Nhập nội dung câu hỏi..."
                          value={q.text}
                          onChange={(e) =>
                            change(q.key, { text: e.target.value })
                          }
                        />
                      </div>

                      <div className="admin-survey-controls-row">
                        <div className="admin-survey-type-select">
                          <label
                            htmlFor={`survey-q-type-${index}`}
                            style={{
                              marginBottom: 4,
                              display: "block",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            Kiểu câu hỏi {index + 1}
                          </label>
                          <select
                            id={`survey-q-type-${index}`}
                            value={q.type}
                            onChange={(e) =>
                              change(q.key, { type: e.target.value })
                            }
                          >
                            <option value="SINGLE_CHOICE">
                              Chọn một đáp án (Radio)
                            </option>
                            <option value="MULTIPLE_CHOICE">
                              Chọn nhiều đáp án (Checkbox)
                            </option>
                          </select>
                        </div>

                        <label className="admin-survey-required-label">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) =>
                              change(q.key, { required: e.target.checked })
                            }
                          />
                          <span>Bắt buộc trả lời</span>
                        </label>
                      </div>

                      <div className="admin-survey-options-group">
                        <span className="admin-survey-options-header">
                          Các phương án trả lời:
                        </span>
                        {q.options.map((option, oi) => (
                          <div className="admin-survey-option-row" key={oi}>
                            <div
                              className={`admin-survey-option-bullet ${
                                q.type === "MULTIPLE_CHOICE" ? "square" : ""
                              }`}
                            />
                            <input
                              aria-label={`Câu ${index + 1}, phương án ${oi + 1}`}
                              required
                              maxLength={4000}
                              placeholder={`Phương án ${oi + 1}`}
                              value={option}
                              onChange={(e) =>
                                change(q.key, {
                                  options: q.options.map((v, i) =>
                                    i === oi ? e.target.value : v
                                  ),
                                })
                              }
                            />
                            <button
                              type="button"
                              className="admin-survey-option-delete"
                              disabled={q.options.length <= 2}
                              title={
                                q.options.length <= 2
                                  ? "Cần tối thiểu 2 phương án"
                                  : "Xóa phương án này"
                              }
                              onClick={() =>
                                change(q.key, {
                                  options: q.options.filter((_, i) => i !== oi),
                                })
                              }
                            >
                              Xóa
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="admin-survey-add-option"
                          onClick={() =>
                            change(q.key, { options: [...q.options, ""] })
                          }
                        >
                          <Plus size={14} /> Thêm phương án
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="admin-survey-add-question-btn"
                    onClick={() =>
                      setQuestions((current) => [...current, newQuestion()])
                    }
                  >
                    <Plus size={16} /> Thêm câu hỏi mới
                  </button>
                </fieldset>
              </div>

              <div className="admin-dialog-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="admin-dialog-cancel"
                  disabled={busy}
                  onClick={closeDialog}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="admin-primary"
                  disabled={busy || !questions.length || (!!audience.recipientFilter && !groupReady)}
                >
                  {busy ? "Đang lưu..." : "Lưu bản nháp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa khảo sát */}
      {deleting && (
        <div className="admin-dialog-backdrop" onClick={() => !busy && setDeleting(null)}>
          <div
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="survey-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="survey-delete-title">Xóa khảo sát?</h2>
            <p>
              Khảo sát “{deleting.title}” sẽ bị gỡ khỏi danh sách. Câu hỏi và
              kết quả đã thu thập được giữ lại.
            </p>
            {formError && (
              <p role="alert" className="danger-text">
                {formError}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="admin-dialog-cancel"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Quay lại
              </button>
              <button
                type="button"
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
