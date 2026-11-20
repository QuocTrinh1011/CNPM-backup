const PAYROLL_RULES_2026 = {
  hoursPerWorkday: 8,
  normalOvertimeMultiplier: 1.5,
  restDayOvertimeMultiplier: 2,
  holidayOvertimeMultiplier: 3,
  nightWorkPremiumMultiplier: 0.3,
  nightOvertimeAdditionalMultiplier: 0.2,
  employeeInsuranceRate: 0.105,
  employerContributionRate: 0.215,
  personalTaxAllowance: 15500000,
  dependentTaxAllowance: 6200000,
  workingWeekdays: [1, 2, 3, 4, 5],
  publicHolidays: [],
  taxBrackets: [
    { lowerBound: 0, upperBound: 10000000, rate: 0.05 },
    { lowerBound: 10000000, upperBound: 30000000, rate: 0.1 },
    { lowerBound: 30000000, upperBound: 60000000, rate: 0.2 },
    { lowerBound: 60000000, upperBound: 100000000, rate: 0.3 },
    { lowerBound: 100000000, upperBound: null, rate: 0.35 },
  ],
};
export const payrollRulesJson = () => JSON.stringify(PAYROLL_RULES_2026, null, 2);
