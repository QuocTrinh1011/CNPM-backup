DO $$
DECLARE
    required_table TEXT;
    required_tables TEXT[] := ARRAY[
        'raw_materials', 'raw_material_receipts', 'raw_material_receipt_items',
        'product_recipes', 'product_recipe_items', 'production_plans',
        'production_plan_materials', 'material_issue_requests',
        'material_issue_request_items', 'production_runs',
        'production_run_consumptions', 'material_returns', 'material_return_items',
        'finished_goods_issue_requests', 'finished_goods_issue_request_items',
        'warehouse_finished_stock', 'inventory_movements'
    ];
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'employee_profiles'
          AND column_name = 'work_area'
          AND is_nullable = 'NO'
          AND column_default LIKE '%GENERAL%'
    ) THEN
        RAISE EXCEPTION 'WORK_AREA_COLUMN_DEFAULT_OR_NULLABILITY_INVALID';
    END IF;

    FOREACH required_table IN ARRAY required_tables LOOP
        IF to_regclass(current_schema() || '.' || required_table) IS NULL THEN
            RAISE EXCEPTION 'WAREHOUSE_TABLE_MISSING:%', required_table;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'inventory_movements'
          AND column_name = 'scope_id'
    ) THEN
        RAISE EXCEPTION 'MOVEMENT_SCOPE_COLUMN_MISSING';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'employee_profiles'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%work_area%'
          AND pg_get_constraintdef(oid) LIKE '%WAREHOUSE%'
    ) THEN
        RAISE EXCEPTION 'WORK_AREA_CHECK_MISSING';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'inventory_movements'::regclass
          AND contype = 'f'
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                              WHERE attrelid = 'inventory_movements'::regclass
                                AND attname = 'scope_id')]::smallint[]
    ) THEN
        RAISE EXCEPTION 'MOVEMENT_SCOPE_FOREIGN_KEY_MISSING';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'raw_materials'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%available_quantity%'
    ) THEN
        RAISE EXCEPTION 'RAW_MATERIAL_NONNEGATIVE_CHECK_MISSING';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'warehouse_finished_stock'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%quantity%'
    ) THEN
        RAISE EXCEPTION 'FINISHED_STOCK_NONNEGATIVE_CHECK_MISSING';
    END IF;

    IF to_regclass(current_schema() || '.uq_raw_material_code_ci') IS NULL
       OR to_regclass(current_schema() || '.uq_product_recipe_active') IS NULL
       OR to_regclass(current_schema() || '.uq_inventory_movement_reference') IS NULL THEN
        RAISE EXCEPTION 'WAREHOUSE_UNIQUE_INDEX_MISSING';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'raw_material_receipts'::regclass
          AND contype = 'f'
          AND confrelid = 'suppliers'::regclass
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'warehouse_finished_stock'::regclass
          AND contype = 'f'
          AND confrelid = 'products'::regclass
    ) THEN
        RAISE EXCEPTION 'WAREHOUSE_FOREIGN_KEY_MISSING';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'inventory_movements'::regclass
          AND tgname = 'trg_inventory_movements_immutable'
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION 'MOVEMENT_IMMUTABILITY_TRIGGER_MISSING';
    END IF;

    IF EXISTS (
        SELECT p.product_id FROM products p
        LEFT JOIN inventory_movements m
          ON m.item_type = 'PRODUCT'
         AND m.item_id = p.product_id
         AND m.location = 'SELLABLE'
         AND m.movement_type = 'OPENING'
        GROUP BY p.product_id
        HAVING COUNT(m.id) <> 1
    ) THEN
        RAISE EXCEPTION 'SELLABLE_OPENING_MOVEMENTS_MISSING_OR_DUPLICATED';
    END IF;
END $$;
