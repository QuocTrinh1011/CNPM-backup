import React from 'react';
import './refund-summary.css';
export const refundLabels={NONE:'Chưa có khoản hoàn',PENDING:'Đang chờ hoàn tiền',PARTIAL:'Đã hoàn một phần',FULL:'Đã hoàn tiền'};
export const refundMoney=value=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(value||0));
export default function RefundSummary({refund}){
  if(!refund||refund.status==='NONE')return null;
  return <section className="refund-summary" aria-label="Tình trạng hoàn tiền"><strong>{refundLabels[refund.status]||refund.status}</strong><p>Đã hoàn: {refundMoney(refund.refundedAmount)}</p>{Number(refund.pendingAmount)>0&&<p>Còn khoản chờ xử lý: {refundMoney(refund.pendingAmount)}</p>}</section>;
}
