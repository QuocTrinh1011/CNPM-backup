package com.cnpm.clothingstore.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ManagerRoleAccessPolicyTest {
    private static final String HR = "MANAGER_HR";
    private static final String WAREHOUSE = "MANAGER_WAREHOUSE";
    private static final String SALES = "MANAGER_SALES";
    private static final String EMPLOYEE = "EMPLOYEE";
    private final ManagerRoleAccessPolicy policy = new ManagerRoleAccessPolicy();

    @ParameterizedTest
    @MethodSource("supportedRoutes")
    void grantsKnownManagerRoutesOnlyToTheirAssignedRoles(RouteCase route) {
        assertEquals(route.allowedRoles(), policy.rolesFor(route.method(), route.path()), route.toString());
        assertEquals(route.allowedRoles().contains(HR), policy.allows(HR, route.method(), route.path()));
        assertEquals(route.allowedRoles().contains(WAREHOUSE), policy.allows(WAREHOUSE, route.method(), route.path()));
        assertEquals(route.allowedRoles().contains(SALES), policy.allows(SALES, route.method(), route.path()));
        assertFalse(policy.allows("ADMIN", route.method(), route.path()));
        assertFalse(policy.allows("EMPLOYEE", route.method(), route.path()));
    }

    @Test
    void deniesUnknownPathsAndUnsupportedMethodsByDefault() {
        for (String role : Set.of(HR, WAREHOUSE, SALES)) {
            for (RouteCase route : Stream.of(
                    new RouteCase("GET", "/api/manager/unknown", Set.of()),
                    new RouteCase("POST", "/api/manager/employees/12", Set.of()),
                    new RouteCase("POST", "/api/manager/products/categories", Set.of()),
                    new RouteCase("GET", "/api/manager/products/not-a-number", Set.of()),
                    new RouteCase("GET", "/api/manager/products/12/unknown", Set.of()),
                    new RouteCase("GET", "/api/manager/suppliers/12", Set.of()),
                    new RouteCase("GET", "/api/manager/audit-logs", Set.of())
            ).toList()) {
                assertTrue(policy.rolesFor(route.method(), route.path()).isEmpty(), route.toString());
                assertFalse(policy.allows(role, route.method(), route.path()), role + " " + route);
            }
        }
    }

    @Test
    void employeeCanOnlyUseSelfServiceAndTeamReadRoutes() {
        for (RouteCase route : Stream.of(
                route("GET", "/api/manager/me/profile", Set.of(EMPLOYEE)),
                route("PUT", "/api/manager/me/profile", Set.of(EMPLOYEE)),
                route("GET", "/api/manager/me/leave-requests", Set.of(EMPLOYEE)),
                route("POST", "/api/manager/me/leave-requests", Set.of(EMPLOYEE)),
                route("PATCH", "/api/manager/me/leave-requests/12/withdraw", Set.of(EMPLOYEE)),
                route("GET", "/api/manager/me/attendance", Set.of(EMPLOYEE)),
                route("GET", "/api/manager/me/payslips", Set.of(EMPLOYEE)),
                route("GET", "/api/manager/me/payslips/2026/11", Set.of(EMPLOYEE)),
                route("GET", "/api/manager/me/team", Set.of(EMPLOYEE)),
                route("GET", "/api/manager/me/team/attendance", Set.of(EMPLOYEE))
        ).toList()) {
            assertEquals(route.allowedRoles(), policy.rolesFor(route.method(), route.path()), route.toString());
            assertTrue(policy.allows(EMPLOYEE, route.method(), route.path()), route.toString());
            assertFalse(policy.allows(HR, route.method(), route.path()), HR + " " + route);
            assertFalse(policy.allows(SALES, route.method(), route.path()), SALES + " " + route);
            assertFalse(policy.allows(WAREHOUSE, route.method(), route.path()), WAREHOUSE + " " + route);
        }
        assertTrue(ManagerRoleAccessPolicy.isManagerPortalRole(EMPLOYEE));
        assertFalse(ManagerRoleAccessPolicy.isManagerRole(EMPLOYEE));
    }

    @Test
    void warehouseEmployeeRoutesAreAdmittedOnlyAsEmployeeForServiceLevelWorkAreaChecks() {
        for (RouteCase route : Stream.of(
                route("GET", "/api/manager/warehouse/me/plans", Set.of(EMPLOYEE)),
                route("GET", "/api/manager/warehouse/me/material-requests", Set.of(EMPLOYEE)),
                route("POST", "/api/manager/warehouse/me/material-requests", Set.of(EMPLOYEE)),
                route("POST", "/api/manager/warehouse/me/plans/12/production-runs", Set.of(EMPLOYEE)),
                route("POST", "/api/manager/warehouse/me/plans/12/material-returns", Set.of(EMPLOYEE)),
                route("GET", "/api/manager/warehouse/me/material-returns", Set.of(EMPLOYEE)),
                route("GET", "/api/manager/warehouse/me/finished-goods-requests", Set.of(EMPLOYEE)),
                route("POST", "/api/manager/warehouse/me/finished-goods-requests", Set.of(EMPLOYEE))
        ).toList()) {
            assertEquals(route.allowedRoles(), policy.rolesFor(route.method(), route.path()), route.toString());
            assertTrue(policy.allows(EMPLOYEE, route.method(), route.path()), route.toString());
            assertFalse(policy.allows(HR, route.method(), route.path()), HR + " " + route);
            assertFalse(policy.allows(SALES, route.method(), route.path()), SALES + " " + route);
            assertFalse(policy.allows(WAREHOUSE, route.method(), route.path()), WAREHOUSE + " " + route);
        }

        assertFalse(policy.allows(EMPLOYEE, "GET", "/api/manager/warehouse/me/unknown"));
        assertFalse(policy.allows(EMPLOYEE, "DELETE", "/api/manager/warehouse/me/plans/12"));
    }

    @Test
    void hrOwnsEmployeeAdministrationLeaveDecisionsAttendancePayrollAndReports() {
        for (RouteCase route : Stream.of(
                route("POST", "/api/manager/employees", Set.of(HR)),
                route("PUT", "/api/manager/employees/12", Set.of(HR)),
                route("DELETE", "/api/manager/employees/12", Set.of(HR)),
                route("GET", "/api/manager/hr/leave-requests", Set.of(HR)),
                route("PATCH", "/api/manager/hr/leave-requests/12/decision", Set.of(HR)),
                route("GET", "/api/manager/hr/attendance", Set.of(HR)),
                route("PUT", "/api/manager/hr/attendance", Set.of(HR)),
                route("GET", "/api/manager/hr/payroll-periods", Set.of(HR)),
                route("POST", "/api/manager/hr/payroll-periods", Set.of(HR)),
                route("GET", "/api/manager/hr/payroll-periods/2026/11", Set.of(HR)),
                route("POST", "/api/manager/hr/payroll-periods/2026/11/review", Set.of(HR)),
                route("POST", "/api/manager/hr/payroll-periods/2026/11/publish", Set.of(HR)),
                route("POST", "/api/manager/hr/payroll-periods/2026/11/adjustments", Set.of(HR)),
                route("POST", "/api/manager/hr/payroll-periods/2026/11/revisions/12", Set.of(HR)),
                route("GET", "/api/manager/hr/payroll-settings", Set.of(HR)),
                route("PUT", "/api/manager/hr/payroll-settings", Set.of(HR)),
                route("GET", "/api/manager/hr/reports", Set.of(HR))
        ).toList()) {
            assertEquals(route.allowedRoles(), policy.rolesFor(route.method(), route.path()), route.toString());
            assertTrue(policy.allows(HR, route.method(), route.path()), route.toString());
            assertFalse(policy.allows(EMPLOYEE, route.method(), route.path()), EMPLOYEE + " " + route);
            assertFalse(policy.allows(SALES, route.method(), route.path()), SALES + " " + route);
            assertFalse(policy.allows(WAREHOUSE, route.method(), route.path()), WAREHOUSE + " " + route);
        }
    }

    private static Stream<RouteCase> supportedRoutes() {
        Set<String> hr = Set.of(HR);
        Set<String> warehouse = Set.of(WAREHOUSE);
        Set<String> sales = Set.of(SALES);
        Set<String> productReaders = Set.of(WAREHOUSE, SALES);
        return Stream.of(
                route("GET", "/api/manager/employees", hr),
                route("GET", "/api/manager/products", productReaders),
                route("GET", "/api/manager/products/categories", productReaders),
                route("GET", "/api/manager/products/12", productReaders),
                route("POST", "/api/manager/products", warehouse),
                route("PUT", "/api/manager/products/12", warehouse),
                route("DELETE", "/api/manager/products/12", warehouse),
                route("PATCH", "/api/manager/products/12/stock", warehouse),
                route("PATCH", "/api/manager/products/12/supplier", warehouse),
                route("GET", "/api/manager/suppliers", warehouse),
                route("POST", "/api/manager/suppliers", warehouse),
                route("PUT", "/api/manager/suppliers/12", warehouse),
                route("GET", "/api/manager/stock-receipts", warehouse),
                route("GET", "/api/manager/stock-receipts/12", warehouse),
                route("POST", "/api/manager/stock-receipts", warehouse),
                route("GET", "/api/manager/raw-materials", warehouse),
                route("POST", "/api/manager/raw-materials", warehouse),
                route("PUT", "/api/manager/raw-materials/12", warehouse),
                route("GET", "/api/manager/raw-material-receipts", warehouse),
                route("GET", "/api/manager/raw-material-receipts/12", warehouse),
                route("POST", "/api/manager/raw-material-receipts", warehouse),
                route("GET", "/api/manager/products/12/recipe", warehouse),
                route("PUT", "/api/manager/products/12/recipe", warehouse),
                route("GET", "/api/manager/production-plans", warehouse),
                route("POST", "/api/manager/production-plans", warehouse),
                route("GET", "/api/manager/production-plans/12", warehouse),
                route("PATCH", "/api/manager/production-plans/12/cancel", warehouse),
                route("GET", "/api/manager/warehouse/employees", warehouse),
                route("GET", "/api/manager/warehouse/material-requests", warehouse),
                route("PATCH", "/api/manager/warehouse/material-requests/12/decision", warehouse),
                route("GET", "/api/manager/warehouse/material-returns", warehouse),
                route("PATCH", "/api/manager/warehouse/material-returns/12/decision", warehouse),
                route("GET", "/api/manager/warehouse/finished-goods-requests", warehouse),
                route("PATCH", "/api/manager/warehouse/finished-goods-requests/12/decision", warehouse),
                route("GET", "/api/manager/warehouse/reports", warehouse),
                route("GET", "/api/manager/users", sales),
                route("POST", "/api/manager/users", sales),
                route("GET", "/api/manager/users/12", sales),
                route("PUT", "/api/manager/users/12", sales),
                route("PATCH", "/api/manager/users/12/lock", sales),
                route("DELETE", "/api/manager/users/12", sales),
                route("GET", "/api/manager/users/12/profile", sales),
                route("GET", "/api/manager/users/12/profile/activities", sales),
                route("GET", "/api/manager/users/12/profile/addresses", sales),
                route("GET", "/api/manager/users/12/profile/orders", sales),
                route("GET", "/api/manager/users/12/profile/feedback", sales),
                route("GET", "/api/manager/users/12/profile/surveys", sales),
                route("GET", "/api/manager/users/12/profile/vouchers", sales),
                route("GET", "/api/manager/users/12/profile/voucher-usages", sales),
                route("GET", "/api/manager/orders", sales),
                route("GET", "/api/manager/orders/summary", sales),
                route("GET", "/api/manager/orders/12", sales),
                route("PATCH", "/api/manager/orders/12/status", sales),
                route("PATCH", "/api/manager/orders/12/return", sales),
                route("PATCH", "/api/manager/orders/12/cod-collection", sales),
                route("POST", "/api/manager/orders/12/payment/reconcile", sales),
                route("GET", "/api/manager/reports", sales),
                route("GET", "/api/manager/feedback", sales),
                route("PATCH", "/api/manager/feedback/12", sales),
                route("DELETE", "/api/manager/feedback/12", sales),
                route("GET", "/api/manager/surveys", sales),
                route("POST", "/api/manager/surveys", sales),
                route("GET", "/api/manager/surveys/filter-options", sales),
                route("POST", "/api/manager/surveys/recipients/preview", sales),
                route("PATCH", "/api/manager/surveys/12/reward", sales),
                route("PATCH", "/api/manager/surveys/12/publish", sales),
                route("DELETE", "/api/manager/surveys/12", sales),
                route("GET", "/api/manager/vouchers", sales),
                route("POST", "/api/manager/vouchers", sales),
                route("PATCH", "/api/manager/vouchers/12", sales),
                route("GET", "/api/manager/promotions", sales),
                route("POST", "/api/manager/promotions", sales),
                route("GET", "/api/manager/promotions/12", sales),
                route("PUT", "/api/manager/promotions/12", sales),
                route("DELETE", "/api/manager/promotions/12", sales)
        );
    }

    private static RouteCase route(String method, String path, Set<String> allowedRoles) {
        return new RouteCase(method, path, allowedRoles);
    }

    private record RouteCase(String method, String path, Set<String> allowedRoles) {}
}
