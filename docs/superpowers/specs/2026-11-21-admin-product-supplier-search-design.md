# Admin Product and Supplier Search

## Intent

Give system Admin a read-only way to inspect product and supplier records, find matching entries, and narrow results without entering the Manager portal.

## Goals

- Keep the existing paginated product directory and expose the existing category, supplier, price-range, stock, and active-status filters as an advanced-search panel.
- Add a supplier directory to Admin with keyword search, field-specific code/email/phone/address filters, active status filtering, sorting, and pagination.
- Show the linked supplier and category in product results where available.
- Keep all Admin list requests on `/api/admin/**`; do not expose mutation actions in these screens.

## Non-goals

- Creating, editing, archiving, or assigning products and suppliers from Admin.
- Changing Manager inventory or supplier workflows.
- Exporting results or adding saved searches.

## Approaches

1. **Extend the existing Admin directory (chosen).** Add the supplier route and use the current directory table, query state, and API helpers. The product endpoint already supports most advanced criteria, and the supplier read endpoint already supports pagination and status filters. This keeps Admin consistent and avoids another table implementation.
2. **Build separate product and supplier search pages.** This gives each page more custom layout control but duplicates the current directory's paging, error, and table behavior without a need for separate write workflows.

## Data and behavior

- Product search uses the existing Admin endpoint with keyword, category, supplier ID, minimum and maximum price, stock state, active state, sort field, and direction.
- Supplier search remains read-only and uses the Admin endpoint. Keyword search covers code, name, email, phone, and address; advanced fields can narrow code, email, phone, or address independently.
- Supplier sort options are limited to fields that exist on the supplier record: code, name, and creation time.
- Filter changes reset pagination to the first page. A clear action restores the default query and sorting.
- Admin authorization remains enforced by the existing Admin access guard. Manager endpoints and mutation behavior are unchanged.

## Constraints

- Use the existing React, Spring Boot, and PostgreSQL patterns and current Admin design tokens.
- Keep labels and empty/error states in Vietnamese.
- Validate filter lengths, sort fields, and pagination on the server.
