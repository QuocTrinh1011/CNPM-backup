// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import ManagerApp from './ManagerApp';
import SurveyRecipientGroup,{groupSurveyRoute,groupSurveySource} from './SurveyRecipientGroup';
import {adminApi,adminRefreshSession} from '../../api/manager-api';
vi.mock('../../api/manager-api',async original=>({...await original(),adminApi:vi.fn(),adminRefreshSession:vi.fn()}));
const preview={totalMatched:14,eligibleCount:13,lockedCount:1,recipients:{content:[{id:1,fullName:'Customer A',email:'a@test.vn'}],totalPages:2}};
const flush=async()=>act(async()=>{await vi.advanceTimersByTimeAsync(0);});
const complete=()=>{
 fireEvent.change(screen.getByLabelText('Tên khảo sát'),{target:{value:'Chăm sóc khách quay lại'}});
 fireEvent.change(screen.getByLabelText('Nội dung câu hỏi 1'),{target:{value:'Bạn thích gì?'}});
 for(const [i,value] of [[1,'A'],[2,'B']])fireEvent.change(screen.getByLabelText(`Câu 1, phương án ${i}`),{target:{value}});
};
beforeEach(()=>{
 vi.useFakeTimers();vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 adminRefreshSession.mockResolvedValue({manager:{fullName:'Manager'}});adminApi.mockReset();
 adminApi.mockImplementation(async(url,options)=>url.endsWith('/recipients/preview')?preview:url==='/api/manager/surveys'&&options?.method==='POST'?{id:7,recipientCount:12}:{content:[],totalPages:0,totalElements:0});
 window.history.replaceState({},'','/manager/users?q=A&page=2&stage=LOYAL&sort=completedValue&direction=asc');
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('passes all filters but not source pagination or sorting, previews and saves a draft with the actual count',async()=>{
 render(<ManagerApp/>);await flush();
 fireEvent.click(screen.getByRole('button',{name:'Tạo khảo sát cho nhóm này'}));await flush();
 expect(screen.getByRole('dialog')).toBeTruthy();expect(window.location.search).toContain('source_page=2');
 const call=adminApi.mock.calls.find(([url])=>url.endsWith('/recipients/preview'));
 expect(call[1].body).toEqual({recipientFilter:{q:'A',stage:'LOYAL'},page:0,size:10});
 expect(screen.getByText(/14 khách khớp bộ lọc · 13 đủ điều kiện · 1 bị loại do khóa/)).toBeTruthy();
 complete();const calls=adminApi.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(10000));expect(adminApi.mock.calls).toHaveLength(calls);
 fireEvent.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await flush();
 const saved=adminApi.mock.calls.find(([url,o])=>url==='/api/manager/surveys'&&o?.method==='POST');
 expect(saved[1].body.audience).toBe('SELECTED');expect(saved[1].body.recipientFilter).toEqual({q:'A',stage:'LOYAL'});expect(saved[1].body.customerIds).toBeUndefined();
 expect(screen.getByText(/Đã lưu khảo sát nháp cho 12 khách hàng/)).toBeTruthy();
 expect(adminApi.mock.calls.some(([url])=>url.includes('/publish'))).toBe(false);
});
it('does not auto open on direct URL, refresh or back/forward and returns to the original list',async()=>{
 const route=groupSurveyRoute(new URLSearchParams('q=A&page=2&dormant=true&minRating=3.5&surveyed=false'));
 window.history.replaceState({},'',`/manager/${route}`);render(<ManagerApp/>);await flush();
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Tạo khảo sát cho nhóm này'}));await flush();
 fireEvent.click(screen.getByRole('button',{name:'Đóng',exact:true}));await flush();
 fireEvent.popState(window);await flush();expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Quay lại nhóm khách hàng'}));await flush();
 const p=new URLSearchParams(window.location.search);expect(p.get('page')).toBe('2');expect(p.get('minRating')).toBe('3.5');expect(p.get('surveyed')).toBe('false');
 expect(groupSurveySource(`/manager/${route}`).filter).toEqual({q:'A',dormant:true,minRating:'3.5',surveyed:false});
});
it('disables saving while preview loads, preserves form after failure and permits retry',async()=>{
 let resolve;adminApi.mockImplementation(async(url,options)=>{
   if(url.endsWith('/recipients/preview'))return new Promise(r=>{resolve=r;});
   if(url==='/api/manager/surveys'&&options?.method==='POST')throw new Error('Không lưu được');
   return {content:[],totalPages:0};
 });
 render(<ManagerApp/>);await flush();fireEvent.click(screen.getByRole('button',{name:'Tạo khảo sát cho nhóm này'}));await flush();complete();
 expect(screen.getByRole('button',{name:'Lưu bản nháp'}).disabled).toBe(true);
 await act(async()=>resolve(preview));expect(screen.getByRole('button',{name:'Lưu bản nháp'}).disabled).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await flush();
 expect(screen.getByText('Không lưu được')).toBeTruthy();expect(screen.getByLabelText('Tên khảo sát').value).toBe('Chăm sóc khách quay lại');
 expect(screen.getByRole('dialog')).toBeTruthy();
});
it('handles preview errors, empty groups and page requests without showing stale recipients',async()=>{
 adminApi.mockRejectedValueOnce(new Error('Mất kết nối'));const onReady=vi.fn();
 render(<SurveyRecipientGroup filter={{q:'A'}} onReady={onReady} onOther={vi.fn()}/>);await flush();
 expect(onReady).toHaveBeenLastCalledWith(false);expect(screen.getByRole('alert').textContent).toContain('Mất kết nối');
 fireEvent.click(screen.getByText('Thử lại người nhận'));await flush();expect(onReady).toHaveBeenLastCalledWith(true);
 adminApi.mockResolvedValue({...preview,recipients:{...preview.recipients,content:[{id:2,fullName:'Customer B',email:'b@test.vn'}]}});
 fireEvent.click(screen.getByText('Người nhận sau'));await flush();expect(screen.queryByText(/a@test.vn/)).toBeNull();expect(adminApi.mock.calls.at(-1)[1].body.page).toBe(1);
 adminApi.mockResolvedValue({totalMatched:1,eligibleCount:0,lockedCount:1,recipients:{content:[],totalPages:0}});
 fireEvent.click(screen.getByText('Tải lại người nhận'));await flush();expect(onReady).toHaveBeenLastCalledWith(false);expect(screen.getByText(/Không có khách hàng hoạt động/)).toBeTruthy();
});
