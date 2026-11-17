package com.htttdn.crm.controller;

import com.htttdn.crm.dto.hr.AttendanceUpsertRequest;
import com.htttdn.crm.dto.hr.EmployeeAttendanceDto;
import com.htttdn.crm.dto.hr.EmployeeTeamMemberDto;
import com.htttdn.crm.dto.hr.TeamAttendanceDto;
import com.htttdn.crm.service.EmployeeAttendanceService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class EmployeeAttendanceController {
    private final EmployeeAttendanceService attendance;

    public EmployeeAttendanceController(EmployeeAttendanceService attendance) { this.attendance = attendance; }

    @GetMapping("/api/manager/hr/attendance")
    public List<EmployeeAttendanceDto> hrMonth(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Long employeeId,
            @RequestParam int year,
            @RequestParam int month) {
        return attendance.hrMonth(authorization, employeeId, year, month);
    }

    @PutMapping("/api/manager/hr/attendance")
    public EmployeeAttendanceDto upsert(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody AttendanceUpsertRequest request) {
        return attendance.upsert(authorization, request);
    }

    @GetMapping("/api/manager/me/attendance")
    public List<EmployeeAttendanceDto> mine(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam int year,
            @RequestParam int month) {
        return attendance.mine(authorization, year, month);
    }

    @GetMapping("/api/manager/me/team")
    public List<EmployeeTeamMemberDto> team(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return attendance.team(authorization);
    }

    @GetMapping("/api/manager/me/team/attendance")
    public List<TeamAttendanceDto> teamMonth(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam int year,
            @RequestParam int month) {
        return attendance.teamMonth(authorization, year, month);
    }
}
