import React,{useEffect,useState} from 'react';
import {adminApi} from '../../api/manager-api';
import {lifecycleLabels} from './CustomerLifecycle';
import './survey-recipient-group.css';

export const recipientFilterKeys=['q','stage','dormant','minCompletedOrders','maxCompletedOrders','minCompletedValue','maxCompletedValue','lastPurchaseFrom','lastPurchaseTo','minRating','maxRating','surveyed','surveyId'];
const sourceKeys=[...recipientFilterKeys,'page','sort','direction'];
export function groupSurveyRoute(params) {
  const next=new URLSearchParams({group:'1'});
  sourceKeys.forEach(key=>{if(params.has(key))next.set(`source_${key}`,params.get(key));});
  return `surveys?${next}`;
}
export function groupSurveySource(location) {
  const params=new URLSearchParams(location.split('?')[1]);
  if(params.get('group')!=='1')return null;
  const source=new URLSearchParams();sourceKeys.forEach(key=>{if(params.has(`source_${key}`))source.set(key,params.get(`source_${key}`));});
  const filter={};recipientFilterKeys.forEach(key=>{
    const value=source.get(key);if(value==null||value==='')return;
    filter[key]=['dormant','surveyed'].includes(key)?value==='true'?true:value==='false'?false:value:value;
  });
  return {filter,back:`users${source.size?`?${source}`:''}`};
}
const labels={q:'Từ khóa',stage:'Nhóm khách',dormant:'Lâu chưa mua lại',minCompletedOrders:'Số đơn tối thiểu',maxCompletedOrders:'Số đơn tối đa',minCompletedValue:'Giá trị tối thiểu (đ)',maxCompletedValue:'Giá trị tối đa (đ)',lastPurchaseFrom:'Ngày mua từ',lastPurchaseTo:'Ngày mua đến',minRating:'Điểm đánh giá tối thiểu',maxRating:'Điểm đánh giá tối đa',surveyed:'Đã từng hoàn thành khảo sát',surveyId:'Mã khảo sát cụ thể'};
export default function SurveyRecipientGroup({filter,onReady,disabled,onOther}) {
  const [page,setPage]=useState(0),[revision,setRevision]=useState(0),[state,setState]=useState({});
  const key=JSON.stringify(filter);
  useEffect(()=>{
    const controller=new AbortController();onReady(false);setState({});
    adminApi('/api/manager/surveys/recipients/preview',{method:'POST',body:{recipientFilter:JSON.parse(key),page,size:10},signal:controller.signal})
      .then(data=>{if(!controller.signal.aborted){setState({data});onReady(data.eligibleCount>0);}})
      .catch(error=>{if(!controller.signal.aborted)setState({error:error.message});});
    return()=>controller.abort();
  },[key,page,revision,onReady]);
  const {data,error}=state;
  return <fieldset disabled={disabled} className="admin-survey-fieldset survey-recipient-group"><legend>Nhóm khách đang lọc</legend>
    <p>Chọn toàn bộ khách phù hợp, không chỉ trang danh sách đang xem. Chốt người nhận khi lưu bản nháp; số xem trước có thể thay đổi trước lúc lưu.</p>
    {filter.surveyId&&<p>Trạng thái trả lời áp dụng cho khảo sát #{filter.surveyId}, chỉ trong đối tượng nhận khảo sát đó. Không suy diễn từ khảo sát khác.</p>}
    <dl>{Object.keys(filter).length?Object.entries(filter).map(([name,value])=><div key={name}><dt>{labels[name]}</dt><dd>{typeof value==='boolean'?(value?'Có':'Không'):name==='stage'?(lifecycleLabels[value]||value):value}</dd></div>):<p>Tất cả khách hàng đang hoạt động.</p>}</dl>
    {!data&&!error&&<p role="status">Đang kiểm tra người nhận...</p>}
    {error&&<p role="alert">{error} <button type="button" className="admin-action" onClick={()=>setRevision(r=>r+1)}>Thử lại người nhận</button></p>}
    {data&&<><p>{data.totalMatched} khách khớp bộ lọc · {data.eligibleCount} đủ điều kiện · {data.lockedCount} bị loại do khóa.</p>
      {!data.eligibleCount?<p role="alert">Không có khách hàng hoạt động phù hợp. Hãy quay lại chỉnh bộ lọc.</p>:<>
        <ul>{data.recipients.content.map(customer=><li key={customer.id}>{customer.fullName} - {customer.email}</li>)}</ul>
        <nav aria-label="Xem trước người nhận"><button type="button" className="admin-action" disabled={!page} onClick={()=>setPage(p=>p-1)}>Người nhận trước</button><span>Trang {page+1}/{Math.max(1,data.recipients.totalPages)}</span><button type="button" className="admin-action" disabled={page+1>=data.recipients.totalPages} onClick={()=>setPage(p=>p+1)}>Người nhận sau</button></nav>
      </>}
      <button type="button" className="admin-action" onClick={()=>setRevision(r=>r+1)}>Tải lại người nhận</button>
    </>}
    <button type="button" className="admin-action" onClick={onOther}>Chọn đối tượng khác</button>
  </fieldset>;
}
