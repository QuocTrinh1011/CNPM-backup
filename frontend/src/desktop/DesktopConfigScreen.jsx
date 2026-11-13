import React, { useEffect, useState } from 'react';
import './DesktopConfigScreen.css';

function errorMessage(error) {
  if (error?.code === 'INSECURE_REMOTE_HTTP') return 'Máy chủ bên ngoài máy này phải sử dụng HTTPS.';
  if (error?.code === 'INVALID_API_ORIGIN') return 'Nhập một địa chỉ gốc hợp lệ, không kèm đường dẫn, tham số hoặc thông tin đăng nhập.';
  return 'Không thể lưu địa chỉ máy chủ. Hãy kiểm tra lại rồi thử lần nữa.';
}

export default function DesktopConfigScreen({
  children,
  configLoaded = false,
  initialConfig = null,
  forceOpen = false,
  onConfigured,
}) {
  const [apiBaseUrl, setApiBaseUrl] = useState(initialConfig?.apiBaseUrl || 'http://localhost:8080');
  const [configured, setConfigured] = useState(Boolean(configLoaded && initialConfig?.apiBaseUrl && !forceOpen));
  const [loading, setLoading] = useState(!configLoaded);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (configLoaded) {
      setApiBaseUrl(initialConfig?.apiBaseUrl || 'http://localhost:8080');
      setConfigured(Boolean(initialConfig?.apiBaseUrl && !forceOpen));
      setLoading(false);
      return undefined;
    }
    let active = true;
    window.desktopConfig.load()
      .then(config => {
        if (!active) return;
        if (config?.apiBaseUrl) {
          setApiBaseUrl(config.apiBaseUrl);
          setConfigured(true);
        }
      })
      .catch(() => {
        if (active) setError('Không đọc được cấu hình hiện tại. Bạn có thể nhập địa chỉ máy chủ bên dưới.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [configLoaded, forceOpen, initialConfig]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await window.desktopConfig.saveApiBaseUrl(apiBaseUrl.trim());
      if (result?.errorCode) throw Object.assign(new Error(result.errorCode), { code: result.errorCode });
      if (!result?.apiBaseUrl) throw new Error('INVALID_API_ORIGIN');
      setApiBaseUrl(result.apiBaseUrl);
      setConfigured(true);
      onConfigured?.(result.apiBaseUrl);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="desktop-config"><p role="status">Đang đọc cấu hình...</p></main>;
  if (configured) return children ?? null;

  return (
    <main className="desktop-config">
      <section className="desktop-config__card" aria-labelledby="desktop-config-title">
        <p className="desktop-config__eyebrow">ANH LỚN SHOP · DESKTOP</p>
        <h1 id="desktop-config-title">Kết nối máy chủ CRM</h1>
        <p className="desktop-config__description">Nhập địa chỉ backend Spring Boot để kết nối các cổng Khách hàng, Admin và Manager.</p>
        <form onSubmit={save}>
          <label htmlFor="desktop-api-origin">Địa chỉ API</label>
          <input
            autoComplete="url"
            id="desktop-api-origin"
            onChange={event => setApiBaseUrl(event.target.value)}
            placeholder="http://localhost:8080"
            required
            type="url"
            value={apiBaseUrl}
          />
          <p className="desktop-config__hint">HTTP chỉ dùng được trên máy này. Máy chủ ở mạng khác cần địa chỉ HTTPS.</p>
          {error && <p className="desktop-config__error" role="alert">{error}</p>}
          <button disabled={saving} type="submit">{saving ? 'Đang lưu...' : 'Lưu và kết nối'}</button>
        </form>
      </section>
    </main>
  );
}
