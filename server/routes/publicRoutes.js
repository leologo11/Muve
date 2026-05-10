import { Router } from 'express';
import crypto from 'crypto';
import { isSupabaseEnabled, normalizeQuote, normalizeQuoteItem, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();

const SERVICE_TYPES = ['flete', 'mudanza', 'paqueteria'];

// ── Pricing helpers ───────────────────────────────────────────────────────────

function calcVehiclePrice(config, distanceKm, numHelpers = 0, numFloors = 0, needsPacking = false, driverHelps = false) {
  const tiers = (config.km_tiers || []).slice().sort((a, b) => a.max_km - b.max_km);
  const tier = tiers.find(t => distanceKm <= t.max_km) || tiers[tiers.length - 1];
  const ppk = tier ? Number(tier.price_per_km || 0) : 0;
  const extras = config.extras || {};
  const kmCost = distanceKm * ppk;
  const driverHelpCost = driverHelps ? Number(extras.driver_help ?? 20000) : 0;
  const helperCost = numHelpers * Number(extras.helper || 0);
  const floorCost = numFloors * Number(extras.floor || 0);
  const packingCost = needsPacking ? Number(extras.packing || 0) : 0;
  const total = Number(config.base_price || 0) + kmCost + driverHelpCost + helperCost + floorCost + packingCost;
  return Math.round(total / 1000) * 1000;
}

function normalizePublicVehicleConfig(r) {
  return {
    id: r.id,
    vehicleType: r.vehicle_type,
    serviceType: r.service_type || 'flete',
    name: r.name,
    description: r.description,
    basePrice: Number(r.base_price || 0),
    kmTiers: r.km_tiers || [],
    extras: r.extras || {},
    active: r.active,
    onlyRegions: r.only_regions,
  };
}

function priceRange(exact) {
  const low  = Math.round(exact * 0.88 / 5000) * 5000;
  const high = Math.round(exact * 1.18 / 5000) * 5000;
  return { min: Math.max(low, 5000), max: Math.max(high, low + 20000) };
}

// GET /api/public/vehicle-configs — active vehicle pricing (no auth)
router.get('/vehicle-configs', async (req, res) => {
  try {
    const filters = { active: 'eq.true', select: '*', order: 'service_type.asc,sort_order.asc' };
    if (req.query.serviceType) filters.service_type = `eq.${req.query.serviceType}`;
    const rows = await supabaseRequest(`/vehicle_configs${qs(filters)}`);
    return res.json(rows.map(normalizePublicVehicleConfig));
  } catch (err) {
    if (err.message.includes('service_type') || err.message.includes('schema cache')) {
      try {
        const rows = await supabaseRequest(`/vehicle_configs${qs({ active: 'eq.true', select: '*', order: 'sort_order.asc' })}`);
        return res.json(rows.map(normalizePublicVehicleConfig));
      } catch {}
    }
    if (err.message.includes('vehicle_configs') || err.message.includes('schema cache')) {
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

// Haversine straight-line distance (km)
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST /api/public/distance — calculate road distance via OSRM with Haversine fallback (no auth)
router.post('/distance', async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.body;
    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ error: 'Coordenadas de origen y destino requeridas' });
    }

    let distanceKm = null;
    let durationMin = null;
    let usedFallback = false;

    try {
      const pts = `${originLng},${originLat};${destLng},${destLat}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${pts}?overview=false`,
        { headers: { 'User-Agent': 'MUVE/1.0' }, signal: controller.signal }
      );
      clearTimeout(timer);
      const d = await r.json();
      distanceKm = d.routes?.[0]?.distance ? parseFloat((d.routes[0].distance / 1000).toFixed(1)) : null;
      durationMin = d.routes?.[0]?.duration ? Math.round(d.routes[0].duration / 60) : null;
    } catch {
      usedFallback = true;
    }

    // Fallback: Haversine × 1.3 road-factor estimate
    if (!distanceKm) {
      const straight = haversineKm(Number(originLat), Number(originLng), Number(destLat), Number(destLng));
      distanceKm = parseFloat((straight * 1.3).toFixed(1));
      durationMin = Math.round((distanceKm / 60) * 60);
      usedFallback = true;
    }

    res.json({ distanceKm, durationMin, estimated: usedFallback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/public/quote-estimate — calculate price estimate for given trip (no auth)
router.post('/quote-estimate', async (req, res) => {
  try {
    const { distanceKm, numHelpers = 0, numFloors = 0, needsPacking = false, driverHelps = false, serviceType = 'flete' } = req.body;
    if (!distanceKm) return res.status(400).json({ error: 'distanceKm requerido' });
    let configs;
    try {
      configs = await supabaseRequest(`/vehicle_configs${qs({ active: 'eq.true', service_type: `eq.${serviceType}`, select: '*', order: 'sort_order.asc' })}`);
    } catch (err) {
      if (!err.message.includes('service_type') && !err.message.includes('schema cache')) throw err;
      configs = await supabaseRequest(`/vehicle_configs${qs({ active: 'eq.true', select: '*', order: 'sort_order.asc' })}`);
    }
    const vehicles = configs.map(cfg => {
      const exact = calcVehiclePrice(cfg, distanceKm, numHelpers, numFloors, needsPacking, driverHelps);
      const { min, max } = priceRange(exact);
      return {
        id: cfg.id, vehicleType: cfg.vehicle_type, name: cfg.name, description: cfg.description,
        onlyRegions: cfg.only_regions, exact, priceMin: min, priceMax: max,
      };
    });
    res.json({ vehicles });
  } catch (err) {
    if (err.message.includes('vehicle_configs') || err.message.includes('schema cache')) {
      return res.json({ vehicles: [] });
    }
    res.status(500).json({ error: err.message });
  }
});

function clean(value) {
  return String(value || '').trim();
}

const STATUS_LABELS = { draft: 'Borrador', active: 'En curso', paused: 'Pausada', completed: 'Completada', cancelled: 'Cancelada' };

function mapPublicPackage(p) {
  return {
    _id: p.id,
    id: p.id,
    trackingId: p.tracking_id,
    customerName: p.customer_name,
    customerLastName: p.customer_last_name ? `${p.customer_last_name[0]}.` : '',
    address: p.address,
    commune: p.commune,
    aptFloor: p.apt_floor,
    status: p.status,
    note: p.note,
    failReason: p.fail_reason,
    photoUrl: p.photo_url,
    photo2Url: p.photo2_url,
    photoUploadedAt: p.photo_uploaded_at,
    photo2UploadedAt: p.photo2_uploaded_at,
    deliveredAt: p.delivered_at,
    order: p.stop_order,
    lat: p.lat,
    lng: p.lng
  };
}

function quoteItemPayload(item, quoteId) {
  return {
    quote_id: quoteId,
    customer_name: item.customerName || '',
    customer_last_name: item.customerLastName || '',
    customer_phone: item.customerPhone || '',
    address: item.address || '',
    commune: item.commune || '',
    price: Number(item.price || 0),
    lat: item.lat || null,
    lng: item.lng || null,
    note: item.note || '',
  };
}

async function findSupabaseQuoteByToken(token) {
  const quotes = await supabaseRequest(`/quotes${qs({ share_token: `eq.${token}`, select: '*' })}`);
  return quotes?.[0] || null;
}

async function replaceSupabaseQuoteItems(quoteId, items = []) {
  await supabaseRequest(`/quote_items${qs({ quote_id: `eq.${quoteId}` })}`, { method: 'DELETE' });
  if (!items.length) return [];
  return supabaseRequest('/quote_items', {
    method: 'POST',
    body: JSON.stringify(items.map(item => quoteItemPayload(item, quoteId))),
  });
}

// POST /api/public/quotes - ingreso desde la landing publica
router.post('/quotes', async (req, res) => {
  try {
    const serviceType = clean(req.body.serviceType).toLowerCase();
    if (!SERVICE_TYPES.includes(serviceType)) {
      return res.status(400).json({ error: 'Selecciona flete, mudanza o paqueteria' });
    }

    const contactPerson = clean(req.body.contactPerson);
    const contactPhone  = clean(req.body.contactPhone);
    if (!contactPerson || !contactPhone) {
      return res.status(400).json({ error: 'Nombre y telefono son obligatorios' });
    }
    if (!/^\+?[\d\s()-]{8,20}$/.test(contactPhone)) {
      return res.status(400).json({ error: 'Ingresa un telefono valido' });
    }

    const clientCompany      = clean(req.body.clientCompany || '');
    const isUrgent           = Boolean(req.body.urgent);
    const rawNotes           = clean(req.body.clientNotes || '');
    const clientNotes        = isUrgent && !rawNotes.includes('URGENTE')
      ? `🚨 URGENTE - SERVICIO INMEDIATO 🚨\n${rawNotes}`.trim()
      : rawNotes;
    const deliveryDate       = clean(req.body.deliveryDate || '');
    // Legacy compat
    const originAddress      = clean(req.body.originAddress || req.body.origin || '');
    const destinationAddress = clean(req.body.destinationAddress || req.body.destination || '');

    // Flete/mudanza specific
    const vehicleType      = clean(req.body.vehicleType || '');
    const distanceKm       = req.body.distanceKm != null ? Number(req.body.distanceKm) : null;
    const originCoords     = req.body.originCoords || null;
    const destinationCoords = req.body.destinationCoords || null;
    const driverHelps      = Boolean(req.body.driverHelps);
    const numHelpers       = Number(req.body.numHelpers || 0);
    const numFloors        = Number(req.body.numFloors || 0);
    const needsPacking     = Boolean(req.body.needsPacking);
    const isConserjeria    = Boolean(req.body.isConserjeria);
    const itemsDescription = clean(req.body.itemsDescription || '');
    const priceMin         = req.body.priceMin != null ? Number(req.body.priceMin) : null;
    const priceMax         = req.body.priceMax != null ? Number(req.body.priceMax) : null;
    const moveSize         = clean(req.body.moveSize || '');

    if (serviceType === 'paqueteria' && !clientCompany) {
      return res.status(400).json({ error: 'Ingresa el nombre de tu empresa o negocio' });
    }
    if (serviceType !== 'paqueteria' && (!originAddress || !destinationAddress)) {
      return res.status(400).json({ error: 'Direccion de origen y destino son obligatorias' });
    }

    const ds = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const quoteCode = `MUVE-${ds}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const payload = {
      quote_code: quoteCode,
      service_type: serviceType,
      status: 'submitted',
      contact_person: contactPerson,
      contact_phone: contactPhone,
      client_notes: clientNotes,
      client_company: clientCompany,
      origin: originAddress,
      destination: destinationAddress,
      move_size: moveSize,
    };
    if (deliveryDate) {
      try { payload.delivery_date = new Date(deliveryDate).toISOString(); } catch (_) {}
    }
    if (serviceType !== 'paqueteria') {
      if (vehicleType) payload.vehicle_type = vehicleType;
      if (distanceKm !== null) payload.distance_km = distanceKm;
      if (originAddress) payload.origin_address = originAddress;
      if (originCoords) payload.origin_coords = originCoords;
      if (destinationAddress) payload.destination_address = destinationAddress;
      if (destinationCoords) payload.destination_coords = destinationCoords;
      payload.driver_helps = driverHelps;
      payload.num_helpers = numHelpers;
      payload.num_floors = numFloors;
      payload.needs_packing = needsPacking;
      payload.is_conserjeria = isConserjeria;
      if (itemsDescription) payload.items_description = itemsDescription;
      if (priceMin !== null) payload.price_min = priceMin;
      if (priceMax !== null) payload.price_max = priceMax;
    }

    const quoteRows = await supabaseRequest('/quotes', { method: 'POST', body: JSON.stringify(payload) });
    const quote = quoteRows?.[0];

    const noteParts = [];
    if (originAddress) noteParts.push(`Origen: ${originAddress}`);
    if (distanceKm) noteParts.push(`Distancia: ${distanceKm} km`);
    if (vehicleType) noteParts.push(`Vehiculo: ${vehicleType}`);
    if (driverHelps) noteParts.push('Ayuda del chofer');
    if (numHelpers > 0) noteParts.push(`${numHelpers} ayudante(s) adicional(es)`);
    if (numFloors > 0) noteParts.push(`${numFloors} piso(s)`);
    if (needsPacking) noteParts.push('Embalaje');
    if (isConserjeria) noteParts.push('Conserjeria');
    if (priceMin && priceMax) noteParts.push(`Precio: $${priceMin.toLocaleString('es-CL')} - $${priceMax.toLocaleString('es-CL')}`);
    if (itemsDescription) noteParts.push(itemsDescription);
    if (clientNotes) noteParts.push(clientNotes);
    if (moveSize) noteParts.push(`Tamano: ${moveSize}`);

    await supabaseRequest('/quote_items', {
      method: 'POST',
      body: JSON.stringify({
        quote_id: quote.id,
        customer_name: contactPerson,
        customer_phone: contactPhone,
        address: destinationAddress || originAddress || '',
        commune: '',
        note: noteParts.join(' | ') || (serviceType === 'paqueteria' ? 'Lead paqueteria' : ''),
      }),
    });

    return res.status(201).json({
      _id: quote.id,
      quoteCode: quote.quote_code,
      status: quote.status,
      serviceType: quote.service_type,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/public/route/:shareToken — company tracking (no auth required)
router.get('/route/:shareToken', async (req, res) => {
  try {
    const routes = await supabaseRequest(`/routes${qs({ share_token: `eq.${req.params.shareToken}`, select: '*' })}`);
    const route = routes?.[0];
    if (!route) return res.status(404).json({ error: 'Enlace no valido o expirado' });

    const packages = await supabaseRequest(`/packages${qs({ route_id: `eq.${route.id}`, select: '*', order: 'stop_order.asc' })}`);
    const publicPackages = packages.filter(p => p.status !== 'eliminado').map(mapPublicPackage);

    return res.json({
      route: {
        _id: route.id,
        id: route.id,
        routeCode: route.route_code,
        name: route.name,
        date: route.date,
        status: route.status,
        statusLabel: STATUS_LABELS[route.status] || route.status,
        driverName: null,
        driverPhone: null,
        clientCompany: {
          name: route.client_company?.name || null,
          contactPerson: route.client_company?.contactPerson || null,
          contactPhone: route.client_company?.contactPhone || null
        },
        startPoint: route.start_point || {},
        distanceKm: route.distance_km,
        stats: route.stats || {},
        invoiceAmount: route.invoice?.amount || null
      },
      packages: publicPackages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/public/quote/:token — client updates items (saves draft)
router.patch('/quote/:token', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const quote = await findSupabaseQuoteByToken(req.params.token);
      if (!quote) return res.status(404).json({ error: 'Cotizacion no encontrada' });
      if (['approved', 'rejected', 'submitted'].includes(quote.status)) {
        return res.status(403).json({ error: 'Esta cotizacion ya no puede modificarse' });
      }
      const { items, clientNotes } = req.body;
      let savedItems = null;
      if (items !== undefined) savedItems = await replaceSupabaseQuoteItems(quote.id, Array.isArray(items) ? items : []);
      if (clientNotes !== undefined) {
        await supabaseRequest(`/quotes${qs({ id: `eq.${quote.id}` })}`, {
          method: 'PATCH',
          body: JSON.stringify({ client_notes: clientNotes || '', updated_at: new Date().toISOString() }),
        });
      }
      const finalItems = savedItems || await supabaseRequest(`/quote_items${qs({ quote_id: `eq.${quote.id}`, select: '*', order: 'created_at.asc' })}`);
      return res.json({ ok: true, items: (finalItems || []).map(normalizeQuoteItem) });
    }
    const quote = await Quote.findOne({ shareToken: req.params.token });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    if (['approved', 'rejected', 'submitted'].includes(quote.status)) {
      return res.status(403).json({ error: 'Esta cotización ya no puede modificarse' });
    }
    const { items, clientNotes } = req.body;
    if (items !== undefined) quote.items = items;
    if (clientNotes !== undefined) quote.clientNotes = clientNotes;
    await quote.save();
    res.json({ ok: true, items: quote.items });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/public/quote/:token/submit — client submits for admin review
router.post('/quote/:token/submit', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const quote = await findSupabaseQuoteByToken(req.params.token);
      if (!quote) return res.status(404).json({ error: 'Cotizacion no encontrada' });
      if (['approved', 'rejected', 'submitted'].includes(quote.status)) {
        return res.status(403).json({ error: 'Esta cotizacion ya fue enviada' });
      }
      const { items, clientNotes } = req.body;
      if (items !== undefined) await replaceSupabaseQuoteItems(quote.id, Array.isArray(items) ? items : []);
      const rows = await supabaseRequest(`/quotes${qs({ id: `eq.${quote.id}` })}`, {
        method: 'PATCH',
        body: JSON.stringify({
          client_notes: clientNotes || quote.client_notes || '',
          status: 'submitted',
          updated_at: new Date().toISOString(),
        }),
      });
      return res.json({ ok: true, status: rows?.[0]?.status || 'submitted' });
    }
    const quote = await Quote.findOne({ shareToken: req.params.token });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    if (['approved', 'rejected', 'submitted'].includes(quote.status)) {
      return res.status(403).json({ error: 'Esta cotización ya fue enviada' });
    }
    const { items, clientNotes } = req.body;
    if (items !== undefined) quote.items = items;
    if (clientNotes !== undefined) quote.clientNotes = clientNotes;
    quote.status = 'submitted';
    await quote.save();
    res.json({ ok: true, status: quote.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
