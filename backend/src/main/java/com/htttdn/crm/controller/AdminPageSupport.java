package com.htttdn.crm.controller;

import org.springframework.data.domain.*;

abstract class AdminPageSupport {
  protected Pageable page(int number, int size) {
    return PageRequest.of(
        Math.max(0, number), Math.min(100, Math.max(1, size)), Sort.by("id").descending());
  }
}
