import React,{useCallback,useEffect,useRef,useState} from 'react';
import {adminApi} from '../../api/manager-api';
import {useManagerList,useManagerReadPause} from '../../shared/hooks/useManagerResource';
import {useManagerFilters,managerQuery} from '../../shared/hooks/useManagerFilters';
import RefundSummary,{refundMoney} from '../customer/RefundSummary';
import './styles/manager-refunds.css';
const dates=value=>value?new Date(value).toLocaleString('vi-VN'):'—';
const labels={PENDING:'Chờ hoàn',COMPLETED:'Đã hoàn',REJECTED:'Đã từ chối'};
export const reviewLabels={MISSING_PAYMENT:'Thiếu bản ghi thanh toán',MISSING_LINK:'Thiếu link thanh toán',DUPLICATE_LINK:'Link giao dịch bị trùng',UNMAPPED_LEGACY_LINK:'Link cũ chưa đối chiếu được',PROVIDER_MISMATCH:'Thông tin PayOS không khớp',PARTIAL_PAYMENT:'Nhận tiền một phần',OVERPAYMENT:'Nhận tiền vượt giá trị đơn',UNKNOWN_PROVIDER_STATUS:'Trạng thái PayOS chưa nhận diện',CANCEL_NOT_CONFIRMED:'Chưa xác nhận hủy link',MULTIPLE_PAYMENTS:'Có nhiều giao dịch đã trả tiền',LOCAL_PROVIDER_CONFLICT:'Trạng thái web và PayOS chưa khớp',PROVIDER_UNAVAILABLE:'Chưa kết nối được PayOS'};
function ProcessForm({refund,onDone,onCancel}){
  const [action,setAction]=useState('complete'),[note,setNote]=useState(''),[reference,setReference]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const sending=useRef(false);
  useManagerReadPause(true);
  const submit=async e=>{e.preventDefault();if(sending.current)return;sending.current=true;setBusy(true);setError('');try{await adminApi(`/api/manager/refunds/${refund.id}/${action}`,{method:'POST',body:{note:note.trim(),bankReference:reference.trim()}});onDone();}catch(e){setError(e.message);}finally{sending.current=false;setBusy(false);}};
  return <form className="refund-form" aria-label="Xử lý khoản hoàn" onSubmit={submit}><h4>Khoản #{refund.id} · {refundMoney(refund.amount)}</h4><p>Chỉ ghi nhận chuyển tiền bên ngoài; hệ thống không tự chuyển tiền.</p><label>Thao tác<select value={action} onChange={e=>setAction(e.target.value)} disabled={busy}><option value="complete">Xác nhận đã hoàn tiền</option><option value="reject">Từ chối khoản hoàn</option></select></label>{action==='complete'&&<label>Mã chuyển hoàn<input autoFocus required maxLength={120} value={reference} onChange={e=>setReference(e.target.value)} disabled={busy}/></label>}<label>{action==='reject'?'Lý do từ chối':'Ghi chú xử lý'}<textarea required maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} disabled={busy}/></label>{error&&<p role="alert">{error}</p>}<div className="refund-actions"><button type="button" onClick={onCancel} disabled={busy}>Quay lại</button><button disabled={busy}>{busy?'Đang lưu…':'Xác nhận ghi nhận'}</button></div></form>;
}
export function OrderFinancePanel({order,onUpdated,onEditingChange}){
  const endpoint=useCallback(()=>`/api/manager/orders/${order.id}/refunds`,[order.id]);
  const {data,loading,error,load}=useManagerList(endpoint,{enabled:!!order.id});
  const [mode,setMode]=useState(''),[selected,setSelected]=useState(null),[amount,setAmount]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[failure,setFailure]=useState('');
  const [key,setKey]=useState(()=>crypto.randomUUID()),sending=useRef(false);
  useManagerReadPause(!!mode||!!selected);
  useEffect(()=>{onEditingChange?.(!!mode||!!selected||busy);return()=>onEditingChange?.(false);},[mode,selected,busy,onEditingChange]);
  const refresh=async()=>{try{onUpdated(await adminApi(`/api/manager/orders/${order.id}`));}catch(e){setFailure('Đã lưu, nhưng chưa tải lại được chi tiết. Vui lòng tải lại; không gửi lại thao tác.');}};
  const submit=async e=>{e.preventDefault();if(sending.current)return;sending.current=true;setBusy(true);setFailure('');
    try{if(mode==='COD')await adminApi(`/api/manager/orders/${order.id}/cod-collection`,{method:'PATCH',body:{note:note.trim()}});else await adminApi(`/api/manager/orders/${order.id}/refunds`,{method:'POST',body:{reasonType:order.status==='CANCELLED'?'CANCEL':'RETURN',amount:Number(amount),note:note.trim(),requestKey:key}});setMode('');setKey(crypto.randomUUID());setNote('');setAmount('');await refresh();}catch(e){setFailure(e.message);}finally{sending.current=false;setBusy(false);}};
  const reconcile=async()=>{if(sending.current)return;sending.current=true;setBusy(true);setFailure('');try{onUpdated(await adminApi(`/api/manager/orders/${order.id}/payment/reconcile`,{method:'POST'}));}catch(e){setFailure(e.message);}finally{sending.current=false;setBusy(false);}};
  const finance=order.finance,available=Number(finance?.refund?.availableAmount||0);
  const canCreate=available>0&&(order.status==='CANCELLED'||['APPROVED','COMPLETED'].includes(order.returnStatus));
  return <section className="refund-card" aria-label="Hoàn tiền và đối soát"><h3>Thanh toán và hoàn tiền</h3><RefundSummary refund={finance?.refund}/>{finance?.reviewRequired&&<div role="status" className="refund-warning"><strong>Thanh toán cần kiểm tra</strong><p>{reviewLabels[finance.reviewReason]||'Cần đối chiếu với PayOS'}</p><small>{dates(finance.reviewAt)}</small></div>}
    {order.paymentMethod==='PAYOS'&&<button type="button" className="admin-action" disabled={busy||!!mode||!!selected} onClick={reconcile}>Đối chiếu lại PayOS</button>}
    {finance?.codCollectedAt&&<p>Đã xác nhận thu toàn bộ COD: {dates(finance.codCollectedAt)}</p>}
    {order.paymentMethod==='COD'&&['DELIVERED','COMPLETED'].includes(order.status)&&!finance?.codCollectedAt&&<button type="button" className="admin-action" disabled={busy||!!mode||!!selected} onClick={()=>{setFailure('');setMode('COD');}}>Xác nhận đã thu COD</button>}
    {canCreate&&!mode&&!selected&&<button type="button" className="admin-action" disabled={busy} onClick={()=>{setFailure('');setMode('REFUND');}}>Tạo khoản hoàn</button>}
    {mode&&<form className="refund-form" aria-label={mode==='COD'?'Xác nhận thu COD':'Tạo khoản hoàn'} onSubmit={submit}><h4>{mode==='COD'?'Xác nhận đã thu toàn bộ '+refundMoney(order.totalAmount):'Lập khoản hoàn thủ công'}</h4>{mode==='COD'?<p>Chỉ xác nhận khi đã kiểm tra thực tế tiền thu. Không tự chuyển tiền.</p>:<label>Số tiền hoàn (VND), tối đa {refundMoney(available)}<input autoFocus type="number" required min="1" step="1" max={available} value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy}/></label>}<label>Ghi chú<textarea autoFocus={mode==='COD'} required maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} disabled={busy}/></label><div className="refund-actions"><button type="button" disabled={busy} onClick={()=>{setMode('');setFailure('');}}>Bỏ qua</button><button disabled={busy}>{busy?'Đang lưu…':'Xác nhận'}</button></div></form>}
    {failure&&<p role="alert">{failure}</p>}{loading&&<p role="status">Đang tải sổ hoàn tiền…</p>}{error&&<p role="alert">{error} <button onClick={()=>load()}>Thử lại</button></p>}
    {!loading&&data?.length===0&&<p>Chưa có khoản hoàn tiền.</p>}
    <div className="refund-ledger">{(data||[]).map(r=><article key={r.id}><b>#{r.id} · {refundMoney(r.amount)} · {labels[r.status]}</b><p>{r.reasonType==='CANCEL'?'Hủy đơn':'Đổi trả'} · {dates(r.requestedAt)}</p><p>{r.note}</p>{r.bankReference&&<p>Mã chuyển hoàn: {r.bankReference}</p>}{r.processedAt&&<p>Xử lý lúc: {dates(r.processedAt)} · Manager #{r.processedBy}</p>}{r.processingNote&&<p>{r.processingNote}</p>}{r.status==='PENDING'&&!selected&&!mode&&<button className="admin-action" onClick={()=>setSelected(r)}>Xử lý khoản hoàn</button>}</article>)}</div>
    {selected&&<ProcessForm key={selected.id} refund={selected} onCancel={()=>setSelected(null)} onDone={()=>{setSelected(null);void refresh();}}/>}
  </section>;
}
export default function ManagerRefunds(){
  const [filters,change]=useManagerFilters({status:'PENDING',q:'',page:'0'});const page=Number(filters.page)||0;
  const endpoint=useCallback(()=>`/api/manager/refunds?${managerQuery({...filters,page,size:20})}`,[filters,page]);
  const {data,loading,error,load}=useManagerList(endpoint);const [selected,setSelected]=useState(null);
  return <section className="refund-card"><h2>Sổ hoàn tiền</h2><p>Ghi nhận hoàn tiền thủ công, không tự chuyển tiền. Mỗi đơn chỉ hoàn trong số tiền đã xác nhận thu.</p><div className="refund-filters"><label>Tìm mã đơn hoặc khách<input aria-label="Tìm khoản hoàn" value={filters.q} onChange={e=>change({q:e.target.value})}/></label><label>Trạng thái<select value={filters.status} onChange={e=>change({status:e.target.value})}><option value="">Tất cả</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
    {loading&&<p role="status">Đang tải khoản hoàn…</p>}{error&&<p role="alert">{error} <button onClick={()=>load()}>Thử lại</button></p>}
    {!loading&&data?.content?.length===0&&<p>Không có khoản hoàn phù hợp.</p>}
    <div className="refund-ledger">{(data?.content||[]).map(r=><article key={r.id}><h3>Đơn #{r.orderCode} · {refundMoney(r.amount)}</h3><p>{r.customerName} · {r.customerEmail}</p><p>{labels[r.status]} · {dates(r.requestedAt)}</p><p>{r.note}</p>{r.bankReference&&<p>Mã chuyển hoàn: {r.bankReference}</p>}{r.processedAt&&<p>Xử lý lúc: {dates(r.processedAt)} · Manager #{r.processedBy}</p>}{r.processingNote&&<p>{r.processingNote}</p>}{r.status==='PENDING'&&!selected&&<button className="admin-action" onClick={()=>setSelected(r)}>Xử lý</button>}</article>)}</div>
    {selected&&<ProcessForm key={selected.id} refund={selected} onCancel={()=>setSelected(null)} onDone={()=>setSelected(null)}/>}
    <nav className="refund-actions" aria-label="Phân trang khoản hoàn"><button disabled={loading||page<=0} onClick={()=>change({page:String(page-1)})}>Trang trước</button><span>Trang {page+1} / {Math.max(1,data?.totalPages||0)}</span><button disabled={loading||page+1>=(data?.totalPages||0)} onClick={()=>change({page:String(page+1)})}>Trang sau</button></nav>
  </section>;
}
