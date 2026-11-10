// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import CustomerPassword from './CustomerPassword';
import {api} from '../../api/api';
vi.mock('../../api/api',()=>({api:vi.fn(),endpoints:{forgotPassword:'/forgot',resetPassword:'/reset'},signOut:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();window.history.replaceState({},'','/');});
it('reads a reset link then removes its secret fragment without persisting it',async()=>{
 window.history.replaceState({},'','/dat-lai-mat-khau#email=owner%40example.com&code='+ 'A'.repeat(43));
 api.mockResolvedValue({enabled:true});const navigate=vi.fn();
 render(<CustomerPassword initialMode="reset" onNavigate={navigate} onNotice={vi.fn()}/>);
 expect((await screen.findByLabelText('Email')).value).toBe('owner@example.com');expect(window.location.hash).toBe('');
 fireEvent.change(screen.getByLabelText('Mật khẩu mới'),{target:{value:'Password123'}});
 fireEvent.click(screen.getByRole('button',{name:'Đặt lại mật khẩu',exact:true}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/reset',{method:'POST',body:{email:'owner@example.com',code:'A'.repeat(43),newPassword:'Password123'}}));
});
it('keeps the forgot form with a generic delivery message and no secret',async()=>{
 api.mockImplementation(async(path)=>path==='/forgot'?{message:'Nếu tài khoản hợp lệ, kiểm tra email.'}:{enabled:true});const navigate=vi.fn();
 render(<CustomerPassword initialMode="forgot" onNavigate={navigate} onNotice={vi.fn()}/>);
 fireEvent.change(await screen.findByLabelText('Email'),{target:{value:'owner@example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'Gửi liên kết đặt lại'}));
 expect(await screen.findByRole('status')).toBeTruthy();expect(navigate).not.toHaveBeenCalled();
});
