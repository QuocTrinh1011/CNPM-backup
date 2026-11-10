import React, { useState } from 'react';
import { adminApi } from '../../api/manager-api';
import { useManagerReadPause } from '../../shared/hooks/useManagerResource';
export const emptyReward=()=>({enabled:false,discountType:'PERCENTAGE',discountValue:10,minOrderAmount:0,maxDiscountAmount:null,validDays:30});
export function RewardFields({ value, onChange, disabled }) {
  const change=(key,v)=>onChange({...value,[key]:v});
  return <fieldset disabled={disabled} className="admin-survey-fieldset"><legend>Voucher thưởng khảo sát</legend><label><input type="checkbox" checked={!!value.enabled} onChange={e=>change('enabled',e.target.checked)}/> Tặng voucher khi hoàn thành</label>{value.enabled&&<>
    <label>Loại giảm<select value={value.discountType} onChange={e=>change('discountType',e.target.value)}><option value="PERCENTAGE">Phần trăm</option><option value="FIXED_AMOUNT">Số tiền</option></select></label>
    <label>Giá trị giảm<input type="number" min="0.01" step="0.01" required value={value.discountValue??''} onChange={e=>change('discountValue',e.target.value===''?null:Number(e.target.value))}/></label>
    <label>Đơn tối thiểu<input type="number" min="0" step="1" required value={value.minOrderAmount??0} onChange={e=>change('minOrderAmount',Number(e.target.value))}/></label>
    {value.discountType==='PERCENTAGE'&&<label>Giảm tối đa (để trống nếu không giới hạn)<input type="number" min="1" step="1" value={value.maxDiscountAmount??''} onChange={e=>change('maxDiscountAmount',e.target.value===''?null:Number(e.target.value))}/></label>}
    <label>Hạn dùng từ khi nhận (ngày)<input type="number" min="1" step="1" required value={value.validDays??''} onChange={e=>change('validDays',e.target.value===''?null:Number(e.target.value))}/></label><p>Mỗi tài khoản nhận một mã riêng dùng một lượt. Mã đã cấp giữ nguyên điều kiện.</p>
  </>}</fieldset>;
}
export default function SurveyRewardEditor({ survey, onSaved }) {
  const [open,setOpen]=useState(false),[value,setValue]=useState(()=>({...emptyReward(),...survey.reward})),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useManagerReadPause(open);
  const save=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await adminApi(`/api/manager/surveys/${survey.id}/reward`,{method:'PATCH',body:value});setOpen(false);onSaved?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <><button type="button" className="admin-action" onClick={()=>setOpen(true)}>Voucher thưởng</button>{open&&<div className="admin-dialog-backdrop"><form className="admin-dialog" role="dialog" aria-modal="true" aria-label="Cấu hình voucher thưởng" onSubmit={save}><h2>Voucher thưởng: {survey.title}</h2><RewardFields value={value} onChange={setValue} disabled={busy}/>{error&&<p role="alert">{error}</p>}<button type="button" disabled={busy} onClick={()=>setOpen(false)}>Quay lại</button><button className="admin-primary" disabled={busy}>{busy?'Đang lưu...':'Lưu ưu đãi'}</button></form></div>}</>;
}
