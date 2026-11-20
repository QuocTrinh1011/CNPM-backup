package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.repository.*;
import com.cnpm.clothingstore.security.JwtTokenService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.domain.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class InternalAccountService extends AdminServiceSupport {
 private final UserRepository users; private final EmployeeProfileRepository employeeProfiles; private final RefreshTokenRepository tokens; private final PasswordEncoder encoder; private final JwtTokenService jwt;
 public InternalAccountService(UserRepository users,EmployeeProfileRepository employeeProfiles,RefreshTokenRepository tokens,PasswordEncoder encoder,JwtTokenService jwt){this.users=users;this.employeeProfiles=employeeProfiles;this.tokens=tokens;this.encoder=encoder;this.jwt=jwt;}
 public record Input(@NotBlank @Size(max=150) String fullName,@NotBlank @Email String email,String role,String password,Boolean locked,@jakarta.validation.constraints.Pattern(regexp="(?i)^(SALES|WAREHOUSE)?$") String workArea){
  public Input(String fullName,String email,String role,String password,Boolean locked){this(fullName,email,role,password,locked,null);}
 }
 public record AccountView(Long id,String email,String fullName,Short age,String phone,String preferences,String role,boolean locked,String lockReason,Instant deletedAt,Instant createdAt,String workArea){}
 public Page<AccountView> list(String q,int page,int size){return list(q,"all",page,size);}
 public Page<AccountView> list(String q,String group,int page,int size){
  Set<String> roles=switch(group==null?"all":group.trim().toLowerCase(Locale.ROOT)){
   case "managers"->Set.of("ADMIN","MANAGER","MANAGER_HR","MANAGER_WAREHOUSE","MANAGER_SALES");
   case "employees"->Set.of("EMPLOYEE");
   case "customers"->Set.of("CUSTOMER");
   case "all"->Set.of("ADMIN","MANAGER","MANAGER_HR","MANAGER_WAREHOUSE","MANAGER_SALES","EMPLOYEE");
   default->throw VoucherService.bad("INVALID_ACCOUNT_GROUP","Nhóm tài khoản không hợp lệ.");
  };
  String query=q==null?"":q.toLowerCase(Locale.ROOT);
  Page<User> pageOfUsers=users.findAll((r,x,c)->c.and(r.get("role").in(roles),c.isNull(r.get("deletedAt")),
    c.or(c.like(c.lower(r.get("fullName")),"%"+query+"%"),c.like(c.lower(r.get("email")),"%"+query+"%"),c.like(r.get("phone"),"%"+query+"%"))),
    PageRequest.of(Math.max(0,page),Math.max(1,Math.min(100,size)),Sort.by("id").descending()));
  Map<Long,String> workAreas=new HashMap<>();
  for(EmployeeProfile profile:employeeProfiles.findAllById(pageOfUsers.getContent().stream().map(User::getId).toList()))workAreas.put(profile.getEmployeeId(),profile.getWorkArea());
  return pageOfUsers.map(user->view(user,workAreas.get(user.getId())));
 }
 @Transactional public User create(Input in){User u=new User();copy(u,in,true);u=users.saveAndFlush(u);audit("CREATE","ACCOUNT",u.getId(),Map.of(),u);if("EMPLOYEE".equals(u.getRole())){EmployeeProfile profile=saveEmployeeProfile(u,in.workArea(),true);audit("CREATE","EMPLOYEE_PROFILE",u.getId(),Map.of(),profile);}return u;}
 @Transactional public User update(Long id,Input in,String authorization){
  var all=users.lockInternalAccounts();User u=all.stream().filter(a->a.getId().equals(id)&&a.getDeletedAt()==null).findFirst().orElseThrow();
  boolean wasEmployee="EMPLOYEE".equals(u.getRole());
  if(jwt.parse(authorization).userId()==id&&(Boolean.TRUE.equals(in.locked())||!u.getRole().equals(in.role())))throw VoucherService.bad("SELF_CHANGE_FORBIDDEN","Không thể tự khóa hoặc đổi quyền.");
  if("ADMIN".equals(u.getRole())&&!u.isLocked()&&(Boolean.TRUE.equals(in.locked())||!"ADMIN".equals(in.role())))protectLast(all);
  var before=snapshot(u);copy(u,in,false);u=users.save(u);tokens.revokeByUserId(id);audit("UPDATE","ACCOUNT",id,before,u);
  if("EMPLOYEE".equals(u.getRole())){Map<String,Object> profileBefore=employeeProfiles.findById(id).map(this::snapshot).orElseGet(Map::of);EmployeeProfile profile=saveEmployeeProfile(u,in.workArea(),!wasEmployee);if(!profileBefore.equals(snapshot(profile)))audit("UPDATE","EMPLOYEE_PROFILE",id,profileBefore,profile);}
  return u;
 }
 @Transactional public void delete(Long id,String authorization){
  var all=users.lockInternalAccounts();User u=all.stream().filter(a->a.getId().equals(id)&&a.getDeletedAt()==null).findFirst().orElseThrow();
  if(jwt.parse(authorization).userId()==id)throw VoucherService.bad("SELF_DELETE_FORBIDDEN","Không thể tự xóa tài khoản.");
  if("ADMIN".equals(u.getRole())&&!u.isLocked())protectLast(all);
  var before=snapshot(u);u.setDeletedAt(Instant.now());u.setLocked(true);tokens.revokeByUserId(id);users.save(u);audit("DELETE","ACCOUNT",id,before,u);
 }
 private void protectLast(List<User> all){if(all.stream().filter(u->"ADMIN".equals(u.getRole())&&!u.isLocked()&&u.getDeletedAt()==null).count()<=1)throw VoucherService.bad("LAST_ADMIN","Phải giữ ít nhất một admin hoạt động.");}
 @Transactional(readOnly=true) public AccountView view(User user){String workArea="EMPLOYEE".equals(user.getRole())?employeeProfiles.findById(user.getId()).map(EmployeeProfile::getWorkArea).orElse(null):null;return view(user,workArea);}
 private AccountView view(User user,String workArea){return new AccountView(user.getId(),user.getEmail(),user.getFullName(),user.getAge(),user.getPhone(),user.getPreferences(),user.getRole(),user.isLocked(),user.getLockReason(),user.getDeletedAt(),user.getCreatedAt(),workArea);}
 private EmployeeProfile saveEmployeeProfile(User account,String requestedWorkArea,boolean creating){
  EmployeeProfile profile=employeeProfiles.findById(account.getId()).orElseGet(()->{EmployeeProfile created=new EmployeeProfile();created.setEmployeeId(account.getId());created.setEmployeeCode("EMP-"+account.getId());created.setJobTitle("Nhân viên");created.setPermissionProfile("STAFF");created.setEmploymentStatus("ACTIVE");created.setHireDate(LocalDate.now());return created;});
  profile.setAccount(account);
  if(creating||requestedWorkArea!=null&&!requestedWorkArea.isBlank()){
   String workArea=normalizeWorkArea(requestedWorkArea);profile.setWorkArea(workArea);profile.setJobTitle("SALES".equals(workArea)?"Nhân viên bán hàng":"Nhân viên kho");
  }
  return employeeProfiles.saveAndFlush(profile);
 }
 private String normalizeWorkArea(String workArea){String normalized=workArea==null?"":workArea.trim().toUpperCase(Locale.ROOT);if(!Set.of("SALES","WAREHOUSE").contains(normalized))throw VoucherService.bad("INVALID_EMPLOYEE_WORK_AREA","Chọn loại nhân viên kho hoặc bán hàng.");return normalized;}
 private void copy(User u,Input in,boolean creating){
  Set<String> roles=Set.of("ADMIN","MANAGER_HR","MANAGER_WAREHOUSE","MANAGER_SALES","EMPLOYEE");
  if(in.role()==null||!roles.contains(in.role()))throw VoucherService.bad("INVALID_ROLE","Vai trò tài khoản không hợp lệ.");
  String email=in.email().trim().toLowerCase(Locale.ROOT);users.findByEmailIgnoreCase(email).filter(other->!Objects.equals(other.getId(),u.getId())).ifPresent(other->{throw VoucherService.bad("EMAIL_EXISTS","Email đã tồn tại.");});
  boolean employee="EMPLOYEE".equals(in.role());
  if(employee&&(creating||!"EMPLOYEE".equals(u.getRole()))||employee&&in.workArea()!=null&&!in.workArea().isBlank())normalizeWorkArea(in.workArea());
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
