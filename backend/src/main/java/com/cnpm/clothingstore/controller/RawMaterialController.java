package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.service.RawMaterialService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/raw-materials")
public class RawMaterialController {
    private final RawMaterialService materials;

    public RawMaterialController(RawMaterialService materials) { this.materials = materials; }

    @GetMapping
    public List<RawMaterialService.View> list() { return materials.list(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RawMaterialService.View create(@Valid @RequestBody RawMaterialService.CreateRequest request) {
        return materials.create(request);
    }

    @PutMapping("/{id}")
    public RawMaterialService.View update(@PathVariable Long id,
                                          @Valid @RequestBody RawMaterialService.UpdateRequest request) {
        return materials.update(id, request);
    }
}
