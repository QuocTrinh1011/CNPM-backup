# Manager Reports Design

## Intent

Restore a dedicated, read-only reports page in the Manager portal so managers can review collected income, inventory purchase costs, popular product variants, customer purchases, and stock-receipt activity by employee.

## Goals

- Show total income, total stock-purchase expense, and net balance.
- Default the year selector to the current year and list that year first; offer an all-months option and individual months.
- Show a monthly trend for a full year and a daily trend when one month is selected. Include zero-valued buckets so trend positions remain stable. Annual labels use “Tháng 1” through “Tháng 12”; daily labels use `dd/MM`.
- Show popular product variants by default, with category, recorded color and size, quantity sold, and revenue.
- Put less-used customer and employee breakdowns in a report-type combobox so the opening view stays focused on totals, trend, and products.
- Keep year and month in `/manager/reports` query parameters so filters survive reload and browser navigation.
- Add the Manager navigation label “Báo cáo” and direct `/manager/reports` route.

## Non-goals

- Do not add sales-person attribution to orders, restore care/support/task reports, or add refund accounting.
- Do not add or change database schema; migration 020 removed legacy reporting fields, including `paid_at` and `salesperson_id`.
- Do not hard-code product colors or garment names; report the catalog category and color/size values stored with order items.

## Data definitions

- A collected order is not canceled and has `payment_status = 'PAID'`, or is COD with `cod_collected_at IS NOT NULL`.
- Income period date: PayOS/other paid orders use `orders.created_at` because `paid_at` no longer exists; COD uses `COALESCE(orders.cod_collected_at, orders.created_at)` to reflect actual cash collection when recorded.
- Expense is the sum of posted `stock_receipts.total_cost`, grouped by `received_at`.
- All period boundaries are calculated in `Asia/Ho_Chi_Minh` and passed to PostgreSQL as instants, with an inclusive start and exclusive end.
- Summary contains `totalIncome`, `totalExpense`, `netBalance`, `paidOrdersCount`, and `stockReceiptsCount`.
- Product rows are grouped by `(product_id, color, size)` and contain category, quantity sold, and `SUM(quantity * unit_price)`; sort by total revenue descending.
- Customer rows are grouped by customer and ranked by `SUM(orders.total_amount)` descending; include order count and email.
- Return the ten highest-revenue product variants and ten highest-spend customers. Employee activity includes every receipt creator (without a top-N limit) so its total reconciles to total expense.
- Employee activity groups receipts by `created_by`; resolve the existing manager/admin account name. Receipts with a null or unresolved creator are grouped under “Hệ thống / Không xác định” so employee activity totals reconcile to total expense.
- `availableYears` is derived from captured-order dates and receipt dates, sorted descending, with the current year first even when it has no records.
- When no records match, return zero totals, twelve month buckets for annual view, or one bucket per calendar day for a selected month.

## Approaches considered

1. Aggregate existing order and stock-receipt data in a new read-only Manager reports API. This keeps metrics grounded in saved transactions and requires no write-path changes. **Selected.**
2. Add employee assignment to orders and update order workflows before reporting sales by employee. This requires a broader schema and checkout/operations change; current data supports stock-receipt activity by employee instead.

## API contract

`GET /api/manager/reports?year=2026&month=11`; omit `month` for the whole year.

```json
{
  "year": 2026,
  "month": 11,
  "availableYears": [2026, 2025, 2024],
  "summary": {
    "totalIncome": 125000000.00,
    "totalExpense": 80000000.00,
    "netBalance": 45000000.00,
    "paidOrdersCount": 142,
    "stockReceiptsCount": 18
  },
  "trend": [
    { "label": "01/11", "income": 10000000.00, "expense": 5000000.00 }
  ],
  "topProducts": [
    {
      "productId": 12,
      "productName": "Áo Polo Nam Classic",
      "categoryName": "Áo Nam",
      "color": "Xanh Navy",
      "size": "L",
      "quantitySold": 54,
      "totalRevenue": 18900000.00
    }
  ],
  "topCustomers": [
    {
      "customerId": 88,
      "fullName": "Nguyễn Văn A",
      "email": "vana@example.com",
      "orderCount": 6,
      "totalSpent": 7500000.00
    }
  ],
  "employeeActivities": [
    {
      "employeeId": 5,
      "fullName": "Trần Quản Lý",
      "email": "manager1@example.com",
      "receiptCount": 10,
      "totalReceiptCost": 45000000.00
    }
  ]
}
```

For a null or unresolved employee, `employeeId` and `email` are null and `fullName` is “Hệ thống / Không xác định”.

## Implementation outline

- Add a protected `/api/manager/reports` endpoint and SQL aggregation using `NamedParameterJdbcTemplate`; avoid downloading paginated orders or receipts to the frontend.
- Return one report payload containing summary, trend, product variants, customers, employee receipt activity, and available years.
- Add a Manager Reports page with query-backed year/month selectors, three summary cards, a lightweight CSS/SVG trend chart, and a report-type combobox. Show product performance by default; switching to customer or employee activity uses the same report payload. Use existing light/dark portal tokens.
- Restore only the report menu item and route; do not restore retired care, support, or personal-task modules.
- Fetch one payload per filter state and format currency/dates in the frontend.

## Constraints

- Keep existing Manager authorization; expose the report only under the authenticated `/api/manager/**` API.
- Add no schema migration and no frontend chart dependency.
- Validate year/month input and return a client error for invalid values.
