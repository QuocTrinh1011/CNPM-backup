import React,{useCallback} from 'react';
import {adminApi} from '../../api/manager-api';
import {useManagerResource} from '../../shared/hooks/useManagerResource';
import {managerQuery} from '../../shared/hooks/useManagerFilters';
import {AssigneeFilter,careOutcomes} from './CustomerCare';
import './care-outcomes-report.css';

const number=value=>new Intl.NumberFormat('vi-VN').format(value);
const percentage=value=>new Intl.NumberFormat('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const labels={completed:'Công việc hoàn thành',recorded:'Đã ghi nhận kết quả',unrecorded:'Chưa ghi nhận kết quả',contacted:'Đã liên hệ',unreachable:'Chưa liên hệ được',resolved:'Đã giải quyết',needsFollowUp:'Cần theo dõi tiếp'};
const outcomes={recorded:'RECORDED',unrecorded:'UNRECORDED',contacted:'CONTACTED',unreachable:'UNREACHABLE',resolved:'RESOLVED',needsFollowUp:'NEEDS_FOLLOW_UP'};

export default function CareOutcomes({go,location}){
 const p=new URLSearchParams((location||window.location.pathname+window.location.search).split('?')[1]);
 const filters={from:p.get('from')||'',to:p.get('to')||'',assigneeId:p.get('assigneeId')||''};
 const url=`/api/manager/care/outcomes?${managerQuery(filters)}`;
 const fetcher=useCallback(signal=>adminApi(url,{signal}),[url]);
 const resource=useManagerResource(fetcher,{keepPreviousData:true});const data=resource.stale?null:resource.data;
 const change=patch=>go(`care-dashboard?${managerQuery({tab:'outcomes',...filters,...patch})}`);
 const open=(outcome,id)=>go(`care?${managerQuery({status:'COMPLETED',outcome:outcome||'',completedFrom:filters.from,completedTo:filters.to,assigneeId:id??filters.assigneeId})}`);
 return <section className="customer-care care-outcomes-report" aria-label="Báo cáo kết quả chăm sóc"><div className="admin-panel">
  <h2>Kết quả chăm sóc</h2><p>Thống kê công việc đã hoàn thành theo ngày hoàn thành, không phải hạn xử lý. Mỗi công việc là một lần chăm sóc, không phải một khách hàng duy nhất.</p>
  <div className="care-filters"><label>Hoàn thành từ ngày<input type="date" value={filters.from} onChange={e=>change({from:e.target.value})}/></label><label>Hoàn thành đến ngày<input type="date" value={filters.to} onChange={e=>change({to:e.target.value})}/></label><AssigneeFilter value={filters.assigneeId} onChange={id=>change({assigneeId:id})}/><button type="button" className="admin-action" onClick={()=>go('care-dashboard?tab=outcomes')}>Bỏ bộ lọc</button></div>
  <p>Khoảng ngày tính theo giờ Việt Nam, gồm cả ngày cuối. Công việc thiếu ngày hoàn thành chỉ được tính khi xem toàn thời gian.</p>
  {(resource.error||resource.backgroundError)&&<p role="alert">{resource.backgroundError&&'Đang hiển thị số liệu gần nhất. '}{resource.error||resource.backgroundError} <button className="admin-action" onClick={()=>resource.load(true)}>Thử lại</button></p>}
  {(resource.loading||resource.stale)&&!data&&<p role="status">Đang tải kết quả chăm sóc…</p>}
  {data&&<>
   <div className="care-metrics">{['completed','recorded','unrecorded'].map(key=><button type="button" key={key} className="care-task" aria-label={`Xem ${labels[key].toLowerCase()}`} onClick={()=>open(outcomes[key])}><span>{labels[key]}</span><strong>{number(data.counts[key])}</strong></button>)}<article className="care-task"><span>Tỷ lệ đã giải quyết</span><strong>{percentage(data.counts.resolvedRate)}%</strong></article></div>
   <p>Đã giải quyết ÷ số có kết quả hợp lệ × 100. Không có kết quả hợp lệ thì tỷ lệ bằng 0. Đây không phải tỷ lệ giải quyết phiếu hỗ trợ hay hiệu quả tăng doanh thu.</p>
   {!data.counts.completed&&<p>Chưa có công việc hoàn thành phù hợp.</p>}
   <h3>Phân bố kết quả đã ghi nhận</h3><p>Kết quả trống hoặc không hợp lệ được tách riêng, không nằm trong mẫu số của bốn nhóm dưới đây.</p>
   {!data.counts.recorded&&<p>Chưa có kết quả hợp lệ để tính phân bố.</p>}
   <div className="care-outcome-bars">{data.distribution.map(group=><div key={group.outcome}><div className="care-outcome-bar-label"><button className="admin-action" aria-label={`Xem nhóm ${careOutcomes[group.outcome]}`} onClick={()=>open(group.outcome)}>{careOutcomes[group.outcome]}</button><span>{number(group.count)} công việc · {percentage(group.percentage)}%</span></div><div className="care-outcome-track" aria-hidden="true"><span style={{width:`${Math.min(100,Math.max(0,Number(group.percentage)))}%`}}/></div></div>)}</div>
   <h3>Theo người phụ trách</h3><p>Nhóm theo người phụ trách công việc, không khẳng định đây là người trực tiếp hoàn thành.</p>
   {!data.staff.length?<p>Chưa có người phụ trách trong kết quả phù hợp.</p>:<div className="care-outcome-table-wrap"><table className="care-outcome-table"><caption>Số công việc và tỷ lệ theo người phụ trách</caption><thead><tr><th>Người phụ trách</th>{Object.entries(labels).map(([key,label])=><th key={key}>{label}</th>)}<th>Tỷ lệ đã giải quyết</th></tr></thead><tbody>{data.staff.map(staff=><tr key={staff.id}><th scope="row">{staff.name}{!staff.active&&<small>Không còn hoạt động</small>}</th>{Object.entries(labels).map(([key,label])=><td key={key} data-label={label}><button className="admin-action" aria-label={`Xem ${label.toLowerCase()} của ${staff.name}`} onClick={()=>open(outcomes[key],staff.id)}>{number(staff.counts[key])}</button></td>)}<td data-label="Tỷ lệ đã giải quyết">{percentage(staff.counts.resolvedRate)}%</td></tr>)}</tbody></table></div>}
   <p>Cập nhật: <time dateTime={data.asOf}>{new Date(data.asOf).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</time> · Tự cập nhật mỗi 5 giây khi tab đang mở.</p>
  </>}
 </div></section>;
}
