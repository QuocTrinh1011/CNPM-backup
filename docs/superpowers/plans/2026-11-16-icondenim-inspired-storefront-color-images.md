# ICONDENIM-Inspired Storefront and Color Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the customer storefront and persist color-specific product galleries so selecting a color changes the displayed product images.

**Architecture:** Store ordered image URL lists by exact color label in a JSONB field owned by `Product`. Keep `imageUrl` as the legacy/default fallback, expose the same product representation through current catalog and warehouse endpoints, and let the existing warehouse product editor maintain the map. Restyle the customer home, collection, and product detail views while preserving existing cart, checkout, account, wishlist, and order flows.

**Tech Stack:** Spring Boot 3.4, Hibernate/JPA, PostgreSQL JSONB, React 19, Vite, Vitest, Testing Library.

**Spec:** `docs/specs/2026-11-16-icondenim-inspired-storefront-color-images-design.md`

## Global Constraints

- Use stock product imagery as previously selected; do not reuse ICONDENIM's product photographs, copy, or branded assets.
- Keep product-level price and stock; do not add per-color or per-size inventory.
- Keep existing order, cart, checkout, authentication, and role permissions.
- Keep `imageUrl` as a fallback for legacy products and products without a color gallery.
- Cover every listed color for every seeded product; replace old product image assignments while preserving non-product seed data and seeded product business fields.
- The checked-in seed currently contains 16 named products and has no SKU column or markers. Never delete live product rows as part of seed refresh; update the named seed products by exact name and color list so history rows remain valid and descriptions stay unchanged.
- Do not add dependencies or change the Admin/Manager visual systems outside the Manager warehouse product editor fields.

## Review Focus

- A request omitting `colorImages` must retain an existing product gallery on update; test backward-compatible update behavior in Task 1.
- A gallery key that does not match any listed product color must be rejected; test validation in Task 1.
- A color switch must select that color's first image and never leave a visibly different color's image selected; test in Task 4.
- A color with no gallery on a legacy product must show `imageUrl`; test in Task 4.
- Running the seed repeatedly must leave the same per-product color gallery and preserve all non-image product fields; verify in Task 2.

---

### Task 1: Persist and validate color galleries

**Files:**
- Create: `database/migrations/023_product_color_images.sql`
- Modify: `database/schema.sql`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/entity/Product.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/dto/admin/AdminDtos.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/AdminProductService.java`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/ProductColorImagesIntegrationTest.java`

**Interfaces:**
- Product JSON adds `colorImages: Map<String, List<String>>`.
- Product create/update accepts optional `colors` and `colorImages`; existing requests without these fields remain valid.
- A non-null `colorImages` map replaces the saved map; null preserves the existing map on update and means empty map on create.

- [x] **Step 1: Add failing product API and persistence tests**

  In `ProductColorImagesIntegrationTest`, create a product through the warehouse endpoint with two exact color keys and ordered URLs; clear the persistence context and assert the public product endpoint returns the persisted map. Also assert unknown color keys, more than six URLs, blank URLs, and non-HTTPS URLs return `INVALID_PRODUCT_COLOR_IMAGES`, and an update omitting `colorImages` retains the saved map.

- [x] **Step 2: Run the targeted tests and verify they fail for the missing behavior**

  Run: `cd backend && mvn -q -Dtest=ProductColorImagesIntegrationTest test`
  Expected: the new tests fail because `colorImages` is not yet persisted or validated.

- [x] **Step 3: Add JSONB field, migration, request fields, and service validation**

  Map `Product.colorImages` using Hibernate JSON support and a PostgreSQL JSONB column. Add `023_product_color_images.sql` with an idempotent `ADD COLUMN IF NOT EXISTS ... JSONB NOT NULL DEFAULT '{}'::jsonb`, and mirror it in `schema.sql`. Extend `ProductRequest`; validate exact trimmed color keys and URL count/content; preserve old fields and map behavior when the new optional fields are omitted.

- [x] **Step 4: Run targeted tests and verify they pass**

  Run: `cd backend && mvn -q -Dtest=ProductColorImagesIntegrationTest test`
  Expected: PASS, including persisted JSON mapping, validation response codes, and backward-compatible update cases.

  Full backend suite after Task 1: `mvn -q test` → 44 suites, 264 tests, 0 failures, 0 errors, 4 skipped.

