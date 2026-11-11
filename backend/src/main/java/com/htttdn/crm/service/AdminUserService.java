package com.htttdn.crm.service;

import com.htttdn.crm.dto.admin.AdminDtos.LockRequest;
import com.htttdn.crm.dto.admin.AdminDtos.UserRequest;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.RefreshTokenRepository;
import com.htttdn.crm.repository.UserRepository;
import java.time.Instant;
import java.util.NoSuchElementException;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminUserService extends AdminServiceSupport {
  private final UserRepository users;

  @org.springframework.beans.factory.annotation.Autowired
  private org.springframework.security.crypto.password.PasswordEncoder encoder;

  public record CreateCustomer(
      @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 150)
          String fullName,
      @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Email String email,
      @jakarta.validation.constraints.NotBlank
          @jakarta.validation.constraints.Size(min = 8, max = 72)
          String password,
      String phone,
      String preferences) {}

  @Transactional
  public User create(CreateCustomer r) {
    String email = r.email().trim().toLowerCase(java.util.Locale.ROOT);
    if (users.existsByEmailIgnoreCase(email))
      throw VoucherService.bad("EMAIL_EXISTS", "Email đã tồn tại.");
    if (r.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw VoucherService.bad("INVALID_PASSWORD", "Mật khẩu tối đa 72 byte.");
    User u = new User();
    u.setRole("CUSTOMER");
    u.setEmail(email);
    u.setFullName(r.fullName().trim());
    u.setPhone(r.phone());
    u.setPreferences(r.preferences());
    u.setPasswordHash(encoder.encode(r.password()));
    users.save(u);
    audit("CREATE", "CUSTOMER", u.getId(), java.util.Map.of(), u);
    return u;
  }

  private final RefreshTokenRepository refreshTokens;
  private final NotificationService notifications;

  public AdminUserService(
      UserRepository users,
      RefreshTokenRepository refreshTokens,
      NotificationService notifications) {
    this.users = users;
    this.refreshTokens = refreshTokens;
    this.notifications = notifications;
  }

  public Page<User> list(String q, int page, int size) {
    return users.findActiveCustomers(q == null ? "" : q.trim(), page(page, size));
  }

  public User get(Long id) {
    return users
        .findById(id)
        .filter(u -> "CUSTOMER".equals(u.getRole()) && u.getDeletedAt() == null)
        .orElseThrow(() -> new NoSuchElementException("Không tìm thấy tài khoản customer."));
  }

  @Transactional
  public User update(Long id, UserRequest request) {
    User user = get(id);
    var before = snapshot(user);
    user.setFullName(request.fullName());
    user.setPhone(request.phone());
    user.setPreferences(request.preferences());
    audit("UPDATE", "CUSTOMER", id, before, user);
    return users.save(user);
  }

  @Transactional
  public User lock(Long id, LockRequest request) {
    User user = get(id);
    var before = snapshot(user);
    if (request.locked()) {
      String reason = request.reason() == null ? "" : request.reason().trim();
      if (reason.isEmpty())
        throw new ApiException(
            HttpStatus.BAD_REQUEST, "LOCK_REASON_REQUIRED", "Vui lòng nhập lý do khóa tài khoản.");
      if (reason.length() > 2000)
        throw new ApiException(
            HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Lý do khóa tối đa 2.000 ký tự.");
      if (user.isLocked())
        throw new ApiException(HttpStatus.CONFLICT, "ALREADY_LOCKED", "Tài khoản đã bị khóa.");
      user.setLocked(true);
      user.setLockReason(reason);
      users.save(user);
      notifications.create(user, "Tài khoản đã bị khóa", reason, "ACCOUNT_LOCKED", null);
      refreshTokens.revokeByUserId(user.getId());
    } else {
      user.setLocked(false);
      user.setLockReason(null);
      users.save(user);
    }
    if (!before.equals(snapshot(user)))
      audit(request.locked() ? "LOCK" : "UNLOCK", "CUSTOMER", id, before, user);
    return user;
  }

  @Transactional
  public void delete(Long id) {
    User user = get(id);
    var before = snapshot(user);
    user.setDeletedAt(Instant.now());
    user.setLocked(true);
    user.setLockReason(null);
    users.save(user);
    refreshTokens.revokeByUserId(id);
    audit("DELETE", "CUSTOMER", id, before, user);
  }
}
