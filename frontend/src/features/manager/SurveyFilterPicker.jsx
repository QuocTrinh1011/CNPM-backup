import React,{useEffect,useState} from 'react';
import {adminApi} from '../../api/manager-api';

const label=survey=>`${survey.title} (#${survey.id})${survey.deleted?' — Đã xóa':survey.status==='DRAFT'?' — Bản nháp / đã gỡ':''}`;
export default function SurveyFilterPicker({value,onChange}) {
  const [q,setQ]=useState(''),[page,setPage]=useState(0),[revision,setRevision]=useState(0),[state,setState]=useState({});
  useEffect(()=>{
    const controller=new AbortController();setState({});
    const params=new URLSearchParams({q,page:String(page),size:'10'});if(value)params.set('selectedId',value);
    adminApi(`/api/manager/surveys/filter-options?${params}`,{signal:controller.signal})
      .then(data=>{if(!controller.signal.aborted)setState({data});})
      .catch(error=>{if(!controller.signal.aborted)setState({error:error.message});});
    return()=>controller.abort();
  },[q,page,value,revision]);
  const options=state.data?.options?.content||[],selected=state.data?.selected;
  return <div className="survey-filter-picker">
    <label>Tìm khảo sát để lọc<input aria-label="Tìm khảo sát để lọc" type="search" maxLength={255} value={q} onChange={e=>{setQ(e.target.value);setPage(0);}}/></label>
    <label>Khảo sát cụ thể<select aria-label="Khảo sát cụ thể" value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Tất cả khảo sát</option>
      {value&&!options.some(s=>String(s.id)===value)&&<option value={value}>{selected?label(selected):`Khảo sát #${value}`}</option>}
      {options.map(s=><option key={s.id} value={s.id}>{label(s)}</option>)}
    </select></label>
    {!state.data&&!state.error&&<small role="status">Đang tải danh sách khảo sát...</small>}
    {state.error&&<div role="alert">{state.error} <button type="button" className="admin-action" onClick={()=>setRevision(n=>n+1)}>Thử lại danh sách khảo sát</button></div>}
    {state.data&&<div className="survey-filter-pagination"><button type="button" className="admin-action" disabled={!page} onClick={()=>setPage(p=>p-1)}>Khảo sát trước</button><small>Trang {page+1}/{Math.max(1,state.data.options?.totalPages||0)}</small><button type="button" className="admin-action" disabled={page+1>=(state.data.options?.totalPages||0)} onClick={()=>setPage(p=>p+1)}>Khảo sát sau</button></div>}
    {value&&<button type="button" className="admin-action" onClick={()=>onChange('')}>Bỏ chọn khảo sát cụ thể</button>}
  </div>;
}
