package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.dto.hr.EmployeeLeaveDecision;
import com.cnpm.clothingstore.dto.hr.EmployeeLeaveDto;
import com.cnpm.clothingstore.dto.hr.EmployeeLeaveSubmission;
import com.cnpm.clothingstore.entity.EmployeeLeaveRequest;
import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.EmployeeLeaveRequestRepository;
import com.cnpm.clothingstore.repository.EmployeeProfileRepository;
import com.cnpm.clothingstore.repository.RefreshTokenRepository;
import com.cnpm.clothingstore.repository.UserRepository;
import com.cnpm.clothingstore.security.JwtTokenService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class EmployeeLeaveService {
    private static final Set<String> TYPES = Set.of("ANNUAL", "SICK", "MATERNITY", "RESIGNATION");
    private static final Set<String> DECISIONS = Set.of("APPROVED", "REJECTED");
    private static final Set<String> OVERLAP_STATUSES = Set.of("PENDING", "APPROVED");

    private final EmployeeLeaveRequestRepository requests;
    private final EmployeeProfileRepository profiles;
    private final RefreshTokenRepository refreshTokens;
    private final UserRepository users;
    private final EmployeeAccessService employeeAccess;
    private final JwtTokenService jwt;
    private final AuditTrail audit;

    public EmployeeLeaveService(EmployeeLeaveRequestRepository requests, EmployeeProfileRepository profiles,
                                RefreshTokenRepository refreshTokens, UserRepository users, EmployeeAccessService employeeAccess,
                                JwtTokenService jwt, AuditTrail audit) {
        this.requests = requests;
        this.profiles = profiles;
        this.refreshTokens = refreshTokens;
        this.users = users;
        this.employeeAccess = employeeAccess;
        this.jwt = jwt;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Page<EmployeeLeaveDto> listMine(String authorization, int page, int size) {
        EmployeeProfile employee = employeeAccess.requireEmployee(authorization);
        return requests.findByEmployee_EmployeeId(employee.getEmployeeId(), pageable(page, size))
                .map(EmployeeLeaveDto::from);
    }

    @Transactional
    public EmployeeLeaveDto submit(String authorization, EmployeeLeaveSubmission input) {
        EmployeeProfile employee = employeeAccess.requireEmployee(authorization);
        if (!"ACTIVE".equals(employee.getEmploymentStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "EMPLOYEE_NOT_ACTIVE", "Nhân viên đã nghỉ việc không thể tạo đơn mới.");
        }
        String type = normalized(input.requestType());
        if (!TYPES.contains(type)) throw bad("INVALID_LEAVE_TYPE", "Loại đơn nghỉ không hợp lệ.");
        if (input.endDate().isBefore(input.startDate())) throw bad("INVALID_LEAVE_DATES", "Ngày kết thúc không được trước ngày bắt đầu.");
        if ("RESIGNATION".equals(type) && input.startDate().isBefore(employee.getHireDate())) {
            throw bad("INVALID_RESIGNATION_DATE", "Ngày nghỉ việc không được trước ngày nhận việc.");
        }
        if (requests.existsByEmployee_EmployeeIdAndStatusInAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                employee.getEmployeeId(), OVERLAP_STATUSES, input.endDate(), input.startDate())) {
            throw new ApiException(HttpStatus.CONFLICT, "LEAVE_REQUEST_OVERLAP", "Khoảng ngày bị trùng với đơn đang chờ hoặc đã được duyệt.");
        }

        EmployeeLeaveRequest request = new EmployeeLeaveRequest();
        request.setEmployee(employee);
        request.setRequestType(type);
        request.setStartDate(input.startDate());
        request.setEndDate(input.endDate());
        request.setEmployeeNote(normalizeNullable(input.employeeNote()));
        requests.saveAndFlush(request);
        audit.record("CREATE", "EMPLOYEE_LEAVE_REQUEST", request.getId(), Map.of(), auditSnapshot(request));
        return EmployeeLeaveDto.from(request);
    }

    @Transactional
    public EmployeeLeaveDto withdraw(String authorization, Long requestId) {
        EmployeeProfile employee = employeeAccess.requireEmployee(authorization);
        EmployeeLeaveRequest request = requests.findWithDetailsById(requestId).orElseThrow(() -> notFound());
        if (!request.getEmployee().getEmployeeId().equals(employee.getEmployeeId())) throw notFound();
        if (!"PENDING".equals(request.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "LEAVE_REQUEST_ALREADY_DECIDED", "Chỉ có thể rút đơn đang chờ duyệt.");
        }
        Map<String, Object> before = auditSnapshot(request);
        request.setStatus("WITHDRAWN");
        requests.saveAndFlush(request);
        audit.record("WITHDRAW", "EMPLOYEE_LEAVE_REQUEST", request.getId(), before, auditSnapshot(request));
        return EmployeeLeaveDto.from(request);
    }

    @Transactional(readOnly = true)
    public Page<EmployeeLeaveDto> listForHr(String status, Long employeeId, int page, int size) {
        String normalizedStatus = status == null || status.isBlank() ? null : normalized(status);
        if (normalizedStatus != null && !Set.of("PENDING", "APPROVED", "REJECTED", "WITHDRAWN").contains(normalizedStatus)) {
            throw bad("INVALID_LEAVE_STATUS", "Trạng thái đơn nghỉ không hợp lệ.");
        }
        return requests.searchForHr(normalizedStatus, employeeId, pageable(page, size)).map(EmployeeLeaveDto::from);
    }

    @Transactional
    public EmployeeLeaveDto decide(String authorization, Long requestId, EmployeeLeaveDecision input) {
        JwtTokenService.Claims claims = jwt.parse(authorization);
        User reviewer = users.findById(claims.userId()).orElseThrow(() -> notFound());
        if (!"MANAGER_HR".equals(claims.role()) || !"MANAGER_HR".equals(reviewer.getRole())
                || reviewer.isLocked() || reviewer.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HR_ROLE_REQUIRED", "Chỉ nhân sự được duyệt đơn nghỉ.");
        }
        String decision = normalized(input.decision());
        if (!DECISIONS.contains(decision)) throw bad("INVALID_LEAVE_DECISION", "Quyết định phải là APPROVED hoặc REJECTED.");
        EmployeeLeaveRequest request = requests.findWithDetailsById(requestId).orElseThrow(() -> notFound());
        if (!"PENDING".equals(request.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "LEAVE_REQUEST_ALREADY_DECIDED", "Đơn nghỉ đã được xử lý.");
        }

        Map<String, Object> before = auditSnapshot(request);
        request.setStatus(decision);
        request.setReviewedBy(reviewer);
        request.setReviewedAt(Instant.now());
        request.setReviewerNote(normalizeNullable(input.reviewerNote()));
        EmployeeProfile employee = request.getEmployee();
        Map<String, Object> employeeBefore = null;
        if ("APPROVED".equals(decision) && "RESIGNATION".equals(request.getRequestType())) {
            employeeBefore = employmentSnapshot(employee);
            employee.setEmploymentStatus("RESIGNED");
            employee.setResignationDate(request.getStartDate());
            profiles.saveAndFlush(employee);
            refreshTokens.revokeByUserId(employee.getEmployeeId());
        }
        requests.saveAndFlush(request);
        audit.record("DECIDE", "EMPLOYEE_LEAVE_REQUEST", request.getId(), before, auditSnapshot(request));
        if (employeeBefore != null) {
            audit.record("RESIGN", "EMPLOYEE", employee.getEmployeeId(), employeeBefore, employmentSnapshot(employee));
        }
        return EmployeeLeaveDto.from(request);
    }

    private static Map<String, Object> auditSnapshot(EmployeeLeaveRequest request) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("employeeId", request.getEmployee().getEmployeeId());
        snapshot.put("requestType", request.getRequestType());
        snapshot.put("startDate", request.getStartDate());
        snapshot.put("endDate", request.getEndDate());
        snapshot.put("status", request.getStatus());
        snapshot.put("reviewedBy", request.getReviewedBy() == null ? null : request.getReviewedBy().getId());
        snapshot.put("reviewedAt", request.getReviewedAt());
        return snapshot;
    }

    private static Map<String, Object> employmentSnapshot(EmployeeProfile profile) {
        return Map.of("employmentStatus", profile.getEmploymentStatus(),
                "resignationDate", profile.getResignationDate() == null ? "" : profile.getResignationDate());
    }

    private static PageRequest pageable(int page, int size) {
        return PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size)),
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
    }

    private static String normalized(String value) { return value == null ? "" : value.trim().toUpperCase(Locale.ROOT); }
    private static String normalizeNullable(String value) { if (value == null) return null; String result = value.trim(); return result.isEmpty() ? null : result; }
    private static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "LEAVE_REQUEST_NOT_FOUND", "Không tìm thấy đơn nghỉ."); }
    private static ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
