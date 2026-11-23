import React from 'react';
import { BadgePercent, Plus, Trash2 } from 'lucide-react';
import { blankInvoiceRule, blankProductRule, blankVoucherRule } from './promotionCampaignUtils';
import { ManagerDialog } from '../ManagerKit';

export function PromotionCampaignEditor({ editor, setEditor, editingId, setEditingId, saving, optionsError, saveCampaign, optionsLoading, products, vouchers, addRule, productNames, voucherCodes, updateRule, removeRule, formError }) {
  const close = () => {
    if (saving) return;
    setEditor(null);
    setEditingId(null);
  };
  return (
    <ManagerDialog
      open={!!editor}
      onClose={close}
      title={editingId === null ? 'Tạo chiến dịch mới' : 'Chỉnh sửa chiến dịch'}
      size="xl"
    >
      {editor && <form onSubmit={saveCampaign} className="promotion-editor-form">
        <span className="promotion-kicker"><BadgePercent size={15} /> CẤU HÌNH ƯU ĐÃI</span>
        {optionsError && <p className="promotion-error" role="alert">{optionsError}</p>}
        <fieldset disabled={saving} className="promotion-editor-fields">
          <div className="promotion-campaign-fields">
            <label>Mã chiến dịch<input required maxLength={40} value={editor.code} disabled={editingId !== null} onChange={event => setEditor(current => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="VD: TET2027" /></label>
            <label>Tên chiến dịch<input required maxLength={150} value={editor.name} onChange={event => setEditor(current => ({ ...current, name: event.target.value }))} placeholder="Tên chương trình khuyến mãi" /></label>
            <label>Ngày bắt đầu<input required type="date" value={editor.startDate} onChange={event => setEditor(current => ({ ...current, startDate: event.target.value }))} /></label>
            <label>Ngày kết thúc<input required type="date" min={editor.startDate || undefined} value={editor.endDate} onChange={event => setEditor(current => ({ ...current, endDate: event.target.value }))} /></label>
          </div>

          <section className="promotion-rule-group">
            <div className="promotion-rule-heading"><div><h4>Quy tắc theo sản phẩm</h4><p>Chọn sản phẩm và phần trăm giảm.</p></div><button type="button" className="admin-action" disabled={optionsLoading || products.length === 0} onClick={() => addRule('productRules', blankProductRule)}><Plus size={15} /> Thêm sản phẩm</button></div>
            {editor.productRules.length === 0 && <p className="promotion-rule-empty">Chưa thêm quy tắc sản phẩm.</p>}
            {editor.productRules.map((rule, index) => <div className="promotion-rule-row" key={`product-${index}`}>
              <label>Sản phẩm<select required value={rule.productId} onChange={event => updateRule('productRules', index, { productId: event.target.value })}><option value="">{optionsLoading ? 'Đang tải...' : 'Chọn sản phẩm'}</option>{rule.productId && !productNames.has(rule.productId) && <option value={rule.productId}>Sản phẩm #{rule.productId}</option>}{products.map(product => <option key={product.id} value={product.id} disabled={editor.productRules.some((other, otherIndex) => otherIndex !== index && other.productId === String(product.id))}>{product.name}</option>)}</select></label>
              <label>Giảm (%)<input required type="number" min="0.01" max="100" step="0.01" value={rule.discountPercent} onChange={event => updateRule('productRules', index, { discountPercent: event.target.value })} /></label>
              <button type="button" className="promotion-remove-rule" aria-label={`Xóa quy tắc sản phẩm ${index + 1}`} onClick={() => removeRule('productRules', index)}><Trash2 size={16} /></button>
            </div>)}
          </section>

          <section className="promotion-rule-group">
            <div className="promotion-rule-heading"><div><h4>Quy tắc theo hóa đơn</h4><p>Đặt ngưỡng hóa đơn tối thiểu và phần trăm giảm.</p></div><button type="button" className="admin-action" onClick={() => addRule('invoiceRules', blankInvoiceRule)}><Plus size={15} /> Thêm ngưỡng</button></div>
            {editor.invoiceRules.length === 0 && <p className="promotion-rule-empty">Chưa thêm quy tắc hóa đơn.</p>}
            {editor.invoiceRules.map((rule, index) => <div className="promotion-rule-row" key={`invoice-${index}`}>
              <label>Hóa đơn tối thiểu (đ)<input required type="number" min="0" step="0.01" value={rule.minimumInvoiceAmount} onChange={event => updateRule('invoiceRules', index, { minimumInvoiceAmount: event.target.value })} /></label>
              <label>Giảm (%)<input required type="number" min="0.01" max="100" step="0.01" value={rule.discountPercent} onChange={event => updateRule('invoiceRules', index, { discountPercent: event.target.value })} /></label>
              <button type="button" className="promotion-remove-rule" aria-label={`Xóa quy tắc hóa đơn ${index + 1}`} onClick={() => removeRule('invoiceRules', index)}><Trash2 size={16} /></button>
            </div>)}
          </section>

          <section className="promotion-rule-group">
            <div className="promotion-rule-heading"><div><h4>Quy tắc theo voucher</h4><p>Liên kết voucher hiện có với phần trăm ưu đãi.</p></div><button type="button" className="admin-action" disabled={optionsLoading || vouchers.length === 0} onClick={() => addRule('voucherRules', blankVoucherRule)}><Plus size={15} /> Thêm voucher</button></div>
            {editor.voucherRules.length === 0 && <p className="promotion-rule-empty">Chưa thêm quy tắc voucher.</p>}
            {editor.voucherRules.map((rule, index) => <div className="promotion-rule-row" key={`voucher-${index}`}>
              <label>Voucher<select required value={rule.voucherId} onChange={event => updateRule('voucherRules', index, { voucherId: event.target.value })}><option value="">{optionsLoading ? 'Đang tải...' : 'Chọn voucher'}</option>{rule.voucherId && !voucherCodes.has(rule.voucherId) && <option value={rule.voucherId}>Voucher #{rule.voucherId}</option>}{vouchers.map(voucher => <option key={voucher.id} value={voucher.id} disabled={editor.voucherRules.some((other, otherIndex) => otherIndex !== index && other.voucherId === String(voucher.id))}>{voucher.code}</option>)}</select></label>
              <label>Giảm (%)<input required type="number" min="0.01" max="100" step="0.01" value={rule.discountPercent} onChange={event => updateRule('voucherRules', index, { discountPercent: event.target.value })} /></label>
              <button type="button" className="promotion-remove-rule" aria-label={`Xóa quy tắc voucher ${index + 1}`} onClick={() => removeRule('voucherRules', index)}><Trash2 size={16} /></button>
            </div>)}
          </section>
        </fieldset>
        {formError && <p className="promotion-error" role="alert">{formError}</p>}
        <div className="admin-dialog-actions">
          <button type="button" className="admin-action" disabled={saving} onClick={close}>Hủy</button>
          <button type="submit" className="admin-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu chiến dịch'}</button>
        </div>
      </form>}
    </ManagerDialog>
  );
}
