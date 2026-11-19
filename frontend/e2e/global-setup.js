import bcrypt from 'bcryptjs';
import pg from 'pg';
import { getE2EDatabaseSettings } from './database.js';
import { ALL_E2E_FIXTURES, E2E_PASSWORD, ROLE_FIXTURES } from './credentials.js';

const { Pool } = pg;

async function seedAndVerifyRoleFixtures(pool, passwordHash) {
  for (const fixture of ALL_E2E_FIXTURES) {
    const account = await pool.query(
      `INSERT INTO customers (email, full_name, password_hash, role, locked, created_at)
       VALUES ($1, $2, $3, $4, FALSE, now())
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         locked = FALSE,
         lock_reason = NULL,
         deleted_at = NULL
       RETURNING customer_id`,
      [fixture.email, fixture.fullName, passwordHash, fixture.role],
    );

    if (fixture.employeeCode) {
      const employeeId = account.rows[0]?.customer_id;
      await pool.query(
        `INSERT INTO employee_profiles (
           employee_id, employee_code, education_level, job_title, permission_profile,
           work_area, employment_status, hire_date, monthly_base_salary,
           insurance_salary_base, reports_to_employee_id, created_at, updated_at
         ) VALUES ($1, $2, 'E2E', $3, $4, $5, 'ACTIVE', current_date - INTERVAL '1 year',
                  9000000, 9000000, NULL, now(), now())
         ON CONFLICT (employee_id) DO UPDATE SET
           employee_code = EXCLUDED.employee_code,
           education_level = EXCLUDED.education_level,
           job_title = EXCLUDED.job_title,
           permission_profile = EXCLUDED.permission_profile,
           work_area = EXCLUDED.work_area,
           employment_status = 'ACTIVE',
           hire_date = EXCLUDED.hire_date,
           resignation_date = NULL,
           monthly_base_salary = EXCLUDED.monthly_base_salary,
           insurance_salary_base = EXCLUDED.insurance_salary_base,
           reports_to_employee_id = NULL,
           updated_at = now()`,
        [employeeId, fixture.employeeCode, fixture.jobTitle, fixture.permissionProfile, fixture.workArea],
      );
    }
  }

  for (const fixture of ALL_E2E_FIXTURES.filter((candidate) => candidate.reportsTo)) {
    await pool.query(
      `UPDATE employee_profiles
       SET reports_to_employee_id = (
         SELECT customer_id FROM customers WHERE email = $1
       ), updated_at = now()
       WHERE employee_id = (SELECT customer_id FROM customers WHERE email = $2)`,
      [fixture.reportsTo, fixture.email],
    );
  }

  for (const fixture of ALL_E2E_FIXTURES) {
    const result = await pool.query(
      `SELECT account.role, account.locked, account.deleted_at, account.password_hash,
              profile.employee_code, profile.work_area, profile.permission_profile
       FROM customers account
       LEFT JOIN employee_profiles profile ON profile.employee_id = account.customer_id
       WHERE account.email = $1`,
      [fixture.email],
    );
    const seeded = result.rows[0];
    const invalidAccount =
      !seeded ||
      seeded.role !== fixture.role ||
      seeded.locked ||
      seeded.deleted_at ||
      !(await bcrypt.compare(E2E_PASSWORD, seeded.password_hash));
    const invalidProfile = fixture.employeeCode && (
      seeded.employee_code !== fixture.employeeCode ||
      seeded.work_area !== fixture.workArea ||
      seeded.permission_profile !== fixture.permissionProfile
    );
    if (invalidAccount || invalidProfile) {
      throw new Error(`Could not seed usable ${fixture.name} fixture in the guarded crm_e2e database.`);
    }
  }
}

