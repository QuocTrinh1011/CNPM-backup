DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'refresh_tokens'::regclass
          AND conname = 'refresh_portal_audience_check'
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%EMPLOYEE%'
    ) THEN
        RAISE EXCEPTION 'refresh_portal_audience_check must permit EMPLOYEE';
    END IF;

    IF to_regclass('employee_profiles') IS NULL THEN
        RAISE EXCEPTION 'employee_profiles table is missing';
    END IF;
    IF to_regclass('employee_leave_requests') IS NULL THEN
        RAISE EXCEPTION 'employee_leave_requests table is missing';
    END IF;
    IF to_regclass('employee_attendance') IS NULL THEN
        RAISE EXCEPTION 'employee_attendance table is missing';
    END IF;
    IF to_regclass('employee_payroll_periods') IS NULL THEN
        RAISE EXCEPTION 'employee_payroll_periods table is missing';
    END IF;
    IF to_regclass('employee_payslips') IS NULL THEN
        RAISE EXCEPTION 'employee_payslips table is missing';
    END IF;
    IF to_regclass('employee_payroll_lines') IS NULL THEN
        RAISE EXCEPTION 'employee_payroll_lines table is missing';
    END IF;
    IF to_regclass('hr_payroll_settings') IS NULL THEN
        RAISE EXCEPTION 'hr_payroll_settings table is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'employee_profiles'::regclass
          AND confrelid = 'customers'::regclass
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'employee profile account foreign key is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'employee_profiles'::regclass
          AND confrelid = 'employee_profiles'::regclass
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'employee team-lead foreign key is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'employee_leave_requests'::regclass
          AND confrelid = 'employee_profiles'::regclass
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'leave request employee foreign key is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'employee_attendance'::regclass
          AND confrelid = 'employee_profiles'::regclass
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'attendance employee foreign key is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'employee_payslips'::regclass
          AND confrelid = 'employee_payroll_periods'::regclass
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'payslip payroll period foreign key is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'employee_payroll_lines'::regclass
          AND confrelid = 'employee_payslips'::regclass
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'payroll line payslip foreign key is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'uq_employee_profiles_code'
    ) THEN
        RAISE EXCEPTION 'employee code unique index is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'uq_employee_attendance_day'
    ) THEN
        RAISE EXCEPTION 'employee/date attendance unique index is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'uq_employee_payslip_period'
    ) THEN
        RAISE EXCEPTION 'payslip employee/period/revision unique index is missing';
    END IF;
END $$;
