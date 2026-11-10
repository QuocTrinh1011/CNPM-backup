import React, {useState} from 'react';
import './customer-lifecycle.css';
import SurveyFilterPicker from './SurveyFilterPicker';
export const lifecycleLabels={NO_PURCHASE:'Chưa mua hàng',FIRST_PURCHASE:'Mua lần đầu',RETURNING:'Khách quay lại',LOYAL:'Khách thân thiết'};
export const lifecycleExplanation='Chỉ tính đơn hoàn thành: thân thiết từ 5 đơn hoặc 5.000.000 đ; lâu chưa mua lại từ 30 ngày lịch Việt Nam kể từ ngày đặt gần nhất trong các đơn hoàn thành. Giá trị sau giảm giá, chưa trừ hoàn tiền; đơn hoàn thành có đổi trả vẫn tính.';
export default function CustomerLifecycle({segment}) {
  if(!segment)return null;
  return <div className="customer-lifecycle"><span className={`admin-badge lifecycle-${segment.stage}`}>{lifecycleLabels[segment.stage]||segment.stage}</span>{segment.dormant&&<span className="admin-badge warning">Lâu chưa mua lại</span>}{segment.daysSinceLastPurchase!=null&&<small>{segment.daysSinceLastPurchase} ngày từ lần mua gần nhất</small>}</div>;
}
export function CustomerLifecycleFilters({params,onChange}) {
  const value=k=>params.get(k)||'';
  const keys=['stage','dormant','minCompletedOrders','maxCompletedOrders','minCompletedValue','maxCompletedValue','lastPurchaseFrom','lastPurchaseTo','sort','direction','minRating','maxRating','surveyed','surveyId'];
  const [expanded,setExpanded]=useState(()=>keys.some(k=>params.has(k)));
  const field=(key,label,type='number')=><label key={key}>{label}<input aria-label={label} type={type} min={type==='number'?0:undefined} value={value(key)} onChange={e=>onChange({[key]:e.target.value})}/></label>;
  return <details className="customer-lifecycle-filters" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary>Phân nhóm và bộ lọc nâng cao</summary><div className="customer-filter-grid">
    <label>Nhóm khách hàng<select aria-label="Nhóm khách hàng" value={value('stage')} onChange={e=>onChange({stage:e.target.value})}><option value="">Tất cả nhóm</option>{Object.entries(lifecycleLabels).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label>
    <label>Mua lại<select aria-label="Mua lại" value={value('dormant')} onChange={e=>onChange({dormant:e.target.value})}><option value="">Tất cả</option><option value="true">Lâu chưa mua lại (≥30 ngày)</option><option value="false">Không có nhãn lâu chưa mua lại</option></select></label>
    {field('minCompletedOrders','Số đơn tối thiểu')}{field('maxCompletedOrders','Số đơn tối đa')}{field('minCompletedValue','Giá trị tối thiểu (đ)')}{field('maxCompletedValue','Giá trị tối đa (đ)')}{field('lastPurchaseFrom','Ngày mua từ','date')}{field('lastPurchaseTo','Ngày mua đến','date')}
    <label>Sắp xếp theo<select aria-label="Sắp xếp khách hàng" value={value('sort')||'createdAt'} onChange={e=>onChange({sort:e.target.value})}><option value="createdAt">Ngày đăng ký</option><option value="completedOrders">Số đơn hoàn thành</option><option value="completedValue">Giá trị đơn hoàn thành</option><option value="lastPurchaseAt">Ngày mua gần nhất</option></select></label>
    <label>Thứ tự<select aria-label="Thứ tự khách hàng" value={value('direction')||'desc'} onChange={e=>onChange({direction:e.target.value})}><option value="desc">Giảm dần</option><option value="asc">Tăng dần</option></select></label>
    {['minRating','maxRating'].map((key,i)=><label key={key}>{i?'Điểm đánh giá tối đa':'Điểm đánh giá tối thiểu'}<input aria-label={i?'Điểm đánh giá tối đa':'Điểm đánh giá tối thiểu'} type="number" min="1" max="5" step="0.1" value={value(key)} onChange={e=>onChange({[key]:e.target.value})}/></label>)}
    <label>Tham gia khảo sát<select aria-label="Tham gia khảo sát" value={value('surveyed')} onChange={e=>onChange({surveyed:e.target.value})}><option value="">{value('surveyId')?'Tất cả người nhận':'Tất cả'}</option><option value="true">{value('surveyId')?'Đã trả lời khảo sát đã chọn':'Đã hoàn thành ít nhất một khảo sát'}</option><option value="false">{value('surveyId')?'Chưa trả lời khảo sát đã chọn':'Chưa hoàn thành khảo sát'}</option></select></label>
    {(expanded||value('surveyId'))&&<SurveyFilterPicker value={value('surveyId')} onChange={surveyId=>onChange({surveyId})}/>}
  </div><p>Điểm là trung bình đánh giá sản phẩm chưa xóa (kể cả đánh giá ẩn), không phải điểm hài lòng khảo sát. Khách chưa đánh giá không thuộc khoảng điểm. Chọn khảo sát cụ thể để lọc trong đối tượng nhận; “Chưa trả lời” không bao gồm người chưa được gửi. Không chọn khảo sát thì tính toàn bộ lịch sử, kể cả khảo sát đã gỡ/xóa.</p><p>{lifecycleExplanation}</p><button className="admin-action" onClick={()=>onChange(Object.fromEntries(keys.map(k=>[k,''])))}>Xóa bộ lọc phân nhóm</button></details>;
}
