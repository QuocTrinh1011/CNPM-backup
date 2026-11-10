// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import ManagerOrderDetail from './ManagerOrderDetail';
import {OrdersPage} from './app/App';
import {adminApi} from './api/manager-api';
import {api} from './api/api';
vi.mock('./api/manager-api',async original=>({...await original(),adminApi:vi.fn()}));
vi.mock('./api/api',async original=>({...await original(),api:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const order={id:9,orderCode:9009,status:'DELIVERED',returnStatus:'REQUESTED',returnReason:'Sai size',items:[]};
it('approves then completes without modifying delivery status and shows the history',async()=>{
 adminApi.mockImplementation(async(url,{body})=>({...order,returnStatus:body.status,returnHistory:[{status:body.status,note:body.note,managerName:'Quản lý',createdAt:'2026-10-06T00:00:00Z'}]}));
 render(<ManagerOrderDetail detail={order} onClose={()=>{}}/>);
 fireEvent.click(screen.getByText('Chấp thuận'));fireEvent.click(screen.getByText('Xác nhận xử lý'));
 fireEvent.click(await screen.findByText('Hoàn tất xử lý'));
 const input=screen.getByLabelText(/Ghi chú cách giải quyết/);
 expect(screen.getByText('Xác nhận xử lý').disabled).toBe(true);
 fireEvent.change(input,{target:{value:'Đã đổi hàng tại cửa hàng'}});fireEvent.click(screen.getByText('Xác nhận xử lý'));
 expect(await screen.findByText('Đã đổi hàng tại cửa hàng')).toBeTruthy();expect(screen.queryByText('Hoàn tất xử lý')).toBeNull();
 expect(adminApi).toHaveBeenLastCalledWith('/api/manager/orders/9/return',{method:'PATCH',body:{status:'COMPLETED',note:'Đã đổi hàng tại cửa hàng'}});
});
it('requires a rejection reason, preserves the draft after failure and locks sending',async()=>{
 let reject;adminApi.mockImplementation(()=>new Promise((_,r)=>{reject=r;}));
 render(<ManagerOrderDetail detail={order} onClose={()=>{}}/>);fireEvent.click(screen.getByText('Từ chối'));
 expect(screen.getByText('Xác nhận xử lý').disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Lý do từ chối'),{target:{value:'Không đủ điều kiện'}});fireEvent.click(screen.getByText('Xác nhận xử lý'));
 expect(screen.getByText('Đang lưu...').disabled).toBe(true);reject(new Error('Lỗi mạng'));
 expect(await screen.findByText('Lỗi mạng')).toBeTruthy();expect(screen.getByLabelText('Lý do từ chối').value).toBe('Không đủ điều kiện');
});
it('does not process final return statuses and displays customer history',async()=>{
 api.mockResolvedValue({...order,returnStatus:'REJECTED',returnHistory:[{status:'REJECTED',note:'Không đủ điều kiện',createdAt:'2026-10-06T00:00:00Z'}]});
 render(<OrdersPage route={{orderId:9,tab:'RETURN',keyword:'',page:0}}/>);
 expect(await screen.findByText('Không đủ điều kiện')).toBeTruthy();expect(screen.queryByText('YÊU CẦU ĐỔI/TRẢ')).toBeNull();
});
it('explains a missing return endpoint without losing the approval draft',async()=>{
 adminApi.mockRejectedValue(Object.assign(new Error('No static resource api/manager/orders/9/return.'),{status:404}));
 render(<ManagerOrderDetail detail={order} onClose={()=>{}}/>);
 fireEvent.click(screen.getByText('Chấp thuận'));
 fireEvent.change(screen.getByLabelText('Ghi chú (không bắt buộc)'),{target:{value:'Giữ ghi chú'}});
 fireEvent.click(screen.getByText('Xác nhận xử lý'));
 expect(await screen.findByText(/Backend đang chạy phiên bản chưa có chức năng/)).toBeTruthy();
 expect(screen.getByLabelText('Ghi chú (không bắt buộc)').value).toBe('Giữ ghi chú');
 expect(screen.getByText('Xác nhận xử lý').disabled).toBe(false);
});
