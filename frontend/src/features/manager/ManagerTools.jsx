import React,{useEffect,useState} from 'react';
import {adminApi as api} from '../../api/manager-api';
import {useManagerReadPause} from '../../shared/hooks/useManagerResource';
export function CustomerCreate({onSaved,user}){
 const [open,setOpen]=useState(false),[form,setForm]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useManagerReadPause(open);
 useEffect(()=>{
  if(!open)return;
  const onKey=event=>{if(event.key==='Escape'&&!busy)setOpen(false)};
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[open,busy]);
 const fields=user?{fullName:'Họ tên',phone:'Điện thoại',preferences:'Sở thích'}:{fullName:'Họ tên',email:'Email',password:'Mật khẩu ban đầu',phone:'Điện thoại',preferences:'Sở thích'};
 const close=()=>{if(busy)return;setOpen(false);setForm(null);setError('')};
 return <div>
  <button type="button" className="admin-action" onClick={()=>{setForm(user?{fullName:user.fullName,phone:user.phone||'',preferences:user.preferences||''}:{fullName:'',email:'',password:'',phone:'',preferences:''});setError('');setOpen(true)}}>{user?'Sửa':'Thêm khách hàng'}</button>
  {open&&form&&<div className="admin-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <form className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-dialog-title" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api(user?`/api/manager/users/${user.id}`:'/api/manager/users',{method:user?'PUT':'POST',body:form});setOpen(false);setForm(null);onSaved()}catch(e){setError(e.message)}finally{setBusy(false)}}}>
    <h2 id="customer-dialog-title">{user?'Sửa thông tin khách hàng':'Thêm khách hàng mới'}</h2>
    <p>{user?`Cập nhật thông tin liên hệ của ${user.fullName||'khách hàng'}.`:'Điền thông tin để tạo tài khoản khách hàng mới.'}</p>
    {Object.entries(fields).map(([key,label],index)=><label key={key} htmlFor={`customer-dialog-${key}`}>{label}{['fullName','email','password'].includes(key)?' *':''}<input id={`customer-dialog-${key}`} required={['fullName','email','password'].includes(key)} autoFocus={index===0} type={key==='password'?'password':key==='email'?'email':'text'} value={form[key]} disabled={busy} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
    {error&&<p role="alert" className="danger-text">{error}</p>}
    <div className="admin-dialog-actions">
     <button type="button" className="admin-action" disabled={busy} onClick={close}>Hủy</button>
     <button className="admin-primary" disabled={busy}>{busy?'Đang lưu...':user?'Lưu thay đổi':'Thêm khách hàng'}</button>
    </div>
   </form>
  </div>}
 </div>
}
export function SurveyAudience({value,onChange,disabled}){
 const [q,setQ]=useState(''),[page,setPage]=useState(0),[data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(value.audience!=='SELECTED')return;let alive=true;setData(null);setError('');api(`/api/manager/users?q=${encodeURIComponent(q)}&page=${page}&size=10`).then(d=>{if(alive)setData(d)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[q,page,value.audience,retry]);
 return <fieldset disabled={disabled}><legend>Người nhận khảo sát</legend><select aria-label="Đối tượng nhận" value={value.audience} onChange={e=>onChange({audience:e.target.value,customerIds:[]})}><option value="ALL">Tất cả khách hàng</option><option value="SELECTED">Chọn khách hàng</option></select>{value.audience==='SELECTED'&&<><label>Tìm khách hàng<input value={q} onChange={e=>{setQ(e.target.value);setPage(0)}}/></label><p>Đã chọn {value.customerIds.length} khách hàng</p>{error?<p role="alert">{error}<button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>:!data?<p>Đang tải...</p>:<>{data.content.filter(u=>!u.locked).map(u=><label key={u.id} style={{display:'block'}}><input type="checkbox" checked={value.customerIds.includes(u.id)} onChange={e=>onChange({...value,customerIds:e.target.checked?[...value.customerIds,u.id]:value.customerIds.filter(id=>id!==u.id)})}/>{u.fullName} — {u.email}</label>)}<button type="button" className="admin-action" disabled={!page} onClick={()=>setPage(p=>p-1)}>Trước</button><button type="button" className="admin-action" disabled={page+1>=data.totalPages} onClick={()=>setPage(p=>p+1)}>Sau</button></>}</>}</fieldset>
}
export function SupplierAssignment(){
 const [productId,setProductId]=useState(''),[supplierId,setSupplierId]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <form className="internal-filters" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);try{await api(`/api/manager/products/${productId}/supplier`,{method:'PATCH',body:{supplierId:supplierId?Number(supplierId):null}});setMessage('Đã cập nhật nhà cung cấp.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}}><label>Mã số sản phẩm<input type="number" min="1" required value={productId} onChange={e=>setProductId(e.target.value)}/></label><label>Mã số nhà cung cấp (trống để gỡ)<input type="number" min="1" value={supplierId} onChange={e=>setSupplierId(e.target.value)}/></label><button className="admin-primary" disabled={busy}>Gắn nhà cung cấp</button><p role="status">{message}</p></form>
}
