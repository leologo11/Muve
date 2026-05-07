import { Router } from 'express';
import PriceConfig from '../models/PriceConfig.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { PRICES } from '../utils/priceByCommune.js';
import { isSupabaseEnabled, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();

router.use(requireAuth);

// Seed helper: capitalize first letter of each word
function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// GET /api/prices — list all commune prices (seeds DB from defaults if empty)
router.get('/', requireAuth, async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      let configs = await supabaseRequest(`/price_configs${qs({ select: '*', order: 'commune.asc' })}`);
      if (configs.length === 0) {
        const defaults = Object.entries(PRICES)
          .filter(([k]) => k !== '_default')
          .map(([commune, price]) => ({ commune: capitalize(commune), price, zone: '' }));
        await supabaseRequest('/price_configs', { method: 'POST', body: JSON.stringify(defaults) });
        configs = await supabaseRequest(`/price_configs${qs({ select: '*', order: 'commune.asc' })}`);
      }
      return res.json({ prices: configs.map(c => ({ ...c, _id: c.id, price: Number(c.price || 0) })), defaultPrice: PRICES['_default'] || 3500 });
    }
    let configs = await PriceConfig.find().sort({ commune: 1 }).lean();
    if (configs.length === 0) {
      const defaults = Object.entries(PRICES)
        .filter(([k]) => k !== '_default')
        .map(([commune, price]) => ({ commune: capitalize(commune), price, zone: '' }));
      await PriceConfig.insertMany(defaults, { ordered: false });
      configs = await PriceConfig.find().sort({ commune: 1 }).lean();
    }
    res.json({ prices: configs, defaultPrice: PRICES['_default'] || 3500 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/prices — create or upsert a commune price
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { commune, price, zone } = req.body;
    if (!commune?.trim() || price == null) return res.status(400).json({ error: 'commune y price son requeridos' });
    if (isSupabaseEnabled()) {
      const existing = await supabaseRequest(`/price_configs${qs({ commune: `eq.${commune.trim()}`, select: 'id' })}`);
      const body = { commune: commune.trim(), price: Number(price), zone: zone?.trim() || '', updated_at: new Date().toISOString() };
      const rows = existing?.[0]
        ? await supabaseRequest(`/price_configs${qs({ id: `eq.${existing[0].id}` })}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await supabaseRequest('/price_configs', { method: 'POST', body: JSON.stringify(body) });
      return res.json({ ...rows[0], _id: rows[0].id, price: Number(rows[0].price || 0) });
    }
    const config = await PriceConfig.findOneAndUpdate(
      { commune: commune.trim() },
      { price: Number(price), zone: zone?.trim() || '' },
      { upsert: true, new: true }
    );
    res.json(config);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/prices/:id — update commune or price
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { commune, price, zone } = req.body;
    const update = {};
    if (commune !== undefined) update.commune = commune.trim();
    if (price !== undefined) update.price = Number(price);
    if (zone !== undefined) update.zone = zone?.trim() || '';
    if (isSupabaseEnabled()) {
      update.updated_at = new Date().toISOString();
      const rows = await supabaseRequest(`/price_configs${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(update) });
      if (!rows?.[0]) return res.status(404).json({ error: 'No encontrado' });
      return res.json({ ...rows[0], _id: rows[0].id, price: Number(rows[0].price || 0) });
    }
    const config = await PriceConfig.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!config) return res.status(404).json({ error: 'No encontrado' });
    res.json(config);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/prices/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      await supabaseRequest(`/price_configs${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
      return res.json({ ok: true });
    }
    await PriceConfig.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/prices/bulk — upsert many commune prices at once + update matching zones
router.post('/bulk', requireRole('admin'), async (req, res) => {
  try {
    const items = req.body; // [{ commune, price }]
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Array requerido' });

    if (isSupabaseEnabled()) {
      // Upsert price_configs
      const priceRows = items.map(({ commune, price }) => ({
        commune: String(commune).trim(),
        price: Number(price),
        zone: '',
        updated_at: new Date().toISOString(),
      }));
      await supabaseRequest('/price_configs?on_conflict=commune', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(priceRows),
      });

      // Update matching zones
      const zones = await supabaseRequest(`/zones${qs({ source: 'eq.commune', select: 'id,name' })}`);
      const norm = s => (s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const priceMap = {};
      items.forEach(({ commune, price }) => { priceMap[norm(commune)] = Number(price); });

      let updated = 0;
      for (const z of zones) {
        const p = priceMap[norm(z.name)];
        if (p !== undefined) {
          await supabaseRequest(`/zones${qs({ id: `eq.${z.id}` })}`, {
            method: 'PATCH',
            body: JSON.stringify({ price: p, updated_at: new Date().toISOString() }),
          });
          updated++;
        }
      }
      return res.json({ ok: true, priceConfigs: priceRows.length, zonesUpdated: updated });
    }

    // MongoDB fallback
    const norm = s => (s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let zonesUpdated = 0;
    for (const { commune, price } of items) {
      await PriceConfig.findOneAndUpdate(
        { commune: commune.trim() },
        { price: Number(price), zone: '' },
        { upsert: true, new: true }
      );
      try {
        const Zone = (await import('../models/Zone.js')).default;
        const allZones = await Zone.find({ source: 'commune' }).lean();
        const match = allZones.find(z => norm(z.name) === norm(commune));
        if (match) { await Zone.findByIdAndUpdate(match._id, { price: Number(price) }); zonesUpdated++; }
      } catch {}
    }
    res.json({ ok: true, priceConfigs: items.length, zonesUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Utility: get a normalized price map for use in imports
export async function getDbPricesMap() {
  if (isSupabaseEnabled()) {
    const configs = await supabaseRequest(`/price_configs${qs({ select: '*' })}`);
    const map = {};
    configs.forEach(c => {
      const key = c.commune.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      map[key] = Number(c.price || 0);
    });
    return map;
  }
  const configs = await PriceConfig.find().lean();
  const map = {};
  configs.forEach(c => {
      const key = c.commune.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    map[key] = c.price;
  });
  return map;
}

export default router;
