package com.htttdn.crm.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.Map;
import java.util.NoSuchElementException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ApiExceptionHandlerTest {
    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test void unexpectedMessagesAreHiddenButBusinessMessagesRemain() {
        var notFound = handler.notFound(new NoSuchElementException("internal table name"));
        var invalid = handler.bad(new IllegalArgumentException("internal parser detail"));
        var business = handler.api(new ApiException(HttpStatus.BAD_REQUEST, "ORDER_INVALID", "Đơn hàng không hợp lệ."));

        assertEquals("Không tìm thấy dữ liệu.", ((Map<?, ?>) notFound.getBody()).get("message"));
        assertEquals("Dữ liệu không hợp lệ.", ((Map<?, ?>) invalid.getBody()).get("message"));
        assertEquals("Đơn hàng không hợp lệ.", ((Map<?, ?>) business.getBody()).get("message"));
    }
}
