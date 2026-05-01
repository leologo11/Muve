import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Login from './views/Login.jsx';
import AdminView from './views/admin/AdminView.jsx';
import DriverView from './views/driver/DriverView.jsx';
import CompanyView from './views/company/CompanyView.jsx';
import CustomerView from './views/customer/CustomerView.jsx';
import PublicRouteView from './views/PublicRouteView.jsx';
import QuoteView from './views/public/QuoteView.jsx';

function RoleRouter() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, color: 'var(--muted)', fontSize: 13, fontWeight: 600
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: 'linear-gradient(135deg, #0a2219, #008855)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, boxShadow: '0 4px 16px #00885530',
        animation: 'pulse 1.4s ease infinite'
      }}>🚚</div>
      Cargando…
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'admin') return <AdminView />;
  if (user.role === 'driver') return <DriverView />;
  if (user.role === 'company') return <CompanyView />;

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/track/:trackingId" element={<CustomerView />} />
          <Route path="/route/:shareToken" element={<PublicRouteView />} />
          <Route path="/quote/:shareToken" element={<QuoteView />} />
          <Route path="/*" element={<RoleRouter />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
