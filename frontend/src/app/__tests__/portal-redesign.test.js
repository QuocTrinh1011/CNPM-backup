// @vitest-environment jsdom
// CSS contracts: new portal styles must not leak into the system Admin.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const userStyles = readFileSync('src/features/storefront/styles/user-redesign.css', 'utf8');
const managerStyles = readFileSync('src/manager-redesign.css', 'utf8');
const newFormStyles = readFileSync('src/features/storefront/styles/customer-new-form.css', 'utf8');
const cockpitStyles = readFileSync('src/manager-cockpit.css', 'utf8');
const adminStyles = ['admin-governance.css','admin-aurora.css'].map(file => readFileSync(`src/${file}`, 'utf8'));

function rules(css) {
  const style = document.createElement('style');
  style.textContent = css.replace(/^@import.*$/gm, '');
  document.head.append(style);
  const result = [];
  const walk = entries => {
    for (const rule of entries) {
      if (rule.selectorText) result.push(rule.selectorText);
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  walk(style.sheet.cssRules);
  style.remove();
  return result;
}

describe('portal redesign isolation', () => {
  it('scopes Aurora to the system Admin without restyling Manager or User', () => {
    for (const css of adminStyles) {
      for (const selector of rules(css)) expect(selector).toMatch(/^\.admin-shell\.internal-portal/);
      expect(css).not.toContain('@import');
    }
    expect(adminStyles[1]).toContain('font-family: "Manrope"');
    expect(adminStyles[1]).toContain('pointer-events: none;');
  });
  it('keeps logout and portal links visible in mobile Admin', () => {
    expect(adminStyles[1]).toContain('.internal-sidebar-footer { display: block;');
    expect(adminStyles[1]).toContain('.internal-nav-link.external { display: inline-flex; }');
    expect(adminStyles[1]).toContain('.internal-logout-btn { background: transparent;');
    expect(adminStyles[1]).toContain('.internal-login button { color: #fff; }');
    expect(adminStyles[1]).toContain('.internal-directory-panel { min-width: 0; width: 100%;');
  });
  it('keeps the Manager cockpit isolated from User and system Admin', () => {
    for (const selector of rules(cockpitStyles)) expect(selector).toMatch(/^\.manager-(shell|login)/);
    expect(cockpitStyles).not.toContain('@import');
    expect(cockpitStyles).toContain('font-family: "Manrope"');
    expect(cockpitStyles).toContain('.admin-primary { background: var(--admin-primary); color: #07100d; }');
    expect(cockpitStyles).toContain('max-height: 90dvh;');
    expect(cockpitStyles).not.toContain('.manager-login.admin-login-card');
  });
  it('retains tablet drawer behavior and mobile product cards in the cockpit', () => {
    expect(cockpitStyles).toContain('@media (max-width: 900px)');
    expect(cockpitStyles).toContain('.admin-mobile-toggle { display: grid;');
    expect(cockpitStyles).toContain('.admin-sidebar.is-open { transform: translateX(0); }');
    expect(cockpitStyles).toContain('.manager-product-table table { min-width: 0; }');
    expect(cockpitStyles).toContain('prefers-reduced-motion');
  });
  it('scopes the ZIP design to User and preserves mobile toast and one-font rules', () => {
    for (const selector of rules(newFormStyles)) expect(selector).toMatch(/^\.site-shell/);
    expect(newFormStyles).toContain('--serif: var(--sans)');
    expect(newFormStyles).toContain('--mono: var(--sans)');
    expect(newFormStyles).toContain('.toast { top: auto; height: auto; }');
    expect(newFormStyles).toContain('height: auto; padding: 12px 0;');
    expect(newFormStyles).not.toContain('@import');
  });
  it('keeps every User selector inside the storefront in all breakpoints', () => {
    const selectors = rules(userStyles);
    expect(selectors.length).toBeGreaterThan(50);
    for (const selector of selectors) expect(selector).toMatch(/^\.site-shell/);
    expect(userStyles).toContain("--sans: 'Manrope'");
    expect(userStyles).toContain('[data-shop-theme="dark"]');
  });
  it('keeps Manager selectors separate from Admin, including login and dark mode', () => {
    const selectors = rules(managerStyles);
    expect(selectors.length).toBeGreaterThan(30);
    for (const selector of selectors) expect(selector).toMatch(/^\.manager-(shell|login)/);
    expect(managerStyles).not.toMatch(/(^|\n):root\s*\{/);
    expect(managerStyles).toContain('[data-theme="dark"]');
  });
  it('keeps both purchase actions aligned and checkout single-column on small screens', () => {
    expect(userStyles).toMatch(/product-modal-actions \{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
    expect(userStyles).toMatch(/shop-checkout-grid \{ grid-template-columns: minmax\(0,1fr\)/);
    expect(userStyles).toContain('prefers-reduced-motion');
  });
  it('loads fonts once at the entry and keeps Manager login links in the same font', () => {
    const entry = readFileSync('index.html', 'utf8');
    expect(entry).toContain('family=Manrope');
    expect(entry.match(/fonts.googleapis.com\/css2/g)).toHaveLength(1);
    for (const file of ['styles/styles.css', 'features/storefront/styles/storefront.css', 'shared/styles/admin-design.css', 'features/storefront/styles/user-redesign.css', 'manager-redesign.css']) {
      expect(readFileSync(`src/${file}`, 'utf8')).not.toContain('@import url');
    }
    expect(managerStyles).toContain('--mono: var(--sans)');
    expect(managerStyles).toContain('input,a,small,label');
  });
  it('keeps mobile input text readable and stacks the Admin hero', () => {
    expect(userStyles).toContain('textarea) { font-size: 16px; }');
    expect(managerStyles).toContain('.manager-login input { font-size: 16px; }');
    expect(readFileSync('src/shared/styles/internal-portal.css', 'utf8')).toContain('.internal-hero-banner { flex-direction: column;');
  });
  it('keeps notices content-sized instead of stretching between top and bottom', () => {
    expect(userStyles).toMatch(/\.toast \{[^}]*top: auto;[^}]*height: auto;/);
    expect(userStyles).toContain('bottom: calc(88px + env(safe-area-inset-bottom,0px))');
    const app = readFileSync('src/app/App.jsx', 'utf8');
    expect(app).toContain('aria-label="Đóng thông báo"');
    expect(app).toContain('window.clearTimeout(timer)');
  });
  it('aligns the Manager drawer and toggle at the tablet breakpoint', () => {
    const tablet = managerStyles.slice(managerStyles.indexOf('@media (max-width: 900px)'), managerStyles.indexOf('@media (max-width: 600px)'));
    expect(tablet).toContain('.admin-mobile-toggle { display: grid;');
    expect(tablet).toContain('transform: translateX(-105%)');
    expect(tablet).toContain('.admin-sidebar.is-open { transform: translateX(0); }');
    expect(tablet).toContain('height: auto;');
  });
  it('emphasizes selected cart lines and keeps long tables within Manager', () => {
    expect(userStyles).toContain('.cart-line:has(.cart-line-checkbox:checked)');
    expect(userStyles).toContain('font-variant-numeric: tabular-nums');
    expect(managerStyles).toContain('max-width: 100%; overflow-x: auto;');
  });
});
