import React from "react";
import { Server, Database, Lock, Shield } from "lucide-react";

export default function AdminSecurityOverview() {
  return (
<div className="internal-info-grid">
        <div className="internal-section-card">
          <div className="internal-card-head">
            <div>
              <h3>Thông số máy chủ & Bảo mật</h3>
              <p>Thông tin cấu hình hạ tầng hiện tại</p>
            </div>
          </div>
          <div className="internal-spec-list">
            <div className="internal-spec-row">
              <span className="spec-label">
                <Server size={14} /> Máy chủ ứng dụng
              </span>
              <span className="spec-val">Spring Boot 3.4.3 (Java 21)</span>
            </div>
            <div className="internal-spec-row">
              <span className="spec-label">
                <Database size={14} /> Cơ sở dữ liệu
              </span>
              <span className="spec-val">PostgreSQL 16 Enterprise</span>
            </div>
            <div className="internal-spec-row">
              <span className="spec-label">
                <Lock size={14} /> Cơ chế xác thực
              </span>
              <span className="spec-val">HMAC-SHA256 JWT Token</span>
            </div>
            <div className="internal-spec-row">
              <span className="spec-label">
                <Shield size={14} /> Quyền hạn tài khoản
              </span>
              <span className="spec-val badge">ROOT_ADMINISTRATOR</span>
            </div>
          </div>
        </div>

        <div className="internal-section-card internal-security-card">
          <div className="internal-card-head">
            <div>
              <h3>Chính sách an toàn thông tin</h3>
              <p>Quy chuẩn vận hành tài khoản nội bộ</p>
            </div>
          </div>
          <div className="internal-security-tips">
            <div className="tip-item">
              <span className="tip-icon">✓</span>
              <p>
                <strong>Phân quyền tối thiểu:</strong> Chỉ cấp quyền <code>ADMIN</code> cho người quản trị cấp cao. Nhân viên vận hành cấp các quyền Manager tương ứng.
              </p>
            </div>
            <div className="tip-item">
              <span className="tip-icon">✓</span>
              <p>
                <strong>Khóa tài khoản kịp thời:</strong> Khi nhân viên nghỉ việc hoặc có dấu hiệu bất thường, sử dụng tính năng <em>Khóa tài khoản</em> trong trang Tài khoản nội bộ.
              </p>
            </div>
            <div className="tip-item">
              <span className="tip-icon">✓</span>
              <p>
                <strong>Đổi mật khẩu định kỳ:</strong> Sử dụng mật khẩu phức tạp trên 8 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}
