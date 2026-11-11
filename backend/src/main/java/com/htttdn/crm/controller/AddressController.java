package com.htttdn.crm.controller;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.CustomerAddressRepository;
import com.htttdn.crm.service.AuthService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers/me/addresses")
public class AddressController {
  private final AuthService auth;
  private final CustomerAddressRepository addresses;

  public AddressController(AuthService auth, CustomerAddressRepository addresses) {
    this.auth = auth;
    this.addresses = addresses;
  }

  @GetMapping
  public List<AddressView> list(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    return addresses
        .findByCustomerIdOrderByDefaultAddressDescUpdatedAtDesc(
            auth.requireCustomer(authorization).getId())
        .stream()
        .map(this::view)
        .toList();
  }

  @PostMapping
  @Transactional
  public ResponseEntity<AddressView> create(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody AddressRequest request) {
    User customer = auth.requireCustomer(authorization);
    CustomerAddress address = new CustomerAddress();
    address.setCustomer(customer);
    copy(address, request);
    if (request.defaultAddress() || addresses.findByCustomerId(customer.getId()).isEmpty())
      makeDefault(customer.getId(), address);
    return ResponseEntity.status(HttpStatus.CREATED).body(view(addresses.save(address)));
  }

  @PutMapping("/{id}")
  @Transactional
  public AddressView update(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id,
      @Valid @RequestBody AddressRequest request) {
    User customer = auth.requireCustomer(authorization);
    CustomerAddress address = get(customer.getId(), id);
    copy(address, request);
    address.setUpdatedAt(Instant.now());
    if (request.defaultAddress()) makeDefault(customer.getId(), address);
    return view(addresses.save(address));
  }

  @DeleteMapping("/{id}")
  @Transactional
  public ResponseEntity<Void> delete(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id) {
    User customer = auth.requireCustomer(authorization);
    CustomerAddress address = get(customer.getId(), id);
    boolean wasDefault = address.isDefaultAddress();
    addresses.delete(address);
    if (wasDefault)
      addresses.findByCustomerIdOrderByDefaultAddressDescUpdatedAtDesc(customer.getId()).stream()
          .findFirst()
          .ifPresent(
              x -> {
                x.setDefaultAddress(true);
                addresses.save(x);
              });
    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/{id}/default")
  @Transactional
  public AddressView makeDefaultEndpoint(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id) {
    User customer = auth.requireCustomer(authorization);
    CustomerAddress address = get(customer.getId(), id);
    makeDefault(customer.getId(), address);
    return view(addresses.save(address));
  }

  private CustomerAddress get(Long customerId, Long id) {
    return addresses
        .findByIdAndCustomerId(id, customerId)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "ADDRESS_NOT_FOUND", "Không tìm thấy địa chỉ."));
  }

  private void copy(CustomerAddress a, AddressRequest r) {
    a.setLabel(clean(r.label()));
    a.setRecipientName(r.recipientName().trim());
    a.setPhone(r.phone().trim());
    a.setAddressLine(r.addressLine().trim());
    a.setWard(clean(r.ward()));
    a.setDistrict(clean(r.district()));
    a.setProvince(clean(r.province()));
    a.setDefaultAddress(r.defaultAddress());
  }

  private void makeDefault(Long customerId, CustomerAddress selected) {
    addresses
        .findByCustomerId(customerId)
        .forEach(
            x -> {
              if (x != selected && x.isDefaultAddress()) {
                x.setDefaultAddress(false);
                addresses.save(x);
              }
            });
    selected.setDefaultAddress(true);
  }

  private String clean(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private AddressView view(CustomerAddress a) {
    return new AddressView(
        a.getId(),
        a.getLabel(),
        a.getRecipientName(),
        a.getPhone(),
        a.getAddressLine(),
        a.getWard(),
        a.getDistrict(),
        a.getProvince(),
        a.isDefaultAddress());
  }

  public record AddressRequest(
      @Size(max = 80) String label,
      @NotBlank @Size(max = 150) String recipientName,
      @NotBlank @Size(max = 40) String phone,
      @NotBlank @Size(max = 500) String addressLine,
      @Size(max = 100) String ward,
      @Size(max = 100) String district,
      @Size(max = 100) String province,
      boolean defaultAddress) {}

  public record AddressView(
      Long id,
      String label,
      String recipientName,
      String phone,
      String addressLine,
      String ward,
      String district,
      String province,
      boolean defaultAddress) {}
}
