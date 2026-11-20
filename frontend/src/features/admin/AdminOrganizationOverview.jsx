import React from "react";
import { Users, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function AdminOrganizationOverview({ go }) {
  return (
<div className="hallmark-org-section">
        <div className="hallmark-org-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ display: 'inline-flex', padding: '5px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                <Users size={16} />
              </span>
              <h3 style={{ margin: 0 }}>Sơ đồ Cơ cấu Tổ chức & Phân nhiệm (10 nhân sự)</h3>
            </div>
            <p>Mô hình vận hành 2 tầng: 4 Quản trị viên chỉ đạo và 6 Nhân viên tác nghiệp trực tiếp.</p>
          </div>
          <button
            type="button"
            className="hallmark-link-btn"
            onClick={() => go('/admin/accounts')}
            title="Mở danh bạ tài khoản nội bộ"
          >
            Quản lý tài khoản
          </button>
        </div>

        {/* Thanh tóm tắt tỷ lệ cơ cấu */}
        <div className="hallmark-org-summary-bar">
          <div className="hallmark-org-summary-item">
            <ShieldCheck size={15} style={{ color: '#6366f1' }} />
            <span>Tầng Quản trị: <strong>4 nhân sự (40%)</strong> · Admin, QL Bán hàng, QL Kho, QL Nhân sự</span>
          </div>
          <div className="hallmark-org-summary-divider" />
          <div className="hallmark-org-summary-item">
            <CheckCircle2 size={15} style={{ color: '#10b981' }} />
            <span>Tầng Tác nghiệp: <strong>6 nhân sự (60%)</strong> · 3 NV Bán hàng, 3 NV Kiểm kho</span>
          </div>
        </div>

        {/* Sơ đồ 2 Tầng: Tầng Quản trị (4 người) & Tầng Tác nghiệp (6 người) */}
        <div className="hallmark-org-tiers">
          {/* TẦNG QUẢN TRỊ (4 NGƯỜI) */}
          <div className="hallmark-tier-block">
            <div className="hallmark-tier-header">
              <div className="hallmark-tier-title-wrap">
                <span className="hallmark-tier-pill admin">TẦNG QUẢN TRỊ</span>
                <h4>Tầng Quản trị (4 người)</h4>
              </div>
              <span className="hallmark-tier-badge">40% Định biên (4/10) · Cấp điều hành</span>
            </div>

            <div className="hallmark-tier-grid-4">
              {/* 🟣 Admin hệ thống */}
              <div className="hallmark-role-card purple">
                <div className="hallmark-role-card-top">
                  <span className="hallmark-role-bullet purple">🟣</span>
                  <div className="hallmark-role-card-title">
                    <span className="hallmark-role-code system">ADMIN HỆ THỐNG</span>
                    <strong>Admin hệ thống</strong>
                  </div>
                  <span className="hallmark-role-count">1</span>
                </div>
                <div className="hallmark-role-desc">
                  Quản trị tài khoản, an ninh RBAC & hạ tầng máy chủ.
                </div>
              </div>

              {/* 🔵 Quản lý Bán hàng */}
              <div className="hallmark-role-card blue">
                <div className="hallmark-role-card-top">
                  <span className="hallmark-role-bullet blue">🔵</span>
                  <div className="hallmark-role-card-title">
                    <span className="hallmark-role-code sales">QUẢN LÝ BÁN HÀNG</span>
                    <strong>Quản lý Bán hàng</strong>
                  </div>
                  <span className="hallmark-role-count">1</span>
                </div>
                <div className="hallmark-role-desc">
                  Điều hành kinh doanh, giám sát doanh thu PayOS QR & COD.
                </div>
              </div>

              {/* 🟠 Quản lý Kho */}
              <div className="hallmark-role-card amber">
                <div className="hallmark-role-card-top">
                  <span className="hallmark-role-bullet amber">🟠</span>
                  <div className="hallmark-role-card-title">
                    <span className="hallmark-role-code warehouse">QUẢN LÝ KHO</span>
                    <strong>Quản lý Kho</strong>
                  </div>
                  <span className="hallmark-role-count">1</span>
                </div>
                <div className="hallmark-role-desc">
                  Định mức an toàn kho, cảnh báo hàng sắp hết (≤ 5), duyệt nhập hàng.
                </div>
              </div>

              {/* 🟢 Quản lý Nhân sự */}
              <div className="hallmark-role-card emerald">
                <div className="hallmark-role-card-top">
                  <span className="hallmark-role-bullet emerald">🟢</span>
                  <div className="hallmark-role-card-title">
                    <span className="hallmark-role-code hr">QUẢN LÝ NHÂN SỰ</span>
                    <strong>Quản lý Nhân sự</strong>
                  </div>
                  <span className="hallmark-role-count">1</span>
                </div>
                <div className="hallmark-role-desc">
                  Quản lý hồ sơ danh bạ 10 nhân sự, phân công ca trực & chấm công.
                </div>
              </div>
            </div>
          </div>

          {/* TẦNG TÁC NGHIỆP (6 NGƯỜI) */}
          <div className="hallmark-tier-block">
            <div className="hallmark-tier-header">
              <div className="hallmark-tier-title-wrap">
                <span className="hallmark-tier-pill staff">TẦNG TÁC NGHIỆP</span>
                <h4>Tầng Tác nghiệp (6 người)</h4>
              </div>
              <span className="hallmark-tier-badge">60% Định biên (6/10) · Quản lý Nhân sự trực tiếp điều phối ca & KPI</span>
            </div>

            <div className="hallmark-tier-grid-2">
              {/* 🔷 Khối 3 Nhân viên Bán hàng */}
              <div className="hallmark-team-card blue">
                <div className="hallmark-team-header">
                  <div className="hallmark-team-title">
                    <span className="hallmark-role-bullet cyan">🔷</span>
                    <div>
                      <h5>3 Nhân viên Bán hàng</h5>
                      <span className="hallmark-team-duty-headline">
                        Trực quầy/web, xác nhận thanh toán và điều phối đơn giao hàng.
                      </span>
                    </div>
                  </div>
                  <span className="hallmark-role-count">3</span>
                </div>

                <div className="hallmark-team-subcards">
                  <div className="hallmark-subcard">
                    <div className="hallmark-subcard-head">
                      <span className="hallmark-subcard-tag sales">NV Bán hàng 01</span>
                      <strong>Trực quầy & Web</strong>
                    </div>
                    <p>Tiếp nhận đơn hàng trực tuyến từ website và hỗ trợ tư vấn khách mua tại quầy</p>
                  </div>

                  <div className="hallmark-subcard">
                    <div className="hallmark-subcard-head">
                      <span className="hallmark-subcard-tag sales">NV Bán hàng 02</span>
                      <strong>Xác nhận thanh toán</strong>
                    </div>
                    <p>Đối soát cổng thanh toán PayOS QR và gọi điện xác nhận đơn thanh toán COD</p>
                  </div>

                  <div className="hallmark-subcard">
                    <div className="hallmark-subcard-head">
                      <span className="hallmark-subcard-tag sales">NV Bán hàng 03</span>
                      <strong>Điều phối đơn giao hàng</strong>
                    </div>
                    <p>Theo dõi tiến độ bưu cục vận chuyển và giải quyết các yêu cầu hỗ trợ đơn hàng</p>
                  </div>
                </div>
              </div>

              {/* 🟡 Khối 3 Nhân viên Kiểm kho */}
              <div className="hallmark-team-card amber">
                <div className="hallmark-team-header">
                  <div className="hallmark-team-title">
                    <span className="hallmark-role-bullet yellow">🟡</span>
                    <div>
                      <h5>3 Nhân viên Kiểm kho</h5>
                      <span className="hallmark-team-duty-headline">
                        Nhập hàng lên giá kệ, kiểm đếm hạn sử dụng & đóng gói xuất kho.
                      </span>
                    </div>
                  </div>
                  <span className="hallmark-role-count">3</span>
                </div>

                <div className="hallmark-team-subcards">
                  <div className="hallmark-subcard">
                    <div className="hallmark-subcard-head">
                      <span className="hallmark-subcard-tag warehouse">NV Kiểm kho 01</span>
                      <strong>Nhập hàng lên giá kệ</strong>
                    </div>
                    <p>Kiểm đếm số lượng thực nhận từ kiện hàng nhập, đối chiếu chứng từ và xếp lên giá kệ</p>
                  </div>

                  <div className="hallmark-subcard">
                    <div className="hallmark-subcard-head">
                      <span className="hallmark-subcard-tag warehouse">NV Kiểm kho 02</span>
                      <strong>Kiểm đếm hạn sử dụng & chất lượng</strong>
                    </div>
                    <p>Kiểm tra chất lượng vải may, tem mác bao bì, hạn sử dụng & duy trì định mức an toàn</p>
                  </div>

                  <div className="hallmark-subcard">
                    <div className="hallmark-subcard-head">
                      <span className="hallmark-subcard-tag warehouse">NV Kiểm kho 03</span>
                      <strong>Đóng gói xuất kho</strong>
                    </div>
                    <p>Soạn hàng theo phiếu xuất kho, đóng gói cẩn thận và bàn giao cho shipper vận chuyển</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
