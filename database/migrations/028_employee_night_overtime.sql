ALTER TABLE employee_attendance
    ADD COLUMN IF NOT EXISTS overtime_night_normal_hours NUMERIC(7,2) NOT NULL DEFAULT 0
        CHECK (overtime_night_normal_hours >= 0),
    ADD COLUMN IF NOT EXISTS overtime_night_rest_day_hours NUMERIC(7,2) NOT NULL DEFAULT 0
        CHECK (overtime_night_rest_day_hours >= 0),
    ADD COLUMN IF NOT EXISTS overtime_night_holiday_hours NUMERIC(7,2) NOT NULL DEFAULT 0
        CHECK (overtime_night_holiday_hours >= 0);