async function seedAndVerifyCatalogFixture(pool) {
  let category = await pool.query("SELECT category_id FROM categories WHERE name = 'E2E Test' LIMIT 1");
  if (!category.rows[0]) {
    category = await pool.query("INSERT INTO categories (name) VALUES ('E2E Test') RETURNING category_id");
  }
  const existing = await pool.query("SELECT product_id FROM products WHERE name = 'E2E Playwright Tee' LIMIT 1");
  if (!existing.rows[0]) {
    await pool.query(
      `INSERT INTO products (
       category_id, name, gender, description, material, size, color, price,
       quantity_remaining, image_url, color_images, featured, active, created_at, updated_at
     )
     VALUES ($1, 'E2E Playwright Tee', 'NAM', 'Isolated storefront test fixture', 'Cotton',
             'S,M,L', 'Đen', 200000, 1000, NULL, '{}'::jsonb, FALSE, TRUE, now(), now())`,
      [category.rows[0].category_id],
    );
  } else {
    await pool.query(
      "UPDATE products SET quantity_remaining = 1000, active = TRUE, updated_at = now() WHERE product_id = $1",
      [existing.rows[0].product_id],
    );
  }
  const product = await pool.query(
    `SELECT product_id, quantity_remaining FROM products WHERE name = 'E2E Playwright Tee'`,
  );
  if (!product.rows[0] || Number(product.rows[0].quantity_remaining) < 1) {
    throw new Error('Could not seed an in-stock catalog fixture in the guarded crm_e2e database.');
  }
}

