package com.htttdn.crm.service;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class ManagerEmployeeService {
    private final UserRepository users;

    public ManagerEmployeeService(UserRepository users) {
        this.users = users;
    }

    public Page<User> list(String q, int page, int size) {
        String query = q == null ? "" : q.trim();
        int pageNumber = Math.max(0, page);
        int pageSize = Math.max(1, Math.min(100, size));
        return users.findEmployeeDirectory(query, PageRequest.of(pageNumber, pageSize, Sort.by("id").descending()));
    }
}
