import React, { useEffect, useState } from 'react';
import DesktopConfigScreen from './DesktopConfigScreen';
import DesktopConnectionScreen from './DesktopConnectionScreen';

export default function DesktopBootstrap({ children, reloadPage = () => window.location.reload() }) {
  const [config, setConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);

  useEffect(() => {
    const openConfig = () => {
      setBackendUnavailable(false);
      setShowConfig(true);
    };
    const markBackendUnavailable = () => setBackendUnavailable(true);
    window.addEventListener('shop-desktop-open-config', openConfig);
    window.addEventListener('shop-backend-unreachable', markBackendUnavailable);

    let active = true;
    Promise.resolve()
      .then(() => window.desktopConfig.load())
      .then(loadedConfig => {
        if (!active) return;
        setConfig(loadedConfig?.apiBaseUrl ? loadedConfig : null);
        setShowConfig(!loadedConfig?.apiBaseUrl);
        setConfigLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setConfig(null);
        setShowConfig(true);
        setConfigLoaded(true);
      });

    return () => {
      active = false;
      window.removeEventListener('shop-desktop-open-config', openConfig);
      window.removeEventListener('shop-backend-unreachable', markBackendUnavailable);
    };
  }, []);

  if (!configLoaded) return <main className="desktop-config"><p role="status">Đang kiểm tra cấu hình máy chủ...</p></main>;
  if (showConfig || !config?.apiBaseUrl) {
    return (
      <DesktopConfigScreen
        configLoaded
        forceOpen={showConfig}
        initialConfig={config}
        onConfigured={apiBaseUrl => {
          setConfig({ apiBaseUrl });
          setShowConfig(false);
          setBackendUnavailable(false);
        }}
      />
    );
  }
  if (backendUnavailable) {
    return (
      <DesktopConnectionScreen
        onChangeServer={() => window.dispatchEvent(new Event('shop-desktop-open-config'))}
        onRetry={reloadPage}
      />
    );
  }
  return children;
}
