import React from 'react';
import { BadgePercent, ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { dateLabel } from './promotionCampaignUtils';

export function PromotionCampaignList({ campaigns, setPage, totalPages, searchText, setSearchText, search, listLoading, listError, notice, searchCampaigns, openCreate, openDetail, openEdit, saving, deletingId, deleteCampaign, currentPage }) {
  return (
    <>
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
    </>
  );
}
