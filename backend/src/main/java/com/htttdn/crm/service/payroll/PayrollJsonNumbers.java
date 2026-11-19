package com.htttdn.crm.service.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.htttdn.crm.dto.hr.PayrollDtos.*;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.security.JwtTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;
import com.htttdn.crm.service.PayrollCalculator;

public final class PayrollJsonNumbers {
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    public static BigDecimal decimal(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || !(value.isNumber() || value.isTextual())) throw new IllegalArgumentException(field + " must be numeric");
        try { return value.isNumber() ? value.decimalValue() : new BigDecimal(value.asText()); }
        catch (NumberFormatException invalid) { throw new IllegalArgumentException(field + " must be numeric"); }
    }

    public static BigDecimal decimalOrZero(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? ZERO : decimal(node, field);
    }

    public static BigDecimal decimalOrDefault(JsonNode node, String field, BigDecimal fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? fallback : decimal(node, field);
    }
}
