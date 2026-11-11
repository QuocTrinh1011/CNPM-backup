package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.StoreVoucherRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SurveyRewardService {
  private final StoreVoucherRepository vouchers;
  private final NotificationService notifications;

  public SurveyRewardService(StoreVoucherRepository vouchers, NotificationService notifications) {
    this.vouchers = vouchers;
    this.notifications = notifications;
  }

  public static void validate(SurveyReward r) {
    if (r == null || !r.isEnabled()) return;
    if (r.getValidDays() == null || r.getValidDays() < 1)
      throw SurveyValidation.invalid("Thời hạn voucher phải là số ngày nguyên dương.");
    AdminVoucherService.apply(new StoreVoucher(), input(r, "VALIDATE", Instant.now()));
  }

  private static AdminVoucherService.Input input(SurveyReward r, String code, Instant now) {
    return new AdminVoucherService.Input(
        code,
        "Phần thưởng hoàn thành khảo sát",
        r.getDiscountType(),
        r.getDiscountValue(),
        r.getMinOrderAmount(),
        r.getMaxDiscountAmount(),
        1,
        now,
        now.plus(r.getValidDays(), ChronoUnit.DAYS),
        true);
  }

  // Caller holds the survey lock and persists the response in this same transaction.
  @Transactional
  public StoreVoucher grant(Survey survey, User customer) {
    SurveyReward r = survey.getReward();
    if (r == null || !r.isEnabled()) return null;
    validate(r);
    StoreVoucher v = new StoreVoucher();
    AdminVoucherService.apply(
        v,
        input(
            r, "KS-" + UUID.randomUUID().toString().replace("-", "").toUpperCase(), Instant.now()));
    v.setOwnerCustomerId(customer.getId());
    v.setRewardSurveyId(survey.getId());
    v.setPerCustomerLimit(1);
    vouchers.saveAndFlush(v);
    notifications.create(
        customer,
        "Bạn nhận được voucher khảo sát",
        "Mã " + v.getCode() + " đã được thêm vào Voucher của tôi.",
        "SURVEY_REWARD",
        survey.getId());
    return v;
  }
}