### Task 2: Replace old product image seed with complete color galleries

**Files:**
- Modify: `database/seed/seed_data.sql`
- Modify: `database/migrations/README.md`

**Interfaces:**
- Each seeded product JSON map uses its existing color labels as keys and ordered HTTPS image URL arrays as values.
- `image_url` remains the first/default gallery image for clients that do not read `colorImages`.

- [x] **Step 1: Build a repeatable coverage query against the 16 named product seed rows**

  Use a temporary SQL validation query over the 16 exact seeded product names and `string_to_array(color, ',')`. Report every seeded product/color pair without a gallery and every map key absent from that product's `color` field. Run it against the current seed to establish that old image data does not meet the new contract; do not add a maintenance file solely for this check.

- [x] **Step 2: Replace the old single-image assignments**

  Replace the existing 16 seeded product photo URLs with curated Pexels stock URLs grouped by garment category and visible color. Add an idempotent update keyed by the exact seeded product name and expected color list for both `image_url` and `color_images`; the schema has no standalone SKU column, and the current seed has no SKU markers. Map every listed color for all 16 seeded products. Preserve names, descriptions, prices, sale prices, stock, and unrelated account/voucher/demo seed statements. Products in the same category/color may reuse a matching URL.

- [x] **Step 3: Verify coverage, idempotence, and product-field preservation**

  Run the coverage query in an isolated temporary PostgreSQL 18 database loaded from `schema.sql`, not the application database. Run only the product image seed block twice, then query for missing/extra color keys and compare all non-image product fields before/after. Expected: zero missing colors, zero extra keys, repeated run yields no product-image changes, and all other fields match.

- [x] **Step 4: Document migration and seed order**

  Add migration 023 to the migration table and note the seed is safe to rerun for the 16 named products after applying the migration.

### Task 3: Manage color galleries in the Manager warehouse product editor

**Files:**
- Modify: `frontend/src/features/manager/ManagerProducts.jsx`
- Create: `frontend/src/features/manager/ManagerProducts.test.jsx`
- Modify: `frontend/src/features/manager/styles/manager-redesign.css` only if needed for the image editor layout.

**Interfaces:**
- Form state uses `colors: string` and `colorImages: Record<string, string[]>`.
- Existing product requests remain `POST`/`PUT /api/manager/products` with the color gallery embedded in the product payload.

- [x] **Step 1: Add failing Manager editor tests**

  Test that editing a product displays one editor group per color, previews its saved URLs, allows adding/removing image URL fields, and submits `colors` plus the ordered `colorImages` map. Test a new product with no gallery and a validation error for an invalid URL.

- [x] **Step 2: Run the focused frontend test and verify it fails**

  Run: `cd frontend && npx vitest run src/features/manager/ManagerProducts.test.jsx`
  Expected: FAIL because the color gallery editor does not exist.

- [x] **Step 3: Implement dynamic color gallery editing**

  Initialize form colors and image arrays from the loaded product, add one URL input per image, add/remove image controls, and show image previews. Submit the existing product fields plus `colors` and `colorImages`; keep all controls available only under the existing warehouse write permission.

- [x] **Step 4: Run the focused frontend test and verify it passes**

  Run: `cd frontend && npx vitest run src/features/manager/ManagerProducts.test.jsx`
  Expected: PASS for create/edit payload and image editing behavior.

### Task 4: Switch product gallery images with selected color

**Files:**
- Create: `frontend/src/features/storefront/product-image-gallery.js`
- Create: `frontend/src/features/storefront/product-image-gallery.test.js`
- Modify: `frontend/src/features/storefront/ProductDetails.jsx`
- Create: `frontend/src/features/storefront/ProductDetails.test.jsx`
- Modify: `frontend/src/features/storefront/CatalogSection.jsx`

**Interfaces:**
- `imagesForColor(product, color)` returns the ordered URLs for that color, or `[product.imageUrl]` when no mapped images exist.
- Add-to-cart continues to receive the existing `{ size, color }` selection.

