package com.htttdn.crm.service.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.htttdn.crm.dto.hr.PayrollDtos.*;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.*;
import java.math.BigDecimal;
import java.util.*;

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
