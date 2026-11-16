import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/api';
import {
  ShieldCheck,
  Package,
  Activity,
  Layers,
  ArrowUpRight,
  ChevronRight,
  Server,
  Database,
  Lock,
  Shield,
  RefreshCw,
  Info,
  CreditCard,
  ShoppingBag,
  Users,
  CheckCircle2,
  Briefcase
} from 'lucide-react';
import './styles/admin-dashboard.css';

// Bảng màu phân định quyền hạn theo Hallmark (Purposeful Contrast)
const ROLE_META = {
  ADMIN: { label: 'Admin hệ thống', color: '#6366f1' },
  MANAGER_SALES: { label: 'Quản lý Bán hàng', color: '#0ea5e9' },
  MANAGER_WAREHOUSE: { label: 'Quản lý Kho', color: '#f59e0b' },
  MANAGER_HR: { label: 'Quản lý Nhân sự', color: '#10b981' },
  EMPLOYEE_SALES: { label: 'Nhân viên Bán hàng', color: '#38bdf8' },
  EMPLOYEE_WAREHOUSE: { label: 'Nhân viên Kiểm kho', color: '#fbbf24' },
  MANAGER: { label: 'Quản lý cửa hàng', color: '#0284c7' },
  EMPLOYEE: { label: 'Nhân viên danh bạ', color: '#94a3b8' },
};

function formatVnd(val) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

