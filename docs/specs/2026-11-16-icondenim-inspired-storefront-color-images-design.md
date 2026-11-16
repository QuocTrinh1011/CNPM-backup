# ICONDENIM-Inspired Storefront and Color Images

## Intent

Refresh the customer storefront using the shopping patterns and product presentation seen on ICONDENIM, while keeping ANH LỚN SHOP's own identity and the existing checkout, account, cart, and order flows. Product photos should look like a coherent menswear catalog. Selecting a product color must immediately show that color's images.

Reference pages reviewed:

- https://icondenim.com/collections/ao-thun
- https://icondenim.com/products/ao-thun-nam-brew-mates-form-boxy

Use appropriately licensed stock photography for the catalog, following the user's earlier choice. Do not reuse ICONDENIM's product photography, text, or branded assets.

## Current State

- `products.image_url` stores one image for each product.
- `products.color` and `products.size` are comma-separated strings.
- `ProductModal` lets a buyer choose a color, but the selected color only changes the label; the image stays the same.
- `ManagerProducts` is the warehouse product editor and currently edits only the single image URL, name, category, price, stock, and description.
- Order lines already store the selected color and size. Product stock and price are product-level, not color/size-level.

## Goals

- Give the customer storefront a coherent fashion-commerce presentation: a clear site header and category navigation, searchable/filterable collections, product cards, a useful footer, and a responsive product detail page with an image gallery, color and size selection, pricing, and purchase actions.
- Keep the current cart, checkout, authentication, wishlist, and order APIs and behaviors.
- Persist one or more image URLs for each listed product color and expose them to storefront and warehouse product management.
- On color change, switch the active gallery to that color's images, select its first image, and keep the selected color in the add-to-cart payload.
- Retain `imageUrl` as a compatibility and fallback image for products with no color-specific images.
- Add image previews and simple URL editing for each color in the Manager warehouse product form.

## Non-goals

- Redesign the Admin or Manager portals beyond the warehouse product editor fields required to manage images.
- Add inventory, price, or size stock per variant. Existing stock and price remain product-level.
- Change checkout, order creation, promotions, authentication, or role permissions.
- Reuse ICONDENIM's source code, copy, or product photographs.

## Approaches Considered

1. **Frontend-only color map:** Fast to prototype, but mappings would be hard-coded outside product data and could not be edited by warehouse staff.
2. **Separate product-image table:** Provides relational constraints and is suitable if images later need independent metadata, search, or lifecycle. It adds joins and image-collection handling to each product read/write path now.
3. **Product-owned JSONB color gallery (selected):** Store a map from each exact color label to an ordered list of image URLs on the product. The catalog always reads images as part of the product, and the editor submits that map with the product. This keeps the product read/write interface small and avoids N+1 image queries. If variant inventory or independently managed image assets are added later, the map can be migrated to normalized variant/image tables.

## Data and Interface

- Add nullable-free `products.color_images JSONB NOT NULL DEFAULT '{}'::jsonb` in migration `023_product_color_images.sql` and add the same column to `database/schema.sql`.
- Represent it in Java/JSON as `colorImages: { [colorLabel]: [imageUrl, ...] }`.
- Extend the existing product create/update request to carry `colors` and `colorImages`. Validate that image-map keys match listed color labels after trimming, each color has at most six nonblank image URLs, and URLs are HTTPS or same-origin paths. Preserve the existing fallback `imageUrl` behavior.
- Replace the old single-image product photo assignments in `database/seed/seed_data.sql` with a curated color gallery for each seeded product, using stock photos that visually match the category and color. Do not alter product names, descriptions, prices, sale prices, stock, or non-product seed data.
- The checked-in seed currently has 16 named product rows and no SKU column or SKU markers. Update those seeded products by their existing product name and exact color list when the seed is rerun; do not change descriptions to add identifiers. Do not delete product rows from a live database because order and stock-receipt history may reference them.
- Cover every listed color for all seeded products. Similar SKUs may share the same category/color-matched stock image; a selected color must never silently keep showing an image of a different color.
- Keep warehouse role authorization unchanged. Only the existing product write permissions may edit product colors and galleries.
- The storefront consumes the same product shape from `/api/products` and `/api/products/{id}`; order APIs continue sending the selected color and size as they do now.

## Customer Experience

- Keep the existing site's customer flows but restyle the customer-facing home, collection, and product detail views around clear fashion photography, editorial collection entry points, concise product cards, and responsive spacing.
- Use a product detail layout with a large main image and selectable thumbnails alongside product name, price, availability, color swatches, size choices, quantity, and add/buy actions.
- Selecting a color selects that color's first image and replaces the thumbnail gallery with the images mapped to that color. Selecting a thumbnail changes only the main image. If a color has no images, use `imageUrl` and show a single-image gallery.
- Keep sizes and color labels visible and accessible; the selected color and size remain the values sent to the existing cart/order functions.
- Make the layout usable at mobile, tablet, and desktop widths.

## Verification

- Backend tests cover JSONB persistence/serialization, request validation, and fallback behavior.
- Frontend tests cover color-to-gallery switching, thumbnail selection, fallback imagery, and selected color/size passed into add-to-cart.
- Verify the warehouse editor loads and saves color galleries for create and edit flows.
- Run backend tests and frontend Vitest/build for `user`, `admin`, and `manager` modes. Review a seeded product at mobile, tablet, and desktop sizes.
- Confirm migration and seed can be run idempotently on a local database after taking a backup.

## Assumptions

- The refresh applies to the customer-facing storefront, not the overall Admin or Manager visual systems.
- Existing stock/price semantics and role access remain unchanged.
- Seed mappings cover every existing color. The `imageUrl` fallback is for legacy products or newly created products before warehouse staff add color images; it must not cause a seeded color selection to display a visibly different color.
- Stock photography may not show the exact garment cut or print of a particular SKU. The warehouse editor can replace seeded stock URLs with the shop's own product photos later.
