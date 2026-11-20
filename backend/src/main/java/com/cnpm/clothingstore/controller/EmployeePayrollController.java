package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.dto.hr.PayrollDtos.*;
import com.cnpm.clothingstore.service.EmployeePayrollService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
public class EmployeePayrollController {
    private final EmployeePayrollService payroll;
    public EmployeePayrollController(EmployeePayrollService payroll) { this.payroll = payroll; }

    @GetMapping("/api/manager/hr/payroll-settings")
    public SettingView setting(@RequestHeader(value = "Authorization", required = false) String authorization,
                               @RequestParam(required = false) LocalDate asOf) {
        return payroll.effectiveSetting(authorization, asOf);
    }

    @PutMapping("/api/manager/hr/payroll-settings")
    public ResponseEntity<SettingView> saveSetting(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                    @RequestBody SettingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(payroll.saveSetting(authorization, request));
    }

    @GetMapping("/api/manager/hr/payroll-periods")
    public List<PeriodView> list(@RequestHeader(value = "Authorization", required = false) String authorization,
                                @RequestParam(required = false) Integer year) {
        return payroll.listPeriods(authorization, year);
    }

    @PostMapping("/api/manager/hr/payroll-periods")
    public ResponseEntity<PeriodView> generate(@RequestHeader(value = "Authorization", required = false) String authorization,
                                               @RequestBody PeriodRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(payroll.generate(authorization, request));
    }

    @GetMapping("/api/manager/hr/payroll-periods/{year}/{month}")
    public PeriodView get(@RequestHeader(value = "Authorization", required = false) String authorization,
                          @PathVariable int year, @PathVariable int month) {
        return payroll.getPeriod(authorization, year, month);
    }

    @PostMapping("/api/manager/hr/payroll-periods/{year}/{month}/review")
    public PeriodView review(@RequestHeader(value = "Authorization", required = false) String authorization,
                             @PathVariable int year, @PathVariable int month) {
        return payroll.review(authorization, year, month);
    }

    @PostMapping("/api/manager/hr/payroll-periods/{year}/{month}/publish")
    public PeriodView publish(@RequestHeader(value = "Authorization", required = false) String authorization,
                              @PathVariable int year, @PathVariable int month) {
        return payroll.publish(authorization, year, month);
    }

    @PostMapping("/api/manager/hr/payroll-periods/{year}/{month}/adjustments")
    public PayslipView adjust(@RequestHeader(value = "Authorization", required = false) String authorization,
                              @PathVariable int year, @PathVariable int month, @RequestBody AdjustmentRequest request) {
        return payroll.adjustDraft(authorization, year, month, request);
    }

    @PostMapping("/api/manager/hr/payroll-periods/{year}/{month}/revisions/{employeeId}")
    public ResponseEntity<PayslipView> correct(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                @PathVariable int year, @PathVariable int month, @PathVariable long employeeId,
                                                @RequestBody CorrectionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(payroll.correctPublished(authorization, year, month, employeeId, request));
    }

    @GetMapping("/api/manager/me/payslips")
    public List<PayslipView> mineForYear(@RequestHeader(value = "Authorization", required = false) String authorization,
                                         @RequestParam int year) {
        return payroll.mineForYear(authorization, year);
    }

    @GetMapping("/api/manager/me/payslips/{year}/{month}")
    public PayslipView mineForMonth(@RequestHeader(value = "Authorization", required = false) String authorization,
                                    @PathVariable int year, @PathVariable int month) {
        return payroll.mineForMonth(authorization, year, month);
    }
}
