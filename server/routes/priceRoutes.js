import { Router } from 'express';
import PriceConfig from '../models/PriceConfig.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { PRICES } from '../utils/priceByCommune.js';

const router = Router();

// Seed helper: capitalize first letter of each word
function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// GET /api/prices — list all commune prices (seeds DB from defaults if empty)
router.get('/', requireAuth, async (req, res) => {
  try {
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
    const config = await PriceConfig.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!config) return res.status(404).json({ error: 'No encontrado' });
    res.json(config);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/prices/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await PriceConfig.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Utility: get a normalized price map for use in imports
export async function getDbPricesMap() {
  const configs = await PriceConfig.find().lean();
  const map = {};
  configs.forEach(c => {
    const key = c.commune.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
    map[key] = c.price;
  });
  return map;
}

export default router;
