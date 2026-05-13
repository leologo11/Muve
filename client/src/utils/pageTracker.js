// Tracking de funnel para el cotizador público.
// 9 niveles de eventos basados en interacciones reales del usuario.
// Excluye rutas de admin/driver automáticamente.

const SESSION_KEY = 'muve_sid';
const STATE_KEY   = 'muve_track';

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

function getDevice() {
  const ua = navigator.userAgent || '';
  if (/iPad|tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getSource() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');

  if (utmSource) {
    const src = utmSource.toLowerCase();
    if (utmMedium === 'cpc' || utmMedium === 'paid') return `${src}_ads`;
    return src;
  }

  const ref = document.referrer || '';
  if (!ref) return 'directo';
  if (/google\./i.test(ref))           return 'google';
  if (/facebook\.|fb\.com/i.test(ref)) return 'facebook';
  if (/instagram\./i.test(ref))        return 'instagram';
  if (/tiktok\./i.test(ref))           return 'tiktok';
  if (/twitter\.|t\.co/i.test(ref))    return 'twitter';
  if (/bing\./i.test(ref))             return 'bing';
  if (/whatsapp\./i.test(ref))         return 'whatsapp';
  if (/youtube\./i.test(ref))          return 'youtube';
  if (/linkedin\./i.test(ref))         return 'linkedin';
  return 'referido';
}

async function post(payload) {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

// Nivel 1: visita inicial
export function trackLanding() {
  if (isAdminPath()) return;
  const state = getState();
  if (state.sent1) return;

  const device = getDevice();
  const source = getSource();
  setState({ ...state, sent1: true, device, source });
  post({ sessionId: getSessionId(), step: 1, submitted: false, device, source });
}

// Niveles 2-8: eventos granulares de interacción
// Solo avanza — nunca retrocede el max registrado
export function trackEvent(level, serviceType) {
  if (isAdminPath()) return;
  const state = getState();
  const prevMax = state.maxStep || 1;
  if (level <= prevMax) return;

  const updated = { ...state, maxStep: level, serviceType: serviceType || state.serviceType };
  setState(updated);
  post({
    sessionId:   getSessionId(),
    step:        level,
    serviceType: updated.serviceType,
    submitted:   updated.submitted || false,
    device:      updated.device,
    source:      updated.source,
  });
}

// Nivel 9: cotización enviada
export function trackSubmit(serviceType) {
  if (isAdminPath()) return;
  const state = getState();
  const updated = { ...state, submitted: true, maxStep: 9, serviceType: serviceType || state.serviceType };
  setState(updated);
  post({
    sessionId:   getSessionId(),
    step:        9,
    serviceType: updated.serviceType,
    submitted:   true,
    device:      updated.device,
    source:      updated.source,
  });
}

// alias backward compat
export const trackStep = trackEvent;
