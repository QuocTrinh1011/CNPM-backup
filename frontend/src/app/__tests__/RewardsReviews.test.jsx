// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import OrderReviews from '../../features/customer/OrderReviews';
import CustomerVouchers from '../../features/customer/CustomerVouchers';
import { RewardFields, emptyReward } from '../../SurveyRewardEditor';
import { api } from '../../api/api';
vi.mock('../../api/api',async original=>({...await original(),api:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('reviews a completed order product once despite multiple variants',async()=>{
  let done=false;
  api.mockImplementation(async(path,opts)=>{if(opts?.method){done=true;return {id:1};}return [{productId:2,canReview:!done,reviewed:done}];});
  render(<OrderReviews order={{id:9,status:'COMPLETED',items:[{productId:2,name:'Áo',size:'M'},{productId:2,name:'Áo',size:'L'}]}}/>);
  fireEvent.click(await screen.findByText('Đánh giá Áo'));
  fireEvent.change(screen.getByLabelText('Bình luận (tùy chọn)'),{target:{value:'Rất tốt'}});
  fireEvent.click(screen.getByText('Gửi đánh giá'));
  await screen.findByText('Đã đánh giá');
  expect(api).toHaveBeenCalledWith('/api/products/2/feedback',{method:'POST',body:{orderId:9,rating:5,comment:'Rất tốt'}});
  expect(screen.queryByText('Đánh giá Áo')).toBeNull();
});
it('keeps review input after failure',async()=>{
  api.mockResolvedValueOnce([{productId:2,canReview:true,reviewed:false}]).mockRejectedValueOnce(new Error('Không gửi được'));
  render(<OrderReviews order={{id:9,items:[{productId:2,name:'Áo'}]}}/>);
  fireEvent.click(await screen.findByText('Đánh giá Áo'));
  fireEvent.change(screen.getByLabelText('Bình luận (tùy chọn)'),{target:{value:'Nội dung'}});
  fireEvent.click(screen.getByText('Gửi đánh giá'));await screen.findByText('Không gửi được');
  expect(screen.getByLabelText('Bình luận (tùy chọn)').value).toBe('Nội dung');
});
it('wallet distinguishes used rewards and only selects active codes',async()=>{
  api.mockResolvedValue({content:[{code:'KS-1',state:'ACTIVE',discountType:'PERCENTAGE',discountValue:10},{code:'KS-2',state:'USED',discountType:'FIXED_AMOUNT',discountValue:10000}],totalPages:1});
  const select=vi.fn();render(<CustomerVouchers onSelect={select}/>);
  await screen.findByText('KS-1');const buttons=screen.getAllByText('Chọn mã');
  expect(buttons[1].disabled).toBe(true);fireEvent.click(buttons[0]);expect(select).toHaveBeenCalledWith('KS-1');
});
it('reward settings default to off and expose amount and validity when enabled',()=>{
  const change=vi.fn();const view=render(<RewardFields value={emptyReward()} onChange={change}/>);
  expect(screen.queryByLabelText('Giá trị giảm')).toBeNull();
  fireEvent.click(screen.getByLabelText('Tặng voucher khi hoàn thành'));expect(change).toHaveBeenCalledWith(expect.objectContaining({enabled:true}));
  view.rerender(<RewardFields value={{...emptyReward(),enabled:true}} onChange={change}/>);
  expect(screen.getByLabelText('Hạn dùng từ khi nhận (ngày)').value).toBe('30');
});
