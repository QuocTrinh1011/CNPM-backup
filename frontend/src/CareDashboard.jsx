import React,{useCallback,useState} from 'react';
import {adminApi} from './api/manager-api';
import {useManagerResource} from './shared/hooks/useManagerResource';
import {managerQuery} from './shared/hooks/useManagerFilters';
import {AssigneeFilter} from './CustomerCare';
import './customer-care.css';
const labels={total:'Tổng công việc',todo:'Chưa thực hiện',inProgress:'Đang xử lý',completed:'Hoàn thành',overdue:'Quá hạn'};
const statuses={todo:'TODO',inProgress:'IN_PROGRESS',completed:'COMPLETED'};
function useData(url){const fetcher=useCallback(signal=>adminApi(url,{signal}),[url]);return useManagerResource(fetcher,{keepPreviousData:true});}
const CareOutcomes=React.lazy(()=>import('./CareOutcomes'));
export default function CareDashboard({go,location}){
 const p=new URLSearchParams((location||window.location.pathname+window.location.search).split('?')[1]);
 const tab=p.get('tab')==='outcomes'?'outcomes':'overview';
 const switchTab=next=>{if(next!==tab)go(`care-dashboard?${managerQuery({tab:next,assigneeId:p.get('assigneeId')||''})}`);};
 return <div><nav className="care-report-tabs" aria-label="Báo cáo chăm sóc"><button type="button" className={tab==='overview'?'admin-primary':'admin-action'} aria-pressed={tab==='overview'} onClick={()=>switchTab('overview')}>Tổng quan</button><button type="button" className={tab==='outcomes'?'admin-primary':'admin-action'} aria-pressed={tab==='outcomes'} onClick={()=>switchTab('outcomes')}>Kết quả chăm sóc</button></nav>{tab==='overview'?<CareOverview go={go} location={location}/>:<React.Suspense fallback={<p role="status">Đang tải báo cáo kết quả…</p>}><CareOutcomes go={go} location={location}/></React.Suspense>}</div>;
}
function CareOverview({go,location}){
 const p=new URLSearchParams((location||window.location.pathname+window.location.search).split('?')[1]);const filters={from:p.get('from')||'',to:p.get('to')||'',assigneeId:p.get('assigneeId')||''};
 const [showDormant,setShowDormant]=useState(false),[page,setPage]=useState(0);
 const resource=useData(`/api/manager/care/dashboard?${managerQuery(filters)}`),data=resource.stale?null:resource.data;
 const dormantFetcher=useCallback(signal=>adminApi(`/api/manager/care/dormant?page=${page}&size=10`,{signal}),[page]);
 const dormant=useManagerResource(dormantFetcher,{enabled:showDormant,keepPreviousData:true}),customers=dormant.stale?null:dormant.data;
 const change=patch=>go(`care-dashboard?${managerQuery({...filters,...patch})}`);
 const open=(key,id)=>go(`care?${managerQuery({...filters,...(id?{assigneeId:id}:{}),status:statuses[key]||'',overdue:key==='overdue'?'true':''})}`);
 return <section className="customer-care"><div className="admin-panel"><h2>Hiệu quả xử lý chăm sóc</h2><p>Thống kê theo hạn xử lý (ngày Việt Nam, gồm cả ngày kết thúc). Trạng thái và quá hạn tính tại thời điểm xem, không phải báo cáo doanh thu hay lịch sử hiệu suất.</p>
 <div className="care-filters"><label>Hạn từ ngày<input type="date" value={filters.from} onChange={e=>change({from:e.target.value})}/></label><label>Hạn đến ngày<input type="date" value={filters.to} onChange={e=>change({to:e.target.value})}/></label><AssigneeFilter value={filters.assigneeId} onChange={id=>change({assigneeId:id})}/><button className="admin-action" onClick={()=>go('care-dashboard')}>Bỏ bộ lọc</button></div>
 {(resource.error||resource.backgroundError)&&<p role="alert">{resource.error||resource.backgroundError} <button className="admin-action" onClick={()=>resource.load()}>Thử lại</button></p>}
 {resource.loading&&!data&&<p role="status">Đang tải báo cáo...</p>}
 {data&&<><div className="care-metrics">{Object.entries(labels).map(([key,label])=><button key={key} className="care-task" onClick={()=>open(key)}><span>{label}</span><strong>{data.counts[key]}</strong></button>)}</div><p>Quá hạn là một phần của công việc chưa hoàn thành, không cộng thêm vào tổng. Cập nhật: {new Date(data.asOf).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}.</p>
 <h3>Theo người phụ trách</h3>{!data.staff.length&&<p>Chưa có công việc phù hợp.</p>}<div className="care-task-list">{data.staff.map(staff=><article className="care-task" key={staff.id}><h3>{staff.name}{!staff.active&&' (không còn hoạt động)'}</h3><div className="care-actions">{Object.entries(labels).map(([key,label])=><button className="admin-action" key={key} onClick={()=>open(key,staff.id)}>{label}: {staff.counts[key]}</button>)}</div></article>)}</div>
 <h3>Khách cần chăm sóc</h3><p>Khách có đơn hoàn thành, từ 30 ngày chưa mua lại và chưa có công việc đang mở. Tính toàn bộ thời gian, không theo bộ lọc công việc; bao gồm khách bị khóa.</p><button className="admin-action" onClick={()=>{setShowDormant(v=>!v);setPage(0);}}>Khách chưa có chăm sóc: {data.dormantWithoutOpenTask}</button></>}
 {showDormant&&<div>{(dormant.error||dormant.backgroundError)&&<p role="alert">{dormant.error||dormant.backgroundError}<button className="admin-action" onClick={()=>dormant.load()}>Thử lại</button></p>}{dormant.loading&&!customers&&<p>Đang tải khách hàng...</p>}{customers&&!customers.content.length&&<p>Không có khách phù hợp.</p>}{customers?.content.map(c=><article className="care-task" key={c.id}><h3>{c.fullName}</h3><p>Ngày đặt gần nhất trong đơn hoàn thành: {new Date(c.lastPurchaseAt).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</p><button className="admin-action" onClick={()=>go(`users/${c.id}?tab=care`)}>Xem hồ sơ</button><button className="admin-primary" onClick={()=>go(`care?customerId=${c.id}`)}>Tạo chăm sóc</button></article>)}<div className="admin-pagination"><button disabled={dormant.loading||page===0} onClick={()=>setPage(n=>n-1)}>Trước</button><span>Trang {page+1}/{Math.max(1,customers?.totalPages||0)}</span><button disabled={dormant.loading||!customers||page+1>=customers.totalPages} onClick={()=>setPage(n=>n+1)}>Sau</button></div></div>}
 </div></section>;
}
