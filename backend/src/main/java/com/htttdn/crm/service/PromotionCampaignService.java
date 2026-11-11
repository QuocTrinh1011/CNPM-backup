package com.htttdn.crm.service;

import com.htttdn.crm.entity.PromotionCampaign;
import com.htttdn.crm.entity.PromotionInvoiceRule;
import com.htttdn.crm.entity.PromotionProductRule;
import com.htttdn.crm.entity.PromotionVoucherRule;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.ProductRepository;
import com.htttdn.crm.repository.PromotionCampaignRepository;
import com.htttdn.crm.repository.PromotionInvoiceRuleRepository;
import com.htttdn.crm.repository.PromotionProductRuleRepository;
import com.htttdn.crm.repository.PromotionVoucherRuleRepository;
import com.htttdn.crm.repository.StoreVoucherRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class PromotionCampaignService extends AdminServiceSupport {
    private static final BigDecimal MAX_PERCENT = new BigDecimal("100.00");
    private static final BigDecimal MAX_INVOICE_AMOUNT = new BigDecimal("9999999999999.99");

    private final PromotionCampaignRepository campaigns;
    private final PromotionProductRuleRepository productRules;
    private final PromotionInvoiceRuleRepository invoiceRules;
    private final PromotionVoucherRuleRepository voucherRules;
    private final ProductRepository products;
    private final StoreVoucherRepository vouchers;

    public PromotionCampaignService(
            PromotionCampaignRepository campaigns,
            PromotionProductRuleRepository productRules,
            PromotionInvoiceRuleRepository invoiceRules,
            PromotionVoucherRuleRepository voucherRules,
            ProductRepository products,
            StoreVoucherRepository vouchers) {
        this.campaigns = campaigns;
        this.productRules = productRules;
        this.invoiceRules = invoiceRules;
        this.voucherRules = voucherRules;
        this.products = products;
        this.vouchers = vouchers;
    }

    @Transactional(readOnly = true)
    public Page<CampaignSummary> list(String search, int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw invalid("Phân trang không hợp lệ.");
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
        String term = search == null ? "" : search.trim();
        Page<PromotionCampaign> results = term.isEmpty()
                ? campaigns.findAll(pageable)
                : campaigns.findByCodeContainingIgnoreCaseOrNameContainingIgnoreCase(term, term, pageable);
        return results.map(this::summary);
    }

    @Transactional(readOnly = true)
    public CampaignDetail get(Long id) {
        return detail(campaign(id));
    }

    @Transactional
    public CampaignDetail create(CampaignWriteInput input) {
        ValidatedInput value = validate(input, null);
        if (campaigns.findByCodeIgnoreCase(value.code()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROMOTION_CODE_DUPLICATE", "Mã chiến dịch đã tồn tại.");
        }

        PromotionCampaign campaign = new PromotionCampaign();
        campaign.setCode(value.code());
        apply(campaign, value);
        campaigns.saveAndFlush(campaign);
        saveRules(campaign.getId(), value);

        CampaignDetail saved = detail(campaign);
        audit("CREATE", "PROMOTION_CAMPAIGN", campaign.getId(), Map.of(), auditSnapshot(saved));
        return saved;
    }

    @Transactional
    public CampaignDetail replace(Long id, CampaignWriteInput input) {
        PromotionCampaign campaign = campaigns.lockById(id).orElseThrow(PromotionCampaignService::notFound);
        ValidatedInput value = validate(input, campaign.getCode());
        CampaignDetail beforeDetail = detail(campaign);

        apply(campaign, value);
        campaigns.saveAndFlush(campaign);
        productRules.deleteByCampaignId(id);
        invoiceRules.deleteByCampaignId(id);
        voucherRules.deleteByCampaignId(id);
        saveRules(id, value);

        CampaignDetail saved = detail(campaign);
        audit("UPDATE", "PROMOTION_CAMPAIGN", id, AuditTrail.snapshot(auditSnapshot(beforeDetail)), auditSnapshot(saved));
        return saved;
    }

    @Transactional
    public void delete(Long id) {
        PromotionCampaign campaign = campaigns.lockById(id).orElseThrow(PromotionCampaignService::notFound);
        CampaignDetail beforeDetail = detail(campaign);
        campaigns.delete(campaign);
        audit("DELETE", "PROMOTION_CAMPAIGN", id, AuditTrail.snapshot(auditSnapshot(beforeDetail)), null);
    }

    private ValidatedInput validate(CampaignWriteInput input, String existingCode) {
        if (input == null) throw invalid("Vui lòng nhập thông tin chiến dịch.");

        String code = existingCode == null ? normalizeCode(input.code()) : existingCode;
        if (existingCode == null && code.isEmpty()) throw invalid("Vui lòng nhập mã chiến dịch.");
        if (existingCode != null && input.code() != null && !input.code().isBlank()
                && !normalizeCode(input.code()).equals(existingCode)) {
            throw invalid("Không được đổi mã chiến dịch đã tạo.");
        }
        if (code.length() > 40) throw invalid("Mã chiến dịch tối đa 40 ký tự.");

        String name = input.name() == null ? "" : input.name().trim();
        if (name.isEmpty()) throw invalid("Vui lòng nhập tên chiến dịch.");
        if (name.length() > 150) throw invalid("Tên chiến dịch tối đa 150 ký tự.");
        LocalDate startDate = input.startDate();
        LocalDate endDate = input.endDate();
        if (startDate == null || endDate == null) throw invalid("Vui lòng nhập ngày bắt đầu và ngày kết thúc.");
        if (endDate.isBefore(startDate)) throw invalid("Ngày kết thúc phải từ ngày bắt đầu trở đi.");

        List<ProductRuleInput> productsInput = input.productRules() == null ? List.of() : input.productRules();
        List<InvoiceRuleInput> invoicesInput = input.invoiceRules() == null ? List.of() : input.invoiceRules();
        List<VoucherRuleInput> vouchersInput = input.voucherRules() == null ? List.of() : input.voucherRules();
        validateProductRules(productsInput);
        validateInvoiceRules(invoicesInput);
        validateVoucherRules(vouchersInput);

        return new ValidatedInput(code, name, startDate, endDate,
                List.copyOf(productsInput), List.copyOf(invoicesInput), List.copyOf(vouchersInput));
    }

    private void validateProductRules(List<ProductRuleInput> values) {
        Set<Long> ids = new HashSet<>();
        for (ProductRuleInput value : values) {
            if (value == null || value.productId() == null || value.productId() < 1) {
                throw invalid("Vui lòng chọn sản phẩm cho từng quy tắc.");
            }
            validatePercent(value.discountPercent());
            if (!ids.add(value.productId())) throw invalid("Không được lặp sản phẩm trong cùng chiến dịch.");
        }
        if (products.findAllById(ids).size() != ids.size()) throw invalid("Có sản phẩm không tồn tại.");
    }

    private void validateInvoiceRules(List<InvoiceRuleInput> values) {
        Set<BigDecimal> thresholds = new HashSet<>();
        for (InvoiceRuleInput value : values) {
            if (value == null || value.minimumInvoiceAmount() == null
                    || value.minimumInvoiceAmount().signum() < 0
                    || value.minimumInvoiceAmount().compareTo(MAX_INVOICE_AMOUNT) > 0
                    || value.minimumInvoiceAmount().stripTrailingZeros().scale() > 2) {
                throw invalid("Ngưỡng hóa đơn phải là số tiền không âm, tối đa 2 chữ số thập phân.");
            }
            validatePercent(value.discountPercent());
            if (!thresholds.add(value.minimumInvoiceAmount().stripTrailingZeros())) {
                throw invalid("Không được lặp ngưỡng hóa đơn trong cùng chiến dịch.");
            }
        }
    }

    private void validateVoucherRules(List<VoucherRuleInput> values) {
        Set<Long> ids = new HashSet<>();
        for (VoucherRuleInput value : values) {
            if (value == null || value.voucherId() == null || value.voucherId() < 1) {
                throw invalid("Vui lòng chọn voucher cho từng quy tắc.");
            }
            validatePercent(value.discountPercent());
            if (!ids.add(value.voucherId())) throw invalid("Không được lặp voucher trong cùng chiến dịch.");
        }
        if (vouchers.findAllById(ids).size() != ids.size()) throw invalid("Có voucher không tồn tại.");
    }

    private static void validatePercent(BigDecimal value) {
        if (value == null || value.signum() <= 0 || value.compareTo(MAX_PERCENT) > 0
                || value.stripTrailingZeros().scale() > 2) {
            throw invalid("Phần trăm giảm phải lớn hơn 0, tối đa 100 và không quá 2 chữ số thập phân.");
        }
    }

    private void apply(PromotionCampaign campaign, ValidatedInput value) {
        campaign.setCode(value.code());
        campaign.setName(value.name());
        campaign.setStartDate(value.startDate());
        campaign.setEndDate(value.endDate());
    }

    private void saveRules(Long campaignId, ValidatedInput value) {
        List<PromotionProductRule> productEntities = new ArrayList<>();
        for (ProductRuleInput input : value.productRules()) {
            PromotionProductRule rule = new PromotionProductRule();
            rule.setCampaignId(campaignId);
            rule.setProductId(input.productId());
            rule.setDiscountPercent(input.discountPercent());
            productEntities.add(rule);
        }
        productRules.saveAll(productEntities);

        List<PromotionInvoiceRule> invoiceEntities = new ArrayList<>();
        for (InvoiceRuleInput input : value.invoiceRules()) {
            PromotionInvoiceRule rule = new PromotionInvoiceRule();
            rule.setCampaignId(campaignId);
            rule.setMinimumInvoiceAmount(input.minimumInvoiceAmount());
            rule.setDiscountPercent(input.discountPercent());
            invoiceEntities.add(rule);
        }
        invoiceRules.saveAll(invoiceEntities);

        List<PromotionVoucherRule> voucherEntities = new ArrayList<>();
        for (VoucherRuleInput input : value.voucherRules()) {
            PromotionVoucherRule rule = new PromotionVoucherRule();
            rule.setCampaignId(campaignId);
            rule.setVoucherId(input.voucherId());
            rule.setDiscountPercent(input.discountPercent());
            voucherEntities.add(rule);
        }
        voucherRules.saveAll(voucherEntities);
    }

    private CampaignDetail detail(PromotionCampaign campaign) {
        List<ProductRuleView> productViews = productRules.findByCampaignIdOrderByIdAsc(campaign.getId()).stream()
                .map(rule -> new ProductRuleView(rule.getId(), rule.getProductId(), rule.getDiscountPercent())).toList();
        List<InvoiceRuleView> invoiceViews = invoiceRules.findByCampaignIdOrderByIdAsc(campaign.getId()).stream()
                .map(rule -> new InvoiceRuleView(rule.getId(), rule.getMinimumInvoiceAmount(), rule.getDiscountPercent())).toList();
        List<VoucherRuleView> voucherViews = voucherRules.findByCampaignIdOrderByIdAsc(campaign.getId()).stream()
                .map(rule -> new VoucherRuleView(rule.getId(), rule.getVoucherId(), rule.getDiscountPercent())).toList();
        return new CampaignDetail(campaign.getId(), campaign.getCode(), campaign.getName(), campaign.getStartDate(),
                campaign.getEndDate(), productViews, invoiceViews, voucherViews);
    }

    private CampaignSummary summary(PromotionCampaign campaign) {
        return new CampaignSummary(campaign.getId(), campaign.getCode(), campaign.getName(), campaign.getStartDate(),
                campaign.getEndDate(), productRules.countByCampaignId(campaign.getId()),
                invoiceRules.countByCampaignId(campaign.getId()), voucherRules.countByCampaignId(campaign.getId()));
    }

    private AuditTrail.PromotionCampaignSnapshot auditSnapshot(CampaignDetail detail) {
        return new AuditTrail.PromotionCampaignSnapshot(detail.id(), detail.code(), detail.name(), detail.startDate(),
                detail.endDate(),
                detail.productRules().stream().map(rule -> new AuditTrail.PromotionProductRuleSnapshot(
                        rule.productId(), rule.discountPercent())).toList(),
                detail.invoiceRules().stream().map(rule -> new AuditTrail.PromotionInvoiceRuleSnapshot(
                        rule.minimumInvoiceAmount(), rule.discountPercent())).toList(),
                detail.voucherRules().stream().map(rule -> new AuditTrail.PromotionVoucherRuleSnapshot(
                        rule.voucherId(), rule.discountPercent())).toList());
    }

    private PromotionCampaign campaign(Long id) {
        return campaigns.findById(id).orElseThrow(PromotionCampaignService::notFound);
    }

    private static String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "PROMOTION_VALIDATION", message);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "PROMOTION_NOT_FOUND", "Không tìm thấy chiến dịch.");
    }

    private record ValidatedInput(String code, String name, LocalDate startDate, LocalDate endDate,
                                  List<ProductRuleInput> productRules, List<InvoiceRuleInput> invoiceRules,
                                  List<VoucherRuleInput> voucherRules) {}

    public record ProductRuleInput(Long productId, BigDecimal discountPercent) {}
    public record InvoiceRuleInput(BigDecimal minimumInvoiceAmount, BigDecimal discountPercent) {}
    public record VoucherRuleInput(Long voucherId, BigDecimal discountPercent) {}
    public record CampaignWriteInput(String code, String name, LocalDate startDate, LocalDate endDate,
                                     List<ProductRuleInput> productRules, List<InvoiceRuleInput> invoiceRules,
                                     List<VoucherRuleInput> voucherRules) {}
    public record ProductRuleView(Long id, Long productId, BigDecimal discountPercent) {}
    public record InvoiceRuleView(Long id, BigDecimal minimumInvoiceAmount, BigDecimal discountPercent) {}
    public record VoucherRuleView(Long id, Long voucherId, BigDecimal discountPercent) {}
    public record CampaignSummary(Long id, String code, String name, LocalDate startDate, LocalDate endDate,
                                  long productRuleCount, long invoiceRuleCount, long voucherRuleCount) {}
    public record CampaignDetail(Long id, String code, String name, LocalDate startDate, LocalDate endDate,
                                 List<ProductRuleView> productRules, List<InvoiceRuleView> invoiceRules,
                                 List<VoucherRuleView> voucherRules) {}
}
