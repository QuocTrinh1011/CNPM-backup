package com.htttdn.crm.security;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public final class ManagerRoleAccessPolicy {
    private static final Set<String> MANAGER_ROLES = Set.of("MANAGER_HR", "MANAGER_WAREHOUSE", "MANAGER_SALES");
    private static final Set<String> MANAGER_PORTAL_ROLES = Set.of("MANAGER_HR", "MANAGER_WAREHOUSE", "MANAGER_SALES", "EMPLOYEE");
    private static final Set<String> HR = Set.of("MANAGER_HR");
    private static final Set<String> EMPLOYEE = Set.of("EMPLOYEE");
    private static final Set<String> WAREHOUSE = Set.of("MANAGER_WAREHOUSE");
    private static final Set<String> SALES = Set.of("MANAGER_SALES");
    private static final Set<String> PRODUCT_READERS = Set.of("MANAGER_WAREHOUSE", "MANAGER_SALES");
    private static final String ID = "[0-9]+";

    private final List<RouteRule> rules;

    public ManagerRoleAccessPolicy() {
        List<RouteRule> configured = new ArrayList<>();

        add(configured, "GET", "/api/manager/employees", HR);
        add(configured, "POST", "/api/manager/employees", HR);
        add(configured, "PUT", "/api/manager/employees/" + ID, HR);
        add(configured, "DELETE", "/api/manager/employees/" + ID, HR);

        add(configured, "GET", "/api/manager/me/profile", EMPLOYEE);
        add(configured, "PUT", "/api/manager/me/profile", EMPLOYEE);
        add(configured, "GET", "/api/manager/me/leave-requests", EMPLOYEE);
        add(configured, "POST", "/api/manager/me/leave-requests", EMPLOYEE);
        add(configured, "PATCH", "/api/manager/me/leave-requests/" + ID + "/withdraw", EMPLOYEE);
        add(configured, "GET", "/api/manager/me/attendance", EMPLOYEE);
        add(configured, "GET", "/api/manager/me/payslips", EMPLOYEE);
        add(configured, "GET", "/api/manager/me/payslips/" + ID + "/" + ID, EMPLOYEE);
        // The service must still verify that this employee has TEAM_LEAD access
        // and scope every result to reports assigned to the authenticated user.
        add(configured, "GET", "/api/manager/me/team", EMPLOYEE);
        add(configured, "GET", "/api/manager/me/team/attendance", EMPLOYEE);

        add(configured, "GET", "/api/manager/hr/leave-requests", HR);
        add(configured, "PATCH", "/api/manager/hr/leave-requests/" + ID + "/decision", HR);
        add(configured, "GET", "/api/manager/hr/attendance", HR);
        add(configured, "PUT", "/api/manager/hr/attendance", HR);
        add(configured, "GET", "/api/manager/hr/payroll-periods", HR);
        add(configured, "POST", "/api/manager/hr/payroll-periods", HR);
        add(configured, "GET", "/api/manager/hr/payroll-periods/" + ID + "/" + ID, HR);
        add(configured, "POST", "/api/manager/hr/payroll-periods/" + ID + "/" + ID + "/review", HR);
        add(configured, "POST", "/api/manager/hr/payroll-periods/" + ID + "/" + ID + "/publish", HR);
        add(configured, "POST", "/api/manager/hr/payroll-periods/" + ID + "/" + ID + "/adjustments", HR);
        add(configured, "POST", "/api/manager/hr/payroll-periods/" + ID + "/" + ID + "/revisions/" + ID, HR);
        add(configured, "GET", "/api/manager/hr/payroll-settings", HR);
        add(configured, "PUT", "/api/manager/hr/payroll-settings", HR);
        add(configured, "GET", "/api/manager/hr/reports", HR);

        add(configured, "GET", "/api/manager/products", PRODUCT_READERS);
        add(configured, "GET", "/api/manager/products/categories", PRODUCT_READERS);
        add(configured, "GET", "/api/manager/products/" + ID, PRODUCT_READERS);
        add(configured, "POST", "/api/manager/products", WAREHOUSE);
        add(configured, "PUT", "/api/manager/products/" + ID, WAREHOUSE);
        add(configured, "DELETE", "/api/manager/products/" + ID, WAREHOUSE);
        add(configured, "PATCH", "/api/manager/products/" + ID + "/stock", WAREHOUSE);
        add(configured, "PATCH", "/api/manager/products/" + ID + "/supplier", WAREHOUSE);

        add(configured, "GET", "/api/manager/suppliers", WAREHOUSE);
        add(configured, "POST", "/api/manager/suppliers", WAREHOUSE);
        add(configured, "PUT", "/api/manager/suppliers/" + ID, WAREHOUSE);
        add(configured, "GET", "/api/manager/stock-receipts", WAREHOUSE);
        add(configured, "GET", "/api/manager/stock-receipts/" + ID, WAREHOUSE);
        add(configured, "POST", "/api/manager/stock-receipts", WAREHOUSE);

        add(configured, "GET", "/api/manager/raw-materials", WAREHOUSE);
        add(configured, "POST", "/api/manager/raw-materials", WAREHOUSE);
        add(configured, "PUT", "/api/manager/raw-materials/" + ID, WAREHOUSE);
        add(configured, "GET", "/api/manager/raw-material-receipts", WAREHOUSE);
        add(configured, "GET", "/api/manager/raw-material-receipts/" + ID, WAREHOUSE);
        add(configured, "POST", "/api/manager/raw-material-receipts", WAREHOUSE);
        add(configured, "GET", "/api/manager/products/" + ID + "/recipe", WAREHOUSE);
        add(configured, "PUT", "/api/manager/products/" + ID + "/recipe", WAREHOUSE);
        add(configured, "GET", "/api/manager/production-plans", WAREHOUSE);
        add(configured, "POST", "/api/manager/production-plans", WAREHOUSE);
        add(configured, "GET", "/api/manager/production-plans/" + ID, WAREHOUSE);

        add(configured, "GET", "/api/manager/warehouse/me/plans", EMPLOYEE);
        add(configured, "GET", "/api/manager/warehouse/me/material-requests", EMPLOYEE);
        add(configured, "POST", "/api/manager/warehouse/me/material-requests", EMPLOYEE);
        add(configured, "POST", "/api/manager/warehouse/me/plans/" + ID + "/production-runs", EMPLOYEE);
        add(configured, "POST", "/api/manager/warehouse/me/plans/" + ID + "/material-returns", EMPLOYEE);
        add(configured, "GET", "/api/manager/warehouse/me/finished-goods-requests", EMPLOYEE);
        add(configured, "POST", "/api/manager/warehouse/me/finished-goods-requests", EMPLOYEE);

        add(configured, "GET", "/api/manager/warehouse/material-requests", WAREHOUSE);
        add(configured, "PATCH", "/api/manager/warehouse/material-requests/" + ID + "/decision", WAREHOUSE);
        add(configured, "GET", "/api/manager/warehouse/material-returns", WAREHOUSE);
        add(configured, "PATCH", "/api/manager/warehouse/material-returns/" + ID + "/decision", WAREHOUSE);
        add(configured, "GET", "/api/manager/warehouse/finished-goods-requests", WAREHOUSE);
        add(configured, "PATCH", "/api/manager/warehouse/finished-goods-requests/" + ID + "/decision", WAREHOUSE);
        add(configured, "GET", "/api/manager/warehouse/reports", WAREHOUSE);

        add(configured, "GET", "/api/manager/users", SALES);
        add(configured, "POST", "/api/manager/users", SALES);
        add(configured, "GET", "/api/manager/users/" + ID, SALES);
        add(configured, "PUT", "/api/manager/users/" + ID, SALES);
        add(configured, "PATCH", "/api/manager/users/" + ID + "/lock", SALES);
        add(configured, "DELETE", "/api/manager/users/" + ID, SALES);
        add(configured, "GET", "/api/manager/users/" + ID + "/profile", SALES);
        for (String profilePage : Set.of("activities", "addresses", "orders", "feedback", "surveys", "vouchers", "voucher-usages")) {
            add(configured, "GET", "/api/manager/users/" + ID + "/profile/" + profilePage, SALES);
        }

        add(configured, "GET", "/api/manager/orders", SALES);
        add(configured, "GET", "/api/manager/orders/summary", SALES);
        add(configured, "GET", "/api/manager/orders/" + ID, SALES);
        add(configured, "PATCH", "/api/manager/orders/" + ID + "/status", SALES);
        add(configured, "PATCH", "/api/manager/orders/" + ID + "/return", SALES);
        add(configured, "PATCH", "/api/manager/orders/" + ID + "/cod-collection", SALES);
        add(configured, "POST", "/api/manager/orders/" + ID + "/payment/reconcile", SALES);

        add(configured, "GET", "/api/manager/reports", SALES);
        add(configured, "GET", "/api/manager/feedback", SALES);
        add(configured, "PATCH", "/api/manager/feedback/" + ID, SALES);
        add(configured, "DELETE", "/api/manager/feedback/" + ID, SALES);

        add(configured, "GET", "/api/manager/surveys", SALES);
        add(configured, "POST", "/api/manager/surveys", SALES);
        add(configured, "GET", "/api/manager/surveys/filter-options", SALES);
        add(configured, "POST", "/api/manager/surveys/recipients/preview", SALES);
        add(configured, "PATCH", "/api/manager/surveys/" + ID + "/reward", SALES);
        add(configured, "PATCH", "/api/manager/surveys/" + ID + "/publish", SALES);
        add(configured, "DELETE", "/api/manager/surveys/" + ID, SALES);

        add(configured, "GET", "/api/manager/vouchers", SALES);
        add(configured, "POST", "/api/manager/vouchers", SALES);
        add(configured, "PATCH", "/api/manager/vouchers/" + ID, SALES);

        add(configured, "GET", "/api/manager/promotions", SALES);
        add(configured, "POST", "/api/manager/promotions", SALES);
        add(configured, "GET", "/api/manager/promotions/" + ID, SALES);
        add(configured, "PUT", "/api/manager/promotions/" + ID, SALES);
        add(configured, "DELETE", "/api/manager/promotions/" + ID, SALES);

        rules = List.copyOf(configured);
    }

    public Set<String> rolesFor(String method, String path) {
        if (method == null || path == null) return Set.of();
        String normalizedMethod = method.toUpperCase(Locale.ROOT);
        return rules.stream()
                .filter(rule -> rule.method().equals(normalizedMethod) && rule.path().matcher(path).matches())
                .map(RouteRule::roles)
                .findFirst()
                .orElseGet(Set::of);
    }

    public boolean allows(String role, String method, String path) {
        return role != null && rolesFor(method, path).contains(role);
    }

    public static boolean isManagerRole(String role) {
        return role != null && MANAGER_ROLES.contains(role);
    }

    public static boolean isManagerPortalRole(String role) {
        return role != null && MANAGER_PORTAL_ROLES.contains(role);
    }

    private static void add(List<RouteRule> rules, String method, String pathRegex, Set<String> roles) {
        rules.add(new RouteRule(method, Pattern.compile(pathRegex), roles));
    }

    private record RouteRule(String method, Pattern path, Set<String> roles) {}
}
