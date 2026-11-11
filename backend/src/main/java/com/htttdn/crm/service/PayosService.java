package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.htttdn.crm.entity.Order;
import com.htttdn.crm.exception.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class PayosService {
  private RestClient client() {
    var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(java.time.Duration.ofSeconds(5));
    factory.setReadTimeout(java.time.Duration.ofSeconds(10));
    return RestClient.builder()
        .baseUrl("https://api-merchant.payos.vn")
        .requestFactory(factory)
        .build();
  }

  @Value("${app.payos.client-id:}")
  private String clientId;

  @Value("${app.payos.api-key:}")
  private String apiKey;

  @Value("${app.payos.checksum-key:}")
  private String checksumKey;

  @Value("${app.payos.return-url}")
  private String returnUrl;

  @Value("${app.payos.cancel-url}")
  private String cancelUrl;

  public void requireConfigured() {
    if (clientId == null
        || clientId.isBlank()
        || apiKey == null
        || apiKey.isBlank()
        || checksumKey == null
        || checksumKey.isBlank())
      throw new ApiException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "PAYOS_NOT_CONFIGURED",
          "Chưa cấu hình PayOS để tạo mã QR thanh toán.");
  }

  public Link createPaymentLink(Order order) {
    return createPaymentLink(order, order.getOrderCode());
  }

  public Link createPaymentLink(Order order, long providerOrderCode) {
    requireConfigured();
    Map<String, Object> body = paymentRequest(order, providerOrderCode);
    try {
      JsonNode result =
          client()
              .post()
              .uri("/v2/payment-requests")
              .header("x-client-id", clientId)
              .header("x-api-key", apiKey)
              .contentType(MediaType.APPLICATION_JSON)
              .body(body)
              .retrieve()
              .body(JsonNode.class);
      return parsePaymentResponse(result);
    } catch (RestClientException ex) {
      throw new ApiException(
          HttpStatus.BAD_GATEWAY,
          "PAYMENT_PROVIDER_ERROR",
          "Không kết nối được PayOS để tạo mã QR. Vui lòng thử lại.");
    }
  }

  public ProviderPayment getPayment(String paymentLinkId) {
    requireConfigured();
    try {
      JsonNode result =
          client()
              .get()
              .uri("/v2/payment-requests/{id}", paymentLinkId)
              .header("x-client-id", clientId)
              .header("x-api-key", apiKey)
              .retrieve()
              .body(JsonNode.class);
      JsonNode data = result == null ? null : result.path("data");
      if (data == null || !"00".equals(result.path("code").asText()) || data.isMissingNode())
        throw new ApiException(
            HttpStatus.BAD_GATEWAY,
            "PAYMENT_PROVIDER_ERROR",
            "Không xác minh được trạng thái PayOS.");
      return new ProviderPayment(
          data.path("orderCode").asLong(0),
          data.path("amount").asLong(-1),
          data.path("amountPaid").asLong(-1),
          data.path("status").asText(""),
          data.path("id").asText(""));
    } catch (RestClientException ex) {
      throw new ApiException(
          HttpStatus.BAD_GATEWAY,
          "PAYMENT_PROVIDER_ERROR",
          "Không kết nối được PayOS để kiểm tra thanh toán.");
    }
  }

  public void cancelPaymentLink(String paymentLinkId) {
    requireConfigured();
    try {
      JsonNode result =
          client()
              .post()
              .uri("/v2/payment-requests/{id}/cancel", paymentLinkId)
              .header("x-client-id", clientId)
              .header("x-api-key", apiKey)
              .contentType(MediaType.APPLICATION_JSON)
              .body(Map.of("cancellationReason", "Tao ma thanh toan moi"))
              .retrieve()
              .body(JsonNode.class);
      if (result == null || !"00".equals(result.path("code").asText()))
        throw new ApiException(
            HttpStatus.BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", "Không hủy được mã thanh toán cũ.");
    } catch (RestClientException ex) {
      throw new ApiException(
          HttpStatus.BAD_GATEWAY,
          "PAYMENT_PROVIDER_ERROR",
          "Không kết nối được PayOS để hủy mã cũ.");
    }
  }

  Link parsePaymentResponse(JsonNode result) {
    JsonNode data = result == null ? null : result.path("data");
    if (data == null
        || !"00".equals(result.path("code").asText())
        || data.path("checkoutUrl").asText("").isBlank()
        || data.path("qrCode").asText("").isBlank()
        || data.path("paymentLinkId").asText("").isBlank())
      throw new ApiException(
          HttpStatus.BAD_GATEWAY,
          "PAYMENT_PROVIDER_ERROR",
          "PayOS chưa tạo được mã QR thanh toán.");
    return new Link(
        data.path("paymentLinkId").asText(),
        data.path("checkoutUrl").asText(),
        data.path("qrCode").asText());
  }

  Map<String, Object> paymentRequest(Order order) {
    return paymentRequest(order, order.getOrderCode());
  }

  Map<String, Object> paymentRequest(Order order, long providerOrderCode) {
    requireConfigured();
    long amount = order.getTotalAmount().longValueExact();
    String description = "Thanh toan " + order.getOrderCode();
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("orderCode", providerOrderCode);
    body.put("amount", amount);
    body.put("description", description);
    body.put("cancelUrl", cancelUrl);
    body.put("returnUrl", returnUrl);
    body.put("expiredAt", order.getExpiresAt().getEpochSecond());
    body.put(
        "signature",
        hmac(
            "amount="
                + amount
                + "&cancelUrl="
                + cancelUrl
                + "&description="
                + description
                + "&orderCode="
                + providerOrderCode
                + "&returnUrl="
                + returnUrl,
            checksumKey));
    return body;
  }

  public boolean verifyWebhook(JsonNode data, String signature) {
    if (checksumKey == null || checksumKey.isBlank() || signature == null || signature.isBlank())
      return false;
    return java.security.MessageDigest.isEqual(
        signature.getBytes(StandardCharsets.UTF_8),
        hmac(canonical(data), checksumKey).getBytes(StandardCharsets.UTF_8));
  }

  public String canonical(JsonNode data) {
    List<String> keys = new ArrayList<>();
    data.fieldNames().forEachRemaining(keys::add);
    Collections.sort(keys);
    List<String> pairs = new ArrayList<>();
    for (String key : keys) {
      JsonNode value = data.get(key);
      pairs.add(
          key
              + "="
              + (value == null || value.isNull()
                  ? ""
                  : value.isValueNode() ? value.asText() : value.toString()));
    }
    return String.join("&", pairs);
  }

  private String hmac(String value, String key) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      StringBuilder result = new StringBuilder();
      for (byte b : mac.doFinal(value.getBytes(StandardCharsets.UTF_8)))
        result.append(String.format("%02x", b));
      return result.toString();
    } catch (Exception ex) {
      throw new IllegalStateException(ex);
    }
  }

  public record Link(String paymentLinkId, String checkoutUrl, String qrCode) {}

  public record ProviderPayment(
      long orderCode, long amount, long amountPaid, String status, String paymentLinkId) {}
}
