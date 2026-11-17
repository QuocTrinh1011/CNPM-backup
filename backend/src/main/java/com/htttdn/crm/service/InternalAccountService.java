package com.htttdn.crm.service;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.security.JwtTokenService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.domain.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

@Service
public class InternalAccountService extends AdminServiceSupport {
 private final UserRepository users; private final RefreshTokenRepository tokens; private final PasswordEncoder encoder; private final JwtTokenService jwt;
 public InternalAccountService(UserRepository users,RefreshTokenRepository tokens,PasswordEncoder encoder,JwtTokenService jwt){this.users=users;this.tokens=tokens;this.encoder=encoder;this.jwt=jwt;}
 public record Input(@NotBlank @Size(max=150) String fullName,@NotBlank @Email String email,String role,String password,Boolean locked){}
 public Page<User> list(String q,int page,int size){return list(q,"all",page,size);}
 public Page<User> list(String q,String group,int page,int size){
  Set<String> roles=switch(group==null?"all":group.trim().toLowerCase(Locale.ROOT)){
   case "managers"->Set.of("ADMIN","MANAGER","MANAGER_HR","MANAGER_WAREHOUSE","MANAGER_SALES");
   case "employees"->Set.of("EMPLOYEE");
   case "customers"->Set.of("CUSTOMER");
   case "all"->Set.of("ADMIN","MANAGER","MANAGER_HR","MANAGER_WAREHOUSE","MANAGER_SALES","EMPLOYEE");
   default->throw VoucherService.bad("INVALID_ACCOUNT_GROUP","Nhóm tài khoản không hợp lệ.");
  };
  String query=q==null?"":q.toLowerCase(Locale.ROOT);
  return users.findAll((r,x,c)->c.and(r.get("role").in(roles),c.isNull(r.get("deletedAt")),
    c.or(c.like(c.lower(r.get("fullName")),"%"+query+"%"),c.like(c.lower(r.get("email")),"%"+query+"%"),c.like(r.get("phone"),"%"+query+"%"))),
    PageRequest.of(Math.max(0,page),Math.max(1,Math.min(100,size)),Sort.by("id").descending()));
 }
 @Transactional public User create(Input in){User u=new User();copy(u,in,true);users.save(u);audit("CREATE","ACCOUNT",u.getId(),Map.of(),u);return u;}
 @Transactional public User update(Long id,Input in,String authorization){
  var all=users.lockInternalAccounts();User u=all.stream().filter(a->a.getId().equals(id)&&a.getDeletedAt()==null).findFirst().orElseThrow();
  if(jwt.parse(authorization).userId()==id&&(Boolean.TRUE.equals(in.locked())||!u.getRole().equals(in.role())))throw VoucherService.bad("SELF_CHANGE_FORBIDDEN","Không thể tự khóa hoặc đổi quyền.");
  if("ADMIN".equals(u.getRole())&&!u.isLocked()&&(Boolean.TRUE.equals(in.locked())||!"ADMIN".equals(in.role())))protectLast(all);
  var before=snapshot(u);copy(u,in,false);tokens.revokeByUserId(id);audit("UPDATE","ACCOUNT",id,before,u);return users.save(u);
 }
 @Transactional public void delete(Long id,String authorization){
  var all=users.lockInternalAccounts();User u=all.stream().filter(a->a.getId().equals(id)&&a.getDeletedAt()==null).findFirst().orElseThrow();
  if(jwt.parse(authorization).userId()==id)throw VoucherService.bad("SELF_DELETE_FORBIDDEN","Không thể tự xóa tài khoản.");
  if("ADMIN".equals(u.getRole())&&!u.isLocked())protectLast(all);
  var before=snapshot(u);u.setDeletedAt(Instant.now());u.setLocked(true);tokens.revokeByUserId(id);users.save(u);audit("DELETE","ACCOUNT",id,before,u);
 }
 private void protectLast(List<User> all){if(all.stream().filter(u->"ADMIN".equals(u.getRole())&&!u.isLocked()&&u.getDeletedAt()==null).count()<=1)throw VoucherService.bad("LAST_ADMIN","Phải giữ ít nhất một admin hoạt động.");}
 private void copy(User u,Input in,boolean creating){
  Set<String> roles=Set.of("ADMIN","MANAGER_HR","MANAGER_WAREHOUSE","MANAGER_SALES","EMPLOYEE");
  if(in.role()==null||!roles.contains(in.role()))throw VoucherService.bad("INVALID_ROLE","Vai trò tài khoản không hợp lệ.");
  String email=in.email().trim().toLowerCase(Locale.ROOT);users.findByEmailIgnoreCase(email).filter(other->!Objects.equals(other.getId(),u.getId())).ifPresent(other->{throw VoucherService.bad("EMAIL_EXISTS","Email đã tồn tại.");});
  boolean employee="EMPLOYEE".equals(in.role());
  boolean wasEmployee=!creating&&"EMPLOYEE".equals(u.getRole());
  if(employee){
   if(creating||!wasEmployee)u.setPasswordHash(encoder.encode(UUID.randomUUID().toString()));
  }else if(creating||wasEmployee||in.password()!=null&&!in.password().isBlank()){
   if(in.password()==null||in.password().length()<8||in.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72)throw VoucherService.bad("INVALID_PASSWORD","Mật khẩu từ 8 ký tự, tối đa 72 byte.");
   u.setPasswordHash(encoder.encode(in.password()));
  }
  u.setEmail(email);u.setFullName(in.fullName().trim());u.setRole(in.role());if(in.locked()!=null)u.setLocked(in.locked());
 }
}
