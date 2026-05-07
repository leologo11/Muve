import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  if (user) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minHeight: '100dvh', background: 'var(--bg)', overflow: 'auto'
    }}>

      {/* ── Brand hero ── */}
      <div style={{
        background: 'linear-gradient(145deg, #0F172A 0%, #0B245C 45%, #003BB5 100%)',
        padding: 'calc(48px + env(safe-area-inset-top)) 24px 52px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(0,136,85,.18)', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: -40,
          width: 140, height: 140, borderRadius: '50%',
          background: 'rgba(0,136,85,.12)', pointerEvents: 'none'
        }} />

        {/* Logo */}
        <div style={{
          width: 68, height: 68, borderRadius: 20,
          background: 'rgba(255,255,255,.12)',
          border: '1.5px solid rgba(255,255,255,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 16px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 24px rgba(0,0,0,.25)'
        }}>
          🚚
        </div>

        <h1 style={{
          fontSize: 34, fontWeight: 800, color: '#fff',
          letterSpacing: '-0.5px', lineHeight: 1
        }}>
          MUVE
        </h1>
        <p style={{
          fontSize: 13, color: 'rgba(255,255,255,.6)',
          marginTop: 8, fontWeight: 500, letterSpacing: '.2px'
        }}>
          Sistema de gestión de rutas
        </p>
      </div>

      {/* ── Form card ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0 20px calc(32px + env(safe-area-inset-bottom))',
      }}>
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'var(--card)',
          borderRadius: '0 0 var(--r-xl) var(--r-xl)',
          padding: '28px 24px 24px',
          boxShadow: 'var(--shadow-lg)',
          borderTop: 'none',
          border: '1px solid var(--border)',
          borderTopWidth: 0,
          animation: 'slideUp .35s var(--ease-out) both'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 15, color: 'var(--muted)', padding: 4,
                    lineHeight: 1, transition: 'none'
                  }}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--r-sm)',
                background: 'var(--danger-dim)', border: '1px solid #cc224430',
                color: 'var(--danger)', fontSize: 13, fontWeight: 600,
                animation: 'fadeIn .2s ease'
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4, padding: '14px', borderRadius: 'var(--r-md)',
                border: 'none',
                background: loading
                  ? 'var(--border)'
                  : 'linear-gradient(135deg, var(--accent) 0%, var(--a2) 100%)',
                color: loading ? 'var(--muted)' : '#fff',
                fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 14px #0052FF30',
                letterSpacing: '.2px'
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Spinner /> Entrando…
                </span>
              ) : 'Entrar →'}
            </button>
          </form>
        </div>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          ¿Buscas tu paquete?{' '}
          <a href="/track" style={{ color: 'var(--accent)', fontWeight: 700 }}>
            Rastrear entrega
          </a>
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin .7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.3)" strokeWidth="2.5" fill="none" />
      <path d="M8 2 A6 6 0 0 1 14 8" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 11, fontWeight: 700, letterSpacing: '0.8px',
  color: 'var(--muted)', textTransform: 'uppercase',
  marginBottom: 6
};

const inputStyle = {
  width: '100%',
  background: 'var(--card2)',
  border: '1.5px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text)',
  fontSize: 15,
  padding: '12px 14px',
  outline: 'none',
  WebkitAppearance: 'none',
  transition: 'border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)',
  display: 'block'
};
