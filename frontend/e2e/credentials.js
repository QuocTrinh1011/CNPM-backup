export const E2E_PASSWORD = 'E2E_Roles123!';

export const ADMIN_EMAIL = 'admin-e2e@crm.test';
export const MANAGER_SALES_EMAIL = 'manager-e2e@crm.test';
export const MANAGER_WAREHOUSE_EMAIL = 'manager-warehouse-e2e@crm.test';
export const MANAGER_HR_EMAIL = 'manager-hr-e2e@crm.test';
export const EMPLOYEE_SALES_EMAIL = 'employee-sales-e2e@crm.test';
export const EMPLOYEE_WAREHOUSE_EMAIL = 'employee-warehouse-e2e@crm.test';
export const EMPLOYEE_TEAM_LEAD_EMAIL = 'employee-team-lead-e2e@crm.test';
export const CUSTOMER_EMAIL = 'customer-e2e@crm.test';

const runId = process.env.E2E_RUN_ID || 'local';
export const WORKFLOW_EMPLOYEE_SALES_EMAILS = {
  chromium: `employee-sales-chromium-${runId}@crm.test`,
  firefox: `employee-sales-firefox-${runId}@crm.test`,
  webkit: `employee-sales-webkit-${runId}@crm.test`,
};

// Preserve the existing test imports while using one E2E-only credential.
export const MANAGER_EMAIL = MANAGER_SALES_EMAIL;
export const MANAGER_PASSWORD = E2E_PASSWORD;

export const ROLE_FIXTURES = [
  { name: 'Admin', email: ADMIN_EMAIL, fullName: 'E2E Admin', role: 'ADMIN', portal: 'admin' },
  { name: 'Customer', email: CUSTOMER_EMAIL, fullName: 'E2E Customer', role: 'CUSTOMER', portal: 'user' },
  { name: 'Manager Sales', email: MANAGER_SALES_EMAIL, fullName: 'E2E Manager Sales', role: 'MANAGER_SALES', portal: 'manager' },
  { name: 'Manager Warehouse', email: MANAGER_WAREHOUSE_EMAIL, fullName: 'E2E Manager Warehouse', role: 'MANAGER_WAREHOUSE', portal: 'manager' },
  { name: 'Manager HR', email: MANAGER_HR_EMAIL, fullName: 'E2E Manager HR', role: 'MANAGER_HR', portal: 'manager' },
  {
    name: 'Employee Sales',
    email: EMPLOYEE_SALES_EMAIL,
    fullName: 'E2E Employee Sales',
    role: 'EMPLOYEE',
    portal: 'manager',
    workArea: 'SALES',
    employeeCode: 'E2E-SALES-STAFF',
    jobTitle: 'E2E Nhân viên bán hàng',
    permissionProfile: 'STAFF',
    reportsTo: EMPLOYEE_TEAM_LEAD_EMAIL,
  },
  {
    name: 'Employee Warehouse',
    email: EMPLOYEE_WAREHOUSE_EMAIL,
    fullName: 'E2E Employee Warehouse',
    role: 'EMPLOYEE',
    portal: 'manager',
    workArea: 'WAREHOUSE',
    employeeCode: 'E2E-WAREHOUSE-STAFF',
    jobTitle: 'E2E Nhân viên kho',
    permissionProfile: 'STAFF',
  },
  {
    name: 'Employee Team Lead',
    email: EMPLOYEE_TEAM_LEAD_EMAIL,
    fullName: 'E2E Employee Team Lead',
    role: 'EMPLOYEE',
    portal: 'manager',
    workArea: 'SALES',
    employeeCode: 'E2E-SALES-LEAD',
    jobTitle: 'E2E Trưởng nhóm bán hàng',
    permissionProfile: 'TEAM_LEAD',
  },
];

export const WORKFLOW_EMPLOYEE_SALES_FIXTURES = Object.entries(WORKFLOW_EMPLOYEE_SALES_EMAILS).map(
  ([browser, email]) => ({
    name: `Employee Sales ${browser}`,
    email,
    fullName: `E2E Employee Sales ${browser}`,
    role: 'EMPLOYEE',
    portal: 'manager',
    workArea: 'SALES',
    employeeCode: `E2E-SALES-${browser.toUpperCase()}-${runId}`,
    jobTitle: 'E2E Nhân viên bán hàng',
    permissionProfile: 'STAFF',
  }),
);

export const ALL_E2E_FIXTURES = [...ROLE_FIXTURES, ...WORKFLOW_EMPLOYEE_SALES_FIXTURES];
