import { Router } from 'express';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import {
  publicCalculationLimiter,
  publicQuoteLimiter,
  publicReadLimiter,
  quoteSpamGuard,
  validatePublicCalculationPayload,
  validatePublicQuotePayload,
} from '../middleware/security.js';
import { notifyAdminQuoteCreated, notifyAdminLead } from '../utils/notifications.js';
import { OSRM_BASE_URL } from '../utils/geocode.js';
import { findTierPricePerKm, calcVehiclePrice } from '../utils/vehiclePricing.js';
import { isSupabaseEnabled, normalizeQuote, normalizeQuoteItem, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();

const SERVICE_TYPES = ['flete', 'mudanza', 'paqueteria'];

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

function normalizeInventoryItem(r) {
  return {
    id: r.item_key,
    name: r.name,
    icon: r.icon || '📦',
    cat: r.category || 'Otros',
    vol: Number(r.volume_m3 || 0),
    minVehicleType: r.min_vehicle_type || 'furgon',
    requiredHelpers: Number(r.required_helpers || 0),
    isHeavy: Boolean(r.is_heavy),
    isFragile: Boolean(r.is_fragile),
    isLong: Boolean(r.is_long),
    isTall: Boolean(r.is_tall),
    active: r.active !== false,
    sortOrder: r.sort_order || 0,
  };
}

function priceRange(exact) {
  const low  = Math.round(exact * 0.88 / 5000) * 5000;
  const high = Math.round(exact * 1.18 / 5000) * 5000;
  return { min: Math.max(low, 5000), max: Math.max(high, low + 20000) };
}

// Items that physically cannot fit in a furgón — always require camión 3/4 minimum
const REQUIRES_CAMION34 = new Set([
  'cama2p', 'camaQueen', 'closet', 'nevera', 'cocina', 'sofa3p',
  // Also catch by name substring for free-text items
]);
const REQUIRES_CAMION34_NAMES = ['cama 2 plaza', 'cama queen', 'cama king', 'closet', 'ropero',
  'refrigerador', 'nevera', 'cocina', 'horno', 'sofa 3', 'sofá 3'];

function enforceVehicleMinimum(vehicle, items = [], freeText = '') {
  if (vehicle === 'camion34' || vehicle === 'camionLargo') return vehicle;
  const hasHeavyItem =
    items.some(i => REQUIRES_CAMION34.has(i.id) && (i.qty || 0) > 0) ||
    REQUIRES_CAMION34_NAMES.some(kw => freeText.toLowerCase().includes(kw));
  if (hasHeavyItem) {
    console.log(`[ai-quote] ⚠ vehicle override: ${vehicle} → camion34 (item requires camion34)`);
    return 'camion34';
  }
  return vehicle;
}

// GET /api/public/vehicle-configs — active vehicle pricing (no auth)
router.get('/vehicle-configs', publicReadLimiter, async (req, res) => {
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

// GET /api/public/inventory-configs — active moving item catalog (no auth)
router.get('/inventory-configs', publicReadLimiter, async (_req, res) => {
  try {
    const rows = await supabaseRequest(`/inventory_item_configs${qs({ active: 'eq.true', select: '*', order: 'category.asc,sort_order.asc,name.asc' })}`);
    res.json(rows.map(normalizeInventoryItem));
  } catch (err) {
    if (err.message.includes('inventory_item_configs') || err.message.includes('schema cache')) return res.json([]);
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
router.post('/distance', publicCalculationLimiter, validatePublicCalculationPayload, async (req, res) => {
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
        `${OSRM_BASE_URL}/route/v1/driving/${pts}?overview=false`,
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

// POST /api/public/osrm-path — road route geometry for the public cotizador map (no auth).
// The authenticated equivalent lives in deliveryRoutes.js, but that whole router requires
// a JWT — this proxies the same OSRM call for the public quote flow, which has none.
router.post('/osrm-path', publicCalculationLimiter, validatePublicCalculationPayload, async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.body;
    if (!originLat || !originLng || !destLat || !destLng) return res.json({ geometry: null });
    const pts = `${originLng},${originLat};${destLng},${destLat}`;
    const r = await fetch(
      `${OSRM_BASE_URL}/route/v1/driving/${pts}?overview=simplified&geometries=geojson`,
      { headers: { 'User-Agent': 'MUVE/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    res.json({ geometry: d.routes?.[0]?.geometry || null });
  } catch {
    res.json({ geometry: null });
  }
});

// POST /api/public/quote-estimate — calculate price estimate for given trip (no auth)
router.post('/quote-estimate', publicCalculationLimiter, validatePublicCalculationPayload, async (req, res) => {
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

// Fallback pricer — runs when Claude is unavailable or returns invalid JSON
function fallbackQuote(items, distanceKm, numHelpers, numFloors) {
  const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
  const names = items.map(i => (i.name || '').toLowerCase()).join(' ');
  const hasHeavy = /nevera|refrigerador|lavadora|secadora|cocina|piano|moto/.test(names);
  const hasBig   = /sofa|sofá|closet|ropero|queen|king|2 plaza/.test(names);

  let vehicle = 'furgon', detectedType = 'flete', basePrice = 30000;

  if (totalQty >= 12 || (totalQty >= 8 && (hasHeavy || hasBig))) {
    vehicle = 'camion34'; detectedType = 'mudanza';
    basePrice = totalQty >= 14 ? 90000 : 65000;
  } else if (hasBig || hasHeavy || totalQty >= 6) {
    vehicle = 'camion34'; detectedType = totalQty >= 8 ? 'mudanza' : 'flete';
    basePrice = 40000 + totalQty * 2000;
  } else if (totalQty <= 2 && !hasHeavy && !hasBig) {
    vehicle = 'furgon';
    basePrice = 22000;
  } else {
    basePrice = 25000 + totalQty * 4000;
  }
  // Hard override: items that never fit in a furgón
  vehicle = enforceVehicleMinimum(vehicle, items, '');

  const kmRates = { furgon: 700, camion34: 1000, camionLargo: 1500 };
  const kmExtra  = distanceKm > 15 ? (distanceKm - 15) * (kmRates[vehicle] || 1000) : 0;
  const helpCost = numHelpers * (detectedType === 'mudanza' ? 20000 : 10000);
  const flrCost  = numFloors * 5000;
  const price    = Math.max(20000, Math.round((basePrice + kmExtra + helpCost + flrCost) / 1000) * 1000);

  const recommendedHelpers = detectedType === 'mudanza'
    ? (totalQty >= 18 ? 2 : 1)
    : (hasHeavy || hasBig ? 1 : 0);

  const vehicleNames = { furgon: 'Furgón N400', camion34: 'Camión 3/4', camionLargo: 'Camión Largo' };
  const vehicleIcons = { furgon: '🚐', camion34: '🚚', camionLargo: '🚛' };

  return {
    detectedType,
    vehicle,
    vehicleName: vehicleNames[vehicle] || 'Furgón N400',
    vehicleIcon: vehicleIcons[vehicle] || '🚐',
    price,
    priceMin: Math.max(15000, Math.round(price * 0.88 / 1000) * 1000),
    priceMax: Math.round(price * 1.15 / 1000) * 1000,
    tollEstimate: 0,
    recommendedHelpers,
    clientExplanation: 'Precio estimado según los artículos y distancia indicados. Un asesor confirmará el valor exacto.',
    internalNote: `Fallback (sin IA): ${totalQty} items, ${distanceKm}km`,
    confidence: 'low',
    needsManualReview: true,
  };
}

// POST /api/public/ai-quote — dedicated AI agent calculates price from scratch (no formulas, no auth)
router.post('/ai-quote', publicCalculationLimiter, async (req, res) => {
  const {
    originAddress = '', destinationAddress = '',
    distanceKm = 0,
    items = [],
    freeText = '',
    numFloors = 0,
    numHelpers = 0,
    needsPacking = false,
  } = req.body;

  // If no Claude key, return fallback immediately — never error to client
  if (!process.env.CLAUDE_API_KEY) {
    console.warn('[ai-quote] CLAUDE_API_KEY no configurada — usando fallback manual');
    return res.json(fallbackQuote(items, Number(distanceKm), Number(numHelpers), Number(numFloors)));
  }

  console.log(`[ai-quote] items=${items.length} freeText="${freeText?.slice(0,40)}" km=${distanceKm}`);

  // Larga distancia: fuera del rango que MUVE cotiza online (o direcciones mal
  // geocodificadas). No inventar un precio — mandar a revisión manual con mensaje claro.
  const LONG_DISTANCE_KM = 1200;
  if (Number(distanceKm) > LONG_DISTANCE_KM) {
    console.log(`[ai-quote] distancia ${distanceKm}km > ${LONG_DISTANCE_KM}km → revisión manual`);
    return res.json({
      detectedType: 'flete',
      vehicle: 'camionLargo',
      vehicleName: 'Camión Largo',
      vehicleIcon: '🚛',
      price: 0, priceMin: 0, priceMax: 0,
      tollEstimate: 0,
      recommendedHelpers: 2,
      clientExplanation: `Es un traslado de larga distancia (~${Math.round(Number(distanceKm))} km). Un asesor MUVE te prepara una cotización a medida.`,
      internalNote: `Larga distancia ${distanceKm} km — cotización manual (revisar direcciones si parece error)`,
      confidence: 'low',
      needsManualReview: true,
    });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    // Fetch real vehicle configs + learning examples in parallel
    let configsSection = '';
    let learningSection = '';
    let realCasesSection = '';
    let rawVehicleConfigs = [];  // kept for server-side km adjustment after AI response
    await Promise.allSettled([
      (async () => {
        const configs = await supabaseRequest(`/vehicle_configs${qs({ active: 'eq.true', select: '*', order: 'sort_order.asc' })}`);
        if (configs && configs.length > 0) {
          rawVehicleConfigs = configs;
          configsSection = '\nTARIFAS CONFIGURADAS (usar estos valores para km):\n';
          for (const cfg of configs) {
            const tiers = (cfg.km_tiers || []).slice().sort((a, b) => a.max_km - b.max_km)
              .map(t => `hasta ${t.max_km}km→$${Number(t.price_per_km || 0).toLocaleString('es-CL')}/km`).join(', ');
            const extras = cfg.extras || {};
            configsSection += `  ${cfg.name || cfg.vehicle_type}: base $${Number(cfg.base_price || 0).toLocaleString('es-CL')} | ${tiers}`;
            if (extras.helper) configsSection += ` | ayudante +$${Number(extras.helper).toLocaleString('es-CL')}`;
            configsSection += '\n';
          }
        }
      })(),
      (async () => {
        const examples = await supabaseRequest(`/ai_quote_feedback${qs({ select: '*', order: 'created_at.desc', limit: '80' })}`);
        if (!examples || examples.length === 0) return;

        const corrections = examples.filter(e => e.status === 'corrected');
        const approvals   = examples.filter(e => e.status === 'approved');

        // Calculate average approved price per vehicle type
        const stats = {};
        for (const ex of approvals) {
          const v = ex.ai_vehicle || 'desconocido';
          if (!stats[v]) stats[v] = { sum: 0, count: 0, min: Infinity, max: 0 };
          stats[v].sum   += Number(ex.ai_price);
          stats[v].count += 1;
          stats[v].min    = Math.min(stats[v].min, Number(ex.ai_price));
          stats[v].max    = Math.max(stats[v].max, Number(ex.ai_price));
        }

        learningSection = `\n━━ CASOS ENTRENADOS POR EL OPERADOR — ${examples.length} casos ━━\n`;
        learningSection += 'REGLA PRINCIPAL: estos precios aprobados son la FUENTE DE VERDAD. Si hay un caso similar al pedido actual, usa ESE precio como base y ajusta solo por diferencias concretas (mas articulos, mas km, extras).\n';
        learningSection += 'Todos los casos entrenados estan a 4km — el servidor agrega el costo de km real automaticamente. El precio que ves es solo el costo de la CARGA.\n';

        if (Object.keys(stats).length > 0) {
          learningSection += '\nPRECIOS APROBADOS POR TIPO DE VEHICULO (usa estos rangos como referencia principal):\n';
          for (const [v, s] of Object.entries(stats)) {
            const avg = Math.round(s.sum / s.count);
            learningSection += `  ${v}: promedio $${avg.toLocaleString('es-CL')} | rango real aprobado $${s.min.toLocaleString('es-CL')}–$${s.max.toLocaleString('es-CL')} (${s.count} casos)\n`;
          }
        }

        if (corrections.length > 0) {
          learningSection += `\n⚠️ CORRECCIONES DEL OPERADOR — estos precios estaban MAL, no repetir:\n`;
          for (const ex of corrections.slice(0, 10)) {
            const dist = ex.distance_km ? `${ex.distance_km}km` : '?km';
            const vCorr = ex.correct_vehicle ? ` → vehiculo correcto: ${ex.correct_vehicle}` : '';
            const note  = ex.notes ? ` | ${ex.notes}` : '';
            learningSection += `  ❌ "${ex.items_text}"${ex.free_text ? ` + "${ex.free_text}"` : ''}, ${dist}: IA=$${Number(ex.ai_price).toLocaleString('es-CL')}${vCorr} → correcto=$${Number(ex.correct_price).toLocaleString('es-CL')}${note}\n`;
          }
        }

        if (approvals.length > 0) {
          learningSection += `\n✅ PRECIOS APROBADOS (son la referencia mas importante — si hay uno similar, usalo):\n`;
          for (const ex of approvals.slice(0, 20)) {
            const dist = ex.distance_km ? `${ex.distance_km}km` : '?km';
            learningSection += `  ✅ "${ex.items_text}"${ex.free_text ? ` + "${ex.free_text}"` : ''}, ${dist} → ${ex.ai_vehicle_name}, ${ex.ai_detected_type}, $${Number(ex.ai_price).toLocaleString('es-CL')}\n`;
          }
        }
      })(),
      (async () => {
        const submitted = await supabaseRequest(
          `/quotes${qs({ select: 'service_type,vehicle_type,distance_km,items_description,price_min,price_max,num_helpers,num_floors,needs_packing', status: 'in.(submitted,approved)', service_type: 'in.(flete,mudanza)', order: 'created_at.desc', limit: '30' })}`
        );
        if (!submitted || submitted.length === 0) return;

        const reqKm = Number(distanceKm) || 0;
        const similar = submitted.filter(q => {
          if (!q.price_min && !q.price_max) return false;
          if (reqKm === 0) return true;
          const qKm = Number(q.distance_km) || 0;
          if (qKm === 0) return false;
          return qKm >= reqKm * 0.3 && qKm <= reqKm * 1.7;
        }).slice(0, 20);

        if (similar.length === 0) return;

        realCasesSection = `\n━━ CASOS REALES COTIZADOS (clientes reales que completaron el formulario) ━━\n`;
        realCasesSection += 'REGLA DE COMPARACIÓN: Si hay un caso con distancia similar (±50%) y artículos parecidos, ';
        realCasesSection += 'usa su precio como ancla principal. Ajusta proporcionalmente por km y extras. ';
        realCasesSection += 'Estos precios son lo que el cliente aceptó pagar — son la referencia más confiable.\n';
        for (const q of similar) {
          const km  = q.distance_km ? `${q.distance_km}km` : '?km';
          const ref = q.price_min && q.price_max
            ? `$${Math.round((Number(q.price_min) + Number(q.price_max)) / 2).toLocaleString('es-CL')} (rango $${Number(q.price_min).toLocaleString('es-CL')}–$${Number(q.price_max).toLocaleString('es-CL')})`
            : q.price_min ? `$${Number(q.price_min).toLocaleString('es-CL')}` : '';
          const extras = [
            q.num_helpers > 0 && `${q.num_helpers} ayudante(s)`,
            q.num_floors > 0 && `${q.num_floors} piso(s)`,
            q.needs_packing && 'embalaje',
          ].filter(Boolean).join(', ') || 'sin extras';
          const desc = (q.items_description || '').slice(0, 100);
          realCasesSection += `  📋 ${q.service_type} ${q.vehicle_type || '?'}, ${km}, ${extras}: "${desc}" → ${ref}\n`;
        }
      })(),
    ]);

    const totalVolumeM3 = items.reduce((sum, i) => sum + (Number(i.vol) || 0) * Number(i.qty || 1), 0);
    const itemsList = items.length > 0
      ? items.map(i => {
          const vol = Number(i.vol) || 0;
          const total = vol * Number(i.qty || 1);
          return `${i.qty}x ${i.name}${vol > 0 ? ` (${total.toFixed(1)}m3)` : ''}`;
        }).join(', ') + `\nVolumen total estimado: ${totalVolumeM3.toFixed(1)}m3`
      : 'No se seleccionaron articulos del catalogo';

    const extrasDesc = [
      numFloors > 0 && `${numFloors} piso(s) sin ascensor`,
      numHelpers > 0 && `${numHelpers} ayudante(s) adicional(es)`,
      needsPacking && 'embalaje profesional',
    ].filter(Boolean).join(', ') || 'ninguno';

    const prompt = `Eres el agente de cotizaciones de MUVE, empresa de fletes y mudanzas en Santiago de Chile.
El cliente NO elige si es flete o mudanza — TU lo detectas segun la cantidad y tipo de articulos.
${configsSection}
━━ FLOTA (CONFIDENCIAL) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AUTO (sedan/hatchback particular)
  Capacidad: maletero de auto (~0.3m3)
  PUEDE: sobres, documentos, 1 caja pequeña, flores, ropa en bolsas, notebook, microondas, 1-2 paquetes pequeños
  NO PUEDE: nada mas grande que un microondas, cajas grandes, muebles, electrodomesticos grandes
  Precio: base + km. Sin ayudantes ni extras.
  Ejemplos: 5km~$9.000 | 10km~$13.000 | 15km~$17.000 | 20km~$21.000
  recommendedHelpers siempre 0. Solo si la carga es MUY pequeña — si hay duda, usar furgon.

FURGON N400 (furgoneta cerrada)
  Capacidad: ~6m3, altura max 1.5m interior
  PUEDE: cajas, colchon, TV, lavadora, microondas, muebles livianos, comoda, escritorio,
         camas 1 plaza, mesas, sillas
  NO PUEDE: cama 2 plazas o mayor, refrigerador grande, sofas grandes, closet/ropero
  Rango de precios: $20.000 – $50.000
  Flete liviano (1-3 cosas pequeñas): $20.000-$30.000
  Flete mediano (4-6 cosas): $30.000-$40.000
  Furgon lleno (traslado pieza completa): $40.000-$50.000

CAMION 3/4 (plataforma abierta + rack en techo)
  Capacidad: ~15m3. PUEDE: cama 2 plazas/Queen/King, refrigerador, closet, sofas, muebles 1-2 dormitorios
  El chofer ayuda a cargar/descargar: INCLUIDO, no cobrar extra.
  Rango de precios: $60.000 – $100.000
  Flete articulos grandes (1-3 items): $60.000-$70.000
  Carga parcial / mudanza chica: $70.000-$85.000
  Camion lleno / mudanza completa 1-2D: $85.000-$100.000

CAMION LARGO (vehiculo grande para mudanzas que superan el camion 3/4)
  Capacidad: ~30m3. Usar cuando la carga supera 15m3.
  Rango de precios: $170.000 – $240.000
  Mudanza mediana-grande (15-22m3, casa 2-3D con todo): $170.000-$195.000
  Mudanza grande (22-26m3, casa 3D completa): $195.000-$215.000
  Mudanza muy grande (26-30m3, casa 4D): $215.000-$240.000
  Si la carga supera 30m3: needsManualReview: true

━━ VOLUMEN INTERNO POR ARTICULO (confidencial — para dimensionar correctamente) ━━━━━━

  Cama 1 plaza: 1.5m3 | Cama 2 plazas: 2.0m3 | Cama Queen/King: 2.8m3
  Closet/Ropero: 2.5m3 | Comoda: 0.8m3 | Mesa de noche: 0.3m3
  Sofa 2 plazas: 2.0m3 | Sofa 3 plazas: 3.2m3
  Refrigerador: 1.5m3 | Lavadora/Secadora: 0.8m3 | Cocina/Horno: 1.0m3 | Microondas: 0.1m3
  TV 50 pulgadas o menos: 0.3m3 | TV 55 pulgadas o mas: 0.6m3
  Mesa comedor: 1.2m3 | Silla: 0.3m3 | Escritorio: 0.8m3
  Caja grande: 0.35m3 | Caja mediana: 0.18m3 | Caja pequeña: 0.08m3

  REGLA DE DIMENSION (usa el volumen total calculado que aparece en la solicitud):
  Total <6m3   → FURGON
  Total 6-15m3 → CAMION 3/4
  Total 15-30m3 → CAMION LARGO
  Total >30m3  → needsManualReview: true

━━ DETECCION FLETE vs MUDANZA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FLETE = pocas cosas del mismo tipo o complementarias (1-5 articulos)
  Cobro por espacio usado, NO por camion completo
  Ej: 2 camas 1P, 1 sofa, 1 nevera, 3 cajas — cada caso es un flete

MUDANZA = contenido de un lugar (pieza, depto, oficina), cosas variadas que se mudan en conjunto
  Cobro por camion completo (mas conveniente)
  Ej: camas + closet + comoda + nevera + sofa + electrodomesticos + cajas = mudanza

ESCALA: items de maletero → auto | 1-4 cosas simples → flete furgon/camion34 | 5-8 variadas → analizar (flete si son cosas complementarias, mudanza si son de pieza completa) | 9+ variadas → mudanza
CLAVE FLETE: pocas cosas aunque sean grandes = flete. Ej: 1 cama 2P + colchon + 2 cajas = flete camion34. Precio bajo, sin cobro de camion completo.

━━ PEAJES / TAGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Si el recorrido usa autopista de peaje, estimar costo del tag (ida + vuelta, tarifa camion):
  Fuera de Santiago:
    Ruta 68 (→ Valparaiso/Vina del Mar): ~$12.000
    Ruta 78 (→ San Antonio/Cartagena): ~$9.000
    Ruta 5 Sur (→ Rancagua, Talca, Sur): ~$7.000-$18.000 segun distancia
    Ruta 5 Norte (→ Los Andes, Calera, Norte): ~$8.000-$20.000
    Ruta 60 (→ Los Andes): ~$8.000
  Dentro de Santiago (si usa Costanera Norte, Autopista Central, Vespucio): ~$3.000-$5.000
  Si el recorrido es corto dentro de comunas sin autopista obvia: tollEstimate = 0
  tollEstimate es ADICIONAL al price (no incluido en price).

━━ REGLAS DE PRECIO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MUDANZAS: el costo principal es la mano de obra (2-4h), NO la distancia corta
  Diferencia entre 3km y 14km: solo $5.000-$10.000
  Camion 3/4 lleno: $85.000-$100.000 | Semi-lleno: $55.000-$80.000 | Minimo: $50.000

FLETES: se cobra por lo que entra, no por camion entero. Pocas cosas = precio bajo aunque el vehiculo sea grande.
  Furgon flete simple (<10km): $25.000-$40.000 | Camion 3/4 flete simple (<10km): $45.000-$65.000
  Ej: 2 camas 1 plaza + 4km = furgon → $30.000-$38.000
  Ej: 1 cama 2 plazas + colchon + 4km = camion 3/4 (NUNCA furgon), precio BAJO porque es poco = $50.000-$60.000
  Ej: 1 sofa 3P o 1 nevera + 4km = camion 3/4 flete → $50.000-$60.000
  Ej: cama 2P + comoda + 3 cajas + 8km = flete camion 3/4 → $55.000-$65.000 (NO es mudanza, es flete, 1 ayudante)

VEHICULO:
  Cajas, muebles livianos, camas 1 PLAZA, colchones → Furgon
  Cama 2 plazas/Queen/King, refrigerador, sofa grande, closet → SIEMPRE Camion 3/4 o superior
  Carga grande que no cabe en camion 3/4 → Camion Largo
  ⚠ cama 1 plaza → furgon | cama 2 plazas o mayor → CAMION 3/4 (NUNCA furgon)

REGLA CRITICA DE PRECIO:
  PRIORIDAD 1: Si hay un caso entrenado similar al pedido → usa ESE precio como base.
  PRIORIDAD 2: Si no hay caso similar → usa los rangos de la flota como referencia.
  El campo "price" es el costo de la CARGA (sin km). El servidor agrega el km automaticamente.
  Los casos entrenados estan a 4km — su precio refleja solo la carga.
  NO sumes km al price.

ADICIONALES sobre el precio base de carga (NO incluir km):
  Piso sin ascensor: +$5.000/piso
  Ayudante en MUDANZA: +$20.000/persona | Ayudante en FLETE: +$10.000/persona
  Embalaje: +$12.000 (furgon) / +$20.000 (camion 3/4) / +$35.000 (largo)

  Redondear todo a multiplos de $1.000
  priceMin = 88% del price | priceMax = 115% del price
  Si info vaga → confidence "low" y rango amplio

  Nunca mencionar viajes, camiones multiples, ni detalles operativos. clientExplanation: max 2 frases naturales.

CUANDO USAR needsManualReview = true:
  - SOLO si el volumen total supera 30m3 (genuinamente no cabe en ningun vehiculo)
  En todos los demas casos: needsManualReview: false — da tu mejor estimacion de precio.
  Si el precio es alto o hay incertidumbre, pon confidence "low" — pero NO uses needsManualReview.
  Para camion largo con carga ≤30m3: precio normalmente, needsManualReview: false.

AYUDANTES RECOMENDADOS (recommendedHelpers):
  El chofer SIEMPRE carga — es el primer "ayudante" ya incluido en el precio.
  0 (solo chofer): carga liviana que el chofer maneja solo — cajas, TV, escritorio, comoda, 1-3 items livianos sin nada muy pesado
  1 ayudante: LA NORMA para la gran mayoria de fletes y mudanzas chicas. Usar cuando hay al menos 1 item muy pesado (nevera, lavadora, sofa grande, closet, cama 2 plazas) o mudanza de hasta ~10 items. Si dudas entre 0 y 1, pon 1.
  2 ayudantes: SOLO para mudanza mediana-grande real — nevera + closet + sofa + cama + mas de 10 items variados, o camion 3/4 casi lleno. NO usar para fletes simples aunque tengan algo pesado.
  3 ayudantes: SOLO camion largo muy cargado (mudanza 3+ dormitorios completos, 15+ items pesados). Nunca 3 con camion 3/4.
  REGLA CLAVE: casi siempre es 1. Solo pasar a 2 si es mudanza grande real. Nunca 3 salvo camion largo lleno.
  El precio base NO incluye ayudantes — son adicionales que el operador decide.

${learningSection}${realCasesSection}
Responde SOLO con JSON valido, sin markdown:
{
  "detectedType": "flete|mudanza",
  "vehicle": "auto|furgon|camion34|camionLargo",
  "vehicleName": "<nombre para mostrar al cliente>",
  "vehicleIcon": "🚗|🚐|🚚|🚛",
  "price": <precio de la CARGA sin km, entero multiplo de 1000 — el servidor agrega el costo de km automaticamente>,
  "priceMin": <entero multiplo de 1000>,
  "priceMax": <entero multiplo de 1000>,
  "tollEstimate": <entero multiplo de 1000, 0 si no aplica>,
  "recommendedHelpers": <0|1|2|3>,
  "clientExplanation": "<1-2 frases naturales para el cliente>",
  "internalNote": "<nota tecnica para el admin>",
  "confidence": "low|medium|high",
  "needsManualReview": <true|false>
}

=== SOLICITUD ===
Origen: ${originAddress || 'No especificado'}
Destino: ${destinationAddress || 'No especificado'}
Distancia: ${distanceKm > 0 ? `${distanceKm} km` : 'No calculada (asumir corta, dentro de Santiago)'}
Articulos: ${itemsList}
Notas adicionales: ${freeText?.trim() || 'Ninguno'}
Extras: ${extrasDesc}`;

    console.log(`[ai-quote] llamando a Claude (prompt ${prompt.length} chars)...`);
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    console.log(`[ai-quote] respuesta Claude: ${text.slice(0, 200)}`);

    // Extract JSON — handle ```json blocks and bare objects
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      console.warn('[ai-quote] sin JSON en respuesta, fallback. Respuesta completa:', text);
      return res.json(fallbackQuote(items, Number(distanceKm), Number(numHelpers), Number(numFloors)));
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      console.log(`[ai-quote] resultado: vehicle=${result.vehicle} price=${result.price} needsManualReview=${result.needsManualReview}`);
    } catch (parseErr) {
      console.warn('[ai-quote] JSON parse falló, fallback:', parseErr.message);
      return res.json(fallbackQuote(items, Number(distanceKm), Number(numHelpers), Number(numFloors)));
    }

    // ── Server-side km adjustment ─────────────────────────────────────────────
    // AI returns cargo-only base price (trained on 4km examples).
    // Server always adds the km cost delta on top using real tariff configs.
    const kmDist = Number(distanceKm) || 0;
    if (kmDist > 4 && rawVehicleConfigs.length > 0) {
      const BASE_TRAINING_KM = 4;
      const aiVehicleType = (['auto', 'furgon', 'camion34', 'camionLargo'].includes(result.vehicle))
        ? result.vehicle : 'furgon';
      const vc = rawVehicleConfigs.find(c => c.vehicle_type === aiVehicleType);
      if (vc && (vc.km_tiers || []).length > 0) {
        const sortedTiers = [...vc.km_tiers].sort((a, b) => a.max_km - b.max_km);
        const tierForActual = sortedTiers.find(t => kmDist <= t.max_km) || sortedTiers[sortedTiers.length - 1];
        const tierForBase   = sortedTiers.find(t => BASE_TRAINING_KM <= t.max_km) || sortedTiers[0];
        const rateActual = Number(tierForActual?.price_per_km || 0);
        const rateBase   = Number(tierForBase?.price_per_km   || 0);
        const kmDelta = Math.round((kmDist * rateActual - BASE_TRAINING_KM * rateBase) / 1000) * 1000;
        if (kmDelta > 0) {
          result.price    = (Number(result.price    || 0) + kmDelta);
          result.priceMin = (Number(result.priceMin || 0) + kmDelta);
          result.priceMax = (Number(result.priceMax || 0) + kmDelta);
          result.internalNote = (result.internalNote || '') + ` | +$${kmDelta.toLocaleString('es-CL')} km (${kmDist}km @$${rateActual}/km)`;
        }
      }
    }

    const price = Math.max(15000, Math.round(Number(result.price || 0) / 1000) * 1000);
    // Always derive range from price — never trust AI's priceMin/priceMax independently
    const priceMin = Math.max(15000, Math.round(price * 0.88 / 1000) * 1000);
    const priceMax = Math.round(price * 1.15 / 1000) * 1000;
    const rawVehicle = ['auto', 'furgon', 'camion34', 'camionLargo'].includes(result.vehicle) ? result.vehicle : 'camion34';
    const vehicleKey = enforceVehicleMinimum(rawVehicle, items, freeText || '');
    const VEHICLE_NAMES = { auto: 'Auto', furgon: 'Furgón N400', camion34: 'Camión 3/4', camionLargo: 'Camión Largo' };
    const VEHICLE_ICONS = { auto: '🚗', furgon: '🚐', camion34: '🚚', camionLargo: '🚛' };
    return res.json({
      detectedType: ['flete', 'mudanza'].includes(result.detectedType) ? result.detectedType : 'mudanza',
      vehicle: vehicleKey,
      vehicleName: VEHICLE_NAMES[vehicleKey],
      vehicleIcon: VEHICLE_ICONS[vehicleKey],
      price,
      priceMin,
      priceMax,
      tollEstimate: Math.round(Math.max(0, Number(result.tollEstimate || 0)) / 1000) * 1000,
      recommendedHelpers: Math.min(3, Math.max(0, Math.round(Number(result.recommendedHelpers ?? 0)))),
      clientExplanation: String(result.clientExplanation || '').slice(0, 300),
      internalNote: String(result.internalNote || '').slice(0, 300),
      confidence: ['low', 'medium', 'high'].includes(result.confidence) ? result.confidence : 'medium',
      needsManualReview: Boolean(result.needsManualReview),
    });
  } catch (err) {
    console.error('[ai-quote] ERROR → fallback manual. Tipo:', err.constructor?.name, '| Msg:', err.message);
    if (err.status) console.error('[ai-quote] HTTP status:', err.status, '| body:', JSON.stringify(err.error || {}));
    return res.json(fallbackQuote(items, Number(distanceKm), Number(numHelpers), Number(numFloors)));
  }
});

// POST /api/public/ai-quote-feedback — operator saves approval/correction to train the pricing agent
router.post('/ai-quote-feedback', publicCalculationLimiter, async (req, res) => {
  try {
    const {
      itemsText = '', itemsJson = null, freeText = '',
      distanceKm = null, origin = '', destination = '',
      numHelpers = 0, numFloors = 0,
      aiVehicle = '', aiVehicleName = '', aiDetectedType = '',
      aiPrice = 0, aiTwoTrips = false,
      status, correctPrice = null, correctVehicle = null, notes = '',
    } = req.body;

    if (!['approved', 'corrected'].includes(status)) {
      return res.status(400).json({ error: 'status debe ser approved o corrected' });
    }
    if (status === 'corrected' && !correctPrice) {
      return res.status(400).json({ error: 'correctPrice requerido al corregir' });
    }

    await supabaseRequest('/ai_quote_feedback', {
      method: 'POST',
      body: JSON.stringify({
        items_text: String(itemsText).slice(0, 500),
        items_json: itemsJson || null,
        free_text: String(freeText).slice(0, 300),
        distance_km: distanceKm ? Number(distanceKm) : null,
        origin: String(origin).slice(0, 200),
        destination: String(destination).slice(0, 200),
        num_helpers: Number(numHelpers) || 0,
        num_floors: Number(numFloors) || 0,
        ai_vehicle: String(aiVehicle).slice(0, 50),
        ai_vehicle_name: String(aiVehicleName).slice(0, 100),
        ai_detected_type: String(aiDetectedType).slice(0, 20),
        ai_price: Math.round(Number(aiPrice) || 0),
        ai_two_trips: Boolean(aiTwoTrips),
        status,
        correct_price: correctPrice ? Math.round(Number(correctPrice)) : null,
        correct_vehicle: correctVehicle ? String(correctVehicle).slice(0, 50) : null,
        notes: String(notes).slice(0, 300),
      }),
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('ai-quote-feedback:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/public/price-review — AI adjusts formula price silently (no auth)
router.post('/price-review', publicCalculationLimiter, async (req, res) => {
  try {
    const {
      serviceType = 'flete',
      vehicleName = '', vehicleMaxVol = 0,
      distanceKm = 0, invVol = 0, catalogVol = 0, aiExtraVol = 0,
      inventoryExtras = '', catalogItems = [],
      numHelpers = 0, numFloors = 0, needsPacking = false,
      helpMode = 'driver', numTrucks = 1,
      formulaPrice = 0,
      vehicleBasePrice = 0, distanceCost = 0, extraVolCost = 0,
      floorCost = 0, helpCost = 0, packCost = 0, vehicleKmPrice = 0,
    } = req.body;

    if (!formulaPrice || !process.env.CLAUDE_API_KEY) {
      return res.json({ factor: 1.0, adjustedPrice: formulaPrice, adjusted: false });
    }

    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const itemsList = catalogItems.length > 0
      ? catalogItems.map(i => `${i.qty}x ${i.name}`).join(', ')
      : 'Sin artículos del catálogo';

    const helpDesc = helpMode === 'none' ? 'Solo traslado (sin ayuda)' :
                     helpMode === 'driver' ? 'Chofer ayuda' :
                     `Chofer + ${numHelpers} ayudante${numHelpers > 1 ? 's' : ''}`;

    const prompt = `Eres el motor de precios de MUVE, empresa de fletes y mudanzas en Santiago de Chile.
Revisa el precio calculado por formula y ajustalo SOLO si hay una razon clara y justificada.

=== SERVICIO ===
Tipo: ${serviceType} | Vehiculo: ${vehicleName} (${vehicleMaxVol} m3) | Distancia: ${distanceKm} km
Volumen: ${Number(invVol).toFixed(1)} m3 total (${Number(catalogVol).toFixed(1)} m3 catalogo${aiExtraVol > 0 ? ` + ${Number(aiExtraVol).toFixed(1)} m3 adicional` : ''})
Articulos: ${itemsList}${inventoryExtras ? `\nAdicionales texto libre: "${inventoryExtras}"` : ''}
Pisos sin ascensor: ${numFloors} | Ayuda: ${helpDesc} | Embalaje: ${needsPacking ? 'Si' : 'No'}${numTrucks > 1 ? ` | Camiones: ${numTrucks}` : ''}

=== DESGLOSE FORMULA ===
Base: $${vehicleBasePrice.toLocaleString()}${numTrucks > 1 ? ` x${numTrucks}` : ''} | KM: $${distanceCost.toLocaleString()} | M3 extra: $${extraVolCost.toLocaleString()}
Pisos: $${floorCost.toLocaleString()} | Carga: $${helpCost.toLocaleString()} | Embalaje: $${packCost.toLocaleString()}
TOTAL FORMULA: $${formulaPrice.toLocaleString()}

=== RANGOS DE MERCADO CHILE ===
Flete furgo: $25.000-$65.000 | Flete 3/4: $50.000-$140.000 | Flete largo: $100.000-$260.000
Mudanza furgo: $45.000-$90.000 | Mudanza 3/4: $80.000-$210.000 | Mudanza largo: $160.000-$420.000

=== REGLAS ===
1. Si precio es razonable para el servicio (dentro de +-15% del mercado): NO ajustar, devuelve factor 1.0
2. Articulos de alto riesgo en texto libre (piano, moto, obra de arte, antigüedades): recargo 15-25% si no esta reflejado
3. Si el precio es claramente bajo para la combinacion de servicio+distancia+volumen: ajusta al alza moderadamente
4. Si el precio es claramente alto para lo que se transporta: ajusta a la baja moderadamente
5. El factor debe estar entre 0.70 y 1.40 como maximo
6. Precio ajustado siempre multiplo de 1000, minimo 15000
7. Cambios menores al 8%: NO ajustar (factor = 1.0)

Responde SOLO con JSON valido sin markdown:
{"factor":<decimal 3 decimales>,"adjustedPrice":<entero multiplo de 1000>,"adjusted":<true|false>}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ factor: 1.0, adjustedPrice: formulaPrice, adjusted: false });

    const result = JSON.parse(jsonMatch[0]);
    const factor = Math.max(0.70, Math.min(1.40, Number(result.factor || 1.0)));
    const adjustedPrice = Math.max(15000, Math.round(Number(result.adjustedPrice || formulaPrice) / 1000) * 1000);

    return res.json({ factor, adjustedPrice, adjusted: Boolean(result.adjusted) });
  } catch (err) {
    console.error('price-review:', err.message);
    res.json({ factor: 1.0, adjustedPrice: req.body?.formulaPrice || 0, adjusted: false, error: true });
  }
});

// POST /api/public/estimate-load — AI estimates extra m³ from free-text inventory (no auth)
router.post('/estimate-load', publicCalculationLimiter, async (req, res) => {
  try {
    const { catalogItems = [], freeText = '', serviceType = 'flete' } = req.body;

    if (!freeText?.trim()) return res.json({ extraVol: 0, items: [], reasoning: '', confidence: 'high' });
    if (freeText.trim().length > 500) return res.status(400).json({ error: 'Texto demasiado largo' });

    if (!process.env.CLAUDE_API_KEY) return res.json({ extraVol: 0, items: [], reasoning: '', confidence: 'low', unavailable: true });

    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const catalogSummary = catalogItems.length > 0
      ? catalogItems.map(i => `- ${i.qty}x ${i.name} (${i.vol} m3 c/u)`).join('\n')
      : 'Ninguno';

    const prompt = `Eres experto en logistica de mudanzas y fletes en Chile. Estima el volumen en m3 de los articulos en texto libre para una cotizacion de ${serviceType}.

Articulos ya en el catalogo (NO los incluyas en tu estimacion):
${catalogSummary}

Articulos adicionales del cliente (estima SOLO estos):
"${freeText.trim()}"

Referencias de volumenes tipicos:
- Bicicleta: 0.5 m3, Moto: 1.5 m3, Piano vertical: 1.2 m3, Piano cola: 3 m3
- Planta grande: 0.4 m3, Jardinera grande: 0.5 m3, Cuadro grande: 0.2 m3
- Caja estandar: 0.1 m3, Caja grande: 0.2 m3, Herramientas: 0.3 m3
- Bicicleta estatica: 0.4 m3, Aparato de gimnasio: 1.0 m3

Responde SOLO con JSON, sin markdown ni explicacion extra:
{"extraVol":<decimal 1 lugar>,"items":[{"name":"<nombre>","estimatedVol":<decimal>}],"reasoning":"<max 60 chars espanol>","confidence":"<low|medium|high>"}

Si el texto no describe articulos reconocibles, devuelve extraVol: 0.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ extraVol: 0, items: [], reasoning: '', confidence: 'low' });

    const result = JSON.parse(jsonMatch[0]);
    return res.json({
      extraVol: Math.max(0, Math.round(Number(result.extraVol || 0) * 10) / 10),
      items: Array.isArray(result.items) ? result.items.slice(0, 10) : [],
      reasoning: String(result.reasoning || '').slice(0, 120),
      confidence: ['low', 'medium', 'high'].includes(result.confidence) ? result.confidence : 'medium',
    });
  } catch (err) {
    console.error('estimate-load:', err.message);
    res.json({ extraVol: 0, items: [], reasoning: '', confidence: 'low', error: true });
  }
});

function clean(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const STATUS_LABELS = { draft: 'Borrador', active: 'En curso', paused: 'Pausada', completed: 'Completada', cancelled: 'Cancelada' };

function mapPublicPackage(p) {
  return {
    _id: p.id,
    id: p.id,
    trackingId: p.tracking_id,
    customerName: p.customer_name,
    customerLastName: p.customer_last_name || '',
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
    price: p.price,
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

const onlyDigits = v => String(v || '').replace(/\D/g, '');

// El cotizador crea un borrador ("lead") al ingresar nombre + teléfono, y luego
// envía la cotización completa al aceptar el precio. Sin esto se guardaban DOS
// registros por cotización. Esta búsqueda enlaza ambos pasos: el envío final
// reutiliza el borrador reciente del mismo teléfono en vez de crear otra fila.
async function findRecentDraftByPhone(phone, windowHours = 6) {
  const digits = onlyDigits(phone);
  if (!isSupabaseEnabled() || digits.length < 8) return null;
  const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
  try {
    const rows = await supabaseRequest(`/quotes${qs({
      select: 'id,quote_code,status,contact_phone,created_at',
      status: 'eq.draft',
      created_at: `gte.${since}`,
      order: 'created_at.desc',
      limit: '30',
    })}`);
    return (rows || []).find(r => onlyDigits(r.contact_phone) === digits) || null;
  } catch (err) {
    console.warn('[public] findRecentDraftByPhone falló:', err.message);
    return null;
  }
}

// POST /api/public/lead — captura parcial antes de mostrar precio
router.post('/lead', publicQuoteLimiter, async (req, res) => {
  try {
    const name  = (req.body.name  || '').toString().trim().slice(0, 120);
    const phone = (req.body.phone || '').toString().trim().slice(0, 40);
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });

    const originAddress      = (req.body.from || '').toString().trim().slice(0, 300);
    const destinationAddress = (req.body.to   || '').toString().trim().slice(0, 300);

    if (isSupabaseEnabled()) {
      // Si el usuario vuelve atrás y avanza de nuevo, no acumular borradores:
      // actualizar el que ya existe para ese teléfono.
      const existing = await findRecentDraftByPhone(phone);
      if (existing) {
        const patch = { contact_person: name };
        if (originAddress)      patch.origin_address = originAddress;
        if (destinationAddress) patch.destination_address = destinationAddress;
        await supabaseRequest(`/quotes${qs({ id: `eq.${existing.id}` })}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
      } else {
        const ds = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const quoteCode = `MUVE-${ds}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        await supabaseRequest('/quotes', {
          method: 'POST',
          body: JSON.stringify({
            quote_code: quoteCode,
            service_type: 'flete',
            contact_person: name,
            contact_phone: phone,
            origin_address: originAddress,
            destination_address: destinationAddress,
            status: 'draft',
            client_notes: 'Lead parcial — cotizador web (pre-precio)',
          }),
        });
        // Solo al crear un lead NUEVO — así el operador tiene el contacto aunque
        // el cliente abandone antes de terminar. No re-notifica al volver atrás.
        notifyAdminLead({ name, phone, origin: originAddress, destination: destinationAddress })
          .catch(err => console.warn('[public/lead] notif lead falló:', err.message));
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[public/lead] Error al guardar lead parcial:', err.message);
    res.json({ ok: true }); // no bloquear al usuario aunque falle el guardado
  }
});

// POST /api/public/quotes - ingreso desde la landing publica
router.post('/quotes', publicQuoteLimiter, validatePublicQuotePayload, quoteSpamGuard, async (req, res) => {
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
    const originFloors     = Number(req.body.originFloors || 0);
    const destinationFloors = Number(req.body.destinationFloors || 0);
    const numFloors        = Number(req.body.numFloors ?? (originFloors + destinationFloors) ?? 0);
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
      payload.origin_floors = originFloors;
      payload.destination_floors = destinationFloors;
      payload.needs_packing = needsPacking;
      payload.is_conserjeria = isConserjeria;
      if (itemsDescription) payload.items_description = itemsDescription;
      if (priceMin !== null) payload.price_min = priceMin;
      if (priceMax !== null) payload.price_max = priceMax;
    }

    // Si ya hay un borrador (lead) reciente de este teléfono, promoverlo en vez de
    // crear una segunda fila — así cada cotización queda en UN solo registro.
    const draft = await findRecentDraftByPhone(contactPhone);
    const writeQuote = async body => {
      if (draft) {
        const promote = { ...body };
        delete promote.quote_code; // conservar el código con el que nació el borrador
        return supabaseRequest(`/quotes${qs({ id: `eq.${draft.id}` })}`, { method: 'PATCH', body: JSON.stringify(promote) });
      }
      return supabaseRequest('/quotes', { method: 'POST', body: JSON.stringify(body) });
    };

    let quoteRows;
    try {
      quoteRows = await writeQuote(payload);
    } catch (schemaErr) {
      if (!schemaErr.message.includes('origin_floors') && !schemaErr.message.includes('destination_floors') && !schemaErr.message.includes('schema cache')) throw schemaErr;
      const legacyPayload = { ...payload };
      delete legacyPayload.origin_floors;
      delete legacyPayload.destination_floors;
      quoteRows = await writeQuote(legacyPayload);
    }
    const quote = quoteRows?.[0];
    if (draft) console.log(`[public/quotes] borrador ${draft.quote_code} promovido a cotización enviada`);

    const noteParts = [];
    if (originAddress) noteParts.push(`Origen: ${originAddress}`);
    if (distanceKm) noteParts.push(`Distancia: ${distanceKm} km`);
    if (vehicleType) noteParts.push(`Vehiculo: ${vehicleType}`);
    if (driverHelps) noteParts.push('Ayuda del chofer incluida');
    if (numHelpers > 0) noteParts.push(`${numHelpers} ayudante(s) adicional(es)`);
    if (numFloors > 0) {
      const floorDetail = originFloors || destinationFloors ? `: retiro ${originFloors}, entrega ${destinationFloors}` : '';
      noteParts.push(`${numFloors} piso(s)${floorDetail}`);
    }
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

    // Darle a la notificación una ventana real para completarse antes de responder
    // (así no depende de que el proceso siga "vivo" tras el response). Si ntfy está
    // lento, la respuesta igual sale a los ~9 s y los reintentos siguen en segundo plano.
    const notifyDone = notifyAdminQuoteCreated({ quote, payload })
      .catch(err => console.warn('[public/quotes] notificación falló:', err.message));
    await Promise.race([notifyDone, new Promise(r => setTimeout(r, 9000))]);

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
router.get('/route/:shareToken', publicReadLimiter, async (req, res) => {
  try {
    const routes = await supabaseRequest(`/routes${qs({ share_token: `eq.${req.params.shareToken}`, select: '*' })}`);
    const route = routes?.[0];
    if (!route) return res.status(404).json({ error: 'Enlace no valido o expirado' });

    const [packages, priceTiersRaw, zonesRaw] = await Promise.all([
      supabaseRequest(`/packages${qs({ route_id: `eq.${route.id}`, select: '*', order: 'stop_order.asc' })}`),
      (async () => {
        if (route.tariff_id) {
          const [tariffRows, items] = await Promise.all([
            supabaseRequest(`/tariffs${qs({ id: `eq.${route.tariff_id}`, select: 'volume_tiers,name' })}`).catch(() => []),
            supabaseRequest(`/tariff_items${qs({ tariff_id: `eq.${route.tariff_id}`, select: '*', order: 'commune.asc' })}`).catch(() => []),
          ]);
          const tariff = tariffRows?.[0];
          const tiers = items?.length ? items.map(i => ({ commune: i.commune, price: Number(i.price || 0), zone: i.zone || '' })) : [];
          return { tiers, volumeTiers: tariff?.volume_tiers || [], tariffName: tariff?.name || '' };
        }
        const configs = await supabaseRequest(`/price_configs${qs({ select: '*', order: 'commune.asc' })}`).catch(() => []);
        return { tiers: (configs || []).map(c => ({ commune: c.commune, price: Number(c.price || 0) })), volumeTiers: [], tariffName: '' };
      })(),
      supabaseRequest(`/zones${qs({ source: 'eq.commune', select: 'name,tiers' })}`).catch(() => []),
    ]);

    // Per-commune volume tiers from zones table (name → [{minQty, price}])
    const zoneTiersMap = {};
    (zonesRaw || []).forEach(z => {
      if (z.name && Array.isArray(z.tiers) && z.tiers.length) {
        zoneTiersMap[z.name.toLowerCase().trim()] = z.tiers;
      }
    });

    const companyIds = req.query.c ? req.query.c.split(',').map(s => s.trim()).filter(Boolean) : null;
    const filtered = companyIds ? packages.filter(p => companyIds.includes(p.company_id)) : packages;
    const publicPackages = filtered.filter(p => p.status !== 'eliminado').map(mapPublicPackage);

    // Enrich priceTiers with per-commune zone tiers (only communes with packages in route)
    const usedCommunes = new Set(publicPackages.map(p => (p.commune || '').toLowerCase().trim()).filter(Boolean));
    const priceTiers = (priceTiersRaw?.tiers || [])
      .filter(t => t.commune && t.price > 0 && usedCommunes.has(t.commune.toLowerCase().trim()))
      .map(t => ({ ...t, tiers: zoneTiersMap[t.commune.toLowerCase().trim()] || [] }))
      .sort((a, b) => b.price - a.price || a.commune.localeCompare(b.commune));

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
        invoiceAmount: route.invoice?.amount || null,
        priceTiers,
        volumeTiers: priceTiersRaw?.volumeTiers || [],
        tariffName: priceTiersRaw?.tariffName || '',
      },
      packages: publicPackages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/public/quote/:token — client updates items (saves draft)
router.patch('/quote/:token', publicQuoteLimiter, async (req, res) => {
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
    // Supabase is this app's only supported database (see CLAUDE.md) — if it's not
    // configured there is no working fallback, so fail loudly instead of crashing
    // on an undefined `Quote` model.
    throw new Error('Base de datos no configurada (Supabase deshabilitado)');
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/public/quote/:token/submit — client submits for admin review
router.post('/quote/:token/submit', publicQuoteLimiter, async (req, res) => {
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
    // Supabase is this app's only supported database (see CLAUDE.md) — if it's not
    // configured there is no working fallback, so fail loudly instead of crashing
    // on an undefined `Quote` model.
    throw new Error('Base de datos no configurada (Supabase deshabilitado)');
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
