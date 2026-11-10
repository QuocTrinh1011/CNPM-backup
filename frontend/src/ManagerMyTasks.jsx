import React,{useCallback,useEffect,useState} from 'react';
import {adminApi} from './api/manager-api';
import {useManagerResource,useManagerReadPause} from './shared/hooks/useManagerResource';
import {managerQuery} from './shared/hooks/useManagerFilters';
import {TaskForm,careLabels,careOutcomes} from './CustomerCare';
import './manager-care-inbox.css';

export const myTaskGroups={OPEN:'Tất cả việc đang mở',TODAY:'Đến hạn hôm nay',UPCOMING:'Sắp đến hạn',OVERDUE:'Quá hạn',FOLLOW_UP:'Chăm sóc tiếp'};
const date=value=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
function useInbox(url,enabled=true){const fetcher=useCallback(signal=>adminApi(url,{signal}),[url]);return useManagerResource(fetcher,{enabled,keepPreviousData:true});}
export function InboxError({resource}){const error=resource.error||resource.backgroundError;return error?<p role="alert">{resource.backgroundError&&'Đang hiển thị dữ liệu gần nhất. '}{error} <button className="admin-action" onClick={()=>resource.load()}>Thử lại</button></p>:null;}
export function MyTaskSummary({go}){
 const resource=useInbox('/api/manager/care/my-tasks/summary'),data=resource.stale?null:resource.data;
 return <section className="admin-panel manager-my-task-summary" aria-label="Tóm tắt việc của tôi"><h2>Việc của tôi</h2><InboxError resource={resource}/>{resource.loading&&!data&&<p role="status">Đang tải việc cá nhân…</p>}<div className="care-actions">{['TODAY','OVERDUE'].map(group=><button key={group} className="admin-action" onClick={()=>go(`my-tasks?group=${group}`)}>{myTaskGroups[group]}: {data?.counts?.[group]??'—'}</button>)}<button className="admin-action" onClick={()=>go('my-tasks')}>Xem tất cả việc của tôi</button></div></section>;
}
export function CareTaskDetail({taskId,onClose,onSaved,onOpenTask}){
 const resource=useInbox(`/api/manager/care/tasks/${taskId}`),task=resource.stale?null:resource.data;
 const [editing,setEditing]=useState(false),[saved,setSaved]=useState(null),[notice,setNotice]=useState('');
 useEffect(()=>setSaved(null),[task]);
 useManagerReadPause(!!editing);
 const current=saved||task;
 const save=value=>{
  const following=editing==='follow-up';
  setSaved(following?{...current,followUpTaskId:value.id}:value);setEditing(false);
  setNotice(following?`Đã hẹn công việc kế tiếp #${value.id}.`:'Đã lưu công việc.');resource.load();onSaved?.();
 };
 const openTask=id=>onOpenTask&&<button className="admin-action" onClick={()=>onOpenTask(id)}>Xem công việc #{id}</button>;
 return <section className="admin-panel manager-care-detail" aria-label="Chi tiết công việc chăm sóc">
  <h2 tabIndex={-1} ref={node=>{if(node&&!node.dataset.focused){node.focus();node.dataset.focused='true';}}}>Công việc #{taskId}</h2>
  <button className="admin-action" disabled={!!editing} onClick={onClose}>Đóng chi tiết</button><InboxError resource={resource}/>
  {resource.loading&&!current&&<p role="status">Đang tải công việc…</p>}{notice&&<p role="status">{notice}</p>}
  {current&&(editing?<TaskForm task={editing==='update'?current:undefined} followUp={editing==='follow-up'?current:undefined} customer={{id:current.customerId,fullName:current.customerName}} onClose={()=>setEditing(false)} onSaved={save}/>:<>
   <h3>{current.title}</h3><p>Khách hàng: {current.customerName}</p><p>Phụ trách: {current.assigneeName}{!current.assigneeActive&&' (không còn hoạt động)'}</p>
   <p>Trạng thái: {careLabels[current.status]}{current.overdue&&' · Quá hạn'}</p><p>Hạn xử lý: {date(current.dueAt)}</p><p className="care-content">{current.description}</p>
   {current.sourceType&&<p>Nguồn: {current.sourceType==='RETURN_ORDER'?'Đơn đổi trả':'Phản hồi'} #{current.sourceId}</p>}
   {current.parentTaskId&&<p>Tiếp nối công việc #{current.parentTaskId} {openTask(current.parentTaskId)}</p>}
   {current.status==='COMPLETED'?<><p>Kết quả: {careOutcomes[current.outcome]||'Chưa ghi nhận'}{current.resultNote&&` · ${current.resultNote}`}</p>
    {current.followUpTaskId?<p>Đã hẹn công việc kế tiếp #{current.followUpTaskId} {openTask(current.followUpTaskId)}</p>:<button className="admin-action" onClick={()=>setEditing('follow-up')}>Hẹn chăm sóc lại</button>}
   </>:<button className="admin-primary" onClick={()=>{setSaved(null);setEditing('update');}}>Xử lý công việc</button>}
  </>)}
 </section>;
}
export default function ManagerMyTasks({go,location}){
 const p=new URLSearchParams(location.split('?')[1]),group=p.get('group')||'OPEN',q=p.get('q')||'',page=Math.max(0,parseInt(p.get('page'),10)||0);
 const [search,setSearch]=useState(q);useEffect(()=>setSearch(q),[q]);
 const resource=useInbox(`/api/manager/care/my-tasks?${managerQuery({group,q,page,size:10})}`),data=resource.stale?null:resource.data;
 const change=patch=>go(`my-tasks?${managerQuery({group,q,page,...patch,...(!Object.hasOwn(patch,'page')?{page:0}:{})})}`);
 const open=id=>{const next=new URLSearchParams(p);next.set('taskId',id);go(`my-tasks?${next}`);};
 return <section className="customer-care"><MyTaskSummary go={go}/><div className="admin-panel"><h2>Danh sách việc của tôi</h2><p>Chỉ công việc đang mở được giao cho tài khoản của anh/chị. Ngày và giờ tính theo Việt Nam. Sắp đến hạn: từ ngày mai đến hết 7 ngày tiếp theo.</p><div className="care-filters"><label>Nhóm công việc<select aria-label="Nhóm việc của tôi" value={group} onChange={e=>change({group:e.target.value})}>{Object.entries(myTaskGroups).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><form onSubmit={e=>{e.preventDefault();change({q:search.trim()});}}><label>Tìm việc của tôi<input type="search" maxLength={255} value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="admin-action">Tìm</button></form></div><InboxError resource={resource}/>{resource.loading&&!data&&<p role="status">Đang tải công việc…</p>}{data&&!data.content.length&&<p>Chưa có công việc phù hợp.</p>}<div className="care-task-list">{data?.content.map(task=><article className="care-task" key={task.id}><h3>{task.title}</h3><p>{task.customerName} · {careLabels[task.status]}{task.overdue&&' · Quá hạn'}</p><p>Hạn: {date(task.dueAt)}</p>{task.parentTaskId&&<p>Tiếp nối công việc #{task.parentTaskId}</p>}<button className="admin-action" onClick={()=>open(task.id)}>Chi tiết / xử lý</button></article>)}</div><div className="admin-pagination"><button className="admin-action" disabled={resource.loading||page===0} onClick={()=>change({page:page-1})}>Trước</button><span>Trang {page+1}/{Math.max(1,data?.totalPages||0)} · {data?.totalElements??0} công việc</span><button className="admin-action" disabled={resource.loading||!data||page+1>=data.totalPages} onClick={()=>change({page:page+1})}>Sau</button></div></div></section>;
}
