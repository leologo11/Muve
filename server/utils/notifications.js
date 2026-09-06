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

// Una cotización "manual" es la que no tiene precio online (carga muy grande,
// larga distancia o IA no disponible). Igual llega la notificación para que el
// operador pueda contactar al cliente.
function isManualReview({ quote, payload }) {
  const notes = String(payload?.client_notes || quote?.client_notes || '').toUpperCase();
  if (notes.includes('REVISIÓN MANUAL') || notes.includes('REVISION MANUAL')) return true;
  const hasPrice = Number(payload?.price_min) > 0 || Number(payload?.price_max) > 0;
  return payload?.service_type !== 'paqueteria' && !hasPrice;
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

const wait = ms => new Promise(r => setTimeout(r, ms));

// Valor seguro para un header HTTP (ByteString / Latin-1). Un emoji o un guion
// largo en el nombre/dirección del cliente hacía que fetch lanzara y la
// notificación se perdiera en silencio ("algunas llegan, otras no").
function headerSafe(value, max = 200) {
  return String(value ?? '')
    .replace(/[^\x00-\xFF]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, max) || 'MUVE';
}

async function postWithTimeout(url, options, { timeoutMs = 10000, retries = 0, retryDelayMs = 1200 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      if (!text) return null;
      try { return JSON.parse(text); }
      catch { return { raw: text }; }
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        console.warn(`[notify] reintento ${attempt + 1}/${retries} tras fallo: ${err.message}`);
        await wait(retryDelayMs * (attempt + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

async function sendNtfyNotification({ quote, payload }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.warn('[notify] NTFY_TOPIC no está definido — no se envía push de ntfy. Configúralo en el .env / Railway.');
    return { skipped: true };
  }

  const base    = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
  const service = String(payload?.service_type || '').toUpperCase();
  const name    = payload?.contact_person || 'Sin nombre';
  const phone   = payload?.contact_phone  || '';
  const price   = payload?.price_min && payload?.price_max
    ? `${money(payload.price_min)} – ${money(payload.price_max)}`
    : 'Por revisar';
  const origin  = payload?.origin || '';
  const dest    = payload?.destination || '';

  const manual = isManualReview({ quote, payload });
  // OJO: los headers HTTP son ByteString (Latin-1). Nada de emoji en Title —
  // el icono visual lo da el header Tags (warning => ⚠️). El body sí es UTF-8.
  const title = manual
    ? `[MANUAL] Cotizacion ${service} - ${name}`
    : `Nueva cotizacion ${service} - ${name}`;
  const body  = [
    phone,
    origin && dest ? `${origin} -> ${dest}` : (origin || dest),
    manual ? 'Precio: a cotizar por un asesor' : `Precio: ${price}`,
    quote?.quote_code || '',
  ].filter(Boolean).join('\n');

  const headers = {
    'Title':    headerSafe(title),
    'Priority': manual ? 'max' : 'high',
    'Tags':     manual ? 'warning,muve' : 'truck,muve',
    'Click':    quoteAdminUrl(quote),
    'Content-Type': 'text/plain; charset=utf-8',
  };
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;

  const res = await postWithTimeout(`${base}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers,
    body,
  }, { timeoutMs: 12000, retries: 3 });
  console.log(`[notify] ntfy enviado al topic "${topic}" (${base})`);
  return res;
}

// Escapa lo mínimo para parse_mode HTML de Telegram.
function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramNotification({ quote, payload }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = String(process.env.TELEGRAM_CHAT_ID || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (!token || chatIds.length === 0) {
    console.warn('[notify] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID sin configurar — no se envía a Telegram.');
    return { skipped: true };
  }

  const service = String(payload?.service_type || quote?.service_type || 'cotización').toUpperCase();
  const price = payload?.price_min && payload?.price_max
    ? (payload.price_min === payload.price_max
        ? money(payload.price_min)
        : `${money(payload.price_min)} – ${money(payload.price_max)}`)
    : 'Por revisar';

  const manual = isManualReview({ quote, payload });
  const rows = [
    manual
      ? `⚠️ <b>Cotización MANUAL ${escHtml(service)}</b>\n<i>Sin precio online — contactá al cliente</i>`
      : `🚚 <b>Nueva cotización ${escHtml(service)}</b>`,
    '',
    `<b>Código:</b> ${escHtml(quote?.quote_code || payload?.quote_code || 'sin código')}`,
    `<b>Cliente:</b> ${escHtml(payload?.contact_person || 'sin nombre')}`,
    `<b>Teléfono:</b> ${escHtml(payload?.contact_phone || 'sin teléfono')}`,
  ];
  if (payload?.client_company) rows.push(`<b>Empresa:</b> ${escHtml(payload.client_company)}`);
  if (payload?.origin) rows.push(`<b>Retiro:</b> ${escHtml(payload.origin)}`);
  if (payload?.destination) rows.push(`<b>Entrega:</b> ${escHtml(payload.destination)}`);
  if (payload?.vehicle_type) rows.push(`<b>Vehículo:</b> ${escHtml(payload.vehicle_type)}`);
  if (payload?.distance_km) rows.push(`<b>Distancia:</b> ${escHtml(payload.distance_km)} km`);
  rows.push(`<b>Precio:</b> ${escHtml(price)}`);
  if (payload?.delivery_date) {
    try { rows.push(`<b>Fecha:</b> ${escHtml(new Date(payload.delivery_date).toLocaleString('es-CL'))}`); } catch (_) {}
  }
  rows.push('', `<a href="${escHtml(quoteAdminUrl(quote))}">Abrir en el panel admin</a>`);
  const text = rows.join('\n');

  const results = await Promise.allSettled(chatIds.map(chatId =>
    postWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    }, { retries: 2 })
  ));

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) {
    throw new Error(failed.map(f => f.reason?.message || String(f.reason)).join(' | '));
  }
  console.log(`[notify] telegram enviado a ${chatIds.length} chat(s)`);
  return { ok: true };
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

// Limpia un valor para usarlo como parámetro de plantilla de WhatsApp:
// sin saltos de línea, tabs ni corridas de espacios (Meta los rechaza).
function waParam(value, max = 250) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max) || '-';
}

async function sendWhatsAppNotification({ quote, payload, message }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipients = String(process.env.ADMIN_WHATSAPP_TO || '')
    .split(',').map(cleanPhone).filter(n => n.length >= 8);

  if (!token || !phoneNumberId || recipients.length === 0) {
    console.warn('[notify] WhatsApp sin configurar (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / ADMIN_WHATSAPP_TO).');
    return { skipped: true };
  }

  const version = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'es';

  // Un mensaje que MUVE te manda a ti sin que tú le hayas escrito primero es
  // "business-initiated": Meta solo lo permite con una PLANTILLA aprobada. El
  // texto libre solo funciona dentro de la ventana de 24 h tras tu último mensaje
  // al número. Por eso: si hay plantilla configurada, se usa; si no, texto libre.
  let buildMessage;
  if (templateName) {
    const service = String(payload?.service_type || quote?.service_type || 'cotización').toUpperCase();
    const price = payload?.price_min && payload?.price_max
      ? (payload.price_min === payload.price_max
          ? money(payload.price_min)
          : `${money(payload.price_min)} a ${money(payload.price_max)}`)
      : 'Por revisar';
    const route = [payload?.origin, payload?.destination].filter(Boolean).join(' → ') || '-';
    const params = [
      quote?.quote_code || payload?.quote_code || 'sin código',
      `${service} · ${payload?.contact_person || 'sin nombre'}`,
      payload?.contact_phone || 'sin teléfono',
      route,
      price,
      quoteAdminUrl(quote),
    ].map(v => ({ type: 'text', text: waParam(v) }));

    buildMessage = to => ({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [{ type: 'body', parameters: params }],
      },
    });
  } else {
    console.warn('[notify] WHATSAPP_TEMPLATE_NAME sin definir — se envía texto libre (solo llega dentro de la ventana de 24 h).');
    buildMessage = to => ({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: String(message || '').slice(0, 3900) },
    });
  }

  const results = await Promise.allSettled(recipients.map(to =>
    postWithTimeout(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildMessage(to)),
    }, { retries: 2 })
  ));

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) {
    throw new Error(failed.map(f => f.reason?.message || String(f.reason)).join(' | '));
  }
  console.log(`[notify] whatsapp enviado a ${recipients.length} número(s)${templateName ? ` (plantilla ${templateName})` : ' (texto libre)'}`);
  return { ok: true };
}

// Diagnóstico: envía un push de prueba y devuelve el resultado CRUDO de ntfy
// (status HTTP, cuerpo, error) para poder ver desde afuera qué está pasando en
// el server de producción sin acceso a los logs de Railway.
export async function notifySelfTest({ send = false } = {}) {
  const topic = process.env.NTFY_TOPIC || '';
  const base  = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
  const out = {
    topicConfigured: Boolean(topic),
    topicMasked: topic ? `${topic.slice(0, 12)}… (largo ${topic.length})` : null,
    ntfyServer: base,
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.ADMIN_WHATSAPP_TO),
  };
  // Por defecto NO envía push — solo reporta config. Con { send:true } manda una prueba.
  if (!send) { out.ntfy = { note: 'agregá ?send=1 para disparar un push de prueba' }; return out; }
  if (!topic) { out.ntfy = { skipped: 'NTFY_TOPIC no configurado' }; return out; }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const headers = {
      'Title': 'MUVE selftest',
      'Priority': 'high',
      'Tags': 'test_tube',
      'Content-Type': 'text/plain; charset=utf-8',
    };
    if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
    const r = await fetch(`${base}/${encodeURIComponent(topic)}`, {
      method: 'POST', headers,
      body: `Prueba de notificación ${new Date().toISOString()}`,
      signal: controller.signal,
    });
    out.ntfy = { httpStatus: r.status, ok: r.ok, body: (await r.text()).slice(0, 400) };
  } catch (err) {
    out.ntfy = { error: err.message };
  } finally {
    clearTimeout(timer);
  }
  return out;
}

// Aviso ligero al crear un lead (nombre + teléfono, antes del precio). Garantiza
// que el operador tenga el contacto aunque el cliente no termine la cotización.
export async function notifyAdminLead({ name, phone, origin, destination }) {
  const route = [origin, destination].filter(Boolean).join(' → ');
  const line = [phone, route].filter(Boolean).join(' · ');

  const tasks = [];

  const topic = process.env.NTFY_TOPIC;
  if (topic) {
    const base = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
    const headers = {
      // Sin emoji en headers (ByteString). El icono lo pone Tags.
      'Title': headerSafe(`Lead nuevo (sin terminar) - ${name || 'sin nombre'}`),
      'Priority': 'default',
      'Tags': 'hourglass_flowing_sand,muve',
      'Content-Type': 'text/plain; charset=utf-8',
    };
    if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
    tasks.push(postWithTimeout(`${base}/${encodeURIComponent(topic)}`, {
      method: 'POST', headers,
      body: `${line || 'Cotización en proceso'}\n(aún no terminó la cotización)`,
    }, { retries: 2 }));
  }

  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChats = String(process.env.TELEGRAM_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  if (tgToken && tgChats.length) {
    const text = [
      `🕓 <b>Lead nuevo</b> <i>(cotización en proceso)</i>`,
      '',
      `<b>Cliente:</b> ${escHtml(name || 'sin nombre')}`,
      `<b>Teléfono:</b> ${escHtml(phone || 'sin teléfono')}`,
      route ? `<b>Ruta:</b> ${escHtml(route)}` : '',
    ].filter(Boolean).join('\n');
    for (const chatId of tgChats) {
      tasks.push(postWithTimeout(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      }, { retries: 2 }));
    }
  }

  if (tasks.length === 0) return { skipped: true };
  const results = await Promise.allSettled(tasks);
  const ok = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[notify] lead → ${ok}/${results.length} envíos OK`);
  return { ok: ok > 0 };
}

export async function notifyAdminQuoteCreated({ quote, payload }) {
  const message = quoteSummaryLines({ quote, payload }).join('\n');
  const context = { quote, payload };
  const tasks = [
    sendTelegramNotification({ quote, payload }),
    sendNtfyNotification({ quote, payload }),
    sendWhatsAppNotification({ quote, payload, message }),
    sendWebhookNotification(message, context),
  ];

  const labels = ['telegram', 'ntfy', 'whatsapp', 'webhook'];
  const results = await Promise.allSettled(tasks);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[notify] ${labels[i]} falló:`, r.reason?.message || String(r.reason));
    } else if (r.value?.skipped) {
      console.log(`[notify] ${labels[i]} omitido (sin configurar)`);
    } else {
      console.log(`[notify] ${labels[i]} OK`);
    }
  });
  const sent = results.filter(r => r.status === 'fulfilled' && !r.value?.skipped).length;
  return { ok: sent > 0, sent };
}
