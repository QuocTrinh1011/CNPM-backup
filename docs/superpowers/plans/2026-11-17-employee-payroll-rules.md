# Employee Payroll Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the HR payroll screen usable with a 2026 rules preset and calculate regular and night overtime by the approved workday category.

**Architecture:** Keep effective-dated rules in `hr_payroll_settings`; offer a 2026 preset in the HR form without silently saving it. Record night overtime separately for ordinary days, weekly rest days, and holidays so the calculator can apply the matching rates. Preserve existing night-hours premium and previously published payslip snapshots.

**Tech Stack:** Spring Boot, JPA, PostgreSQL migrations, JUnit, React, Vitest.

**Spec:** User-approved payroll recommendation in the conversation on 2026-11-17; 2026 Vietnam payroll references: Personal Income Tax Law 109/2025/QH15 and Labour Code guidance in Decree 145/2020/ND-CP.

## Global Constraints

- Do not automatically save or generate payroll when loading a preset.
- Use decimal fractions for rates: 0.105, 0.215, 0.05, 0.1, 0.2, 0.3, 0.35.
- Effective-date settings and snapshot rule/input values on generated payslips.
- Preserve published historical payslips and existing attendance rows.
- Keep unrelated Admin statistics edits in the working tree untouched.

## Review Focus

- Annual tax brackets must be monthly VND bounds and contiguous, with the final upper bound null.
- Employee/employer insurance percentages apply to the profile's insurance salary base, not every gross earning.
- Night overtime must distinguish normal day, weekly rest day, and public holiday hours; ordinary night work remains a separate 30% premium.
- Night normal-day additional 20% basis is 100% when there was no daytime overtime that date, and 150% when daytime overtime was recorded that date.
- Missing fields in old payslip snapshots must deserialize as zero for later corrections.

---

### Task 1: Add the 2026 payroll preset and clearer HR form behavior

**Files:** `frontend/src/features/manager/EmployeeWorkspaces.jsx`, `frontend/src/features/manager/EmployeeWorkspaces.test.jsx`

- [x] Add a test that when the HR settings endpoint has no effective rule, the textarea is prefilled with a 2026 suggestion while the form still requires an explicit save.
- [x] Add a test that selecting the preset sets employee insurance to 0.105, employer contribution to 0.215, personal/dependent deductions to 15500000/6200000, and the five 2026 tax bands.
- [x] Run the focused Vitest file and confirm the new assertions fail before implementation.
- [x] Add a named 2026 preset and a button to load it; label it as a suggested rule set and explain that schedule/region-specific values must be reviewed. Do not auto-submit.
- [x] Run the focused Vitest file and confirm the assertions pass.

### Task 2: Add day-category fields for night overtime

**Files:** `database/migrations/028_employee_night_overtime.sql`, `backend/src/main/java/com/cnpm/clothingstore/entity/EmployeeAttendance.java`, `backend/src/main/java/com/cnpm/clothingstore/dto/hr/AttendanceUpsertRequest.java`, `backend/src/main/java/com/cnpm/clothingstore/dto/hr/EmployeeAttendanceDto.java`, `backend/src/main/java/com/cnpm/clothingstore/service/EmployeeAttendanceService.java`, `backend/src/test/java/com/cnpm/clothingstore/service/EmployeeAttendanceIntegrationTest.java`, `frontend/src/features/manager/EmployeeWorkspaces.jsx`

- [x] Add attendance API tests proving the three night-overtime categories are persisted and returned independently.
- [x] Run the focused backend test and confirm it fails because the new fields are absent.
- [x] Add non-null zero-default columns for normal-day, weekly-rest-day, and holiday night overtime; wire them through the entity, request, response, audit snapshot, and form.
- [x] Keep `overtimeNightHours` as ordinary night-work premium hours and relabel the UI accordingly.
- [x] Run the focused backend and frontend tests and confirm they pass.

### Task 3: Calculate 2026 rules and night overtime correctly

**Files:** `backend/src/main/java/com/cnpm/clothingstore/service/PayrollCalculator.java`, `backend/src/main/java/com/cnpm/clothingstore/service/EmployeePayrollService.java`, `backend/src/test/java/com/cnpm/clothingstore/service/EmployeePayrollServiceTest.java`, `backend/src/test/java/com/cnpm/clothingstore/service/EmployeePayrollIntegrationTest.java`

- [x] Add calculator tests for normal/rest/holiday night overtime, including the 20% additional normal-day basis with and without daytime overtime.
- [x] Add a test for the five monthly 2026 tax bands and 2026 deductions, plus validation of the 0.2 night-overtime additional rate.
- [x] Run focused backend tests and confirm the new assertions fail before implementation.
- [x] Add `nightOvertimeAdditionalMultiplier`; apply night-overtime pay as base overtime rate + 30% night premium + 20% daytime-rate component, while retaining the existing standalone night-work premium.
- [x] Aggregate and snapshot the new attendance fields; treat absent fields in old snapshots as zero.
- [x] Run focused backend tests and confirm they pass.

### Task 4: Verify and document

**Files:** `backend/README.md`, `docs/superpowers/plans/2026-11-17-employee-payroll-rules.md`

- [x] Document the recommended 2026 settings, decimal-rate format, and the need for HR review of shop schedule, insurance bases, and regional minimum wage.
- [x] Run `mvn -q -Dtest=EmployeePayrollServiceTest,EmployeeAttendanceIntegrationTest,EmployeePayrollIntegrationTest test` from `backend` and the focused frontend Vitest file.
- [x] Build the frontend manager mode and compile the backend; record actual results.
- [x] Do not generate or publish payroll periods as part of implementation.

## Implementation results

- Backend focused tests: `EmployeePayrollServiceTest` 12/12, `EmployeePayrollIntegrationTest` 4/4, and `EmployeeAttendanceIntegrationTest` 2/2 passed using Java 21 and the repository's Maven distribution.
- Frontend focused test: `EmployeeWorkspaces.test.jsx` 8/8 passed.
- Frontend `npm run build -- --mode manager` succeeded. Vite emitted its existing `lucide-react` module-directive warnings.
- Migration 028 is added and fresh `schema.sql` includes the same fields. It has not been applied to a live PostgreSQL database; HR settings have not been saved and no payroll period was generated or published.
