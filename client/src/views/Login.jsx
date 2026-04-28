import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

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
      alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'var(--bg)',
      minHeight: '100dvh'
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚚</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>Routiflow</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Sistema de gestión de rutas</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Email
            </label>
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
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#cc224412', border: '1px solid #cc224430', color: 'var(--danger)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: '14px', borderRadius: 12, border: 'none',
              background: loading ? 'var(--border)' : 'var(--accent)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity .2s'
            }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
          ¿Buscas tu paquete?{' '}
          <a href="/track" style={{ color: 'var(--accent)', fontWeight: 600 }}>Rastrear entrega</a>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: 'var(--card2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 15,
  padding: '11px 14px',
  outline: 'none',
  WebkitAppearance: 'none'
};
