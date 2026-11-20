import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/styles.css';
const App = React.lazy(() => import('./app/portals/UserPortal'));
const AdminApp = React.lazy(() => import('./app/portals/AdminPortal'));
const ManagerApp = React.lazy(() => import('./app/portals/ManagerPortal'));

const mode = import.meta.env.MODE;
const isAdmin = mode === 'admin' || (mode !== 'user' && (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')));
const isManager = mode === 'manager' || (mode !== 'user' && mode !== 'admin' && /^\/manager(?:\/|$)/.test(window.location.pathname));
const selectedPortal = isManager ? <ManagerApp /> : isAdmin ? <AdminApp /> : <App />;
const root = createRoot(document.getElementById('root'));
const portalContent = <React.Suspense fallback={<p role="status">Đang tải NOVA SHOP...</p>}>{selectedPortal}</React.Suspense>;

if (mode === 'desktop') {
  void import('./desktop/DesktopBootstrap.jsx').then(({ default: DesktopBootstrap }) => {
    root.render(<React.StrictMode><DesktopBootstrap>{portalContent}</DesktopBootstrap></React.StrictMode>);
  });
} else {
  root.render(<React.StrictMode>{portalContent}</React.StrictMode>);
}
