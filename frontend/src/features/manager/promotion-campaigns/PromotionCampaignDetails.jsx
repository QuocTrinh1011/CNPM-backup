import React from 'react';
import { BadgePercent, X } from 'lucide-react';
import { dateLabel, money, percentLabel } from './promotionCampaignUtils';

export function PromotionCampaignDetails({ detailId, closeDetail, detailLoading, detailError, detail, productNames, voucherCodes }) {
  return (
    <>
    {detailId !== null && <div className="admin-dialog-backdrop promotion-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) closeDetail(); }}>
      <section className="admin-dialog promotion-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-detail-title">
        <div className="promotion-dialog-heading"><div><span className="promotion-kicker"><BadgePercent size={15} /> CHI TIẾT CHIẾN DỊCH</span><h3 id="promotion-detail-title">{detail?.name || 'Thông tin chiến dịch'}</h3></div><button type="button" className="admin-action" aria-label="Đóng" onClick={closeDetail}><X size={17} /></button></div>
        {detailLoading && <p role="status">Đang tải chi tiết...</p>}
        {detailError && <p className="promotion-error" role="alert">{detailError}</p>}
        {detail && <>
          <div className="promotion-detail-meta"><span><small>Mã chiến dịch</small><b>{detail.code}</b></span><span><small>Thời gian</small><b>{dateLabel(detail.startDate)} – {dateLabel(detail.endDate)}</b></span></div>
          <div className="promotion-detail-groups">
            <section><h4>Sản phẩm</h4>{detail.productRules.length ? <ul>{detail.productRules.map(rule => <li key={rule.id}><span>{productNames.get(String(rule.productId)) || `Sản phẩm #${rule.productId}`}</span><b>{percentLabel(rule.discountPercent)}</b></li>)}</ul> : <p>Không có quy tắc.</p>}</section>
            <section><h4>Hóa đơn</h4>{detail.invoiceRules.length ? <ul>{detail.invoiceRules.map(rule => <li key={rule.id}><span>Từ {money(rule.minimumInvoiceAmount)}</span><b>{percentLabel(rule.discountPercent)}</b></li>)}</ul> : <p>Không có quy tắc.</p>}</section>
            <section><h4>Voucher</h4>{detail.voucherRules.length ? <ul>{detail.voucherRules.map(rule => <li key={rule.id}><span>{voucherCodes.get(String(rule.voucherId)) || `Voucher #${rule.voucherId}`}</span><b>{percentLabel(rule.discountPercent)}</b></li>)}</ul> : <p>Không có quy tắc.</p>}</section>
          </div>
        </>}
      </section>
    </div>}
    </>
  );
}
