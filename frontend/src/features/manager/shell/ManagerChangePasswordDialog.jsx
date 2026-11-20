import React, { useState } from "react";
import { X, KeyRound } from "lucide-react";
import { managerChangePassword } from "../../../api/manager-api";

export function ManagerChangePasswordDialog({ open, onClose, onSuccess, userEmail }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    setBusy(true);
    try {
      await managerChangePassword(currentPassword, newPassword);
      onSuccess?.('Đổi mật khẩu thành công! Hãy lưu lại mật khẩu mới.');
      onClose();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="admin-modal-backdrop manager-change-password-backdrop"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'grid', placeItems: 'center', zIndex: 9999, padding: '16px',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="admin-card manager-change-password-dialog" role="dialog" aria-modal="true" aria-labelledby="manager-change-password-title" style={{ width: '100%', maxWidth: '440px', padding: '24px', position: 'relative' }}>
        <div className="manager-change-password-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ padding: '8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex' }}>
              <KeyRound size={20} aria-hidden="true" />
            </span>
            <div>
              <h3 id="manager-change-password-title" style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>Đổi mật khẩu cá nhân</h3>
              <small style={{ color: 'var(--admin-muted)', fontSize: '12px' }}>{userEmail}</small>
            </div>
          </div>
          <button className="manager-change-password-close" type="button" disabled={busy} onClick={onClose} aria-label="Đóng">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {error && <div role="alert" className="manager-change-password-error">{error}</div>}
        <form className="manager-change-password-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>MẬT KHẨU HIỆN TẠI
            <input type="password" required disabled={busy} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <label>MẬT KHẨU MỚI (TỐI THIỂU 8 KÝ TỰ)
            <input type="password" required minLength={8} disabled={busy} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <label>XÁC NHẬN MẬT KHẨU MỚI
            <input type="password" required minLength={8} disabled={busy} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" disabled={busy} onClick={onClose}>Hủy</button>
            <button type="submit" disabled={busy} className="admin-primary-btn">{busy ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
