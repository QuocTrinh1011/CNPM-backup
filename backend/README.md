# CRM Admin Backend

Java 21 / Spring Boot REST backend for the Vietnamese men's clothing customer portal and the existing admin CRM module. PostgreSQL is accessed through Spring Data JPA; Hibernate creates/updates the development schema. The default database is `htttdn`.

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
$env:DB_URL='jdbc:postgresql://localhost:5432/htttdn'
$env:DB_USERNAME='postgres'
$env:DB_PASSWORD='mat-khau-postgres-cua-ban'
$env:SERVER_PORT='8080'
mvn spring-boot:run
```

Customer APIs follow the sequence diagrams: `/api/auth/*`, `/api/customers/me`, `/api/products`, `/api/cart`, `/api/orders`, `/api/payments/payos/*`, `/api/products/{id}/feedback`, and `/api/surveys/*`.

PayOS checkout requires `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, and `PAYOS_CHECKSUM_KEY`; without them, it returns a configuration error. COD remains available. Refresh tokens are BCrypt-independent SHA-256 hashes in the database and are sent only as HttpOnly cookies; passwords use BCrypt.

Admin APIs use a separate JWT flow: call `/api/admin/auth/login`, then send its Bearer token to `/api/admin/**`. Customer tokens and the legacy `X-User-Role` header are not accepted by admin APIs. Admin refresh tokens use the HttpOnly `adminRefreshToken` cookie and `/api/admin/auth` cookie path.

## Admin API

- `GET /api/admin/users`, `GET/PUT /api/admin/users/{id}`, `PATCH /api/admin/users/{id}/lock`
- `GET /api/admin/feedback`, `PATCH /api/admin/feedback/{id}`
- `GET/POST /api/admin/surveys`, `PATCH /api/admin/surveys/{id}/publish`, `DELETE /api/admin/surveys/{id}`
- `GET/POST /api/admin/products`, `PUT/DELETE /api/admin/products/{id}`, `PATCH /api/admin/products/{id}/stock`
- `GET /api/admin/orders`, `GET /api/admin/orders/{id}`, `PATCH /api/admin/orders/{id}/status`
- `GET /api/admin/reports/revenue`, `GET /api/admin/reports/users`, `GET /api/admin/surveys/stats`
- `POST /api/admin/auth/login`, `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`

All list endpoints support `page` and `size`; users and products also support `q`, while feedback/survey/order lists support `status`.

For an existing database created from an older schema, run `database/migrations/001_admin_user_split.sql` before starting with `ddl-auto=none`. The script adds missing storefront/order columns and the refresh-token audience discriminator without deleting data.

For QR payment retry on an existing PostgreSQL database, run `database/migrations/007_payos_qr.sql` and then `database/migrations/008_payos_attempts.sql` before restarting the backend with `ddl-auto=none`. The latter preserves existing PayOS links as the first payment attempt. Do not rerun the full seed to migrate payments. Customer payment endpoints are `GET /api/orders/{id}/payment`, `POST /api/orders/{id}/payment/sync`, and `POST /api/orders/{id}/payment/retry`; all require the order owner's Bearer token.
