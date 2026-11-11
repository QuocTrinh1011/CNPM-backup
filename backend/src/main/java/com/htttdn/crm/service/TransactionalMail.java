package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** No recipient substitution: sandbox mode only permits the configured address. */
@Service
public class TransactionalMail {
  @Value("${RESEND_API_KEY:}")
  private String apiKey;

  @Value("${RESEND_ENABLED:false}")
  private boolean enabled;

  @Value("${RESEND_FROM:ANH LỚN SHOP <onboarding@resend.dev>}")
  private String from;

  @Value("${RESEND_TEST_MODE:true}")
  private boolean testMode;

  @Value("${RESEND_TEST_RECIPIENT:}")
  private String testRecipient;

  @Value("${PUBLIC_ORIGIN:}")
  private String origin;

  private final ObjectMapper mapper;
  private final HttpClient client =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

  public TransactionalMail(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  public boolean available() {
    try {
      var uri = URI.create(origin);
      return enabled
          && !apiKey.isBlank()
          && "https".equals(uri.getScheme())
          && uri.getHost() != null
          && uri.getUserInfo() == null
          && uri.getQuery() == null
          && uri.getFragment() == null
          && (uri.getPath().isEmpty() || "/".equals(uri.getPath()))
          && (!testMode || !testRecipient.isBlank());
    } catch (RuntimeException e) {
      return false;
    }
  }

  public boolean permits(String recipient) {
    return available()
        && recipient != null
        && (!testMode || recipient.equalsIgnoreCase(testRecipient.trim()));
  }

  public String link(String path) {
    return origin.replaceAll("/+$", "") + path;
  }

  public void send(String recipient, String subject, String text, String key) {
    if (!permits(recipient)) throw new IllegalStateException("Email delivery unavailable");
    try {
      var body =
          mapper.writeValueAsString(
              Map.of("from", from, "to", List.of(recipient), "subject", subject, "text", text));
      var request =
          HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
              .timeout(Duration.ofSeconds(10))
              .header("Authorization", "Bearer " + apiKey)
              .header("Content-Type", "application/json")
              .header("Idempotency-Key", key)
              .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
              .build();
      var response = client.send(request, HttpResponse.BodyHandlers.discarding());
      if (response.statusCode() < 200 || response.statusCode() >= 300)
        throw new IllegalStateException("Email provider rejected request");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Email delivery interrupted");
    } catch (java.io.IOException e) {
      throw new IllegalStateException("Email delivery unavailable");
    }
  }

  public record OrderEmail(String recipient, String subject, String text, String key) {}

  @Async("transactionalMailExecutor")
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void afterOrderCommit(OrderEmail message) {
    if (!permits(message.recipient())) return;
    try {
      send(message.recipient(), message.subject(), message.text(), message.key());
    } catch (RuntimeException e) {
      org.slf4j.LoggerFactory.getLogger(getClass())
          .warn("Order email delivery failed; in-app notification retained");
    }
  }

  @Configuration
  @EnableAsync
  static class MailExecutorConfig {
    @Bean(name = "transactionalMailExecutor")
    ThreadPoolTaskExecutor executor() {
      var executor = new ThreadPoolTaskExecutor();
      executor.setCorePoolSize(1);
      executor.setMaxPoolSize(1);
      executor.setQueueCapacity(100);
      executor.setThreadNamePrefix("transactional-mail-");
      executor.setRejectedExecutionHandler(
          (task, pool) ->
              org.slf4j.LoggerFactory.getLogger(TransactionalMail.class)
                  .warn("Order email queue full; in-app notification retained"));
      return executor;
    }
  }
}
