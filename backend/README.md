# CRM Admin Backend

Java 21 / Spring Boot REST backend for the Vietnamese men's clothing customer portal and the Admin/Manager CRM portals. PostgreSQL is accessed through Spring Data JPA. Hibernate `ddl-auto` defaults to `validate`: apply the schema and required migrations from the repository's `database/` directory before startup; the backend does not create or update the schema. The default database is `cnpm`, isolated for this CNPM project.

## Package structure

```text
com.htttdn.crm
├── config/       # application and infrastructure configuration
├── controller/   # REST controllers and HTTP mapping
├── dto/          # request/response contracts (grouped by feature)
├── entity/       # JPA entities and relationships
├── exception/    # API exception handling and error responses
├── repository/   # Spring Data repositories
├── security/     # authentication/authorization filters
└── service/      # business use cases (ready for feature services)
```

## Run locally

```powershell
$env:DB_URL='jdbc:postgresql://localhost:5432/cnpm'
$env:DB_USERNAME='postgres'
$env:DB_PASSWORD='mat-khau-postgres-cua-ban'
mvn spring-boot:run
```

The backend defaults to port `8080`, matching the frontend API base URL. Set `SERVER_PORT` only when a different local port is needed.

Customer APIs follow the sequence diagrams: `/api/auth/*`, `/api/customers/me`, `/api/products`, `/api/cart`, `/api/orders`, `/api/payments/payos/*`, `/api/products/{id}/feedback`, and `/api/surveys/*`.

PayOS checkout requires `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, and `PAYOS_CHECKSUM_KEY`; without them, it returns a configuration error. COD remains available. Refresh tokens are BCrypt-independent SHA-256 hashes in the database and are sent only as HttpOnly cookies; passwords use BCrypt.

Admin APIs use a separate JWT flow: call `/api/admin/auth/login`, then send its Bearer token to `/api/admin/**`. Customer tokens and the legacy `X-User-Role` header are not accepted by admin APIs. Admin refresh tokens use the HttpOnly `adminRefreshToken` cookie and `/api/admin/auth` cookie path.

## Admin API

- `GET /api/admin/users`, `GET/PUT /api/admin/users/{id}`, `PATCH /api/admin/users/{id}/lock`
- `GET /api/admin/feedback`, `PATCH /api/admin/feedback/{id}`
- `GET/POST /api/admin/surveys`, `PATCH /api/admin/surveys/{id}/publish`, `DELETE /api/admin/surveys/{id}`
- `GET/POST /api/admin/products`, `PUT/DELETE /api/admin/products/{id}`, `PATCH /api/admin/products/{id}/stock`
- `GET /api/admin/orders`, `GET /api/admin/orders/{id}`, `PATCH /api/admin/orders/{id}/status`
- `POST /api/admin/auth/login`, `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`

All list endpoints support `page` and `size`; users and products also support `q`, while feedback/survey/order lists support `status`.

For an existing database created from an older schema, run the required scripts from the ordered [`database/migrations/README.md`](../database/migrations/README.md) after taking a backup. For the original admin/storefront split, `database/migrations/001_admin_user_split.sql` adds missing storefront/order columns and the refresh-token audience discriminator without deleting data.

Manager API access is enforced by role and HTTP method/path. `MANAGER_SALES` handles sales/CRM workflows; `MANAGER_WAREHOUSE` handles products, suppliers, and stock receipts; both share read-only product lookup. `MANAGER_HR` can create/update/deactivate employee profiles, approve leave and resignation requests, edit attendance, configure/generate/review/publish/correct payroll, and read HR reports. `EMPLOYEE` signs in through the shared Manager auth endpoints and can access only their own profile/contact updates, requests, attendance, and published payslips. `TEAM_LEAD` is an employee permission profile rather than an account role; it grants read-only access to basic profile fields and attendance for direct reports assigned by HR. It grants no leave decisions or salary/payroll access. Admin remains the system-role administrator, while HR owns employee lifecycle records. Apply migrations 022–025 after the earlier migrations before deploying these scopes: 022 changes legacy `MANAGER` accounts to `MANAGER_SALES` and revokes their existing Manager refresh sessions; 025 allows Employee refresh sessions and creates HR tables. Existing users whose sessions were revoked must sign in again.

HR endpoints include `/api/manager/employees`, `/api/manager/hr/leave-requests`, `/api/manager/hr/attendance`, `/api/manager/hr/payroll-settings`, `/api/manager/hr/payroll-periods`, and `/api/manager/hr/reports`. Employee endpoints are under `/api/manager/me/` (`profile`, `leave-requests`, `attendance`, `payslips`); team-lead reads are `/api/manager/me/team` and `/api/manager/me/team/attendance`. Authorization derives the employee identity from the authenticated token, and team scope is checked against the current `TEAM_LEAD` profile and direct-report relationship.

The local/demo seed adds `qlnhansu@shop.com`, `nvbh01@shop.com`–`nvbh03@shop.com`, and `nvkho01@shop.com`–`nvkho03@shop.com`; all seven use the sample password `password`. Never load these credentials in production. Payroll tax, insurance, work calendar, and overtime rules are stored as effective-dated `PAYROLL_RULES`; the HR screen offers a suggested 2026 preset, but HR must review and explicitly save it before generating a period. Confirm the shop's work calendar, insurance salary bases, and region-specific minimum wage before use. Existing attendance records keep their values when night-overtime categories are added by migration 028.

For QR payment retry on an existing PostgreSQL database, run `database/migrations/007_payos_qr.sql` and then `database/migrations/008_payos_attempts.sql` before restarting the backend with `ddl-auto=none`. The latter preserves existing PayOS links as the first payment attempt. Do not rerun the full seed to migrate payments. Customer payment endpoints are `GET /api/orders/{id}/payment`, `POST /api/orders/{id}/payment/sync`, and `POST /api/orders/{id}/payment/retry`; all require the order owner's Bearer token.
