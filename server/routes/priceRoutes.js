import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { PRICES, normalize as norm } from '../utils/priceByCommune.js';
import { qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();

router.use(requireAuth);

// Seed helper: capitalize first letter of each word
function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// GET /api/prices — list all commune prices (seeds DB from defaults if empty)
router.get('/', requireAuth, async (req, res) => {
  try {
    let configs = await supabaseRequest(`/price_configs${qs({ select: '*', order: 'commune.asc' })}`);
    if (configs.length === 0) {
      const defaults = Object.entries(PRICES)
        .filter(([k]) => k !== '_default')
        .map(([commune, price]) => ({ commune: capitalize(commune), price, zone: '' }));
      await supabaseRequest('/price_configs', { method: 'POST', body: JSON.stringify(defaults) });
      configs = await supabaseRequest(`/price_configs${qs({ select: '*', order: 'commune.asc' })}`);
    }
    return res.json({ prices: configs.map(c => ({ ...c, _id: c.id, price: Number(c.price || 0) })), defaultPrice: PRICES['_default'] || 3500 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/prices — create or upsert a commune price
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { commune, price, zone } = req.body;
    if (!commune?.trim() || price == null) return res.status(400).json({ error: 'commune y price son requeridos' });
    const existing = await supabaseRequest(`/price_configs${qs({ commune: `eq.${commune.trim()}`, select: 'id' })}`);
    const body = { commune: commune.trim(), price: Number(price), zone: zone?.trim() || '', updated_at: new Date().toISOString() };
    const rows = existing?.[0]
      ? await supabaseRequest(`/price_configs${qs({ id: `eq.${existing[0].id}` })}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await supabaseRequest('/price_configs', { method: 'POST', body: JSON.stringify(body) });
    return res.json({ ...rows[0], _id: rows[0].id, price: Number(rows[0].price || 0) });
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
    update.updated_at = new Date().toISOString();
    const rows = await supabaseRequest(`/price_configs${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(update) });
    if (!rows?.[0]) return res.status(404).json({ error: 'No encontrado' });
    return res.json({ ...rows[0], _id: rows[0].id, price: Number(rows[0].price || 0) });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/prices/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await supabaseRequest(`/price_configs${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/prices/bulk — upsert many commune prices at once + update matching zones
router.post('/bulk', requireRole('admin'), async (req, res) => {
  try {
    const items = req.body; // [{ commune, price }]
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Array requerido' });

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
    const priceMap = {};
    items.forEach(({ commune, price }) => { priceMap[norm(commune)] = Number(price); });

    // Sequential PATCH per zone — a batch upsert isn't viable here because `zones.polygon`
    // is NOT NULL with no default, so a POST+on_conflict upsert would fail PostgREST's
    // INSERT-side constraint check unless every row also carried its full polygon payload.
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Utility: get a normalized price map for use in imports
export async function getDbPricesMap() {
  const configs = await supabaseRequest(`/price_configs${qs({ select: '*' })}`);
  const map = {};
  configs.forEach(c => {
    const key = norm(c.commune);
    map[key] = Number(c.price || 0);
  });
  return map;
}

export default router;
