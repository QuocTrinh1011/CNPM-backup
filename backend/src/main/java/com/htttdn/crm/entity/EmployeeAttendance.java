package com.htttdn.crm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "employee_attendance", uniqueConstraints =
        @UniqueConstraint(name = "uq_employee_attendance_day", columnNames = {"employee_id", "attendance_date"}))
public class EmployeeAttendance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private EmployeeProfile employee;

    @Column(name = "attendance_date", nullable = false)
    private LocalDate attendanceDate;

    @Column(name = "attendance_status", nullable = false, length = 24)
    private String attendanceStatus;

    @Column(name = "day_fraction", nullable = false, precision = 2, scale = 1)
    private BigDecimal dayFraction = BigDecimal.ONE;

    @Column(name = "paid_equivalent_days", nullable = false, precision = 2, scale = 1)
    private BigDecimal paidEquivalentDays = BigDecimal.ZERO;

    @Column(name = "overtime_normal_hours", nullable = false, precision = 7, scale = 2)
    private BigDecimal overtimeNormalHours = BigDecimal.ZERO;

    @Column(name = "overtime_rest_day_hours", nullable = false, precision = 7, scale = 2)
    private BigDecimal overtimeRestDayHours = BigDecimal.ZERO;

    @Column(name = "overtime_holiday_hours", nullable = false, precision = 7, scale = 2)
    private BigDecimal overtimeHolidayHours = BigDecimal.ZERO;

    @Column(name = "overtime_night_hours", nullable = false, precision = 7, scale = 2)
    private BigDecimal overtimeNightHours = BigDecimal.ZERO;

    @Column(name = "overtime_night_normal_hours", nullable = false, precision = 7, scale = 2)
    private BigDecimal overtimeNightNormalHours = BigDecimal.ZERO;

    @Column(name = "overtime_night_rest_day_hours", nullable = false, precision = 7, scale = 2)
    private BigDecimal overtimeNightRestDayHours = BigDecimal.ZERO;

    @Column(name = "overtime_night_holiday_hours", nullable = false, precision = 7, scale = 2)
    private BigDecimal overtimeNightHolidayHours = BigDecimal.ZERO;

    @Column(length = 2000)
    private String note;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by")
    private User recordedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void beforeInsert() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void beforeUpdate() { updatedAt = Instant.now(); }

    public Long getId() { return id; }
    public EmployeeProfile getEmployee() { return employee; }
    public void setEmployee(EmployeeProfile employee) { this.employee = employee; }
    public LocalDate getAttendanceDate() { return attendanceDate; }
    public void setAttendanceDate(LocalDate attendanceDate) { this.attendanceDate = attendanceDate; }
    public String getAttendanceStatus() { return attendanceStatus; }
    public void setAttendanceStatus(String attendanceStatus) { this.attendanceStatus = attendanceStatus; }
    public BigDecimal getDayFraction() { return dayFraction; }
    public void setDayFraction(BigDecimal dayFraction) { this.dayFraction = dayFraction; }
    public BigDecimal getPaidEquivalentDays() { return paidEquivalentDays; }
    public void setPaidEquivalentDays(BigDecimal paidEquivalentDays) { this.paidEquivalentDays = paidEquivalentDays; }
    public BigDecimal getOvertimeNormalHours() { return overtimeNormalHours; }
    public void setOvertimeNormalHours(BigDecimal overtimeNormalHours) { this.overtimeNormalHours = overtimeNormalHours; }
    public BigDecimal getOvertimeRestDayHours() { return overtimeRestDayHours; }
    public void setOvertimeRestDayHours(BigDecimal overtimeRestDayHours) { this.overtimeRestDayHours = overtimeRestDayHours; }
    public BigDecimal getOvertimeHolidayHours() { return overtimeHolidayHours; }
    public void setOvertimeHolidayHours(BigDecimal overtimeHolidayHours) { this.overtimeHolidayHours = overtimeHolidayHours; }
    public BigDecimal getOvertimeNightHours() { return overtimeNightHours; }
    public void setOvertimeNightHours(BigDecimal overtimeNightHours) { this.overtimeNightHours = overtimeNightHours; }
    public BigDecimal getOvertimeNightNormalHours() { return overtimeNightNormalHours; }
    public void setOvertimeNightNormalHours(BigDecimal overtimeNightNormalHours) { this.overtimeNightNormalHours = overtimeNightNormalHours; }
    public BigDecimal getOvertimeNightRestDayHours() { return overtimeNightRestDayHours; }
    public void setOvertimeNightRestDayHours(BigDecimal overtimeNightRestDayHours) { this.overtimeNightRestDayHours = overtimeNightRestDayHours; }
    public BigDecimal getOvertimeNightHolidayHours() { return overtimeNightHolidayHours; }
    public void setOvertimeNightHolidayHours(BigDecimal overtimeNightHolidayHours) { this.overtimeNightHolidayHours = overtimeNightHolidayHours; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public User getRecordedBy() { return recordedBy; }
    public void setRecordedBy(User recordedBy) { this.recordedBy = recordedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
