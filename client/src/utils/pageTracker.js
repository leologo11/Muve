// Tracking de funnel para el cotizador público.
// Guarda eventos en Supabase via /api/analytics/track.
// Excluye rutas de admin/driver automáticamente.

const SESSION_KEY  = 'muve_sid';
const STATE_KEY    = 'muve_track';

function isAdminPath() {
  const p = window.location.pathname;
  return p.startsWith('/admin') || p.startsWith('/app') || p.startsWith('/driver');
}

function getSessionId() {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function getState() {
  try { return JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}'); } catch { return {}; }
}

function setState(s) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(s));
}

async function post(payload) {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {} // analytics never breaks the app
}

export function trackLanding() {
  if (isAdminPath()) return;
  const state = getState();
  if (state.sent1) return; // ya trackeamos esta sesión al inicio
  setState({ ...state, sent1: true });
  post({ sessionId: getSessionId(), step: 1, submitted: false });
}

export function trackStep(step, serviceType) {
  if (isAdminPath()) return;
  const state = getState();
  const prevMax = state.maxStep || 1;
  if (step <= prevMax) return; // no retroceder
  const updated = { ...state, maxStep: step, serviceType: serviceType || state.serviceType };
  setState(updated);
  post({ sessionId: getSessionId(), step, serviceType: updated.serviceType, submitted: updated.submitted || false });
}

export function trackSubmit(serviceType) {
  if (isAdminPath()) return;
  const state = getState();
  const updated = { ...state, submitted: true, serviceType: serviceType || state.serviceType };
  setState(updated);
  post({ sessionId: getSessionId(), step: updated.maxStep || 4, serviceType: updated.serviceType, submitted: true });
}
