import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/styles.css';
const App = React.lazy(() => import('./app/portals/UserPortal'));
const AdminApp = React.lazy(() => import('./AdminPortal'));
const ManagerApp = React.lazy(() => import('./app/portals/ManagerPortal'));

const mode = import.meta.env.MODE;
const isAdmin = mode === 'admin' || (mode !== 'user' && (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')));
const isManager = mode === 'manager' || (mode !== 'user' && mode !== 'admin' && /^\/manager(?:\/|$)/.test(window.location.pathname));
createRoot(document.getElementById('root')).render(<React.StrictMode><React.Suspense fallback={<p role="status">Đang tải ANH LỚN SHOP...</p>}>{isManager ? <ManagerApp /> : isAdmin ? <AdminApp /> : <App />}</React.Suspense></React.StrictMode>);
