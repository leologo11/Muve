import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Login from './views/Login.jsx';
import AdminView from './views/admin/AdminView.jsx';
import DriverView from './views/driver/DriverView.jsx';
import CompanyView from './views/company/CompanyView.jsx';
import CustomerView from './views/customer/CustomerView.jsx';

function RoleRouter() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 14 }}>
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
          <Route path="/*" element={<RoleRouter />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
