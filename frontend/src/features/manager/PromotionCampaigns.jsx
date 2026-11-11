import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgePercent, Eye, Pencil, Plus, Search, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import './promotion-campaigns.css';

const PAGE_SIZE = 10;
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value || 0));
const dateLabel = value => {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const percentLabel = value => `${Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
const blankCampaign = () => ({ code: '', name: '', startDate: '', endDate: '', productRules: [], invoiceRules: [], voucherRules: [] });
const blankProductRule = () => ({ productId: '', discountPercent: '' });
const blankInvoiceRule = () => ({ minimumInvoiceAmount: '', discountPercent: '' });
const blankVoucherRule = () => ({ voucherId: '', discountPercent: '' });
async function readAllPages(loadPage) {
  const first = await loadPage(0);
  const records = [...(first.content || [])];
  for (let page = 1; page < (first.totalPages || 0); page += 1) {
    const next = await loadPage(page);
    records.push(...(next.content || []));
  }
  return records;
}

function toForm(campaign) {
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

export default function PromotionCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [products, setProducts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [editor, setEditor] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const saveLock = useRef(false);
  const detailRequest = useRef(0);

  const closeDetail = useCallback(() => {
    detailRequest.current += 1;
    setDetailId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError('');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true);
    setListError('');
    adminApi(adminEndpoints.promotions({ search, page, size: PAGE_SIZE }), { signal: controller.signal })
      .then(result => {
        setCampaigns(result.content || []);
        setTotalPages(result.totalPages || 0);
        if ((result.totalPages || 0) > 0 && page >= result.totalPages) setPage(result.totalPages - 1);
      })
      .catch(error => { if (error.name !== 'AbortError') setListError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [page, search, revision]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      readAllPages(page => adminApi(adminEndpoints.products({ page, size: 100, active: 'ALL' }))),
      readAllPages(page => adminApi(`/api/manager/vouchers?page=${page}&size=100`)),
    ]).then(([productResult, voucherResult]) => {
      if (!active) return;
      const failures = [];
      if (productResult.status === 'fulfilled') setProducts(productResult.value);
      else failures.push(`Không tải được danh sách sản phẩm: ${productResult.reason.message}`);
      if (voucherResult.status === 'fulfilled') setVouchers(voucherResult.value);
      else failures.push(`Không tải được danh sách voucher: ${voucherResult.reason.message}`);
      setOptionsError(failures.join(' '));
    }).finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!editor && detailId === null) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape' && !saving && deletingId === null) {
        setEditor(null);
        setEditingId(null);
        closeDetail();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, detailId, saving, deletingId, closeDetail]);

  useEffect(() => () => { detailRequest.current += 1; }, []);

  const productNames = useMemo(() => new Map(products.map(product => [String(product.id), product.name])), [products]);
  const voucherCodes = useMemo(() => new Map(vouchers.map(voucher => [String(voucher.id), voucher.code])), [vouchers]);

  const searchCampaigns = event => {
    event.preventDefault();
    setPage(0);
    setSearch(searchText.trim());
  };

  const openCreate = () => {
    setEditingId(null);
    setFormError('');
    setEditor(blankCampaign());
  };

  const openEdit = async campaign => {
    setFormError('');
    setListError('');
    setSaving(true);
    try {
      const result = await adminApi(adminEndpoints.promotion(campaign.id));
      setEditingId(result.id);
      setEditor(toForm(result));
    } catch (error) {
      setListError(error.message);
    } finally { setSaving(false); }
  };

  const openDetail = async id => {
    const requestId = detailRequest.current + 1;
    detailRequest.current = requestId;
    setDetailId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const result = await adminApi(adminEndpoints.promotion(id));
      if (requestId === detailRequest.current) setDetail(result);
    } catch (error) {
      if (requestId === detailRequest.current) setDetailError(error.message);
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  };

  const updateRule = (key, index, patch) => setEditor(current => ({
    ...current,
    [key]: current[key].map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule),
  }));
  const addRule = (key, makeRule) => setEditor(current => ({ ...current, [key]: [...current[key], makeRule()] }));
  const removeRule = (key, index) => setEditor(current => ({ ...current, [key]: current[key].filter((_, ruleIndex) => ruleIndex !== index) }));

  const saveCampaign = async event => {
    event.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setFormError('');
    setNotice('');
    const payload = {
      code: editor.code.trim().toUpperCase(),
      name: editor.name.trim(),
      startDate: editor.startDate,
      endDate: editor.endDate,
      productRules: editor.productRules.map(rule => ({ productId: Number(rule.productId), discountPercent: Number(rule.discountPercent) })),
      invoiceRules: editor.invoiceRules.map(rule => ({ minimumInvoiceAmount: Number(rule.minimumInvoiceAmount), discountPercent: Number(rule.discountPercent) })),
      voucherRules: editor.voucherRules.map(rule => ({ voucherId: Number(rule.voucherId), discountPercent: Number(rule.discountPercent) })),
    };
    try {
      const url = editingId === null ? adminEndpoints.createPromotion() : adminEndpoints.updatePromotion(editingId);
      await adminApi(url, { method: editingId === null ? 'POST' : 'PUT', body: payload });
      setEditor(null);
      setEditingId(null);
      setNotice(editingId === null ? 'Đã tạo chiến dịch khuyến mãi.' : 'Đã cập nhật chiến dịch khuyến mãi.');
      setRevision(value => value + 1);
    } catch (error) { setFormError(error.message); }
    finally { saveLock.current = false; setSaving(false); }
  };

  const deleteCampaign = async campaign => {
    if (!window.confirm(`Xóa chiến dịch “${campaign.name}” và toàn bộ quy tắc của chiến dịch này?`)) return;
    setDeletingId(campaign.id);
    setListError('');
    setNotice('');
    try {
      await adminApi(adminEndpoints.deletePromotion(campaign.id), { method: 'DELETE' });
      setNotice(`Đã xóa chiến dịch ${campaign.code}.`);
      if (campaigns.length === 1 && page > 0) setPage(value => value - 1);
      setRevision(value => value + 1);
    } catch (error) { setListError(error.message); }
    finally { setDeletingId(null); }
  };

  const currentPage = totalPages === 0 ? 0 : Math.min(page, totalPages - 1);

  return <section className="admin-panel promotion-campaigns">
    <div className="promotion-page-heading">
      <div><span className="promotion-kicker"><BadgePercent size={15} /> ƯU ĐÃI CỬA HÀNG</span><h2>Chiến dịch khuyến mãi</h2><p>Quản lý chiến dịch và các quy tắc theo sản phẩm, hóa đơn hoặc voucher.</p></div>
      <button type="button" className="admin-primary" onClick={openCreate}><Plus size={16} /> Tạo chiến dịch</button>
    </div>

    {notice && <p className="promotion-notice" role="status">{notice}</p>}
    <div className="promotion-toolbar">
      <form className="promotion-search" onSubmit={searchCampaigns}>
        <Search size={17} aria-hidden="true" />
        <input aria-label="Tìm chiến dịch" placeholder="Tìm theo mã hoặc tên chiến dịch..." value={searchText} onChange={event => setSearchText(event.target.value)} />
        <button type="submit" className="admin-action">Tìm</button>
      </form>
      <span>{listLoading ? 'Đang tải...' : `${campaigns.length} chiến dịch trên trang`}</span>
    </div>
    {listError && <p className="promotion-error" role="alert">{listError}</p>}

    <div className="promotion-table-wrap">
      <table className="promotion-table">
        <thead><tr><th>Chiến dịch</th><th>Thời gian</th><th>Quy tắc</th><th>Thao tác</th></tr></thead>
        <tbody>
          {listLoading && campaigns.length === 0 && <tr><td colSpan="4"><p className="promotion-empty" role="status">Đang tải chiến dịch...</p></td></tr>}
          {!listLoading && campaigns.length === 0 && <tr><td colSpan="4"><p className="promotion-empty">{search ? 'Không tìm thấy chiến dịch phù hợp.' : 'Chưa có chiến dịch khuyến mãi.'}</p></td></tr>}
          {campaigns.map(campaign => <tr key={campaign.id}>
            <td><strong>{campaign.name}</strong><small className="promotion-code">{campaign.code}</small></td>
            <td>{dateLabel(campaign.startDate)} – {dateLabel(campaign.endDate)}</td>
            <td><div className="promotion-counts"><span>SP {campaign.productRuleCount}</span><span>Hóa đơn {campaign.invoiceRuleCount}</span><span>Voucher {campaign.voucherRuleCount}</span></div></td>
            <td><div className="promotion-row-actions">
              <button type="button" className="admin-action" aria-label={`Xem ${campaign.name}`} title="Xem chi tiết" onClick={() => openDetail(campaign.id)}><Eye size={15} /></button>
              <button type="button" className="admin-action" aria-label={`Sửa ${campaign.name}`} title="Chỉnh sửa" disabled={saving || deletingId !== null} onClick={() => openEdit(campaign)}><Pencil size={15} /></button>
              <button type="button" className="admin-action promotion-delete" aria-label={`Xóa ${campaign.name}`} title="Xóa chiến dịch" disabled={deletingId !== null} onClick={() => deleteCampaign(campaign)}><Trash2 size={15} /></button>
            </div></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="promotion-pagination"><span>{totalPages ? `Trang ${currentPage + 1} / ${totalPages}` : 'Trang 0 / 0'}</span><div><button type="button" className="admin-action" aria-label="Trang trước" disabled={currentPage <= 0 || listLoading} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={16} /> Trước</button><button type="button" className="admin-action" aria-label="Trang sau" disabled={!totalPages || currentPage >= totalPages - 1 || listLoading} onClick={() => setPage(value => Math.min(totalPages - 1, value + 1))}>Sau <ChevronRight size={16} /></button></div></div>

    {editor && <div className="admin-dialog-backdrop promotion-backdrop" onMouseDown={event => { if (event.currentTarget === event.target && !saving) { setEditor(null); setEditingId(null); } }}>
      <section className="admin-dialog promotion-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-editor-title">
        <div className="promotion-dialog-heading"><div><span className="promotion-kicker"><BadgePercent size={15} /> CẤU HÌNH ƯU ĐÃI</span><h3 id="promotion-editor-title">{editingId === null ? 'Tạo chiến dịch mới' : 'Chỉnh sửa chiến dịch'}</h3></div><button type="button" className="admin-action" aria-label="Đóng" disabled={saving} onClick={() => { setEditor(null); setEditingId(null); }}><X size={17} /></button></div>
        {optionsError && <p className="promotion-error" role="alert">{optionsError}</p>}
        <form onSubmit={saveCampaign}>
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
          <div className="admin-dialog-actions promotion-dialog-actions"><button type="button" className="admin-action" disabled={saving} onClick={() => { setEditor(null); setEditingId(null); }}>Hủy</button><button type="submit" className="admin-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu chiến dịch'}</button></div>
        </form>
      </section>
    </div>}

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
  </section>;
}
