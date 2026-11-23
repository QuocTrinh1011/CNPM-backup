import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, adminEndpoints } from '../../../api/manager-api';
import { PAGE_SIZE, blankCampaign, readAllPages, toForm } from './promotionCampaignUtils';

export function usePromotionCampaigns() {
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
  return {
    campaigns, page, setPage, totalPages, searchText, setSearchText, search,
    listLoading, listError, setListError, notice, products, vouchers,
    optionsLoading, optionsError, editor, setEditor, editingId, setEditingId,
    formError, saving, detailId, detail, detailLoading, detailError, deletingId,
    closeDetail, productNames, voucherCodes, searchCampaigns, openCreate,
    openEdit, openDetail, updateRule, addRule, removeRule, saveCampaign,
    deleteCampaign, currentPage,
  };
}
