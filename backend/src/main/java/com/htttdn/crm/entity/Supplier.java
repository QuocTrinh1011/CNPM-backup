package com.htttdn.crm.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.Instant;

@Entity
@Table(name = "suppliers")
public class Supplier {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @NotBlank
  @Size(max = 40)
  @Column(unique = true, nullable = false, length = 40)
  public String code;

  @NotBlank
  @Size(max = 150)
  @Column(nullable = false, length = 150)
  public String name;

  @Email
  @Size(max = 255)
  public String email;

  @Size(max = 30)
  public String phone;

  @Size(max = 1000)
  @Column(length = 1000)
  public String address;

  @Size(max = 4000)
  @Column(length = 4000)
  public String notes;

  public boolean active = true;
  public Instant createdAt = Instant.now();
}
