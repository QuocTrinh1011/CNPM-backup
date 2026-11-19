import useManagerSession from "../features/manager/shell/useManagerSession";
import { navItems, managerRoleSections, managerLandingPaths, managerNavGroups, pageSubtitles, navIcons, userOrigin } from "../features/manager/shell/manager-navigation";
import { AdminLogin } from "../features/manager/shell/ManagerLogin";
import { ManagerChangePasswordDialog } from "../features/manager/shell/ManagerChangePasswordDialog";
import { Surveys } from "../features/manager/surveys/SurveysPage";
import { Users } from "../features/manager/customers/CustomersPage";
import { Dashboard } from "../features/manager/dashboard/ManagerDashboard";

import { useManagerList, ManagerSyncStatus } from "../shared/hooks/useManagerResource";

import '../shared/styles/internal-portal.css';

import { PanelLoading } from "../features/manager/ManagerComponents";

import React, { useEffect, useState } from "react";
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
import { Activity, LogOut, Menu, X, PanelLeftClose, PanelLeftOpen, Sun, Moon, ExternalLink, KeyRound } from "lucide-react";
import { adminSignOut } from "../api/manager-api";

export default function ManagerApp() {
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  const { admin, setAdmin, employeeProfile, employeeProfileReady, checking, sessionError } = useManagerSession(setPath);

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
  }, [setAdmin]);
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
              <div
                className="manager-nav-group"
                role="group"
                aria-label={label}
                key={label}
              >
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
        {section === "users" && (profileMatch ? <CustomerProfile
                  key={profileMatch[1]}
                  customerId={profileMatch[1]}
                  location={path}
                  go={go}
                /> : <Users notify={notify} location={path} go={go} />)}{" "}
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

export const useAdminList = useManagerList;

