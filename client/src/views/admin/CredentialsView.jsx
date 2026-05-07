import React, { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

export default function CredentialsView() {
  const [credentials, setCredentials] = useState([]);
  const [name, setName] = useState('Integracion MUVE');
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setCredentials(await api.getCredentials());
    } catch (err) {
      toast(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    setCreated(null);
    try {
      const credential = await api.createCredential({ name });
      setCreated(credential);
      await load();
      toast('Credencial MUVE generada');
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (credential) => {
    if (!confirm(`Revocar la credencial "${credential.name}"?`)) return;
    try {
      await api.revokeCredential(credential._id);
      await load();
      toast('Credencial revocada');
    } catch (err) {
      toast(err.message);
    }
  };

  const copyCreated = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(`MUVE_API_KEY_ID=${created.keyId}\nMUVE_API_SECRET=${created.secret}`);
    toast('Credenciales copiadas');
  };

  if (loading) {
    return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>Cargando credenciales...</div>;
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg)' }}>
      <section style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={title}>Configuracion de API</h2>
            <p style={muted}>Genera y revoca llaves para integraciones externas de MUVE.</p>
          </div>
        </div>

        <label style={label}>Nombre de la integracion</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)} style={input} placeholder="Ej: ERP cliente, Zapier, integracion web" />
          <button onClick={create} disabled={busy} style={primaryBtn}>{busy ? 'Generando...' : 'Generar API Key'}</button>
        </div>

        {created && (
          <div style={secretBox}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>Guarda este secreto ahora</div>
            <CredentialLine label="Key ID" value={created.keyId} />
            <CredentialLine label="Secret" value={created.secret} />
            <button onClick={copyCreated} style={{ ...primaryBtn, width: '100%', marginTop: 10 }}>Copiar Credenciales</button>
          </div>
        )}
      </section>

      <section style={{ ...panel, marginTop: 12 }}>
        <h2 style={title}>Llaves activas y revocadas</h2>
        {credentials.length === 0 ? (
          <div style={{ ...muted, padding: '18px 0' }}>Aun no hay credenciales generadas.</div>
        ) : credentials.map(credential => (
          <div key={credential._id} style={row}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#0F172A' }}>{credential.name}</div>
              <div style={{ ...mono, marginTop: 4 }}>{credential.keyId}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Creada {new Date(credential.createdAt).toLocaleString('es-CL')} · prefijo {credential.prefix}
              </div>
            </div>
            <button
              onClick={() => revoke(credential)}
              disabled={credential.revoked}
              style={credential.revoked ? disabledBtn : dangerBtn}
            >
              {credential.revoked ? 'Revocada' : 'Revocar'}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function CredentialLine({ label, value }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={labelStyleSmall}>{label}</div>
      <div style={mono}>{value}</div>
    </div>
  );
}

const panel = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 15,
  padding: 16,
  boxShadow: 'var(--shadow-sm)',
};

const title = {
  fontFamily: 'Montserrat, Inter, sans-serif',
  letterSpacing: '-.04em',
  color: '#0F172A',
  fontSize: 22,
  fontWeight: 900,
  margin: 0,
};

const muted = { color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 };
const label = { display: 'block', color: 'var(--muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 };
const labelStyleSmall = { ...label, marginBottom: 4 };
const input = { width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', fontSize: 14, color: 'var(--text)', background: '#f8fbff' };
const primaryBtn = { border: 0, borderRadius: 12, padding: '11px 15px', fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #0052FF 0%, #00DAFF 100%)', cursor: 'pointer', boxShadow: '0 10px 22px #0052ff28' };
const secretBox = { marginTop: 14, border: '1px solid #0052ff24', borderRadius: 15, background: '#f4f7ff', padding: 14 };
const mono = { background: '#0F172A', color: '#E2E8F0', borderRadius: 12, padding: '9px 11px', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12, wordBreak: 'break-all' };
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', padding: '13px 0' };
const dangerBtn = { border: '1px solid #cc224430', borderRadius: 12, background: '#cc224412', color: '#cc2244', padding: '8px 12px', fontWeight: 800, cursor: 'pointer' };
const disabledBtn = { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card2)', color: 'var(--muted)', padding: '8px 12px', fontWeight: 800, cursor: 'not-allowed' };
