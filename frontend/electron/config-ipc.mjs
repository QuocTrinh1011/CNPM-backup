export function isTrustedDesktopSender(event) {
  const frame = event?.senderFrame;
  if (!frame || frame.parent !== null || typeof frame.url !== 'string') return false;
  try {
    const url = new URL(frame.url);
    return url.protocol === 'app:'
      && url.hostname === 'desktop'
      && !url.port
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function assertTrusted(event) {
  if (isTrustedDesktopSender(event)) return;
  const error = new Error('UNTRUSTED_CONFIG_CALL');
  error.code = 'UNTRUSTED_CONFIG_CALL';
  throw error;
}

export function createDesktopConfigHandlers({ apiConfig, onSaved = async () => {} }) {
  return {
    async load(event) {
      assertTrusted(event);
      const apiBaseUrl = apiConfig.current();
      return apiBaseUrl ? { apiBaseUrl } : null;
    },
    async save(event, value) {
      assertTrusted(event);
      try {
        const saved = await apiConfig.save(value);
        await onSaved(event, saved);
        return { apiBaseUrl: saved.apiBaseUrl };
      } catch (cause) {
        const allowedCodes = new Set(['INSECURE_REMOTE_HTTP', 'INVALID_API_ORIGIN']);
        return { errorCode: allowedCodes.has(cause?.code) ? cause.code : 'CONFIG_SAVE_FAILED' };
      }
    },
  };
}

export function registerDesktopConfigIpc(ipcMain, dependencies) {
  const handlers = createDesktopConfigHandlers(dependencies);
  ipcMain.handle('desktop-config:load', handlers.load);
  ipcMain.handle('desktop-config:save-api-base-url', handlers.save);
  return handlers;
}
