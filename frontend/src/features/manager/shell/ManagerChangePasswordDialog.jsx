import React, { useState } from "react";
import { managerChangePassword } from "../../../api/manager-api";
import { InlineNotice, ManagerDialog } from "../ManagerKit";

export function ManagerChangePasswordDialog({ open, onClose, onSuccess, userEmail }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (!busy) onClose?.();
  };

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
      onClose?.();
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
    <ManagerDialog
      open={open}
      onClose={close}
      title="Đổi mật khẩu cá nhân"
      description={userEmail}
      size="sm"
      closeLabel="Đóng"
    >
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      <form className="manager-change-password-form" onSubmit={handleSubmit}>
        <label>
          MẬT KHẨU HIỆN TẠI
          <input
            type="password"
            required
            disabled={busy}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label>
          MẬT KHẨU MỚI (TỐI THIỂU 8 KÝ TỰ)
          <input
            type="password"
            required
            minLength={8}
            disabled={busy}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label>
          XÁC NHẬN MẬT KHẨU MỚI
          <input
            type="password"
            required
            minLength={8}
            disabled={busy}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>
        <div className="manager-change-password-actions">
          <button type="button" className="admin-action" disabled={busy} onClick={close}>Hủy</button>
          <button type="submit" className="admin-primary" disabled={busy}>
            {busy ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </ManagerDialog>
  );
}
