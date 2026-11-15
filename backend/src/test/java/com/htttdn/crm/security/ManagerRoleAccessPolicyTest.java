package com.htttdn.crm.security;

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
                    new RouteCase("POST", "/api/manager/employees", Set.of()),
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
