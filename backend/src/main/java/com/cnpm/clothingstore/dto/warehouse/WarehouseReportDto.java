package com.cnpm.clothingstore.dto.warehouse;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record WarehouseReportDto(
        String period,
        int year,
        Integer month,
        Integer quarter,
        Instant fromInclusive,
        Instant toExclusive,
        Instant effectiveFromInclusive,
        Instant historyAvailableFrom,
        boolean historyComplete,
        List<BalanceLine> balances,
        List<MovementTotal> movementTotals) {

    public record BalanceLine(String itemType, Long itemId, String itemCode, String itemName,
                              String unit, String location, Long scopeId,
                              BigDecimal openingQuantity, BigDecimal incomingQuantity,
                              BigDecimal outgoingQuantity, BigDecimal closingQuantity) {}

    public record MovementTotal(String itemType, String location, String movementType,
                                BigDecimal incomingQuantity, BigDecimal outgoingQuantity,
                                BigDecimal netQuantity) {}
}
