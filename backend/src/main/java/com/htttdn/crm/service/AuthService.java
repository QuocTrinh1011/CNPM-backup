package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.JsonNode; import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.entity.*; import com.htttdn.crm.exception.ApiException; import com.htttdn.crm.repository.*; import com.htttdn.crm.security.JwtTokenService;
import org.springframework.beans.factory.annotation.Value; import org.springframework.http.*; import org.springframework.security.crypto.password.PasswordEncoder; import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets; import java.security.*; import java.time.*; import java.util.*; import javax.crypto.Mac; import javax.crypto.spec.SecretKeySpec;

@Service
public class AuthService {
    private static final String DUMMY_PASSWORD_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    @org.springframework.beans.factory.annotation.Autowired private TransactionalMail mail;
    @org.springframework.beans.factory.annotation.Autowired private org.springframework.core.env.Environment environment;
    @Value("${DEV_PASSWORD_RESET_ENABLED:false}") private boolean developmentResetEnabled;
    private boolean developmentRecovery(){return developmentResetEnabled && environment!=null && environment.acceptsProfiles(org.springframework.core.env.Profiles.of("development"));}
    public boolean passwordRecoveryEnabled(){return mail!=null && mail.available() || developmentRecovery();}
    private void requirePasswordRecovery(){if(!passwordRecoveryEnabled())throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"PASSWORD_RECOVERY_DISABLED","Khôi phục mật khẩu trực tuyến chưa được bật. Vui lòng liên hệ cửa hàng để được hỗ trợ.");}
    private final UserRepository users; private final RefreshTokenRepository refreshTokens; private final PasswordResetTokenRepository resetTokens; private final PasswordEncoder encoder; private final ObjectMapper mapper; private final JwtTokenService jwt;
    @Value("${app.auth.jwt-secret}") private String jwtSecret; @Value("${app.auth.access-minutes:15}") private long accessMinutes; @Value("${app.auth.refresh-days:30}") private long refreshDays; @Value("${app.auth.secure-cookie:false}") private boolean secureCookie; @Value("${app.auth.reset-code-minutes:15}") private long resetCodeMinutes;
    public AuthService(UserRepository users,RefreshTokenRepository refreshTokens,PasswordResetTokenRepository resetTokens,PasswordEncoder encoder,ObjectMapper mapper,JwtTokenService jwt){this.users=users;this.refreshTokens=refreshTokens;this.resetTokens=resetTokens;this.encoder=encoder;this.mapper=mapper;this.jwt=jwt;}

    @Transactional
    public User register(String email,String password,String fullName,String phone,Short age){
        String normalized=email==null?"":email.trim().toLowerCase(Locale.ROOT); validatePassword(password);
        if(normalized.isBlank() || !normalized.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Email không hợp lệ.");
        if(fullName==null || fullName.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Vui lòng nhập họ và tên.");
        if(users.existsByEmailIgnoreCase(normalized)) throw new ApiException(HttpStatus.CONFLICT,"EMAIL_ALREADY_EXISTS","Email này đã được đăng ký.");
        User user=new User(); user.setEmail(normalized); user.setFullName(fullName.trim()); user.setPhone(phone==null?null:phone.trim()); user.setAge(age); user.setRole("CUSTOMER"); user.setPasswordHash(encoder.encode(password));
        try{return users.saveAndFlush(user);}catch(Exception e){if(e.getCause()!=null)throw new ApiException(HttpStatus.CONFLICT,"EMAIL_ALREADY_EXISTS","Email này đã được đăng ký.");throw e;}
    }
    public void validatePassword(String password){if(password==null || password.length()<8 || !password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số.");}
    @Transactional public Session login(String email,String password){
        User user=users.findByEmailIgnoreCase(email==null?"":email.trim()).orElse(null);
        boolean customerWithPassword=user!=null && "CUSTOMER".equals(user.getRole()) && user.getPasswordHash()!=null && !user.getPasswordHash().isBlank();
        String passwordHash=customerWithPassword ? user.getPasswordHash() : DUMMY_PASSWORD_HASH;
        boolean passwordMatches=encoder.matches(password==null?"":password,passwordHash);
        if(!customerWithPassword || !passwordMatches) throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_CREDENTIALS","Email hoặc mật khẩu không đúng.");
        if(user.getDeletedAt()!=null) throw new ApiException(HttpStatus.FORBIDDEN,"ACCOUNT_REMOVED","Tài khoản này đã bị vô hiệu hóa.");
        if(user.isLocked()) throw locked(user);
        return issue(user,UUID.randomUUID().toString());
    }
    @Transactional(noRollbackFor=ApiException.class) public Session refresh(String raw){
        if(raw==null || raw.isBlank()) throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_REFRESH_TOKEN","Phiên đăng nhập đã hết hạn.");
        RefreshToken token=refreshTokens.findForUpdate(hash(raw)).orElseThrow(()->new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_REFRESH_TOKEN","Phiên đăng nhập không hợp lệ."));
        if("ADMIN".equals(token.getAudience())) throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_REFRESH_TOKEN","Phiên customer không hợp lệ.");
        if("ROTATED".equals(token.getStatus())){refreshTokens.revokeFamily(token.getFamilyId(),"REUSE_DETECTED");throw new ApiException(HttpStatus.UNAUTHORIZED,"REFRESH_TOKEN_REUSE_DETECTED","Phát hiện refresh token bị sử dụng lại. Vui lòng đăng nhập lại.");}
        if(!"ACTIVE".equals(token.getStatus())) throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_REFRESH_TOKEN","Phiên đăng nhập không còn hiệu lực.");
        if(token.getExpiresAt().isBefore(Instant.now())){token.setStatus("REVOKED");token.setRevokeReason("EXPIRED");token.setRevokedAt(Instant.now());refreshTokens.save(token);throw new ApiException(HttpStatus.UNAUTHORIZED,"REFRESH_TOKEN_EXPIRED","Refresh token đã hết hạn.");}
        token.setStatus("ROTATED"); token.setRevokeReason("ROTATED"); token.setRevokedAt(Instant.now()); refreshTokens.save(token);
        User user=token.getUser(); if(!"CUSTOMER".equals(user.getRole()) || user.getDeletedAt()!=null) throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_REFRESH_TOKEN","Phiên customer không hợp lệ."); if(user.isLocked()) throw locked(user);
        return issue(user,token.getFamilyId());
    }
    @Transactional public void logout(String raw){if(raw==null||raw.isBlank())return;refreshTokens.findForUpdate(hash(raw)).filter(t->!"ADMIN".equals(t.getAudience())).ifPresent(t->{if("ACTIVE".equals(t.getStatus())){t.setStatus("REVOKED");t.setRevokeReason("LOGOUT");t.setRevokedAt(Instant.now());refreshTokens.save(t);}});}
    @Transactional public User saveProfile(User user){return users.save(user);}
    @Transactional public void changePassword(User user,String currentPassword,String newPassword){if(!encoder.matches(currentPassword==null?"":currentPassword,user.getPasswordHash()))throw new ApiException(HttpStatus.BAD_REQUEST,"CURRENT_PASSWORD_INVALID","Mật khẩu hiện tại không đúng.");validatePassword(newPassword);user.setPasswordHash(encoder.encode(newPassword));users.save(user);refreshTokens.revokeByUserId(user.getId());}
    @Transactional public String requestPasswordReset(String email){
        requirePasswordRecovery();String normalized=email==null?"":email.trim().toLowerCase(Locale.ROOT);
        boolean deliver=mail!=null && mail.available();
        if(deliver && !mail.permits(normalized)) return null;
        User user=users.findForPasswordReset(normalized).orElse(null);
        if(user==null||!"CUSTOMER".equals(user.getRole())||user.isLocked()||user.getDeletedAt()!=null)return null;
        var previous=resetTokens.findFirstByCustomerIdOrderByCreatedAtDesc(user.getId());
        if(previous.isPresent() && previous.get().getCreatedAt().isAfter(Instant.now().minusSeconds(60))) return null;
        byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
        String code=deliver?Base64.getUrlEncoder().withoutPadding().encodeToString(bytes):String.format("%06d",new SecureRandom().nextInt(1_000_000));
        if(deliver){
            String link=mail.link("/dat-lai-mat-khau#email="+java.net.URLEncoder.encode(normalized,StandardCharsets.UTF_8)+"&code="+code);
            try { mail.send(normalized,"ANH LỚN SHOP — Đặt lại mật khẩu","Mở liên kết để đặt lại mật khẩu:\n"+link+"\n\nLiên kết có hiệu lực "+resetCodeMinutes+" phút, dùng một lần. Nếu không yêu cầu, bạn có thể bỏ qua email này.","password-reset-"+UUID.randomUUID()); }
            catch(RuntimeException e) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("Password reset email delivery failed"); return null; }
        }
        resetTokens.deleteByCustomerId(user.getId());resetTokens.flush();
        PasswordResetToken token=new PasswordResetToken();token.setCustomer(user);token.setTokenHash(hash(code));token.setExpiresAt(Instant.now().plus(Duration.ofMinutes(resetCodeMinutes)));resetTokens.save(token);
        return deliver?null:code;
    }
    @Transactional public void resetPassword(String email,String code,String newPassword){
        requirePasswordRecovery();validatePassword(newPassword);String normalized=email==null?"":email.trim().toLowerCase(Locale.ROOT);
        if(mail!=null && mail.available() && (code==null || !code.matches("[A-Za-z0-9_-]{43}")))throw invalidReset();
        User user=users.findForPasswordReset(normalized).orElse(null);
        if(user==null||!"CUSTOMER".equals(user.getRole())||user.isLocked()||user.getDeletedAt()!=null)throw invalidReset();
        PasswordResetToken token=resetTokens.findByTokenHash(hash(code==null?"":code.trim())).orElseThrow(this::invalidReset);
        if(token.getUsedAt()!=null||!token.getExpiresAt().isAfter(Instant.now())||!user.getId().equals(token.getCustomer().getId()))throw invalidReset();
        user.setPasswordHash(encoder.encode(newPassword));users.save(user);token.setUsedAt(Instant.now());resetTokens.save(token);refreshTokens.revokeByUserId(user.getId());
    }
    private ApiException invalidReset(){return new ApiException(HttpStatus.BAD_REQUEST,"RESET_CODE_INVALID","Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.");}
    public ResponseCookie cookie(String raw){return ResponseCookie.from("refreshToken",raw).httpOnly(true).secure(secureCookie).sameSite("Lax").path("/api/auth").maxAge(Duration.ofDays(refreshDays)).build();}
    public ResponseCookie clearCookie(){return ResponseCookie.from("refreshToken","").httpOnly(true).secure(secureCookie).sameSite("Lax").path("/api/auth").maxAge(Duration.ZERO).build();}
    public User requireCustomer(String authorization){
        JwtTokenService.Claims claims=jwt.parse(authorization); if(!"CUSTOMER".equals(claims.role())) throw new ApiException(HttpStatus.FORBIDDEN,"CUSTOMER_REQUIRED","Customer token required.");
        User user=users.findById(claims.userId()).orElseThrow(()->new ApiException(HttpStatus.UNAUTHORIZED,"UNAUTHORIZED","Vui lòng đăng nhập."));
        if(!"CUSTOMER".equals(user.getRole()) || user.getDeletedAt()!=null) throw new ApiException(HttpStatus.UNAUTHORIZED,"UNAUTHORIZED","Phiên đăng nhập không hợp lệ."); if(user.isLocked()) throw locked(user); return user;
    }
    private ApiException locked(User user){String reason=user.getLockReason();return new ApiException(HttpStatus.LOCKED,"ACCOUNT_LOCKED",reason==null||reason.isBlank()?"Tài khoản đang bị khóa.":"Tài khoản đang bị khóa. Lý do: "+reason);}
    private Session issue(User user,String family){String raw=UUID.randomUUID()+"."+UUID.randomUUID();RefreshToken token=new RefreshToken();token.setUser(user);token.setAudience("CUSTOMER");token.setFamilyId(family);token.setTokenHash(hash(raw));token.setExpiresAt(Instant.now().plus(Duration.ofDays(refreshDays)));refreshTokens.save(token);return new Session(jwt.issue(user.getId(),"CUSTOMER"),raw,accessMinutes*60,user);}
    public static String hash(String value){try{byte[] b=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();for(byte x:b)s.append(String.format("%02x",x));return s.toString();}catch(Exception e){throw new IllegalStateException(e);}}
    public record Session(String accessToken,String refreshToken,long expiresIn,User user){}
}
