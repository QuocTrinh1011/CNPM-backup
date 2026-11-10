import React,{useCallback,useEffect,useState} from 'react';
import {adminApi} from '../../api/api';
import {useManagerFilters,managerQuery,vietnamDateRange} from '../../shared/hooks/useManagerFilters';
import './audit-logs.css';

const types={ORDER:'Đơn hàng',CUSTOMER:'Khách hàng',ACCOUNT:'Tài khoản nội bộ',PRODUCT:'Sản phẩm',VOUCHER:'Voucher',FEEDBACK:'Phản hồi',SURVEY:'Khảo sát',CARE_TASK:'Công việc chăm sóc',CARE_NOTE:'Ghi chú chăm sóc',SUPPORT_TICKET:'Phiếu hỗ trợ'};
const actions={REFUND_REQUEST:'Tạo khoản hoàn',REFUND_COMPLETE:'Xác nhận đã hoàn tiền',REFUND_REJECT:'Từ chối khoản hoàn',COD_COLLECTED:'Xác nhận thu COD',CREATE:'Tạo mới',UPDATE:'Cập nhật',DELETE:'Xóa mềm',LOCK:'Khóa',UNLOCK:'Mở khóa',ORDER_STATUS:'Đổi trạng thái đơn',RETURN_PROCESS:'Xử lý đổi trả',STOCK:'Cập nhật tồn kho',ARCHIVE:'Ẩn sản phẩm',REWARD:'Cấu hình thưởng',PUBLISH:'Phát hành',UNPUBLISH:'Gỡ phát hành',CUSTOMER_CANCEL:'Khách hàng hủy đơn',CUSTOMER_RECEIPT:'Khách hàng xác nhận nhận hàng'};
const fields={role:'Vai trò',locked:'Bị khóa',deleted:'Đã xóa mềm',status:'Trạng thái',returnStatus:'Đổi trả',paymentStatus:'Thanh toán',orderCode:'Mã đơn',name:'Tên sản phẩm',price:'Giá',stock:'Tồn kho',active:'Bật',category:'Danh mục',code:'Mã voucher',discountType:'Loại giảm',discountValue:'Giá trị giảm',minOrderAmount:'Đơn tối thiểu',maxDiscountAmount:'Giảm tối đa',usageLimit:'Giới hạn lượt',startsAt:'Bắt đầu',expiresAt:'Hết hạn',hidden:'Bị ẩn',hasShopResponse:'Có phản hồi shop',title:'Tên khảo sát',audience:'Đối tượng',rewardEnabled:'Bật thưởng',rewardType:'Loại thưởng',rewardValue:'Giá trị thưởng',rewardMinimum:'Đơn tối thiểu thưởng',rewardMaximum:'Trần thưởng',rewardDays:'Số ngày hiệu lực'};
const value=v=>v==null?'—':typeof v==='boolean'?(v?'Có':'Không'):String(v);
Object.assign(fields,{customerId:'ID khách hàng',assigneeId:'ID người phụ trách',authorId:'ID người ghi chú',dueAt:'Hạn xử lý',completedAt:'Ngày hoàn thành',outcome:'Kết quả chăm sóc',sourceType:'Loại nguồn',sourceId:'ID nguồn',parentTaskId:'Công việc trước',version:'Phiên bản',orderId:'ID đơn hàng',messageCount:'Số tin nhắn'});
function AdminRead({fetcher,children}){
 const [state,setState]=useState({loading:true,data:null,error:'',fetcher:null});const [revision,setRevision]=useState(0);
 const load=useCallback(()=>setRevision(r=>r+1),[]);
 useEffect(()=>{const controller=new AbortController();setState({loading:true,data:null,error:'',fetcher});fetcher(controller.signal).then(data=>{if(!controller.signal.aborted)setState({loading:false,data,error:'',fetcher});}).catch(e=>{if(!controller.signal.aborted)setState(s=>({...s,loading:false,error:e.message}));});return()=>controller.abort();},[fetcher,revision]);
 return children({...state,backgroundError:'',stale:state.fetcher!==fetcher,load});
}
export default function AuditLogs(){
 const [filters,change]=useManagerFilters({q:'',type:'',action:'',from:'',to:'',page:'0'});const [draft,setDraft]=useState(filters.q);
 useEffect(()=>setDraft(filters.q),[filters.q]);
 const numericPage=Number(filters.page);const page=Number.isInteger(numericPage)&&numericPage>=0?numericPage:0;
 const range=vietnamDateRange(filters.from,filters.to);
 const endpoint=`/api/admin/audit-logs?${managerQuery({...filters,...range,page,size:20})}`;
 const fetcher=useCallback(signal=>adminApi(endpoint,{signal}),[endpoint]);
 return <section className="audit-logs admin-panel" aria-label="Nhật ký thao tác">
  <h2>Nhật ký thao tác</h2><p>Lịch sử thành công từ khi triển khai tính năng. Chỉ xem, không sửa hoặc xóa. Hiển thị thao tác của Admin, Manager và các thao tác khách hàng đã được ghi nhận.</p>
  <form className="audit-filters" onSubmit={e=>{e.preventDefault();change({q:draft});}}>
   <label>Người thực hiện / ID đối tượng<input aria-label="Tìm nhật ký" value={draft} maxLength={150} onChange={e=>setDraft(e.target.value)} placeholder="Tên nhân viên hoặc ID"/></label><button className="admin-primary">Tìm kiếm</button>
   <label>Chức năng<select value={filters.type} onChange={e=>change({type:e.target.value})}><option value="">Tất cả chức năng</option>{Object.entries(types).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Thao tác<select value={filters.action} onChange={e=>change({action:e.target.value})}><option value="">Tất cả thao tác</option>{Object.entries(actions).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Từ ngày<input type="date" value={filters.from} onChange={e=>change({from:e.target.value})}/></label><label>Đến ngày<input type="date" value={filters.to} onChange={e=>change({to:e.target.value})}/></label>
   <button type="button" className="admin-action" onClick={()=>change({q:'',type:'',action:'',from:'',to:''})}>Xóa bộ lọc</button>
  </form>
  <AdminRead fetcher={fetcher}>{({data,loading,error,backgroundError,load,stale})=><>
   {(error||backgroundError)&&<p role="alert">{backgroundError&&'Đang giữ dữ liệu gần nhất. '}{error||backgroundError} <button className="admin-action" onClick={()=>load(true)}>Thử lại</button></p>}
   {(loading&&!data||stale)&&<p role="status">Đang tải nhật ký…</p>}
   {!stale&&data&&<><div className="audit-summary"><span>{data.totalElements} bản ghi · Giờ Việt Nam</span><button className="admin-action" onClick={()=>load(true)}>Tải lại</button></div>
    {!data.content.length&&<p>Chưa có nhật ký phù hợp.</p>}
    <div className="audit-list">{data.content.map(log=><article key={log.id}><header><strong>{actions[log.action]||log.action} · {types[log.entityType]||log.entityType} #{log.targetId}</strong><time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</time></header><p>{log.actorName} · {log.actorRole} · ID {log.actorId} · Bản ghi #{log.id}</p>
     <details><summary>Xem dữ liệu trước / sau</summary><p>Không lưu mật khẩu, email/điện thoại khách, địa chỉ, lý do hoặc nội dung phản hồi. Một số thay đổi nội dung chỉ ghi nhận thao tác, không lưu nội dung cũ/mới.</p><div className="audit-table-wrap"><table><thead><tr><th>Trường</th><th>Trước</th><th>Sau</th></tr></thead><tbody>{[...new Set([...Object.keys(log.beforeData),...Object.keys(log.afterData)])].map(key=><tr key={key} className={JSON.stringify(log.beforeData[key])!==JSON.stringify(log.afterData[key])?'audit-changed':''}><th>{fields[key]||key}</th><td>{value(log.beforeData[key])}</td><td>{value(log.afterData[key])}</td></tr>)}</tbody></table></div></details>
    </article>)}</div>
    <nav aria-label="Phân trang nhật ký"><button className="admin-action" disabled={page===0} onClick={()=>change({page:String(page-1)})}>Trang trước</button><span>Trang {page+1} / {Math.max(1,data.totalPages)}</span><button className="admin-action" disabled={page+1>=data.totalPages} onClick={()=>change({page:String(page+1)})}>Trang sau</button></nav>
   </>}
  </>}</AdminRead>
 </section>;
}
