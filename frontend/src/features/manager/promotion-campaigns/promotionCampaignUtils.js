export const PAGE_SIZE = 10;
export const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value || 0));
export const dateLabel = value => {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};
export const percentLabel = value => `${Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
export const blankCampaign = () => ({ code: '', name: '', startDate: '', endDate: '', productRules: [], invoiceRules: [], voucherRules: [] });
export const blankProductRule = () => ({ productId: '', discountPercent: '' });
export const blankInvoiceRule = () => ({ minimumInvoiceAmount: '', discountPercent: '' });
export const blankVoucherRule = () => ({ voucherId: '', discountPercent: '' });
export async function readAllPages(loadPage) {
  const first = await loadPage(0);
  const records = [...(first.content || [])];
  for (let page = 1; page < (first.totalPages || 0); page += 1) {
    const next = await loadPage(page);
    records.push(...(next.content || []));
  }
  return records;
}

export function toForm(campaign) {
  return {
    code: campaign.code || '',
    name: campaign.name || '',
    startDate: campaign.startDate || '',
    endDate: campaign.endDate || '',
    productRules: (campaign.productRules || []).map(rule => ({ productId: String(rule.productId), discountPercent: String(rule.discountPercent) })),
    invoiceRules: (campaign.invoiceRules || []).map(rule => ({ minimumInvoiceAmount: String(rule.minimumInvoiceAmount), discountPercent: String(rule.discountPercent) })),
    voucherRules: (campaign.voucherRules || []).map(rule => ({ voucherId: String(rule.voucherId), discountPercent: String(rule.discountPercent) })),
  };
}
