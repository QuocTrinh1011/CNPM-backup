import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, ROLE_FIXTURES } from './credentials.js';

for (const fixture of ROLE_FIXTURES) {
  test(`${fixture.name} fixture can authenticate`, async ({ page }) => {
    const origin = fixture.portal === 'admin'
      ? 'http://localhost:5174'
      : fixture.portal === 'user' ? 'http://localhost:5173' : 'http://localhost:5175';
    const loginPath = fixture.portal === 'admin'
      ? '/api/admin/auth/login'
      : fixture.portal === 'user' ? '/api/auth/login' : '/api/manager/auth/login';
    const buttonName = fixture.portal === 'admin'
      ? /ĐĂNG NHẬP ADMIN/i
      : fixture.portal === 'user' ? /ĐĂNG NHẬP →/i : /ĐĂNG NHẬP QUẢN LÝ/i;

    const loginPage = fixture.portal === 'user' ? '/dang-nhap' : `/${fixture.portal}/login`;
    await page.goto(`${origin}${loginPage}`);
    await page.getByLabel(/email/i).fill(fixture.email);
    await page.getByLabel(/mật khẩu/i).fill(E2E_PASSWORD);

    const loginResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === loginPath && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: buttonName }).click();

    expect((await loginResponse).status()).toBe(200);
  });
}
