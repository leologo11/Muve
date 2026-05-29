import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import DriverView from './views/driver/DriverView.jsx';
import DriverRoutePicker from './views/driver/DriverRoutePicker.jsx';
import Toast from './components/Toast.jsx';
import { requestGeoPermissions } from './utils/geo.js';

async function initNative() {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0052FF' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (_) {}
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (_) {}
}

// ── Error boundary ──────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 24, background: '#fff', minHeight: '100dvh', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#cc2244', marginBottom: 8 }}>Error de la aplicación</div>
        <pre style={{ fontSize: 11, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {this.state.error?.message}{'\n'}{this.state.error?.stack}
        </pre>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', background: '#0052FF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
          Reintentar
        </button>
      </div>
    );
    return this.props.children;
  }
}

// ── Login screen ────────────────────────────────────────────────────────────
function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const inpStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,.15)',
    border: '1.5px solid rgba(255,255,255,.3)',
    borderRadius: 14, padding: '16px 18px',
    fontSize: 16, color: '#fff', outline: 'none',
    fontFamily: 'Inter,system-ui,sans-serif',
    marginBottom: 12, WebkitTextFillColor: '#fff',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0041CC 0%, #0052FF 55%, #0044DD 100%)',
      padding: '32px 28px',
      paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{ fontSize: 64, marginBottom: 12, lineHeight: 1 }}>🚗</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>MUVE</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.6)', letterSpacing: 3, marginTop: 4, textTransform: 'uppercase' }}>Driver</div>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 380 }}>
        <input style={inpStyle} type="email" autoComplete="email" placeholder="Correo electrónico" required value={email} onChange={e => setEmail(e.target.value)} />
        <input style={inpStyle} type="password" autoComplete="current-password" placeholder="Contraseña" required value={password} onChange={e => setPassword(e.target.value)} />

        {error && (
          <div style={{ background: 'rgba(255,70,70,.2)', border: '1px solid rgba(255,100,100,.35)', borderRadius: 10, padding: '11px 16px', color: '#ffcccc', fontSize: 13, fontWeight: 600, marginBottom: 14, textAlign: 'center' }}>
            ⚠ {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '18px 20px', borderRadius: 14, border: 'none',
          background: loading ? 'rgba(255,255,255,.25)' : '#fff',
          color: loading ? 'rgba(255,255,255,.6)' : '#0052FF',
          fontSize: 17, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : '0 8px 28px rgba(0,0,0,.3)',
          fontFamily: 'Inter,system-ui,sans-serif',
        }}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <div style={{ position: 'absolute', bottom: 'max(20px, env(safe-area-inset-bottom))', fontSize: 11, color: 'rgba(255,255,255,.3)', fontWeight: 600 }}>
        MUVE Driver · v1.0
      </div>
    </div>
  );
}

// ── App shell ───────────────────────────────────────────────────────────────
function DriverAppInner() {
  const { user, loading } = useAuth();
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  useEffect(() => {
    initNative();
    // Request location permissions as soon as user is in the app
    requestGeoPermissions().catch(() => {});
  }, []);

  if (loading) return (
    <div style={{ height: '100dvh', background: '#0052FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 60, marginBottom: 14 }}>🚗</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>MUVE Driver</div>
    </div>
  );

  if (!user) return <LoginScreen />;

  // Route picker before entering a specific route
  if (!selectedRouteId) return (
    <ErrorBoundary>
      <DriverRoutePicker onSelect={setSelectedRouteId} />
    </ErrorBoundary>
  );

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: '#F1F5F9',
    }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ErrorBoundary>
          <DriverView
            routeId={selectedRouteId}
            onBack={() => setSelectedRouteId(null)}
          />
        </ErrorBoundary>
      </div>
      <Toast />
    </div>
  );
}

export default function DriverApp() {
  return (
    <AuthProvider>
      <DriverAppInner />
    </AuthProvider>
  );
}
