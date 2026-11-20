# Product seed image refresh design

Date: 2026-11-16

## Intent

Replace unsuitable and repetitive product seed photos with men's fashion stock photos that fit the clean, wearable catalog style shown by ICONDENIM. Keep the existing 100-product catalog and all non-image product data intact.

## Goals

- Match photos to their product group: tees, polos, shirts, trousers/jeans, jackets, and accessories.
- Use multiple distinct Pexels stock photos with simple studio or lifestyle framing and neutral styling; avoid visible third-party logos.
- Update `database/seed/seed_data.sql` so fresh seed runs use the new photo URLs and repeat runs refresh only `image_url` for existing `ALS-SKU-001` through `ALS-SKU-100` products.
- Update the live `cnpm_crm` product images only, after a database backup.
- Confirm the 100 image URLs return successfully and the storefront API still returns 100 products.

## Non-goals

- Do not change names, SKUs, categories, descriptions, colors, sizes, prices, sale prices, stock, suppliers, or any other database fields.
- Do not copy ICONDENIM's product photos or logos.
- Do not change application code or UI.

## Approaches

1. **Pexels stock, matched by garment category (selected):** keeps the visual direction while avoiding direct reuse of ICONDENIM's branded assets. Pexels states its photos are free for personal and commercial use under its license.
2. **Direct ICONDENIM image URLs:** visually closest, but brings their branding into this shop and depends on hotlinking their product assets.

## Implementation choices

- Keep external Pexels image URLs, consistent with the current database's remote `image_url` values.
- Curate a small varied set per product category, selecting different URLs for different SKUs where available.
- Add an idempotent SQL update mapping by SKU that changes only `products.image_url`, because existing seed inserts skip products already present.
- Apply the same image mapping to `cnpm_crm` using a transaction after backing up the DB; do not rerun unrelated account, survey, voucher, schema, or cleanup statements.

## Reference

- [ICONDENIM men's apparel collections](https://icondenim.com/collections/ao-thun) for visual direction.
- [Pexels license](https://www.pexels.com/license/) for stock image usage terms.
