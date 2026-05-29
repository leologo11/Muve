import React, { useState, useEffect } from 'react';
import { api } from './api/index.js';
import DriverView from './views/driver/DriverView.jsx';
import Toast from './components/Toast.jsx';

// Initialize native plugins (only active inside Capacitor container)
async function initNative() {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0052FF' });
  } catch (_) {}
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (_) {}
}

// ── Login screen ────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const inp = (extra = {}) => ({
    style: {
      width: '100%', boxSizing: 'border-box',
      background: 'rgba(255,255,255,.15)',
      border: '1.5px solid rgba(255,255,255,.3)',
      borderRadius: 14, padding: '16px 18px',
      fontSize: 16, color: '#fff', outline: 'none',
      fontFamily: 'Inter,system-ui,sans-serif',
      marginBottom: 12,
      WebkitTextFillColor: '#fff',
    },
    ...extra,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { token, user } = await api.login(email.trim(), password);
      localStorage.setItem('rf_token', token);
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100dvh',
      background: 'linear-gradient(160deg, #0041CC 0%, #0052FF 55%, #0044DD 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 28px',
      paddingTop: 'max(32px, env(safe-area-inset-top))',
      paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{ fontSize: 64, marginBottom: 12, lineHeight: 1 }}>🚗</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: -1, lineHeight: 1 }}>MUVE</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.6)', letterSpacing: 3, marginTop: 4, textTransform: 'uppercase' }}>Driver</div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 380 }}>
        <input
          {...inp({ autoComplete: 'email', type: 'email', placeholder: 'Correo electrónico', required: true })}
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          {...inp({ autoComplete: 'current-password', type: 'password', placeholder: 'Contraseña', required: true })}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {error && (
          <div style={{
            background: 'rgba(255,70,70,.2)', border: '1px solid rgba(255,100,100,.35)',
            borderRadius: 10, padding: '11px 16px', color: '#ffcccc',
            fontSize: 13, fontWeight: 600, marginBottom: 14, textAlign: 'center',
          }}>
            ⚠ {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '18px 20px', borderRadius: 14, border: 'none',
          background: loading ? 'rgba(255,255,255,.25)' : '#fff',
          color: loading ? 'rgba(255,255,255,.6)' : '#0052FF',
          fontSize: 17, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : '0 8px 28px rgba(0,0,0,.3)',
          transition: 'all .2s',
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

// ── Main app shell ──────────────────────────────────────────────────────────
export default function DriverApp() {
  const [status, setStatus] = useState('loading'); // loading | login | app
  const [user, setUser]     = useState(null);

  useEffect(() => {
    initNative();
    const token = localStorage.getItem('rf_token');
    if (!token) { setStatus('login'); return; }
    api.me()
      .then(u  => { setUser(u);  setStatus('app'); })
      .catch(() => { localStorage.removeItem('rf_token'); setStatus('login'); });
  }, []);

  const handleLogin = (u) => { setUser(u); setStatus('app'); };
  const handleLogout = () => {
    localStorage.removeItem('rf_token');
    setUser(null);
    setStatus('login');
  };

  if (status === 'loading') return (
    <div style={{
      height: '100dvh', background: '#0052FF',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ fontSize: 60, marginBottom: 14 }}>🚗</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>MUVE Driver</div>
    </div>
  );

  if (status === 'login') return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top,0px)',
      background: 'var(--bg, #F1F5F9)',
    }}>
      <DriverView onLogout={handleLogout} nativeApp />
      <Toast />
    </div>
  );
}