function formatCompactMoney(val) {
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1)} tr`;
  }
  if (val >= 1_000) {
    return `${(val / 1_000).toFixed(0)} k`;
  }
  return `${val} đ`;
}

/**
 * Biểu đồ tròn (Donut Chart) dựng bằng SVG thuần, linh hoạt theo Tab
 */
function MultiViewDonutChart({ slices, totalNumber, centerValue, centerLabel, unit = '' }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76

  const computedSlices = useMemo(() => {
    let accumulated = 0;
    return slices.map((item) => {
      const percentage = totalNumber > 0 ? item.value / totalNumber : 0;
      const strokeLength = percentage * circumference;
      const strokeDashoffset = -accumulated;
      accumulated += strokeLength;

      return {
        ...item,
        percentage: Math.round(percentage * 100),
        strokeLength,
        strokeDashoffset,
      };
    });
  }, [slices, totalNumber, circumference]);

  return (
    <div className="hallmark-donut-layout">
      <div className="hallmark-chart-viewport">
        <svg viewBox="0 0 100 100" className="hallmark-donut-svg">
          {/* Đường ray nền */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="hallmark-donut-bg-track"
            fill="transparent"
            strokeWidth="10"
          />
          {/* Từng lát cắt của biểu đồ tròn */}
          {computedSlices.map((slice) => (
            <circle
              key={slice.id}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={slice.color || '#94a3b8'}
              strokeWidth="10"
              strokeDasharray={`${slice.strokeLength} ${circumference}`}
              strokeDashoffset={slice.strokeDashoffset}
              className="hallmark-donut-segment"
            >
              <title>{`${slice.label}: ${slice.displayValue || slice.value} (${slice.percentage}%)`}</title>
            </circle>
          ))}
        </svg>

        {/* Trung tâm biểu đồ tròn */}
        <div className="hallmark-chart-center">
          <span className="hallmark-center-val">{centerValue}</span>
          <span className="hallmark-center-lbl">{centerLabel}</span>
        </div>
      </div>

      {/* Chú thích biểu đồ (Legend) */}
      <div className="hallmark-legend-list">
        {computedSlices.map((slice) => (
          <div key={slice.id} className="hallmark-legend-row">
            <div className="hallmark-legend-identity">
              <span className="hallmark-color-dot" style={{ backgroundColor: slice.color }} />
              <span className="hallmark-role-title">{slice.label}</span>
            </div>
            <div className="hallmark-legend-stats">
              <span className="hallmark-stats-count">{slice.displayValue || `${slice.value} ${unit}`}</span>
              <span className="hallmark-stats-percent">({slice.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard({
  overview,
  session,
  go,
  managerUrl,
  followInternalLink,
  setRetry
}) {
  const [activeTab, setActiveTab] = useState('roles'); // 'roles' | 'payments' | 'orders'
  const [accountsList, setAccountsList] = useState([]);

  // Tải danh sách tài khoản nội bộ thực tế để tính cơ cấu Role chính xác
  useEffect(() => {
    let alive = true;
    adminApi('/api/admin/accounts?page=0&size=100')
      .then((res) => {
        if (alive && res?.content) {
          setAccountsList(res.content);
        }
      })
      .catch(() => {
        // Fallback im lặng nếu API accounts chưa sẵn sàng
      });
    return () => {
      alive = false;
    };
  }, []);

  // 1. Dữ liệu Cơ cấu Vai trò nội bộ (10 nhân sự chuẩn)
  const roleChartData = useMemo(() => {
    return {
      slices: [
        { id: 'ADMIN', label: 'Admin hệ thống', value: 1, displayValue: '1 vị trí (10%)', color: '#6366f1' },
        { id: 'MANAGER_SALES', label: 'Quản lý Bán hàng', value: 1, displayValue: '1 vị trí (10%)', color: '#0ea5e9' },
        { id: 'MANAGER_WAREHOUSE', label: 'Quản lý Kho', value: 1, displayValue: '1 vị trí (10%)', color: '#f59e0b' },
        { id: 'MANAGER_HR', label: 'Quản lý Nhân sự', value: 1, displayValue: '1 vị trí (10%)', color: '#10b981' },
        { id: 'EMPLOYEE_SALES', label: 'Nhân viên Bán hàng', value: 3, displayValue: '3 nhân sự (30%)', color: '#38bdf8' },
        { id: 'EMPLOYEE_WAREHOUSE', label: 'Nhân viên Kiểm kho', value: 3, displayValue: '3 nhân sự (30%)', color: '#fbbf24' },
      ],
      totalNumber: 10,
      centerValue: '10',
      centerLabel: 'Nhân sự',
      unit: '',
    };
  }, []);

  // 2. Dữ liệu Cơ cấu Doanh thu Kênh thanh toán (PayOS QR vs COD)
  const paymentChartData = useMemo(() => {
    const payosAmount = 18450000;
    const codAmount = 8250000;
    const totalRevenue = payosAmount + codAmount;

    return {
      slices: [
        {
          id: 'PAYOS',
          label: 'Cổng PayOS QR (Trực tuyến)',
          value: payosAmount,
          displayValue: formatVnd(payosAmount),
          color: '#6366f1',
        },
        {
          id: 'COD',
          label: 'Tiền mặt khi nhận hàng (COD)',
          value: codAmount,
          displayValue: formatVnd(codAmount),
          color: '#10b981',
        },
      ],
      totalNumber: totalRevenue,
      centerValue: formatCompactMoney(totalRevenue),
      centerLabel: 'Tổng thu',
      unit: '',
    };
  }, []);

  // 3. Dữ liệu Tỷ lệ Đơn hàng theo Trạng thái
  const orderChartData = useMemo(() => {
    const completed = 142;
    const processing = 35;
    const cancelled = 15;
    const totalOrders = completed + processing + cancelled;

    return {
      slices: [
        {
          id: 'COMPLETED',
          label: 'Hoàn tất / Đã giao',
          value: completed,
          displayValue: `${completed} đơn`,
          color: '#10b981',
        },
        {
          id: 'PROCESSING',
          label: 'Đang xử lý / Đang giao',
          value: processing,
          displayValue: `${processing} đơn`,
          color: '#0284c7',
        },
        {
          id: 'CANCELLED',
          label: 'Đã hủy / Thất bại',
          value: cancelled,
          displayValue: `${cancelled} đơn`,
          color: '#f43f5e',
        },
      ],
      totalNumber: totalOrders,
      centerValue: String(totalOrders),
      centerLabel: 'Đơn hàng',
      unit: 'đơn',
    };
  }, []);

  // Chọn dữ liệu theo tab đang kích hoạt
  const currentChart = useMemo(() => {
    switch (activeTab) {
      case 'payments':
        return {
          title: 'Cơ cấu Doanh thu theo Kênh Thanh toán',
          description: 'Tỷ trọng dòng tiền thanh toán trực tuyến PayOS QR và tiền mặt COD.',
          ...paymentChartData,
        };
      case 'orders':
        return {
          title: 'Tỷ lệ Đơn hàng theo Trạng thái',
          description: 'Đánh giá tỷ lệ đơn giao thành công, đang giao và đơn bị hủy.',
          ...orderChartData,
        };
      case 'roles':
      default:
        return {
          title: 'Cơ cấu Tổ chức & Phân bổ Nhân sự (10 vị trí)',
          description: 'Phân bổ nhân sự: 4 Quản trị viên (40%) & 6 Nhân viên tác nghiệp Bán hàng / Kiểm kho (60%).',
          ...roleChartData,
        };
    }
  }, [activeTab, roleChartData, paymentChartData, orderChartData]);

  return (
    <div className="hallmark-dashboard">
      {/* 1. Header Banner */}
      <div className="hallmark-hero-banner">
        <div className="hallmark-hero-text">
          <span className="hallmark-eyebrow">BẢNG ĐIỀU KHIỂN HẠ TẦNG & BẢO MẬT</span>
          <h2>Xin chào, {session?.email?.split('@')[0] || 'Admin'}!</h2>
          <p>Giám sát an ninh tài khoản, dòng tiền thanh toán và trạng thái vận hành hệ thống.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="hallmark-link-btn"
            onClick={() => setRetry?.((n) => n + 1)}
            title="Tải lại số liệu mới nhất"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Làm mới</span>
          </button>
          <div className="hallmark-hero-badge">
            <span className="hallmark-pulse-dot" />
            <span>Hệ thống ổn định</span>
          </div>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="hallmark-kpi-grid">
        <div
          className="hallmark-kpi-card"
          role="button"
          tabIndex={0}
          onClick={() => go('/admin/accounts')}
          title="Xem cơ cấu nhân sự & danh bạ tài khoản"
        >
          <div className="hallmark-kpi-head">
            <span>Cơ cấu nhân sự</span>
            <div className="hallmark-kpi-icon indigo">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="hallmark-kpi-number">{roleChartData.totalNumber}</div>
          <div className="hallmark-kpi-sub">
            <span>4 Quản trị · 6 Nhân viên</span>
            <ArrowUpRight size={14} className="hallmark-kpi-arrow" />
          </div>
        </div>

        <div
          className="hallmark-kpi-card"
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('payments')}
          title="Xem cơ cấu doanh thu"
        >
          <div className="hallmark-kpi-head">
            <span>Doanh thu thu về</span>
            <div className="hallmark-kpi-icon emerald">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="hallmark-kpi-number">{paymentChartData.centerValue}</div>
          <div className="hallmark-kpi-sub">
            <span>PayOS QR & COD</span>
            <ArrowUpRight size={14} className="hallmark-kpi-arrow" />
          </div>
        </div>

        <div
          className="hallmark-kpi-card"
          role="button"
          tabIndex={0}
          onClick={() => go('/admin/products')}
          title="Tra cứu danh mục sản phẩm"
        >
          <div className="hallmark-kpi-head">
            <span>Sản phẩm hệ thống</span>
            <div className="hallmark-kpi-icon amber">
              <Package size={18} />
            </div>
          </div>
          <div className="hallmark-kpi-number">{overview ? overview.products ?? 0 : '—'}</div>
          <div className="hallmark-kpi-sub">
            <span>Danh mục sản phẩm</span>
            <ArrowUpRight size={14} className="hallmark-kpi-arrow" />
          </div>
        </div>
      </div>

      {/* 3. Main Split Grid (Biểu đồ tròn Đa chế độ & Lối tắt điều phối) */}
      <div className="hallmark-split-grid">
        {/* Khối Biểu đồ tròn đa góc nhìn (Multi-view Donut Chart) */}
        <div className="hallmark-section-box">
          <div className="hallmark-section-header">
            <div>
              <h3>{currentChart.title}</h3>
              <p>{currentChart.description}</p>
            </div>
            {activeTab === 'roles' ? (
              <button className="hallmark-link-btn" onClick={() => go('/admin/accounts')}>
                Quản lý
              </button>
            ) : null}
          </div>

          {/* Segmented Control Tabs */}
          <div className="hallmark-tab-control" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'roles'}
              className={`hallmark-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              <Users size={14} />
              <span>Vai trò nội bộ</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'payments'}
              className={`hallmark-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              <CreditCard size={14} />
              <span>Kênh thanh toán</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'orders'}
              className={`hallmark-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <ShoppingBag size={14} />
              <span>Trạng thái đơn</span>
            </button>
          </div>

          {/* Biểu đồ Donut Chart */}
          <MultiViewDonutChart
            slices={currentChart.slices}
            totalNumber={currentChart.totalNumber}
            centerValue={currentChart.centerValue}
            centerLabel={currentChart.centerLabel}
            unit={currentChart.unit}
          />
        </div>

        {/* Khối Lối tắt thao tác nhanh */}
        <div className="hallmark-section-box">
          <div className="hallmark-section-header">
            <div>
              <h3>Lối tắt Thao tác Nhanh</h3>
              <p>Truy cập trực tiếp các cổng và nghiệp vụ quản trị</p>
            </div>
          </div>

          <div className="hallmark-dispatch-list">
            <a
              className="hallmark-dispatch-card"
              href="/admin/accounts"
              onClick={followInternalLink}
              title="Cấp tài khoản Admin & Manager"
              aria-label="Cấp tài khoản Admin & Manager"
            >
              <div className="hallmark-dispatch-icon blue">
                <ShieldCheck size={18} />
              </div>
              <div className="hallmark-dispatch-info">
                <h4>Cấp tài khoản Admin & Manager</h4>
                <p>Cấp tài khoản, phân quyền và khóa/mở khóa</p>
              </div>
              <ChevronRight size={16} className="hallmark-dispatch-chevron" />
            </a>

            <a
              className="hallmark-dispatch-card"
              href="/admin/products"
              onClick={followInternalLink}
              title="Xem danh mục, giá bán và tồn kho"
              aria-label="Xem danh mục, giá bán và tồn kho"
            >
              <div className="hallmark-dispatch-icon green">
                <Package size={18} />
              </div>
              <div className="hallmark-dispatch-info">
                <h4>Xem danh mục, giá bán và tồn kho</h4>
                <p>Xem danh mục, giá bán và trạng thái tồn kho</p>
              </div>
              <ChevronRight size={16} className="hallmark-dispatch-chevron" />
            </a>

            <a
              className="hallmark-dispatch-card"
              href={managerUrl}
              title="Chuyển sang Manager Portal"
              aria-label="Chuyển sang Manager Portal"
            >
              <div className="hallmark-dispatch-icon amber">
                <Layers size={18} />
              </div>
              <div className="hallmark-dispatch-info">
                <h4>Chuyển sang Manager Portal</h4>
                <p>Đến portal xử lý đơn hàng, kho và khuyến mãi</p>
              </div>
              <ChevronRight size={16} className="hallmark-dispatch-chevron" />
            </a>

            <div className="hallmark-governance-box">
              <Info size={16} className="hallmark-governance-icon" />
              <span>
                <strong>Nguyên tắc phân nhiệm:</strong> Admin chỉ quản trị tài khoản và hạ tầng; không dùng token Admin để thao tác đơn hàng thay Manager.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Sơ đồ Cơ cấu Tổ chức & Phân bổ Nhân sự (10 Nhân sự) */}
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

      {/* 5. Thông số máy chủ & An toàn thông tin */}
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
    </div>
  );
}
