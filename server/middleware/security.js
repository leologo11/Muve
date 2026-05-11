import crypto from 'crypto';

const stores = new Map();
const DEFAULT_MESSAGE = 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.';

function getStore(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  return stores.get(name);
}

function cleanExpired(store, now = Date.now()) {
  for (const [key, record] of store.entries()) {
    const resetAt = record.resetAt || record.expiresAt || 0;
    const blockedUntil = record.blockedUntil || 0;
    if (resetAt < now && blockedUntil < now) store.delete(key);
  }
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  return String(value || '').split(',')[0];
}

export function getClientIp(req) {
  const raw =
    firstHeaderValue(req.headers['cf-connecting-ip']) ||
    firstHeaderValue(req.headers['x-forwarded-for']) ||
    firstHeaderValue(req.headers['x-real-ip']) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';

  return String(raw).trim().replace(/^::ffff:/, '') || 'unknown';
}

export function createRateLimit({ name, windowMs, max, blockMs = windowMs, key, message = DEFAULT_MESSAGE }) {
  const store = getStore(name);

  return (req, res, next) => {
    const now = Date.now();
    if (store.size > 5000 || Math.random() < 0.01) cleanExpired(store, now);

    const rateKey = key ? key(req) : getClientIp(req);
    const current = store.get(rateKey);

    if (current?.blockedUntil > now) {
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((current.blockedUntil - now) / 1000),
      });
    }

    const record = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs, blockedUntil: 0 }
      : current;

    record.count += 1;

    if (record.count > max) {
      record.blockedUntil = now + blockMs;
      store.set(rateKey, record);
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil(blockMs / 1000),
      });
    }

    store.set(rateKey, record);
    return next();
  };
}

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
  next();
}

export const publicReadLimiter = createRateLimit({
  name: 'public-read',
  windowMs: 60 * 1000,
  max: 180,
  blockMs: 5 * 60 * 1000,
});

export const publicCalculationLimiter = createRateLimit({
  name: 'public-calculation',
  windowMs: 60 * 1000,
  max: 45,
  blockMs: 10 * 60 * 1000,
  message: 'Demasiadas cotizaciones seguidas. Espera un momento e intenta otra vez.',
});

export const publicQuoteLimiter = createRateLimit({
  name: 'public-quote-create',
  windowMs: 15 * 60 * 1000,
  max: 6,
  blockMs: 30 * 60 * 1000,
  message: 'Hemos recibido varias cotizaciones desde tu conexion. Intenta nuevamente mas tarde.',
});

function textLength(value) {
  return String(value ?? '').trim().length;
}

function reject(res, error) {
  return res.status(400).json({ error });
}

export function validatePublicQuotePayload(req, res, next) {
  const body = req.body || {};
  const honeypots = ['website', 'companyWebsite', 'homepage', '_gotcha', 'faxNumber'];

  if (honeypots.some(key => textLength(body[key]) > 0)) {
    return reject(res, 'Solicitud no valida');
  }

  const stringLimits = [
    ['contactPerson', 80],
    ['contactPhone', 30],
    ['contactEmail', 140],
    ['clientCompany', 140],
    ['originAddress', 260],
    ['destinationAddress', 260],
    ['origin', 260],
    ['destination', 260],
    ['moveSize', 60],
    ['vehicleType', 60],
    ['deliveryDate', 80],
    ['clientNotes', 1200],
    ['itemsDescription', 4500],
  ];

  for (const [key, max] of stringLimits) {
    if (textLength(body[key]) > max) {
      return reject(res, `El campo ${key} es demasiado largo`);
    }
  }

  const numberLimits = [
    ['distanceKm', 0, 3000],
    ['numHelpers', 0, 10],
    ['numFloors', 0, 80],
    ['originFloors', 0, 40],
    ['destinationFloors', 0, 40],
    ['priceMin', 0, 10000000],
    ['priceMax', 0, 10000000],
  ];

  for (const [key, min, max] of numberLimits) {
    if (body[key] == null || body[key] === '') continue;
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value < min || value > max) {
      return reject(res, `El campo ${key} tiene un valor no permitido`);
    }
  }

  return next();
}

export function validatePublicCalculationPayload(req, res, next) {
  const body = req.body || {};
  const numericLimits = [
    ['distanceKm', 0, 3000],
    ['numHelpers', 0, 10],
    ['numFloors', 0, 80],
    ['originLat', -90, 90],
    ['destLat', -90, 90],
    ['originLng', -180, 180],
    ['destLng', -180, 180],
  ];

  for (const [key, min, max] of numericLimits) {
    if (body[key] == null || body[key] === '') continue;
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value < min || value > max) {
      return reject(res, `El campo ${key} tiene un valor no permitido`);
    }
  }

  if (body.serviceType && !['flete', 'mudanza', 'paqueteria'].includes(String(body.serviceType))) {
    return reject(res, 'Tipo de servicio no permitido');
  }

  return next();
}

export function quoteSpamGuard(req, res, next) {
  const body = req.body || {};
  const now = Date.now();
  const ip = getClientIp(req);
  const phone = normalizePhone(body.contactPhone);
  const serviceType = String(body.serviceType || '').toLowerCase();
  const origin = String(body.originAddress || body.origin || '').toLowerCase().trim();
  const destination = String(body.destinationAddress || body.destination || '').toLowerCase().trim();
  const items = String(body.itemsDescription || '').toLowerCase().trim();
  const fingerprint = hash([serviceType, phone, origin, destination, items].join('|'));

  const duplicateStore = getStore('quote-duplicates');
  if (duplicateStore.size > 5000 || Math.random() < 0.01) cleanExpired(duplicateStore, now);

  const duplicateKey = `${ip}:${fingerprint}`;
  const duplicate = duplicateStore.get(duplicateKey);
  if (duplicate?.expiresAt > now) {
    return res.status(429).json({
      error: 'Ya recibimos una cotizacion igual hace poco. Si necesitas cambiar algo, espera unos minutos o modifica los datos.',
      retryAfter: Math.ceil((duplicate.expiresAt - now) / 1000),
    });
  }

  duplicateStore.set(duplicateKey, { expiresAt: now + 10 * 60 * 1000 });

  if (!phone) return next();

  const phoneStore = getStore('quote-phone');
  if (phoneStore.size > 5000 || Math.random() < 0.01) cleanExpired(phoneStore, now);

  const current = phoneStore.get(phone);
  const record = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + 30 * 60 * 1000, blockedUntil: 0 }
    : current;

  if (record.blockedUntil > now) {
    return res.status(429).json({
      error: 'Ese telefono ya envio varias cotizaciones. Intenta nuevamente mas tarde.',
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
    });
  }

  record.count += 1;
  if (record.count > 4) {
    record.blockedUntil = now + 30 * 60 * 1000;
    phoneStore.set(phone, record);
    return res.status(429).json({
      error: 'Ese telefono ya envio varias cotizaciones. Intenta nuevamente mas tarde.',
      retryAfter: 30 * 60,
    });
  }

  phoneStore.set(phone, record);
  return next();
}
