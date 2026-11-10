import React, {useCallback} from 'react';
import {adminApi} from '../../api/manager-api';
import {useManagerResource} from '../../shared/hooks/useManagerResource';
import {lifecycleLabels} from './CustomerLifecycle';
import './retention-report.css';

const number = value => new Intl.NumberFormat('vi-VN', {maximumFractionDigits:0}).format(value);
const decimal = value => new Intl.NumberFormat('vi-VN', {minimumFractionDigits:2,maximumFractionDigits:2}).format(value);

export default function RetentionReport({go}) {
  const fetcher = useCallback(signal => adminApi('/api/manager/reports/retention',{signal}),[]);
  const {data,loading,error,backgroundError,load} = useManagerResource(fetcher);
  const customers = query => go(`users${query ? `?${query}` : ''}`);
  return <section className="retention-report" aria-label="Báo cáo giữ chân khách hàng">
    <header><h3>Giữ chân khách hàng</h3><p>Tỷ lệ mua lại toàn thời gian, chưa phải phân tích giữ chân theo nhóm khách cùng kỳ đăng ký.</p></header>
    {(error || backgroundError) && <div role="alert" className="retention-warning">{data && 'Đang hiển thị số liệu gần nhất. '}{error || backgroundError} <button className="admin-action" onClick={()=>load(true)}>Thử lại</button></div>}
    {loading && !data && <p role="status">Đang tải báo cáo…</p>}
    {data && <>
      <div className="retention-metrics">
        {[
          ['Tổng khách hàng',number(data.totalCustomers),'', 'Tài khoản khách chưa xóa, bao gồm tài khoản bị khóa.'],
          ['Khách đã mua',number(data.purchasingCustomers),'minCompletedOrders=1','Có ít nhất một đơn hoàn thành.'],
          ['Khách mua lại',number(data.repeatCustomers),'minCompletedOrders=2','Có ít nhất hai đơn hoàn thành, bao gồm khách thân thiết.'],
          ['Lâu chưa mua lại',number(data.dormantCustomers),'dormant=true',`Từ ${data.thresholds.dormantDays} ngày lịch Việt Nam kể từ ngày đặt gần nhất trong các đơn hoàn thành.`],
        ].map(([label,value,query,description])=><article key={label}><h4>{label}</h4><button className="retention-count" aria-label={`Xem ${label.toLowerCase()}`} onClick={()=>customers(query)}>{value}</button><p>{description}</p></article>)}
        <article><h4>Phiếu hỗ trợ đã giải quyết</h4><button className="retention-count" onClick={()=>go('support-tickets?status=RESOLVED')}>{number(data.resolvedSupportTickets ?? 0)}</button><p>Số phiếu RESOLVED toàn thời gian của khách chưa xóa, gồm khách bị khóa. Không phải số khách hoặc tỷ lệ giải quyết công việc chăm sóc.</p></article>
        <article><h4>Tỷ lệ khách mua lại</h4><strong>{decimal(data.repeatRate)}%</strong><p>Khách mua lại ÷ khách đã mua × 100.</p></article>
        <article><h4>Giá trị đơn hoàn thành</h4><strong>{decimal(data.completedValue)} đ</strong><p>Tổng giá trị sau giảm giá của đơn hoàn thành.</p></article>
        <article><h4>Giá trị trung bình mỗi khách đã mua</h4><strong>{decimal(data.averageCompletedValuePerBuyer)} đ</strong><p>Giá trị đơn hoàn thành ÷ khách đã mua.</p></article>
      </div>
      {data.totalCustomers === 0 && <p>Chưa có khách hàng để thống kê.</p>}
      <div className="retention-distribution"><h3>Phân bố nhóm khách hàng</h3><p>Bốn nhóm không trùng nhau. “Lâu chưa mua lại” là nhãn bổ sung, không phải nhóm thứ năm.</p>
        {data.distribution.map(group=><div className="retention-group" key={group.stage}>
          <button className="admin-action" onClick={()=>customers(`stage=${group.stage}`)} aria-label={`Xem nhóm ${lifecycleLabels[group.stage]}`}>{lifecycleLabels[group.stage]}</button>
          <span>{number(group.count)} khách · {decimal(group.percentage)}%</span>
          <div className="retention-track" aria-hidden="true"><div style={{width:`${Math.min(100,Math.max(0,Number(group.percentage)))}%`}} /></div>
        </div>)}
      </div>
      <aside><p>Chỉ tính đơn COMPLETED. Khách thân thiết được ưu tiên khi có từ {data.thresholds.loyalOrders} đơn hoặc {number(data.thresholds.loyalValue)} đ giá trị đơn hoàn thành.</p><p>Đây là chỉ số theo đơn hoàn thành, không phải tiền thực thu. Khi chưa có khách đã mua, tỷ lệ và giá trị trung bình bằng 0.</p><p>Cập nhật: <time dateTime={data.updatedAt}>{new Date(data.updatedAt).toLocaleString('vi-VN',{timeZone:data.thresholds.timezone})}</time> (giờ Việt Nam). Tự cập nhật mỗi 5 giây khi tab đang mở.</p></aside>
    </>}
  </section>;
}
