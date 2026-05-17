function money(value) {
  const n = Number(value || 0);
  return n > 0 ? `$${Math.round(n).toLocaleString('es-CL')}` : '';
}

function cleanPhone(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function appUrl() {
  return (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://muveapp.cl').replace(/\/+$/, '');
}

function quoteAdminUrl(quote) {
  const id = quote?.id || quote?._id;
  return `${appUrl()}/admin${id ? `?quote=${encodeURIComponent(id)}` : ''}`;
}

function quoteSummaryLines({ quote, payload }) {
  const service = String(payload?.service_type || quote?.service_type || 'cotizacion').toUpperCase();
  const price = payload?.price_min && payload?.price_max
    ? payload.price_min === payload.price_max
      ? money(payload.price_min)
      : `${money(payload.price_min)} - ${money(payload.price_max)}`
    : 'Por revisar';

  const lines = [
    'Nueva cotizacion MUVE',
    '',
    `Codigo: ${quote?.quote_code || payload?.quote_code || 'Sin codigo'}`,
    `Servicio: ${service}`,
    `Cliente: ${payload?.contact_person || 'Sin nombre'}`,
    `Telefono: ${payload?.contact_phone || 'Sin telefono'}`,
  ];

  if (payload?.client_company) lines.push(`Empresa: ${payload.client_company}`);
  if (payload?.origin) lines.push(`Retiro: ${payload.origin}`);
  if (payload?.destination) lines.push(`Entrega: ${payload.destination}`);
  if (payload?.vehicle_type) lines.push(`Vehiculo: ${payload.vehicle_type}`);
  if (payload?.distance_km) lines.push(`Distancia: ${payload.distance_km} km`);
  lines.push(`Precio: ${price}`);
  if (payload?.delivery_date) lines.push(`Fecha: ${new Date(payload.delivery_date).toLocaleString('es-CL')}`);
  if (payload?.client_notes) lines.push(`Notas: ${String(payload.client_notes).slice(0, 350)}`);
  lines.push('', `Ver en admin: ${quoteAdminUrl(quote)}`);

  return lines;
}

async function postWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    if (!text) return null;
    try { return JSON.parse(text); }
    catch { return { raw: text }; }
  } finally {
    clearTimeout(timer);
  }
}

async function sendNtfyNotification({ quote, payload }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return { skipped: true };

  const service = String(payload?.service_type || '').toUpperCase();
  const name    = payload?.contact_person || 'Sin nombre';
  const phone   = payload?.contact_phone  || '';
  const price   = payload?.price_min && payload?.price_max
    ? `${money(payload.price_min)} – ${money(payload.price_max)}`
    : 'Por revisar';
  const origin  = payload?.origin || '';
  const dest    = payload?.destination || '';

  const title = `📋 Nueva cotización ${service} — ${name}`;
  const body  = [
    phone,
    origin && dest ? `${origin} → ${dest}` : (origin || dest),
    `Precio: ${price}`,
    quote?.quote_code || '',
  ].filter(Boolean).join('\n');

  return postWithTimeout(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers: {
      'Title':    title,
      'Priority': 'high',
      'Tags':     'truck,muve',
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body,
  });
}

async function sendWebhookNotification(message, context) {
  const url = process.env.ADMIN_NOTIFICATION_WEBHOOK_URL;
  if (!url) return { skipped: true };

  return postWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'quote.created',
      message,
      quote: context.quote,
      payload: context.payload,
      createdAt: new Date().toISOString(),
    }),
  });
}

async function sendWhatsAppNotification(message) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = cleanPhone(process.env.ADMIN_WHATSAPP_TO);
  if (!token || !phoneNumberId || !to) return { skipped: true };

  const version = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  return postWithTimeout(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message.slice(0, 3900),
      },
    }),
  });
}

export async function notifyAdminQuoteCreated({ quote, payload }) {
  const message = quoteSummaryLines({ quote, payload }).join('\n');
  const context = { quote, payload };
  const tasks = [
    sendNtfyNotification({ quote, payload }),
    sendWhatsAppNotification(message, context),
    sendWebhookNotification(message, context),
  ];

  const results = await Promise.allSettled(tasks);
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length) {
    console.warn('Quote notification warning:', failures.map(f => f.reason?.message || String(f.reason)).join(' | '));
  }
  return { ok: failures.length < results.length };
}
