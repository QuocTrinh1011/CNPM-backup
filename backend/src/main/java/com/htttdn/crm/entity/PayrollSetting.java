package com.htttdn.crm.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "hr_payroll_settings", uniqueConstraints =
        @UniqueConstraint(name = "uq_hr_payroll_setting_effective", columnNames = {"setting_key", "effective_from"}))
public class PayrollSetting {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "setting_key", nullable = false, length = 100) private String settingKey;
    @Column(name = "effective_from", nullable = false) private LocalDate effectiveFrom;
    @Column(name = "effective_to") private LocalDate effectiveTo;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "setting_value", nullable = false, columnDefinition = "jsonb") private JsonNode settingValue;
    @Column(length = 2000) private String note;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "updated_by") private User updatedBy;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
    public Long getId() { return id; }
    public String getSettingKey() { return settingKey; }
    public void setSettingKey(String value) { settingKey = value; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDate value) { effectiveFrom = value; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDate value) { effectiveTo = value; }
    public JsonNode getSettingValue() { return settingValue; }
    public void setSettingValue(JsonNode value) { settingValue = value; }
    public String getNote() { return note; }
    public void setNote(String value) { note = value; }
    public User getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(User value) { updatedBy = value; }
    public Instant getCreatedAt() { return createdAt; }
}
