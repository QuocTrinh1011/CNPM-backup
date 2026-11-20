import React from 'react';
import { usePromotionCampaigns } from './promotion-campaigns/usePromotionCampaigns';
import { PromotionCampaignList } from './promotion-campaigns/PromotionCampaignList';
import { PromotionCampaignEditor } from './promotion-campaigns/PromotionCampaignEditor';
import { PromotionCampaignDetails } from './promotion-campaigns/PromotionCampaignDetails';
import './promotion-campaigns.css';

export default function PromotionCampaigns() {
  const campaignState = usePromotionCampaigns();
  const {
    campaigns, setPage, totalPages, searchText, setSearchText, search,
    listLoading, listError, notice, products, vouchers,
    optionsLoading, optionsError, editor, setEditor, editingId, setEditingId,
    formError, saving, detailId, detail, detailLoading, detailError, deletingId,
    closeDetail, productNames, voucherCodes, searchCampaigns, openCreate,
    openEdit, openDetail, updateRule, addRule, removeRule, saveCampaign,
    deleteCampaign, currentPage,
  } = campaignState;

  return (
    <section className="admin-panel promotion-campaigns">
      <PromotionCampaignList
        campaigns={campaigns}
        setPage={setPage}
        totalPages={totalPages}
        searchText={searchText}
        setSearchText={setSearchText}
        search={search}
        listLoading={listLoading}
        listError={listError}
        notice={notice}
        searchCampaigns={searchCampaigns}
        openCreate={openCreate}
        openDetail={openDetail}
        openEdit={openEdit}
        saving={saving}
        deletingId={deletingId}
        deleteCampaign={deleteCampaign}
        currentPage={currentPage}
      />
      <PromotionCampaignEditor
        editor={editor}
        setEditor={setEditor}
        editingId={editingId}
        setEditingId={setEditingId}
        saving={saving}
        optionsError={optionsError}
        saveCampaign={saveCampaign}
        optionsLoading={optionsLoading}
        products={products}
        vouchers={vouchers}
        addRule={addRule}
        productNames={productNames}
        voucherCodes={voucherCodes}
        updateRule={updateRule}
        removeRule={removeRule}
        formError={formError}
      />
      <PromotionCampaignDetails
        detailId={detailId}
        closeDetail={closeDetail}
        detailLoading={detailLoading}
        detailError={detailError}
        detail={detail}
        productNames={productNames}
        voucherCodes={voucherCodes}
      />
    </section>
  );
}
