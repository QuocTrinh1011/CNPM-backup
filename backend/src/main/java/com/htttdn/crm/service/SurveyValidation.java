package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.exception.ApiException;
import java.util.*;
import org.springframework.http.HttpStatus;

public final class SurveyValidation {
  private static final ObjectMapper JSON = new ObjectMapper();

  public static ApiException invalid(String m) {
    return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", m);
  }

  public static String text(String v, int max, String label) {
    if (v == null || v.trim().isEmpty() || v.trim().length() > max)
      throw invalid(label + " không được trống và tối đa " + max + " ký tự.");
    return v.trim();
  }

  public static List<String> array(String raw) {
    try {
      var node = JSON.readTree(raw);
      if (!node.isArray()) throw invalid("Phải là danh sách phương án.");
      List<String> result = new ArrayList<>();
      for (var n : node) {
        if (!n.isTextual() || n.asText().trim().isEmpty())
          throw invalid("Phương án không được trống.");
        result.add(n.asText().trim());
      }
      if (new HashSet<>(result).size() != result.size())
        throw invalid("Phương án không được trùng.");
      return result;
    } catch (ApiException e) {
      throw e;
    } catch (Exception e) {
      throw invalid("Danh sách phương án không hợp lệ.");
    }
  }

  public static String json(List<String> values) {
    try {
      String s = JSON.writeValueAsString(values);
      if (s.length() > 4000) throw invalid("Danh sách tối đa 4.000 ký tự.");
      return s;
    } catch (ApiException e) {
      throw e;
    } catch (Exception e) {
      throw invalid("Danh sách không hợp lệ.");
    }
  }

  public static String options(String raw) {
    if (raw == null || raw.length() > 4000) throw invalid("Phương án tối đa 4.000 ký tự.");
    var values = array(raw);
    if (values.size() < 2) throw invalid("Cần ít nhất hai phương án.");
    return json(values);
  }
}
