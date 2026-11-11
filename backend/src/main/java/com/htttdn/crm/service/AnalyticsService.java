package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.exception.ApiException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AnalyticsService {
  private final JdbcTemplate db;
  private final ObjectMapper json = new ObjectMapper();

  public AnalyticsService(JdbcTemplate db) {
    this.db = db;
  }

  public record Bucket(String label, long count, double percent) {}

  private Bucket bucket(String label, long count, long total) {
    return new Bucket(label, count, total == 0 ? 0 : Math.round(count * 1000.0 / total) / 10.0);
  }

  public Map<String, Object> customers() {
    var rows =
        db.queryForList(
            "select age, preferences, locked from customers where role='CUSTOMER' and deleted_at is"
                + " null");
    long total = rows.size(), locked = 0, knownAge = 0, knownPreferences = 0;
    String[] labels = {"Dưới 18", "18–24", "25–34", "35–44", "45–54", "Từ 55", "Chưa khai báo"};
    long[] ages = new long[7];
    Map<String, Long> preferences = new TreeMap<>();
    for (var row : rows) {
      if (Boolean.TRUE.equals(row.get("locked"))) locked++;
      Number age = (Number) row.get("age");
      int group = 6;
      if (age != null) {
        knownAge++;
        int a = age.intValue();
        group = a < 18 ? 0 : a < 25 ? 1 : a < 35 ? 2 : a < 45 ? 3 : a < 55 ? 4 : 5;
      }
      ages[group]++;
      String preference =
          Objects.toString(row.get("preferences"), "")
              .strip()
              .replaceAll("\\s+", " ")
              .toLowerCase(Locale.ROOT);
      if (!preference.isBlank()) {
        knownPreferences++;
        preferences.merge(preference, 1L, Long::sum);
      }
    }
    List<Bucket> ageBuckets = new ArrayList<>(), preferenceBuckets = new ArrayList<>();
    for (int i = 0; i < labels.length; i++) ageBuckets.add(bucket(labels[i], ages[i], total));
    var sorted =
        preferences.entrySet().stream()
            .sorted(
                Map.Entry.<String, Long>comparingByValue()
                    .reversed()
                    .thenComparing(Map.Entry.comparingByKey()))
            .toList();
    long other = 0;
    for (int i = 0; i < sorted.size(); i++) {
      var e = sorted.get(i);
      if (i < 10) preferenceBuckets.add(bucket(e.getKey(), e.getValue(), total));
      else other += e.getValue();
    }
    preferenceBuckets.add(bucket("Khác", other, total));
    preferenceBuckets.add(bucket("Chưa khai báo", total - knownPreferences, total));
    return Map.of(
        "total",
        total,
        "active",
        total - locked,
        "locked",
        locked,
        "knownAge",
        knownAge,
        "knownPreferences",
        knownPreferences,
        "ages",
        ageBuckets,
        "preferences",
        preferenceBuckets);
  }

  public Map<String, Object> surveys(int page, int size) {
    checkPage(page, size);
    long total =
        db.queryForObject(
            "select count(*) from survey_definitions where deleted_at is null", Long.class);
    var content =
        db.queryForList(
            "select s.id,s.title,s.status,(select count(*) from survey_responses r where"
                + " r.survey_id=s.id) as responses from survey_definitions s where s.deleted_at is"
                + " null order by s.created_at desc,s.id desc limit ? offset ?",
            size,
            (long) page * size);
    return Map.of(
        "content", content, "totalElements", total, "totalPages", (total + size - 1) / size);
  }

  private void checkPage(int page, int size) {
    if (page < 0 || size < 1 || size > 100)
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "Phân trang không hợp lệ.");
  }

  private Map<String, Object> survey(long id) {
    var rows =
        db.queryForList(
            "select id,title,status from survey_definitions where id=? and deleted_at is null", id);
    if (rows.isEmpty())
      throw new ApiException(HttpStatus.NOT_FOUND, "SURVEY_NOT_FOUND", "Không tìm thấy khảo sát.");
    return rows.get(0);
  }

  private List<String> strings(String raw) {
    try {
      var node = json.readTree(raw);
      if (!node.isArray()) return null;
      List<String> values = new ArrayList<>();
      for (var n : node) {
        if (!n.isTextual() || n.asText().isBlank()) return null;
        values.add(n.asText().trim());
      }
      return values;
    } catch (Exception e) {
      return null;
    }
  }

  public Map<String, Object> results(long id) {
    var result = new LinkedHashMap<String, Object>(survey(id));
    long total =
        db.queryForObject(
            "select count(*) from survey_responses where survey_id=?", Long.class, id);
    var questions =
        db.queryForList(
            "select id,text,type,options_json from survey_questions where survey_id=? order by"
                + " display_order,id",
            id);
    List<Map<String, Object>> reports = new ArrayList<>();
    for (var q : questions) {
      long qid = ((Number) q.get("id")).longValue();
      String type = Objects.toString(q.get("type"), "TEXT");
      boolean choice = Set.of("SINGLE", "SINGLE_CHOICE", "MULTIPLE_CHOICE").contains(type);
      var options = strings(Objects.toString(q.get("options_json"), ""));
      boolean invalidOptions =
          choice
              && (options == null
                  || options.size() < 2
                  || new HashSet<>(options).size() != options.size());
      Map<String, Long> counts = new LinkedHashMap<>();
      if (choice && !invalidOptions) options.forEach(o -> counts.put(o, 0L));
      var answers =
          db.queryForList(
              "select a.response_id,a.answer from survey_answers a join survey_responses r on"
                  + " r.id=a.response_id where r.survey_id=? and a.question_id=? order by a.id",
              id,
              qid);
      Map<Long, List<String>> byResponse = new HashMap<>();
      for (var a : answers) {
        String value = Objects.toString(a.get("answer"), "").trim();
        if (!value.isBlank())
          byResponse
              .computeIfAbsent(((Number) a.get("response_id")).longValue(), k -> new ArrayList<>())
              .add(value);
      }
      long answered = 0, invalid = 0;
      for (var values : byResponse.values()) {
        if (values.size() == 1 && "MULTIPLE_CHOICE".equals(type) && "[]".equals(values.get(0)))
          continue;
        answered++;
        if (values.size() != 1 || invalidOptions) {
          invalid++;
          continue;
        }
        if (!choice) continue;
        List<String> selected =
            "MULTIPLE_CHOICE".equals(type) ? strings(values.get(0)) : List.of(values.get(0));
        if (selected == null || selected.isEmpty() || !counts.keySet().containsAll(selected)) {
          invalid++;
          continue;
        }
        new HashSet<>(selected).forEach(o -> counts.merge(o, 1L, Long::sum));
      }
      List<Bucket> buckets = new ArrayList<>();
      for (var e : counts.entrySet()) buckets.add(bucket(e.getKey(), e.getValue(), answered));
      Map<String, Object> report = new LinkedHashMap<>();
      report.put("id", qid);
      report.put("text", q.get("text"));
      report.put("type", type);
      report.put("answered", answered);
      report.put("skipped", total - answered);
      report.put("invalid", invalid);
      report.put("invalidOptions", invalidOptions);
      report.put("options", buckets);
      reports.add(report);
    }
    result.put("responses", total);
    result.put("questions", reports);
    return result;
  }

  public Map<String, Object> textAnswers(long id, long questionId, int page, int size) {
    checkPage(page, size);
    survey(id);
    var types =
        db.queryForList(
            "select type from survey_questions where id=? and survey_id=?",
            String.class,
            questionId,
            id);
    if (types.isEmpty()
        || Set.of("SINGLE", "SINGLE_CHOICE", "MULTIPLE_CHOICE").contains(types.get(0)))
      throw new ApiException(
          HttpStatus.NOT_FOUND, "QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi văn bản.");
    String from =
        " from survey_answers a join survey_responses r on r.id=a.response_id where r.survey_id=?"
            + " and a.question_id=? and trim(a.answer)<>''";
    long total = db.queryForObject("select count(*)" + from, Long.class, id, questionId);
    var content =
        db.queryForList(
            "select a.answer" + from + " order by a.id limit ? offset ?",
            String.class,
            id,
            questionId,
            size,
            (long) page * size);
    return Map.of(
        "content", content, "totalElements", total, "totalPages", (total + size - 1) / size);
  }
}
