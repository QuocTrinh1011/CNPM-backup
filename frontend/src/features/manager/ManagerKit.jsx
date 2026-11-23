import React, { useEffect, useId, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { FilterChip } from "./ManagerComponents";

export function ManagerPageToolbar({ children, meta }) {
  return (
    <div className="manager-page-toolbar">
      <div className="manager-page-toolbar-actions">{children}</div>
      {meta && <span className="manager-page-toolbar-meta">{meta}</span>}
    </div>
  );
}

export function FilterBar({
  search = "",
  onSearch,
  onSubmit,
  placeholder = "Tìm kiếm…",
  searchLabel,
  filters,
  advanced,
  chips = [],
  actions,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedNode = typeof advanced === "function" ? advanced({ open: showAdvanced }) : advanced;
  return (
    <div className="manager-filter-bar">
      <form
        className="manager-filter-bar__row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}
      >
        <div className="manager-filter-bar__search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder={placeholder}
            aria-label={searchLabel || placeholder}
            onChange={(event) => onSearch?.(event.target.value)}
          />
          {search && (
            <button
              type="button"
              className="admin-search-clear"
              aria-label="Xóa nội dung tìm kiếm"
              onClick={() => onSearch?.("")}
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
        {filters && <div className="manager-filter-bar__filters">{filters}</div>}
        <div className="manager-filter-bar__actions">
          {advanced && (
            <button
              type="button"
              className={`manager-filter-toggle${showAdvanced ? " is-active" : ""}`}
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((value) => !value)}
            >
              <SlidersHorizontal size={15} aria-hidden="true" />
              Bộ lọc
            </button>
          )}
          {actions}
        </div>
      </form>
      {advancedNode && showAdvanced && (
        <div className="manager-filter-bar__advanced">{advancedNode}</div>
      )}
      {chips.length > 0 && (
        <div className="manager-filter-bar__chips">
          {chips.map((chip, index) => (
            <FilterChip key={chip.key ?? `${chip.label}-${index}`} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DataTableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="manager-skeleton" role="status">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="manager-row">
          {Array.from({ length: cols }).map((__, col) => (
            <span
              key={col}
              className={`manager-skeleton__row${col === 0 ? "" : " is-narrow"}`}
              aria-hidden="true"
            />
          ))}
        </div>
      ))}
      <span className="manager-sr-only">Đang tải dữ liệu...</span>
    </div>
  );
}

export function EmptyState({ icon, title = "Chưa có dữ liệu", description, action }) {
  return (
    <div className="manager-empty">
      {icon && <span className="manager-empty__icon">{icon}</span>}
      <b className="manager-empty__title">{title}</b>
      {description && <p className="manager-empty__text">{description}</p>}
      {action && <div className="manager-empty__action">{action}</div>}
    </div>
  );
}

export function InlineNotice({ tone = "neutral", title, children, onDismiss }) {
  return (
    <div
      className={`manager-notice manager-notice--${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div className="manager-notice__body">
        {title && <b className="manager-notice__title">{title}</b>}
        {children && <p>{children}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="manager-notice__close"
          aria-label="Đóng thông báo"
          onClick={onDismiss}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const pillTones = {
  neutral: "",
  success: " manager-status-pill--success",
  warning: " manager-status-pill--warning",
  danger: " manager-status-pill--danger",
  info: " manager-status-pill--info",
  primary: " manager-status-pill--primary",
};

export function StatusPill({ tone = "neutral", dot = true, children }) {
  return (
    <span className={`admin-badge manager-status-pill${pillTones[tone] ?? ""}`}>
      {dot && <span className="manager-status-pill__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Tabs({ tabs = [], value, onChange, ariaLabel }) {
  const ref = useRef(null);
  const handleKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.key === value);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const target = tabs[next];
    if (!target) return;
    onChange?.(target.key);
    ref.current?.querySelector(`[data-tab-key="${target.key}"]`)?.focus();
  };
  return (
    <div className="manager-tabs" role="tablist" aria-label={ariaLabel} ref={ref} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          data-tab-key={tab.key}
          className="manager-tab"
          aria-selected={tab.key === value}
          tabIndex={tab.key === value ? 0 : -1}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.icon}
          {tab.label}
          {tab.count != null && <span className="manager-tab__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function MetricCard({ label, value, hint, icon, tone = "neutral" }) {
  return (
    <div className={`manager-metric manager-metric--${tone}`}>
      {icon && <span className="manager-metric__icon">{icon}</span>}
      <span className="manager-metric__label">{label}</span>
      <b className="manager-metric__value">{value}</b>
      {hint && <span className="manager-metric__hint">{hint}</span>}
    </div>
  );
}

const focusableSelector =
  'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)';

export function ManagerDialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  size = "md",
  sheetOnMobile = true,
  closeLabel = "Đóng hộp thoại",
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialog = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = dialog.current;
    const target = node?.querySelector(focusableSelector) || node;
    target?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  const close = () => onClose?.();
  const keyboard = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = [...dialog.current.querySelectorAll(focusableSelector)];
    const first = nodes[0];
    const last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div
      className="admin-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        onKeyDown={keyboard}
        className={`admin-dialog manager-dialog manager-dialog--${size}${sheetOnMobile ? " manager-dialog--sheet" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="manager-dialog__header">
          <div className="manager-dialog__heading">
            <h2 className="manager-dialog__title" id={titleId}>{title}</h2>
            {description && <p className="manager-dialog__description" id={descriptionId}>{description}</p>}
          </div>
          <button type="button" className="admin-action manager-dialog__close" aria-label={closeLabel} onClick={close}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="manager-dialog__body">{children}</div>
        {actions && <div className="admin-dialog-actions manager-dialog__footer">{actions}</div>}
      </div>
    </div>
  );
}
