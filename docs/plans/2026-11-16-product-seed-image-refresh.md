# Product Seed Image Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the 100 demo product photos with category-matched Pexels stock images inspired by ICONDENIM's clean men's-fashion catalog style.

**Architecture:** Keep seed product data unchanged except `image_url`. Update the seed's insert URLs and add an idempotent SKU-to-image update so existing demo products receive the new images. Apply the same image-only mapping to `cnpm_crm` after a backup.

**Tech Stack:** PostgreSQL SQL, PowerShell HTTP checks, Spring Boot REST API.

**Spec:** `docs/specs/2026-11-16-product-seed-images-design.md`

## Global Constraints

- Keep names, SKUs, categories, descriptions, colors, sizes, prices, sale prices, stock, suppliers, and all non-image DB fields unchanged.
- Use Pexels stock photos; do not copy ICONDENIM photos or logos.
- Do not change application code or UI.
- Update only the 100 `ALS-SKU-001` through `ALS-SKU-100` products in the live database; do not rerun unrelated seed sections.
- Do not commit or push.

## Review Focus

- Every expected SKU has exactly one image mapping; validate the 100 distinct SKUs before DB update.
- Image URLs are reachable; check each distinct URL.
- The live update changes only `products.image_url`; compare non-image product values before and after for stability.

---

### Task 1: Refresh product image URLs in seed SQL

**Files:**
- Modify: `database/seed/seed_data.sql`

- [x] Curate working Pexels CDN URLs by category (tee, polo, shirt, pants/denim, jacket, accessory) and assign them to the 100 existing SKU rows.
- [x] Add an idempotent SQL `UPDATE ... FROM (VALUES (sku, image_url), ...)` after product insertion; match `ALS-SKU-###` in product names and update only `image_url`.
- [x] Parse the finished seed to confirm 100 distinct SKU mappings, category-appropriate URL assignments, and no non-image product fields changed.
- [x] Check every distinct Pexels URL returns an image response.

### Task 2: Refresh the live demo database

**Files:**
- Database: `cnpm_crm` on local PostgreSQL

- [x] Create a fresh `pg_dump` backup before modifying the DB.
- [x] Apply the 100 SKU-to-image mappings in one transaction, updating only `products.image_url` for existing `ALS-SKU-###` products.
- [x] Verify the DB still has 100 distinct demo SKUs and the expected image URLs; query `GET /api/products` and confirm its `totalElements` remains 100.
- [x] Confirm user, admin, and manager Vite portals still return HTTP 200.
