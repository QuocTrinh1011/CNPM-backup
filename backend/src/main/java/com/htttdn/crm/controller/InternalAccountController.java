package com.htttdn.crm.controller;
import com.htttdn.crm.service.InternalAccountService;
import com.htttdn.crm.entity.User;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
@RestController @RequestMapping("/api/admin/accounts")
public class InternalAccountController {
 private final InternalAccountService service;
 public InternalAccountController(InternalAccountService service){this.service=service;}
 @GetMapping public Page<User> list(@RequestParam(defaultValue="")String q,@RequestParam(defaultValue="all")String group,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return service.list(q,group,page,size);}
 @PostMapping public ResponseEntity<User> create(@Valid @RequestBody InternalAccountService.Input input){return ResponseEntity.status(201).body(service.create(input));}
 @PatchMapping("/{id}") public User update(@PathVariable Long id,@Valid @RequestBody InternalAccountService.Input input,@RequestHeader("Authorization")String auth){return service.update(id,input,auth);}
 @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id,@RequestHeader("Authorization")String auth){service.delete(id,auth);return ResponseEntity.noContent().build();}
}