- [x] **Step 1: Write failing gallery utility and interaction tests**

  Assert color-specific order and legacy fallback in the utility test. In the details test, assert color selection updates the main image and thumbnails, thumbnail selection changes only the main image, the default card image remains valid, and add-to-cart receives the selected color and size.

- [x] **Step 2: Run focused tests and verify they fail**

  Run: `cd frontend && npx vitest run src/features/storefront/product-image-gallery.test.js src/features/storefront/ProductDetails.test.jsx`
  Expected: FAIL because color-specific image selection is not implemented.

- [x] **Step 3: Implement the gallery state**

  Resolve the selected color's image list, reset the active image to its first entry on color change, and render accessible thumbnail buttons. Do not change cart, size, or checkout APIs.

- [x] **Step 4: Run focused tests and verify they pass**

  Run: `cd frontend && npx vitest run src/features/storefront/product-image-gallery.test.js src/features/storefront/ProductDetails.test.jsx`
  Expected: PASS for gallery switching, legacy fallback, thumbnail selection, and selected variant payload.

### Task 5: Refresh the customer storefront presentation

**Files:**
- Modify: `frontend/src/features/storefront/StorefrontHome.jsx`
- Modify: `frontend/src/features/storefront/CatalogSection.jsx`
- Modify: `frontend/src/features/storefront/ProductDetails.jsx`
- Modify: `frontend/src/app/App.jsx`
- Create: `frontend/src/features/storefront/styles/storefront-catalog.css`
- Modify: `frontend/src/app/portals/UserPortal.jsx`

**Interfaces:**
- Existing callbacks and routes remain unchanged; only presentation and gallery controls change.
- The new stylesheet is imported last in the User portal CSS chain, preserving the current order of all existing styles and making the new storefront presentation explicit.

- [x] **Step 1: Implement a storefront layout inspired by the reference shopping patterns**

  Use ANH LỚN SHOP's current brand tokens and content. Present a clear site header, category/collection entry points, an image-led product grid with prices, a responsive footer, and a product page with a gallery beside concise purchase details. Keep existing filters, pagination, and actions; make tap targets at least 44px and avoid horizontal overflow.

- [x] **Step 2: Add responsive and accessibility checks**

  Verify the product page at 390px, 768px, and 1280px; keyboard-operate color/size/gallery controls; ensure each image has meaningful alt text and each swatch has a color name and selected state. Respect reduced-motion preferences for image transitions.

- [x] **Step 3: Run frontend tests and all three production builds**

  Run: `cd frontend && npx vitest run && npx vite build --mode user && npx vite build --mode admin && npx vite build --mode manager`
  Expected: existing tests pass and all builds succeed.

### Task 6: Final integration review

**Files:**
- Review all files changed in Tasks 1–5; update `frontend/README.md` only if its storefront structure description is affected.

- [x] **Step 1: Run backend and frontend verification**

  Run: `cd backend && mvn -q test`; then `cd frontend && npx vitest run && npx vite build --mode user && npx vite build --mode admin && npx vite build --mode manager`.
  Expected: test suites pass and all three builds succeed.

- [x] **Step 2: Verify database migration/seed in an isolated temporary database**

  Apply migration 023, run the updated product seed twice, and confirm all seeded colors have valid images, product counts and non-image values are unchanged. Use an isolated temporary PostgreSQL instance rather than the application database.

- [x] **Step 3: Review final diff and working tree**

  Run `git diff --check` and inspect the changed files. Preserve the pre-existing `database/seed/seed_data.sql` admin password hash edit; do not include it as part of this feature unless the user separately asks.

**Execution notes:** Reused the existing storefront header, footer, brand tokens, routes, and purchase actions; no `App.jsx` change was needed. Added image-backed collection tiles and responsive catalog/detail styling in `storefront-catalog.css`, imported last by `UserPortal`. Browser checks at 390px, 768px, and 1280px verified no horizontal overflow, keyboard selection for color/size/gallery, and color-specific image switching. Current checks: frontend Vitest 51 files / 361 tests pass; all user/admin/manager builds succeed. Backend: 44 suites / 264 tests, 0 failures/errors, 4 skipped. Disposable PostgreSQL seed/migration verification is recorded in the SDD ledger; the application database was not changed.
