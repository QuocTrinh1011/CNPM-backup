package com.htttdn.crm.controller;

import com.htttdn.crm.service.PromotionCampaignService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/promotions")
public class PromotionCampaignController {
    private final PromotionCampaignService service;

    public PromotionCampaignController(PromotionCampaignService service) {
        this.service = service;
    }

    @GetMapping
    public Page<PromotionCampaignService.CampaignSummary> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(search, page, size);
    }

    @GetMapping("/{id}")
    public PromotionCampaignService.CampaignDetail get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PromotionCampaignService.CampaignDetail create(
            @RequestBody PromotionCampaignService.CampaignWriteInput input) {
        return service.create(input);
    }

    @PutMapping("/{id}")
    public PromotionCampaignService.CampaignDetail replace(
            @PathVariable Long id,
            @RequestBody PromotionCampaignService.CampaignWriteInput input) {
        return service.replace(id, input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
