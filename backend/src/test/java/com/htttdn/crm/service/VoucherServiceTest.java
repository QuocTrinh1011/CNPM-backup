package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class VoucherServiceTest {
  StoreVoucher voucher() {
    StoreVoucher v = new StoreVoucher();
    v.setCode("SHOP10");
    v.setDiscountValue(new BigDecimal("10"));
    ReflectionTestUtils.setField(v, "id", 1L);
    return v;
  }

  @Test
  void percentageCapFixedAmountAndRounding() {
    StoreVoucher v = voucher();
    assertEquals(new BigDecimal("100"), VoucherService.discount(v, new BigDecimal("999")));
    v.setMaxDiscountAmount(new BigDecimal("50"));
    assertEquals(new BigDecimal("50"), VoucherService.discount(v, new BigDecimal("999")));
    v.setDiscountType("FIXED_AMOUNT");
    v.setDiscountValue(new BigDecimal("5000"));
    assertEquals(new BigDecimal("999"), VoucherService.discount(v, new BigDecimal("999")));
  }

  @Test
  void datesMinimumDisabledAndLimitAreEnforced() {
    StoreVoucher v = voucher();
    v.setMinOrderAmount(new BigDecimal("100"));
    assertEquals(
        "VOUCHER_MINIMUM_NOT_MET",
        assertThrows(ApiException.class, () -> VoucherService.check(v, BigDecimal.TEN)).code());
    assertDoesNotThrow(() -> VoucherService.check(v, new BigDecimal("100")));
    v.setActive(false);
    assertEquals("DISABLED", VoucherService.state(v, Instant.now()));
    v.setActive(true);
    v.setStartsAt(Instant.now().plusSeconds(60));
    assertEquals(
        "VOUCHER_SCHEDULED",
        assertThrows(ApiException.class, () -> VoucherService.check(v, new BigDecimal("100")))
            .code());
    v.setStartsAt(null);
    v.setExpiresAt(Instant.now().minusSeconds(1));
    assertEquals(
        "VOUCHER_EXPIRED",
        assertThrows(ApiException.class, () -> VoucherService.check(v, new BigDecimal("100")))
            .code());
    v.setExpiresAt(null);
    v.setUsageLimit(1);
    v.setUsedCount(1);
    assertEquals(
        "VOUCHER_EXHAUSTED",
        assertThrows(ApiException.class, () -> VoucherService.check(v, new BigDecimal("100")))
            .code());
    assertThrows(ApiException.class, () -> VoucherService.check(v, new BigDecimal("-1")));
  }

  @Test
  void releaseIsIdempotentAndLegacyOrdersAreUntouched() {
    var repo = mock(StoreVoucherRepository.class);
    var usages = mock(VoucherUsageRepository.class);
    var service = new VoucherService(repo, usages);
    var v = voucher();
    v.setUsedCount(3);
    var order = new Order();
    ReflectionTestUtils.setField(order, "id", 5L);
    when(usages.findByOrderId(5L)).thenReturn(Optional.empty());
    service.release(order);
    verifyNoInteractions(repo);
    var usage = new VoucherUsage(order, v);
    when(usages.findByOrderId(5L)).thenReturn(Optional.of(usage));
    when(repo.lockById(1L)).thenReturn(Optional.of(v));
    service.release(order);
    service.release(order);
    assertEquals(2, v.getUsedCount());
    assertNotNull(usage.getReleasedAt());
    verify(repo, times(1)).save(v);
  }
}
