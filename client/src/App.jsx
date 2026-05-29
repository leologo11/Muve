import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Login from './views/Login.jsx';
import AdminView from './views/admin/AdminView.jsx';
import DriverView from './views/driver/DriverView.jsx';
import DriverRoutePicker from './views/driver/DriverRoutePicker.jsx';
import CompanyView from './views/company/CompanyView.jsx';
import CustomerView from './views/customer/CustomerView.jsx';
import PublicRouteView from './views/PublicRouteView.jsx';
import QuoteView from './views/public/QuoteView.jsx';
import LandingView from './views/public/LandingView.jsx';
import CotizadorView from './views/public/CotizadorView.jsx';
import PruebaView from './views/public/PruebaView.jsx';
import { trackPageView } from './utils/metaPixel.js';

function MetaPixelPageView() {
  const location = useLocation();

  useEffect(() => {
    trackPageView();
  }, [location.pathname, location.search]);

  return null;
}

// Driver web shell — same flow as the native app but without Capacitor
function DriverWebShell() {
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  if (!selectedRouteId) {
    return <DriverRoutePicker onSelect={setSelectedRouteId} />;
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <DriverView routeId={selectedRouteId} onBack={() => setSelectedRouteId(null)} />
    </div>
  );
}

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
        background: 'linear-gradient(135deg, #0052FF 0%, #00DAFF 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, boxShadow: '0 4px 16px #0052FF30',
        animation: 'pulse 1.4s ease infinite'
      }}>🚚</div>
      Cargando…
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'admin') return <AdminView />;
  if (user.role === 'driver') return <DriverWebShell />;
  if (user.role === 'company') return <CompanyView />;

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MetaPixelPageView />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin/*" element={<RoleRouter />} />
          <Route path="/app/*" element={<RoleRouter />} />
          <Route path="/cotizar" element={<CotizadorView />} />
          <Route path="/prueba" element={<PruebaView />} />
          <Route path="/" element={<CotizadorView />} />
          <Route path="/v1" element={<LandingView />} />
          <Route path="/track/:trackingId" element={<CustomerView />} />
          <Route path="/route/:shareToken" element={<PublicRouteView />} />
          <Route path="/quote/:shareToken" element={<QuoteView />} />
          <Route path="/*" element={<RoleRouter />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
