package com.htttdn.crm.controller;
import com.htttdn.crm.dto.admin.AdminDtos.StatusRequest; import com.htttdn.crm.service.*; import jakarta.validation.Valid; import org.springframework.web.bind.annotation.*; import java.time.Instant; import java.util.Map;
@RestController @RequestMapping("/api/manager/orders") public class AdminOrderController {
 private final AdminOrderService service;private final ManagerOrderQuery query;
 public AdminOrderController(AdminOrderService service,ManagerOrderQuery query){this.service=service;this.query=query;}
 @GetMapping public ManagerOrderQuery.Page<ManagerOrderQuery.View> list(@RequestParam(required=false)String status,@RequestParam(defaultValue="")String q,@RequestParam(required=false)String paymentStatus,@RequestParam(required=false)Boolean paymentReview,@RequestParam(required=false)Instant from,@RequestParam(required=false)Instant to,@RequestParam(defaultValue="createdAt")String sort,@RequestParam(defaultValue="DESC")String direction,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return query.list(new ManagerOrderQuery.Filter(status,q,paymentStatus,from,to,sort,direction,page,size,paymentReview));}
 @GetMapping("/summary") public Map<String,Long> summary(@RequestParam(defaultValue="")String q,@RequestParam(required=false)String paymentStatus,@RequestParam(required=false)Boolean paymentReview,@RequestParam(required=false)Instant from,@RequestParam(required=false)Instant to){return query.summary(new ManagerOrderQuery.Filter(null,q,paymentStatus,from,to,null,null,0,20,paymentReview));}
 @GetMapping("/{id}") public ManagerOrderQuery.View get(@PathVariable Long id){return query.detail(id);}
 public record SalespersonRequest(Long salespersonId) {}
 @PatchMapping("/{id}/salesperson") public ManagerOrderQuery.View assignSalesperson(@PathVariable Long id,@RequestBody SalespersonRequest request){service.assignSalesperson(id,request==null?null:request.salespersonId());return query.detail(id);}
 @PatchMapping("/{id}/status") public ManagerOrderQuery.View updateStatus(@PathVariable Long id,@Valid @RequestBody StatusRequest r){service.updateStatus(id,r);return query.detail(id);} }
