package com.htttdn.crm.exception;

import jakarta.validation.ConstraintViolationException;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(ApiException.class)
  ResponseEntity<?> api(ApiException e) {
    return ResponseEntity.status(e.status())
        .body(Map.of("code", e.code(), "message", e.getMessage()));
  }

  @ExceptionHandler(NoSuchElementException.class)
  ResponseEntity<?> notFound(Exception e) {
    return ResponseEntity.status(404)
        .body(
            Map.of(
                "code",
                "NOT_FOUND",
                "message",
                Objects.toString(e.getMessage(), "Không tìm thấy dữ liệu.")));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<?> bad(Exception e) {
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "code",
                "VALIDATION_ERROR",
                "message",
                Objects.toString(e.getMessage(), "Dữ liệu không hợp lệ.")));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> invalid(MethodArgumentNotValidException e) {
    Map<String, String> fields = new LinkedHashMap<>();
    e.getBindingResult()
        .getFieldErrors()
        .forEach(x -> fields.put(x.getField(), x.getDefaultMessage()));
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "code", "VALIDATION_ERROR", "message", "Dữ liệu chưa hợp lệ.", "fields", fields));
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    HttpMediaTypeNotSupportedException.class
  })
  ResponseEntity<?> unreadable(Exception e) {
    return ResponseEntity.badRequest()
        .body(Map.of("code", "INVALID_JSON", "message", "Dữ liệu gửi lên không đúng định dạng."));
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  ResponseEntity<?> typeMismatch(MethodArgumentTypeMismatchException e) {
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "code",
                "VALIDATION_ERROR",
                "message",
                "Tham số '" + e.getName() + "' không đúng kiểu dữ liệu."));
  }

  @ExceptionHandler(MissingServletRequestParameterException.class)
  ResponseEntity<?> missingParam(MissingServletRequestParameterException e) {
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "code",
                "VALIDATION_ERROR",
                "message",
                "Thiếu tham số '" + e.getParameterName() + "'."));
  }

  @ExceptionHandler(MissingRequestHeaderException.class)
  ResponseEntity<?> missingHeader(MissingRequestHeaderException e) {
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "code",
                "VALIDATION_ERROR",
                "message",
                "Thiếu header '" + e.getHeaderName() + "'."));
  }

  @ExceptionHandler(ConstraintViolationException.class)
  ResponseEntity<?> constraint(ConstraintViolationException e) {
    return ResponseEntity.badRequest()
        .body(Map.of("code", "VALIDATION_ERROR", "message", "Dữ liệu chưa hợp lệ."));
  }

  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<?> noResource(NoResourceFoundException e) {
    return ResponseEntity.status(404)
        .body(Map.of("code", "NOT_FOUND", "message", "Không tìm thấy tài nguyên."));
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  ResponseEntity<?> methodNotSupported(HttpRequestMethodNotSupportedException e) {
    return ResponseEntity.status(405)
        .body(Map.of("code", "METHOD_NOT_ALLOWED", "message", "Phương thức không được hỗ trợ."));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ResponseEntity<?> uploadTooLarge(MaxUploadSizeExceededException e) {
    return ResponseEntity.status(413)
        .body(
            Map.of(
                "code", "PAYLOAD_TOO_LARGE", "message", "Tệp tải lên vượt quá giới hạn cho phép."));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> conflict(DataIntegrityViolationException e) {
    log.error("Database constraint violation", e);
    return ResponseEntity.status(409)
        .body(Map.of("code", "CONFLICT", "message", "Dữ liệu đã tồn tại hoặc vi phạm ràng buộc."));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> fallback(Exception e) {
    log.error("Unhandled error", e);
    return ResponseEntity.status(500)
        .body(Map.of("code", "INTERNAL_ERROR", "message", "Có lỗi xảy ra. Vui lòng thử lại sau."));
  }
}
