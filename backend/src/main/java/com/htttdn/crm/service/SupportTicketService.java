package com.htttdn.crm.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SupportTicketService {
  private final EntityManager em;
  private final JdbcTemplate db;
  private final ObjectMapper json;
  private final NotificationService notifications;
  private final AuditTrail audit;

  public SupportTicketService(
      EntityManager em,
      JdbcTemplate db,
      ObjectMapper json,
      NotificationService notifications,
      AuditTrail audit) {
    this.em = em;
    this.db = db;
    this.json = json;
    this.notifications = notifications;
    this.audit = audit;
  }

  public static final Set<String> STATUSES =
      Set.of("NEW", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED");

  public record Actor(long id, boolean manager) {}

  public record Create(
      Long customerId,
      Long orderId,
      Long assigneeId,
      @NotBlank @Size(max = 150) String title,
      @NotBlank @Size(max = 4000) String description,
      @Pattern(regexp = "[0-9a-fA-F-]{36}") String requestId) {}

  public record Update(
      Long assigneeId,
      @Size(max = 30) String status,
      Long version,
      @Size(max = 4000) String reply,
      @Pattern(regexp = "[0-9a-fA-F-]{36}") String requestId) {}

  public record Reply(
      @NotBlank @Size(max = 4000) String content,
      boolean internal,
      @Pattern(regexp = "[0-9a-fA-F-]{36}") String requestId) {}

  public record Message(
      String id, String author, String content, boolean internal, Instant createdAt) {}

  public record Row(
      long id,
      String title,
      String status,
      Long orderId,
      Long orderCode,
      Instant createdAt,
      Instant updatedAt,
      Instant resolvedAt,
      long version,
      Long customerId,
      String customerName,
      String customerEmail,
      Long assigneeId,
      String assigneeName,
      boolean assigneeActive) {}

  public record Detail(Row ticket, String description, List<Message> messages) {}

  private ApiException bad(String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SUPPORT_INPUT", message);
  }

  private ApiException conflict(String message) {
    return new ApiException(HttpStatus.CONFLICT, "SUPPORT_CHANGED", message);
  }

  private ApiException missing() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "SUPPORT_NOT_FOUND", "Không tìm thấy phiếu hỗ trợ.");
  }

  private String text(String value, int max, boolean required) {
    String s = value == null ? "" : value.trim();
    if (s.length() > max || required && s.isBlank())
      throw bad("Nội dung không được trống và không vượt quá " + max + " ký tự.");
    return s;
  }

  private String key(String value) {
    try {
      return UUID.fromString(value).toString();
    } catch (Exception e) {
      throw bad("Mã gửi yêu cầu không hợp lệ. Hãy tải lại trang.");
    }
  }

  private User actor(Actor actor) {
    var u = em.find(User.class, actor.id());
    if (u == null
        || u.getDeletedAt() != null
        || u.isLocked()
        || !(actor.manager() ? "MANAGER" : "CUSTOMER").equals(u.getRole()))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "FORBIDDEN", "Không có quyền truy cập phiếu hỗ trợ.");
    return u;
  }

  private User customer(Long id, boolean lock) {
    if (id == null) throw bad("Hãy chọn khách hàng.");
    var c =
        lock ? em.find(User.class, id, LockModeType.PESSIMISTIC_WRITE) : em.find(User.class, id);
    if (c == null || c.getDeletedAt() != null || !"CUSTOMER".equals(c.getRole())) throw missing();
    return c;
  }

  private User staff(Long id) {
    if (id == null) return null;
    var u = em.find(User.class, id);
    if (u == null || u.getDeletedAt() != null || u.isLocked() || !"MANAGER".equals(u.getRole()))
      throw bad("Người phụ trách phải là quản lý đang hoạt động.");
    return u;
  }

  private SupportTicket ticket(Actor a, long id, boolean lock) {
    actor(a);
    var t =
        lock
            ? em.find(SupportTicket.class, id, LockModeType.PESSIMISTIC_WRITE)
            : em.find(SupportTicket.class, id);
    if (t == null || !a.manager() && t.customerId != a.id()) throw missing();
    customer(t.customerId, false);
    return t;
  }

  private List<Message> messages(SupportTicket t) {
    try {
      return new ArrayList<>(json.readValue(t.messages, new TypeReference<List<Message>>() {}));
    } catch (Exception e) {
      throw new IllegalStateException("Invalid support conversation", e);
    }
  }

  private void append(SupportTicket t, Message message) {
    var items = messages(t);
    int limit = "RESOLVED".equals(t.status) ? 201 : 200;
    if (items.size() >= limit)
      throw bad("Phiếu đã đạt 200 tin nhắn trao đổi. Vui lòng tạo phiếu mới và ghi mã phiếu cũ.");
    items.add(message);
    try {
      t.messages = json.writeValueAsString(items);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private Map<String, Object> snapshot(SupportTicket t) {
    var data = new TreeMap<String, Object>();
    data.put("customerId", t.customerId);
    data.put("orderId", t.orderId);
    data.put("assigneeId", t.assigneeId);
    data.put("status", t.status);
    data.put("messageCount", messages(t).size());
    data.put("version", t.version);
    return data;
  }

  private void log(User manager, String action, SupportTicket t, Map<String, Object> before) {
    audit.recordAs(
        new AuditTrail.Actor(manager.getId(), manager.getFullName(), manager.getRole()),
        action,
        "SUPPORT_TICKET",
        t.id,
        before,
        snapshot(t));
  }

  private void notify(User who, SupportTicket t, String title, String type) {
    notifications.createSupport(who, title, "Phiếu hỗ trợ #" + t.id + ": " + title, type, t.id);
  }

  private void notifyAssignee(SupportTicket t) {
    if (t.assigneeId != null) {
      var u = em.find(User.class, t.assigneeId);
      if (u != null && u.getDeletedAt() == null && !u.isLocked() && "MANAGER".equals(u.getRole()))
        notify(u, t, "Phiếu hỗ trợ cần xử lý", "SUPPORT_ASSIGNED");
    }
  }

  @Transactional
  public Detail create(Actor a, Create input) {
    User creator = actor(a);
    if (!a.manager() && (input.customerId() != null || input.assigneeId() != null))
      throw bad("Không được chỉ định khách hàng hoặc nhân viên từ tài khoản khách.");
    em.lock(creator, LockModeType.PESSIMISTIC_WRITE);
    var owner = customer(a.manager() ? input.customerId() : a.id(), true);
    String request = key(input.requestId()),
        title = text(input.title(), 150, true),
        description = text(input.description(), 4000, true);
    var previous =
        em.createQuery(
                "select t from SupportTicket t where t.createdBy=:actor and t.requestKey=:key",
                SupportTicket.class)
            .setParameter("actor", a.id())
            .setParameter("key", request)
            .getResultList();
    if (!previous.isEmpty()) {
      var t = previous.getFirst();
      if (!t.customerId.equals(owner.getId())
          || !Objects.equals(t.orderId, input.orderId())
          || !t.title.equals(title)
          || !t.description.equals(description))
        throw conflict("Mã gửi đã được dùng cho nội dung khác.");
      return detail(a, t.id);
    }
    if (input.orderId() != null) {
      var order = em.find(Order.class, input.orderId());
      if (order == null || !order.getCustomer().getId().equals(owner.getId()))
        throw bad("Đơn hàng không thuộc khách hàng của phiếu.");
    }
    staff(input.assigneeId());
    var t = new SupportTicket();
    t.customerId = owner.getId();
    t.orderId = input.orderId();
    t.assigneeId = a.manager() ? input.assigneeId() : null;
    t.createdBy = a.id();
    t.requestKey = request;
    t.title = title;
    t.description = description;
    t.createdAt = Instant.now();
    t.updatedAt = t.createdAt;
    em.persist(t);
    em.flush();
    notify(owner, t, "Đã tiếp nhận yêu cầu hỗ trợ", "SUPPORT_CREATED");
    notifyAssignee(t);
    if (a.manager()) log(creator, "CREATE", t, Map.of());
    return detail(a, t.id);
  }

  @Transactional
  public Detail update(Actor a, long id, Update input) {
    User manager = actor(a);
    if (!a.manager())
      throw new ApiException(
          HttpStatus.FORBIDDEN, "MANAGER_REQUIRED", "Chỉ quản lý được xử lý phiếu.");
    var t = ticket(a, id, true);
    String status = input.status();
    if (status == null || !STATUSES.contains(status)) throw bad("Trạng thái phiếu không hợp lệ.");
    String reply = text(input.reply(), 4000, false),
        request = reply.isEmpty() ? null : key(input.requestId());
    // Retrying the same transition after a lost response returns its result, without another
    // message/notification.
    if (request != null && messages(t).stream().anyMatch(m -> m.id().equals(request))) {
      var old = messages(t).stream().filter(m -> m.id().equals(request)).findFirst().orElseThrow();
      if (!old.content().equals(reply)
          || !old.author().equals("ANH LỚN SHOP")
          || old.internal()
          || !t.status.equals(status)
          || !Objects.equals(t.assigneeId, input.assigneeId()))
        throw conflict("Yêu cầu đã thay đổi. Hãy tải lại phiếu.");
      return detail(a, id);
    }
    if (input.version() == null || input.version() != t.version)
      throw conflict("Phiếu đã thay đổi. Hãy tải lại trước khi lưu.");
    if ("RESOLVED".equals(t.status))
      throw conflict("Phiếu đã giải quyết, không thể sửa. Hãy tạo phiếu mới nếu cần.");
    boolean same = t.status.equals(status),
        valid =
            same
                || "NEW".equals(t.status) && "IN_PROGRESS".equals(status)
                || "IN_PROGRESS".equals(t.status)
                    && Set.of("WAITING_CUSTOMER", "RESOLVED").contains(status)
                || "WAITING_CUSTOMER".equals(t.status)
                    && Set.of("IN_PROGRESS", "RESOLVED").contains(status);
    if (!valid) throw conflict("Không thể chuyển sang trạng thái này.");
    if (!Objects.equals(t.assigneeId, input.assigneeId())) staff(input.assigneeId());
    if (!"NEW".equals(status) && input.assigneeId() == null)
      throw bad("Cần chọn người phụ trách trước khi xử lý.");
    if (!same && Set.of("WAITING_CUSTOMER", "RESOLVED").contains(status) && reply.isEmpty())
      throw bad("Hãy nhập nội dung gửi khách khi chờ khách hoặc giải quyết phiếu.");
    if (same && Objects.equals(t.assigneeId, input.assigneeId()) && reply.isEmpty())
      return detail(a, id);
    var before = snapshot(t);
    boolean reassigned = !Objects.equals(t.assigneeId, input.assigneeId());
    t.assigneeId = input.assigneeId();
    t.status = status;
    t.updatedAt = Instant.now();
    if ("RESOLVED".equals(status)) t.resolvedAt = t.updatedAt;
    if (!reply.isEmpty())
      append(t, new Message(request, "ANH LỚN SHOP", reply, false, t.updatedAt));
    em.flush();
    log(manager, "UPDATE", t, before);
    if (!same || !reply.isEmpty())
      notify(customer(t.customerId, false), t, "Phiếu hỗ trợ đã được cập nhật", "SUPPORT_UPDATED");
    if (reassigned) notifyAssignee(t);
    return detail(a, id);
  }

  @Transactional
  public Detail reply(Actor a, long id, Reply input) {
    User sender = actor(a);
    var t = ticket(a, id, true);
    if (!a.manager() && input.internal()) throw bad("Khách hàng không được gửi ghi chú nội bộ.");
    String request = key(input.requestId()), content = text(input.content(), 4000, true);
    String author = a.manager() ? "ANH LỚN SHOP" : "Khách hàng";
    var existing = messages(t).stream().filter(m -> m.id().equals(request)).findFirst();
    if (existing.isPresent()) {
      var old = existing.get();
      if (!old.content().equals(content)
          || !old.author().equals(author)
          || old.internal() != input.internal()) throw conflict("Mã tin nhắn đã được dùng.");
      return detail(a, id);
    }
    if ("RESOLVED".equals(t.status))
      throw conflict("Phiếu đã giải quyết. Hãy tạo phiếu mới nếu cần hỗ trợ thêm.");
    var before = snapshot(t);
    t.updatedAt = Instant.now();
    append(t, new Message(request, author, content, input.internal(), t.updatedAt));
    if (!a.manager() && "WAITING_CUSTOMER".equals(t.status)) t.status = "IN_PROGRESS";
    em.flush();
    if (a.manager()) {
      log(sender, "UPDATE", t, before);
      if (!input.internal())
        notify(customer(t.customerId, false), t, "Shop đã trả lời phiếu hỗ trợ", "SUPPORT_REPLY");
    } else notifyAssignee(t);
    return detail(a, id);
  }

  public Detail detail(Actor a, long id) {
    var t = ticket(a, id, false);
    return new Detail(
        row(t, a.manager()),
        t.description,
        messages(t).stream().filter(m -> a.manager() || !m.internal()).toList());
  }

  private Row row(SupportTicket t, boolean manager) {
    var c = em.find(User.class, t.customerId);
    var assigned = t.assigneeId == null ? null : em.find(User.class, t.assigneeId);
    var order = t.orderId == null ? null : em.find(Order.class, t.orderId);
    return new Row(
        t.id,
        t.title,
        t.status,
        t.orderId,
        order == null ? null : order.getOrderCode(),
        t.createdAt,
        t.updatedAt,
        t.resolvedAt,
        t.version,
        manager ? t.customerId : null,
        manager ? c.getFullName() : null,
        manager ? c.getEmail() : null,
        manager ? t.assigneeId : null,
        manager && assigned != null ? assigned.getFullName() : null,
        manager
            && assigned != null
            && !assigned.isLocked()
            && assigned.getDeletedAt() == null
            && "MANAGER".equals(assigned.getRole()));
  }

  public CustomerProfileService.Page<Row> list(
      Actor a, String q, String status, Long customerId, Long assigneeId, int page, int size) {
    actor(a);
    if (page < 0 || size < 1 || size > 100) throw bad("Phân trang không hợp lệ.");
    if (status != null && !STATUSES.contains(status)) throw bad("Trạng thái không hợp lệ.");
    q = text(q, 150, false);
    var args = new ArrayList<Object>();
    String where =
        " from support_tickets s join customers c on c.customer_id=s.customer_id where"
            + " c.role='CUSTOMER' and c.deleted_at is null";
    if (!a.manager()) {
      where += " and s.customer_id=?";
      args.add(a.id());
    } else {
      if (customerId != null) {
        where += " and s.customer_id=?";
        args.add(customerId);
      }
      if (assigneeId != null) {
        where += " and s.assignee_id=?";
        args.add(assigneeId);
      }
    }
    if (status != null) {
      where += " and s.status=?";
      args.add(status);
    }
    if (!q.isEmpty()) {
      String like =
          "%"
              + q.toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_")
              + "%";
      where += " and (lower(s.title) like ? escape '!' or cast(s.id as varchar)=?";
      args.add(like);
      args.add(q.replaceFirst("^#", ""));
      if (a.manager()) {
        where += " or lower(c.full_name) like ? escape '!' or lower(c.email) like ? escape '!'";
        args.add(like);
        args.add(like);
      }
      where += ")";
    }
    long count = db.queryForObject("select count(*)" + where, Long.class, args.toArray());
    args.add(size);
    args.add((long) page * size);
    // Lists are projections: no conversation payload or per-row entity lookups.
    String joined =
        where.replace(
            " where c.role",
            " left join customers a on a.customer_id=s.assignee_id left join orders o on"
                + " o.order_id=s.order_id where c.role");
    var rows =
        db.query(
            "select"
                + " s.id,s.title,s.status,s.order_id,o.order_code,s.created_at,s.updated_at,s.resolved_at,s.version,s.customer_id,c.full_name,c.email,s.assignee_id,a.full_name"
                + " assignee_name,a.role assignee_role,a.locked,a.deleted_at"
                + joined
                + " order by s.updated_at desc,s.id desc limit ? offset ?",
            (r, n) -> {
              var resolved = r.getTimestamp("resolved_at");
              return new Row(
                  r.getLong("id"),
                  r.getString("title"),
                  r.getString("status"),
                  (Long) r.getObject("order_id"),
                  (Long) r.getObject("order_code"),
                  r.getTimestamp("created_at").toInstant(),
                  r.getTimestamp("updated_at").toInstant(),
                  resolved == null ? null : resolved.toInstant(),
                  r.getLong("version"),
                  a.manager() ? r.getLong("customer_id") : null,
                  a.manager() ? r.getString("full_name") : null,
                  a.manager() ? r.getString("email") : null,
                  a.manager() ? (Long) r.getObject("assignee_id") : null,
                  a.manager() ? r.getString("assignee_name") : null,
                  a.manager()
                      && "MANAGER".equals(r.getString("assignee_role"))
                      && !r.getBoolean("locked")
                      && r.getTimestamp("deleted_at") == null);
            },
            args.toArray());
    return new CustomerProfileService.Page<>(rows, count, (count + size - 1) / size, page, size);
  }
}
