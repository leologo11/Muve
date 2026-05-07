import { Router } from 'express';
import Zone from '../models/Zone.js';
import PriceConfig from '../models/PriceConfig.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { PRICES } from '../utils/priceByCommune.js';
import { isSupabaseEnabled, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth);

const GEO_URL = 'https://raw.githubusercontent.com/robsalasco/precenso_2016_geojson_chile/master/Comunas_Metropolitana.geojson';

// Palette for auto-coloring commune zones by price tier
const TIER_COLOR = (price) => {
  if (price <= 2000) return '#2a9940';
  if (price <= 3500) return '#66bb6a';
  if (price <= 5000) return '#f57c00';
  if (price <= 7000) return '#e53935';
  return '#7b1fa2';
};

function norm(s) {
  return (s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function communeName(props) {
  return props?.NOM_COMUNA || props?.NOMBRE || props?.nombre || props?.name || props?.Comuna || '';
}

// GET /api/zones
router.get('/', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest(`/zones${qs({ select: '*', order: 'source.asc,name.asc' })}`);
      return res.json(rows.map(z => ({
        _id: z.id,
        id: z.id,
        name: z.name,
        price: Number(z.price || 0),
        color: z.color,
        source: z.source,
        polygon: z.polygon,
        createdAt: z.created_at,
        updatedAt: z.updated_at,
      })));
    }
    res.json(await Zone.find().sort({ source: 1, name: 1 }).lean());
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/zones
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest('/zones', {
        method: 'POST',
        body: JSON.stringify({
          name: req.body.name,
          price: Number(req.body.price || 0),
          color: req.body.color || '#5c35cc',
          source: req.body.source || 'custom',
          polygon: req.body.polygon,
        }),
      });
      const z = rows?.[0];
      return res.status(201).json({ ...z, _id: z.id, price: Number(z.price || 0) });
    }
    res.status(201).json(await Zone.create(req.body));
  }
  catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/zones/:id
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const payload = {};
      if (req.body.name !== undefined) payload.name = req.body.name;
      if (req.body.price !== undefined) payload.price = Number(req.body.price);
      if (req.body.color !== undefined) payload.color = req.body.color;
      if (req.body.source !== undefined) payload.source = req.body.source;
      if (req.body.polygon !== undefined) payload.polygon = req.body.polygon;
      payload.updated_at = new Date().toISOString();
      const rows = await supabaseRequest(`/zones${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(payload) });
      if (!rows?.[0]) return res.status(404).json({ error: 'No encontrado' });
      return res.json({ ...rows[0], _id: rows[0].id, price: Number(rows[0].price || 0) });
    }
    const z = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!z) return res.status(404).json({ error: 'No encontrado' });
    res.json(z);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/zones/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      await supabaseRequest(`/zones${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
      return res.json({ ok: true });
    }
    await Zone.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/zones/communes/all — wipe and re-seed communes
router.delete('/communes/all', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest(`/zones${qs({ source: 'eq.commune', select: 'id' })}`);
      await supabaseRequest(`/zones${qs({ source: 'eq.commune' })}`, { method: 'DELETE' });
      return res.json({ deleted: rows.length });
    }
    const { deletedCount } = await Zone.deleteMany({ source: 'commune' });
    res.json({ deleted: deletedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/zones/seed-communes — create one Zone per RM commune
// Accepts optional { features } in body (client fetched GeoJSON) to avoid server-side network issues
router.post('/seed-communes', requireRole('admin'), async (req, res) => {
  try {
    let features;

    if (Array.isArray(req.body?.features) && req.body.features.length > 0) {
      // Client fetched the GeoJSON directly (more reliable)
      features = req.body.features;
    } else {
      // Fallback: server-side fetch
      const r = await fetch(GEO_URL, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error('No se pudo descargar el mapa de comunas del RM');
      const geoData = await r.json();
      features = geoData.features;
    }

    // Build price lookup: DB prices → fallback to hardcoded PRICES
    const configs = isSupabaseEnabled()
      ? await supabaseRequest(`/price_configs${qs({ select: '*' })}`)
      : await PriceConfig.find().lean();
    const priceMap = {};
    configs.forEach(c => { priceMap[norm(c.commune)] = Number(c.price || 0); });

    const defaultPrice = PRICES['_default'] || 3500;
    function getPrice(name) {
      return priceMap[norm(name)] || PRICES[norm(name)] || defaultPrice;
    }

    let created = 0, skipped = 0, errors = 0;

    for (const feat of features) {
      const rawName = communeName(feat.properties);
      if (!rawName) continue;
      const name = titleCase(rawName);

      // Idempotent — skip if already exists
      if (isSupabaseEnabled()) {
        const exists = await supabaseRequest(`/zones${qs({ name: `ilike.${name}`, source: 'eq.commune', select: 'id' })}`);
        if (exists?.length) { skipped++; continue; }
      } else {
        const exists = await Zone.findOne({ name: { $regex: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }, source: 'commune' });
        if (exists) { skipped++; continue; }
      }

      // Handle Polygon and MultiPolygon geometries
      let polygon;
      if (feat.geometry?.type === 'Polygon') {
        polygon = feat.geometry;
      } else if (feat.geometry?.type === 'MultiPolygon') {
        // Use the ring with the most vertices (main body of the commune)
        const largest = feat.geometry.coordinates.reduce((a, b) => a[0].length >= b[0].length ? a : b);
        polygon = { type: 'Polygon', coordinates: largest };
      } else {
        continue;
      }

      const price = getPrice(name);
      try {
        if (isSupabaseEnabled()) {
          await supabaseRequest('/zones', {
            method: 'POST',
            body: JSON.stringify({ name, price, color: TIER_COLOR(price), source: 'commune', polygon }),
          });
        } else {
          await Zone.create({ name, price, color: TIER_COLOR(price), source: 'commune', polygon });
        }
        created++;
      } catch { errors++; }
    }

    res.json({ created, skipped, errors, total: features.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
