package com.htttdn.crm.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "categories")
public class Category {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "category_id")
  private Long id;

  @Column(nullable = false, length = 100)
  private String name;

  public Category() {}

  public Long getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public void setName(String value) {
    name = value;
  }
}