async function seedAndVerifyWarehouseFixture(pool) {
  const productResult = await pool.query("SELECT product_id FROM products WHERE name = 'E2E Playwright Tee' LIMIT 1");
  const employeeResult = await pool.query("SELECT customer_id FROM customers WHERE email = $1", [ROLE_FIXTURES.find(row => row.name === 'Employee Warehouse').email]);
  const managerResult = await pool.query("SELECT customer_id FROM customers WHERE email = $1", [ROLE_FIXTURES.find(row => row.name === 'Manager Warehouse').email]);
  if (!productResult.rows[0] || !employeeResult.rows[0] || !managerResult.rows[0]) {
    throw new Error('Could not seed the assigned warehouse plan because its E2E account or product is missing.');
  }

  let material = await pool.query("SELECT id FROM raw_materials WHERE upper(code) = 'E2E-FABRIC' LIMIT 1");
  if (!material.rows[0]) {
    material = await pool.query(
      `INSERT INTO raw_materials (code, name, unit, available_quantity, active, created_at, updated_at)
       VALUES ('E2E-FABRIC', 'Vải E2E', 'm', 1000, TRUE, now(), now()) RETURNING id`,
    );
  } else {
    await pool.query("UPDATE raw_materials SET available_quantity = 1000, active = TRUE, updated_at = now() WHERE id = $1", [material.rows[0].id]);
  }

  let recipe = await pool.query("SELECT id FROM product_recipes WHERE product_id = $1 AND version = 1 LIMIT 1", [productResult.rows[0].product_id]);
  if (!recipe.rows[0]) {
    recipe = await pool.query(
      `INSERT INTO product_recipes (product_id, version, active, created_by, created_at)
       VALUES ($1, 1, TRUE, $2, now()) RETURNING id`,
      [productResult.rows[0].product_id, managerResult.rows[0].customer_id],
    );
  } else {
    await pool.query("UPDATE product_recipes SET active = TRUE, created_by = $2, created_at = now() WHERE id = $1", [recipe.rows[0].id, managerResult.rows[0].customer_id]);
  }
  const recipeId = recipe.rows[0].id;
  const recipeItem = await pool.query("SELECT id FROM product_recipe_items WHERE recipe_id = $1 AND material_id = $2 LIMIT 1", [recipeId, material.rows[0].id]);
  if (!recipeItem.rows[0]) {
    await pool.query(
      `INSERT INTO product_recipe_items (recipe_id, material_id, material_code, material_name, unit, quantity_per_product)
       VALUES ($1, $2, 'E2E-FABRIC', 'Vải E2E', 'm', 1)`,
      [recipeId, material.rows[0].id],
    );
  } else {
    await pool.query("UPDATE product_recipe_items SET quantity_per_product = 1 WHERE id = $1", [recipeItem.rows[0].id]);
  }
  let plan = await pool.query("SELECT id FROM production_plans WHERE plan_code = 'E2E-WAREHOUSE-PLAN' LIMIT 1");
  if (!plan.rows[0]) {
    plan = await pool.query(
      `INSERT INTO production_plans (
       plan_code, product_id, recipe_id, target_quantity, completed_quantity,
       assigned_employee_id, due_date, status, note, created_by, created_at, updated_at
       ) VALUES ('E2E-WAREHOUSE-PLAN', $1, $2, 10, 0, $3, current_date + 7, 'PLANNED', 'Isolated Playwright fixture', $4, now(), now())
       RETURNING id`,
      [productResult.rows[0].product_id, recipeId, employeeResult.rows[0].customer_id, managerResult.rows[0].customer_id],
    );
  } else {
    await pool.query(
      `UPDATE production_plans SET product_id = $2, recipe_id = $3, target_quantity = 10, completed_quantity = 0,
       assigned_employee_id = $4, due_date = current_date + 7, status = 'PLANNED', note = 'Isolated Playwright fixture',
       created_by = $5, updated_at = now() WHERE id = $1`,
      [plan.rows[0].id, productResult.rows[0].product_id, recipeId, employeeResult.rows[0].customer_id, managerResult.rows[0].customer_id],
    );
  }
  const planId = plan.rows[0].id;
  const planMaterial = await pool.query("SELECT id FROM production_plan_materials WHERE plan_id = $1 AND material_id = $2 LIMIT 1", [planId, material.rows[0].id]);
  if (!planMaterial.rows[0]) {
    await pool.query(
      `INSERT INTO production_plan_materials (
       plan_id, material_id, material_code, material_name, unit,
       quantity_per_product, required_quantity, allocated_quantity, consumed_quantity, returned_quantity
       ) VALUES ($1, $2, 'E2E-FABRIC', 'Vải E2E', 'm', 1, 10, 0, 0, 0)`,
      [planId, material.rows[0].id],
    );
  } else {
    await pool.query(
      `UPDATE production_plan_materials SET required_quantity = 10, allocated_quantity = 0,
       consumed_quantity = 0, returned_quantity = 0 WHERE id = $1`,
      [planMaterial.rows[0].id],
    );
  }
  const check = await pool.query(
    `SELECT plan.id, profile.employee_code, count(material.id)::integer AS material_count
     FROM production_plans plan
     JOIN employee_profiles profile ON profile.employee_id = plan.assigned_employee_id
     LEFT JOIN production_plan_materials material ON material.plan_id = plan.id
     WHERE plan.plan_code = 'E2E-WAREHOUSE-PLAN'
     GROUP BY plan.id, profile.employee_code`,
  );
  if (check.rows[0]?.employee_code !== 'E2E-WAREHOUSE-STAFF' || check.rows[0]?.material_count !== 1) {
    throw new Error('Could not verify the assigned warehouse plan fixture in the guarded crm_e2e database.');
  }
}

export default async function globalSetup() {
  const settings = getE2EDatabaseSettings();
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
  const pool = new Pool({ ...settings.pgConfig, connectionTimeoutMillis: 2_000 });
  const deadline = Date.now() + 60_000;

  try {
    let schemaReady = false;
    while (Date.now() < deadline) {
      try {
        const result = await pool.query("SELECT to_regclass('public.customers') AS customers");
        if (result.rows[0].customers) {
          schemaReady = true;
          break;
        }
      } catch {
        // Spring may still be creating the schema or PostgreSQL may still be starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    if (!schemaReady) {
      throw new Error('PostgreSQL or the Spring-created crm_e2e schema was not ready within 60 seconds.');
    }

    await seedAndVerifyRoleFixtures(pool, passwordHash);
    await seedAndVerifyCatalogFixture(pool);
    await seedAndVerifyWarehouseFixture(pool);
    await seedAndVerifyRoleFixtures(pool, passwordHash);
    await seedAndVerifyCatalogFixture(pool);
    await seedAndVerifyWarehouseFixture(pool);
  } finally {
    await pool.end();
  }
}
