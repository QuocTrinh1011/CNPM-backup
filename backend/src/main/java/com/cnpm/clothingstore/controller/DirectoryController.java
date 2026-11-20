package com.cnpm.clothingstore.controller;
import com.cnpm.clothingstore.service.DirectoryService;
import com.cnpm.clothingstore.entity.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.Map;
@RestController
public class DirectoryController {
 private final DirectoryService service;public DirectoryController(DirectoryService service){this.service=service;}
 @GetMapping("/api/admin/overview")public Map<String,Long> overview(){return service.overview();}
 @GetMapping("/api/admin/products") public Page<Product> products(@RequestParam(defaultValue="")String q,@RequestParam(defaultValue="")String category,@RequestParam(required=false)Long supplierId,@RequestParam(required=false)BigDecimal minPrice,@RequestParam(required=false)BigDecimal maxPrice,@RequestParam(defaultValue="")String stock,@RequestParam(required=false)Boolean active,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,@RequestParam(defaultValue="createdAt")String sort,@RequestParam(defaultValue="true")boolean desc){return service.products(q,category,supplierId,minPrice,maxPrice,stock,active,page,size,sort,desc);}
 @GetMapping({"/api/admin/suppliers","/api/manager/suppliers"}) public Page<Supplier> suppliers(@RequestParam(defaultValue="")String q,@RequestParam(required=false)Boolean active,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,@RequestParam(defaultValue="name")String sort,@RequestParam(defaultValue="false")boolean desc){return service.suppliers(q,active,page,size,sort,desc);}
 @PostMapping("/api/manager/suppliers") @ResponseStatus(org.springframework.http.HttpStatus.CREATED) public Supplier create(@Valid @RequestBody Supplier input){return service.save(null,input);}
 @PutMapping("/api/manager/suppliers/{id}") public Supplier update(@PathVariable Long id,@Valid @RequestBody Supplier input){return service.save(id,input);}
 @PatchMapping("/api/manager/products/{id}/supplier") public Product assign(@PathVariable Long id,@Valid @RequestBody Assignment input){return service.assign(id,input.supplierId());}
 public record Assignment(@NotNull Long supplierId){}
}
