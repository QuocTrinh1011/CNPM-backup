package com.cnpm.clothingstore.service;
import com.cnpm.clothingstore.entity.*;
import com.cnpm.clothingstore.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.*;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Root;
import java.util.*;
import java.math.BigDecimal;
@Service
public class DirectoryService {
 private final ProductRepository products;private final SupplierRepository suppliers;private final UserRepository users;
 public DirectoryService(ProductRepository products,SupplierRepository suppliers,UserRepository users){this.products=products;this.suppliers=suppliers;this.users=users;}
 private Pageable paging(int page,int size,String sort,boolean desc,Set<String> allowed){if(!allowed.contains(sort)||page<0||size<1||size>100)throw VoucherService.bad("INVALID_FILTER","Bộ lọc hoặc phân trang không hợp lệ.");return PageRequest.of(page,size,Sort.by(desc?Sort.Direction.DESC:Sort.Direction.ASC,sort).and(Sort.by("id")));}
 public Map<String,Long> overview(){long accounts=users.countByRoleAndDeletedAtIsNull("ADMIN")+users.countByRoleAndDeletedAtIsNull("MANAGER_HR")+users.countByRoleAndDeletedAtIsNull("MANAGER_WAREHOUSE")+users.countByRoleAndDeletedAtIsNull("MANAGER_SALES")+users.countByRoleAndDeletedAtIsNull("EMPLOYEE");return Map.of("accounts",accounts,"products",products.count(),"suppliers",suppliers.count());}
 public Page<Product> products(String q,String category,Long supplierId,BigDecimal minPrice,BigDecimal maxPrice,String stock,Boolean active,int page,int size,String sort,boolean desc){
  String categoryFilter=normalized(category);
  if(q.length()>120||categoryFilter.length()>120||supplierId!=null&&supplierId<1||minPrice!=null&&minPrice.signum()<0||maxPrice!=null&&maxPrice.signum()<0||minPrice!=null&&maxPrice!=null&&minPrice.compareTo(maxPrice)>0||!Set.of("","IN_STOCK","OUT").contains(stock))throw VoucherService.bad("INVALID_FILTER","Bộ lọc sản phẩm không hợp lệ.");
  return products.findAll((r,x,c)->{List<Predicate> p=new ArrayList<>();
   if(!q.isBlank()){Predicate name=c.like(c.lower(r.get("name")),"%"+q.toLowerCase(Locale.ROOT)+"%");try{p.add(c.or(name,c.equal(r.get("id"),Long.valueOf(q))));}catch(NumberFormatException e){p.add(name);}}
   if(!categoryFilter.isEmpty())p.add(c.equal(c.lower(r.get("categoryEntity").get("name")),categoryFilter.toLowerCase(Locale.ROOT)));if(supplierId!=null)p.add(c.equal(r.get("supplierId"),supplierId));
   if(minPrice!=null)p.add(c.greaterThanOrEqualTo(r.get("price"),minPrice));if(maxPrice!=null)p.add(c.lessThanOrEqualTo(r.get("price"),maxPrice));
   if(active!=null)p.add(c.equal(r.get("active"),active));if("IN_STOCK".equals(stock))p.add(c.greaterThan(r.get("stock"),0));else if("OUT".equals(stock))p.add(c.equal(r.get("stock"),0));
   return c.and(p.toArray(Predicate[]::new));},paging(page,size,sort,desc,Set.of("name","price","stock","createdAt","id")));
 }
 public Page<Supplier> suppliers(String q,String code,String email,String phone,String address,Boolean active,int page,int size,String sort,boolean desc){
  String keyword=normalized(q),codeValue=normalized(code),emailValue=normalized(email),phoneValue=normalized(phone),addressValue=normalized(address);
  if(keyword.length()>120||codeValue.length()>40||emailValue.length()>255||phoneValue.length()>30||addressValue.length()>1000)throw VoucherService.bad("INVALID_FILTER","Bộ lọc nhà cung cấp không hợp lệ.");
  return suppliers.findAll((r,x,c)->{
   List<Predicate> predicates=new ArrayList<>();
   if(!keyword.isEmpty()){
    List<Predicate> keywordMatches=new ArrayList<>();
    for(String field:List.of("code","name","email","phone","address"))keywordMatches.add(contains(c,r,field,keyword));
    predicates.add(c.or(keywordMatches.toArray(Predicate[]::new)));
   }
   addContains(predicates,c,r,"code",codeValue);addContains(predicates,c,r,"email",emailValue);
   addContains(predicates,c,r,"phone",phoneValue);addContains(predicates,c,r,"address",addressValue);
   if(active!=null)predicates.add(c.equal(r.get("active"),active));
   return c.and(predicates.toArray(Predicate[]::new));
  },paging(page,size,sort,desc,Set.of("code","name","createdAt","id")));
 }
 private static String normalized(String value){return value==null?"":value.trim();}
 private static String likePattern(String value){return "%"+value.toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%";}
 private static Predicate contains(CriteriaBuilder criteria,Root<Supplier> root,String field,String value){return criteria.like(criteria.lower(root.get(field)),likePattern(value),'!');}
 private static void addContains(List<Predicate> predicates,CriteriaBuilder criteria,Root<Supplier> root,String field,String value){if(!value.isEmpty())predicates.add(contains(criteria,root,field,value));}
 @Transactional public Supplier save(Long id,Supplier input){
  Supplier s=id==null?new Supplier():suppliers.findById(id).orElseThrow();String code=input.code.trim().toUpperCase(Locale.ROOT);
  if(!code.matches("[A-Z0-9_-]{1,40}")||suppliers.existsByCodeIgnoreCaseAndIdNot(code,id==null?-1L:id))throw VoucherService.bad("INVALID_SUPPLIER_CODE","Mã nhà cung cấp không hợp lệ hoặc đã tồn tại.");
  s.code=code;s.name=input.name.trim();s.email=input.email;s.phone=input.phone;s.address=input.address;s.notes=input.notes;s.active=input.active;return suppliers.save(s);
 }
 @Transactional public Product assign(Long productId,Long supplierId){Product p=products.findLockedById(productId).orElseThrow();if(supplierId!=null&&!suppliers.existsById(supplierId))throw VoucherService.bad("SUPPLIER_NOT_FOUND","Không tìm thấy nhà cung cấp.");p.setSupplierId(supplierId);return products.save(p);}
}
