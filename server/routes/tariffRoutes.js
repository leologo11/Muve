import { Router } from 'express';
import Tariff from '../models/Tariff.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isSupabaseEnabled, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const [tariffs, items] = await Promise.all([
        supabaseRequest(`/tariffs${qs({ select: '*', order: 'created_at.desc' })}`),
        supabaseRequest(`/tariff_items${qs({ select: '*' })}`),
      ]);
      return res.json(tariffs.map(t => ({
        _id: t.id, id: t.id, name: t.name, description: t.description, defaultPrice: Number(t.default_price || 0),
        items: items.filter(i => i.tariff_id === t.id).map(i => ({ _id: i.id, commune: i.commune, price: Number(i.price || 0), zone: i.zone })),
        createdAt: t.created_at, updatedAt: t.updated_at,
      })));
    }
    const tariffs = await Tariff.find().sort({ createdAt: -1 }).lean();
    res.json(tariffs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const [tariffs, items] = await Promise.all([
        supabaseRequest(`/tariffs${qs({ id: `eq.${req.params.id}`, select: '*' })}`),
        supabaseRequest(`/tariff_items${qs({ tariff_id: `eq.${req.params.id}`, select: '*' })}`),
      ]);
      const t = tariffs?.[0];
      if (!t) return res.status(404).json({ error: 'Tarifa no encontrada' });
      return res.json({ _id: t.id, id: t.id, name: t.name, description: t.description, defaultPrice: Number(t.default_price || 0), items: items.map(i => ({ _id: i.id, commune: i.commune, price: Number(i.price || 0), zone: i.zone })) });
    }
    const tariff = await Tariff.findById(req.params.id).lean();
    if (!tariff) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.json(tariff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest('/tariffs', {
        method: 'POST',
        body: JSON.stringify({ name: req.body.name, description: req.body.description || '', default_price: Number(req.body.defaultPrice || 3500) }),
      });
      const t = rows[0];
      if (req.body.items?.length) {
        await supabaseRequest('/tariff_items', {
          method: 'POST',
          body: JSON.stringify(req.body.items.map(i => ({ tariff_id: t.id, commune: i.commune, price: Number(i.price || 0), zone: i.zone || '' }))),
        });
      }
      return res.status(201).json({ _id: t.id, id: t.id, name: t.name, description: t.description, defaultPrice: Number(t.default_price || 0), items: req.body.items || [] });
    }
    const tariff = await Tariff.create(req.body);
    res.status(201).json(tariff);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const payload = {};
      if (req.body.name !== undefined) payload.name = req.body.name;
      if (req.body.description !== undefined) payload.description = req.body.description || '';
      if (req.body.defaultPrice !== undefined) payload.default_price = Number(req.body.defaultPrice || 0);
      payload.updated_at = new Date().toISOString();
      const rows = await supabaseRequest(`/tariffs${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(payload) });
      if (!rows?.[0]) return res.status(404).json({ error: 'Tarifa no encontrada' });
      if (Array.isArray(req.body.items)) {
        await supabaseRequest(`/tariff_items${qs({ tariff_id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
        if (req.body.items.length) {
          await supabaseRequest('/tariff_items', { method: 'POST', body: JSON.stringify(req.body.items.map(i => ({ tariff_id: req.params.id, commune: i.commune, price: Number(i.price || 0), zone: i.zone || '' }))) });
        }
      }
      return res.json({ _id: rows[0].id, id: rows[0].id, name: rows[0].name, description: rows[0].description, defaultPrice: Number(rows[0].default_price || 0), items: req.body.items || [] });
    }
    const tariff = await Tariff.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!tariff) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.json(tariff);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      await supabaseRequest(`/tariffs${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
      return res.json({ ok: true });
    }
    await Tariff.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const original = await supabaseRequest(`/tariffs${qs({ id: `eq.${req.params.id}`, select: '*' })}`);
      const t = original?.[0];
      if (!t) return res.status(404).json({ error: 'Tarifa no encontrada' });
      const rows = await supabaseRequest('/tariffs', { method: 'POST', body: JSON.stringify({ name: `${t.name} (copia)`, description: t.description, default_price: t.default_price }) });
      return res.status(201).json({ _id: rows[0].id, id: rows[0].id, name: rows[0].name, description: rows[0].description, defaultPrice: Number(rows[0].default_price || 0), items: [] });
    }
    const original = await Tariff.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ error: 'Tarifa no encontrada' });
    const { _id, createdAt, updatedAt, __v, ...rest } = original;
    const copy = await Tariff.create({ ...rest, name: rest.name + ' (copia)' });
    res.status(201).json(copy);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
