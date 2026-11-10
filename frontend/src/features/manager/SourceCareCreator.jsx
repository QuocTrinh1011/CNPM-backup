import React,{useEffect,useState} from 'react';
import {adminApi} from '../../api/manager-api';
import {useManagerReadPause} from '../../shared/hooks/useManagerResource';
import './styles/customer-care.css';
const TaskForm=React.lazy(()=>import('./CustomerCare').then(module=>({default:module.TaskForm})));

export default function SourceCareCreator({type,id}){
 const [open,setOpen]=useState(false),[source,setSource]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[saved,setSaved]=useState(null);
 useManagerReadPause(open);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();setSource(null);setError('');
  adminApi(`/api/manager/care/sources/${type}/${id}`,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setSource(data);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[open,type,id,retry]);
 const url=`/manager/care?sourceType=${encodeURIComponent(type)}&sourceId=${encodeURIComponent(id)}`;
 const taskUrl=taskId=>`${url}&taskId=${encodeURIComponent(taskId)}`;
 return <section className="customer-care care-source" aria-label="Chăm sóc từ nguồn">
  {!open&&<button type="button" className="admin-action" onClick={()=>{setSaved(null);setOpen(true);}}>Tạo công việc chăm sóc</button>}
  {saved&&<p role="status">Đã tạo công việc #{saved.id}. <a href={taskUrl(saved.id)}>Theo dõi công việc chăm sóc</a></p>}
  {open&&<>
   <h4>Chăm sóc {type==='RETURN_ORDER'?'đơn đổi trả':'phản hồi'} · ID #{id}</h4>
   <p>Không thay đổi trạng thái đơn, phản hồi, thanh toán hoặc tự gửi tin cho khách.</p>
   {error?<p role="alert">{error} <button type="button" className="admin-action" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>:!source?<p role="status">Đang kiểm tra nguồn và công việc hiện có…</p>:source.openTaskId?<p role="status">Đã có công việc đang mở #{source.openTaskId}. <a href={taskUrl(source.openTaskId)}>Xem công việc đang mở</a></p>:<React.Suspense fallback={<p role="status">Đang tải form chăm sóc…</p>}><TaskForm source={source} customer={{id:source.customerId,fullName:source.customerName}} onSaved={task=>{setSaved(task);setOpen(false);}} onClose={()=>setOpen(false)}/></React.Suspense>}
   {(!source||source.openTaskId)&&<button type="button" className="admin-action" onClick={()=>setOpen(false)}>Đóng chăm sóc</button>}
   {source&&!source.openTaskId&&<p><a href={url}>Xem công việc cùng nguồn</a> nếu nguồn đã được quản lý khác tiếp nhận.</p>}
  </>}
 </section>;
}
