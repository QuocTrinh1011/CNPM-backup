import React, { useState } from "react";
import { adminSignIn } from "../../../api/manager-api";

const userOrigin = import.meta.env.VITE_USER_ORIGIN || "http://localhost:5173";

export function AdminLogin({ theme, onAuthenticated, onNotice, error }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const session = await adminSignIn(form);
      onAuthenticated(session);
    } catch (error) {
      onNotice(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-login manager-login" data-theme={theme}>
      <div className="admin-login-card">
        <div className="admin-mark">
          AL<span>MANAGER</span>
        </div>
        <span className="admin-eyebrow">ANH LỚN SHOP / PRIVATE AREA</span>
        <h1>
          Không gian
          <br />
          <i>quản lý vận hành.</i>
        </h1>
        <p>Đăng nhập để quản lý cửa hàng và dữ liệu khách hàng.</p>
        {error&&<p role="alert">{error}</p>}
        <form onSubmit={submit}>
          <label>
            EMAIL
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
          <label>
            MẬT KHẨU
            <input
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
          </label>
          <button className="admin-primary" disabled={busy}>
            {busy ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP QUẢN LÝ →"}
          </button>
        </form>
        <small className="admin-dev-note">
          Tài khoản quản lý do Admin hệ thống cấp.
        </small>
        <a href={userOrigin}>← Về storefront</a>
      </div>
    </div>
  );
}
