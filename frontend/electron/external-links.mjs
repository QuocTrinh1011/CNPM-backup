export function approvedExternalUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'pay.payos.vn' || url.port || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function isDesktopAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'app:' && url.hostname === 'desktop' && !url.port && !url.username && !url.password;
  } catch {
    return false;
  }
}

function openApprovedExternal(value, shell) {
  const url = approvedExternalUrl(value);
  if (!url) return;
  Promise.resolve(shell.openExternal(url.href)).catch(() => {});
}

export function installNavigationGuards(webContents, shell) {
  webContents.setWindowOpenHandler(({ url }) => {
    openApprovedExternal(url, shell);
    return { action: 'deny' };
  });

  const guardNavigation = (event, value) => {
    if (isDesktopAppUrl(value)) return;
    event.preventDefault();
    openApprovedExternal(value, shell);
  };
  webContents.on('will-navigate', guardNavigation);
  webContents.on('will-redirect', guardNavigation);
}
