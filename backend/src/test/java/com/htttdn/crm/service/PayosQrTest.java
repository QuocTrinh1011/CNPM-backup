package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.entity.Order;
import com.htttdn.crm.exception.ApiException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class PayosQrTest {
  private final PayosService service = new PayosService();
  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void missingCredentialsDoNotCreateDemoPayment() {
    ApiException error = assertThrows(ApiException.class, service::requireConfigured);
    assertEquals("PAYOS_NOT_CONFIGURED", error.code());
  }

  @Test
  void requestCarriesSignedFieldsAndMatchingExpiry() throws Exception {
    ReflectionTestUtils.setField(service, "clientId", "client");
    ReflectionTestUtils.setField(service, "apiKey", "api");
    ReflectionTestUtils.setField(service, "checksumKey", "secret");
    ReflectionTestUtils.setField(service, "returnUrl", "https://shop.test/return");
    ReflectionTestUtils.setField(service, "cancelUrl", "https://shop.test/cancel");
    Order order = new Order();
    order.setOrderCode(123L);
    order.setTotalAmount(BigDecimal.valueOf(10000));
    order.setExpiresAt(Instant.ofEpochSecond(1800000000));
    Map<String, Object> body = service.paymentRequest(order);
    assertEquals(1800000000L, body.get("expiredAt"));
    String canonical =
        "amount=10000&cancelUrl=https://shop.test/cancel&description=Thanh toan"
            + " 123&orderCode=123&returnUrl=https://shop.test/return";
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec("secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    assertEquals(
        HexFormat.of().formatHex(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8))),
        body.get("signature"));
  }

  @Test
  void responseRequiresActualQrAndLink() throws Exception {
    var response =
        mapper.readTree(
            "{\"code\":\"00\",\"data\":{\"paymentLinkId\":\"link\",\"checkoutUrl\":\"https://pay.test\",\"qrCode\":\"000201\"}}");
    assertEquals("000201", service.parsePaymentResponse(response).qrCode());
    assertThrows(
        ApiException.class,
        () ->
            service.parsePaymentResponse(
                mapper.readTree(
                    "{\"code\":\"00\",\"data\":{\"checkoutUrl\":\"https://pay.test\"}}")));
  }
}
