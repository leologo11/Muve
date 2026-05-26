import { Router } from 'express';
import TierTemplate from '../models/TierTemplate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isSupabaseEnabled, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

function toClient(r) {
  return {
    _id: r.id ?? r._id,
    name: r.name,
    qty2: Number(r.qty2 ?? 4),
    qty3: Number(r.qty3 ?? 8),
    mode: r.mode ?? 'flat',
    discount2: Number(r.discount2 ?? 0),
    discount3: Number(r.discount3 ?? 0),
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
  };
}

// GET /api/tier-templates
router.get('/', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest(`/tier_templates${qs({ select: '*', order: 'created_at.desc' })}`);
      return res.json(rows.map(toClient));
    }
    res.json((await TierTemplate.find().sort({ createdAt: -1 }).lean()).map(toClient));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tier-templates
router.post('/', async (req, res) => {
  try {
    const { name, qty2, qty3, mode, discount2, discount3 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'nombre requerido' });
    const payload = { name: name.trim(), qty2: Number(qty2 ?? 4), qty3: Number(qty3 ?? 8), mode: mode ?? 'flat', discount2: Number(discount2 ?? 0), discount3: Number(discount3 ?? 0) };
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest('/tier_templates', { method: 'POST', body: JSON.stringify(payload) });
      return res.status(201).json(toClient(rows[0]));
    }
    res.status(201).json(toClient(await TierTemplate.create(payload)));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/tier-templates/:id
router.patch('/:id', async (req, res) => {
  try {
    const { name, qty2, qty3, mode, discount2, discount3 } = req.body;
    const payload = {};
    if (name !== undefined)      payload.name      = String(name).trim();
    if (qty2 !== undefined)      payload.qty2      = Number(qty2);
    if (qty3 !== undefined)      payload.qty3      = Number(qty3);
    if (mode !== undefined)      payload.mode      = mode;
    if (discount2 !== undefined) payload.discount2 = Number(discount2);
    if (discount3 !== undefined) payload.discount3 = Number(discount3);
    if (isSupabaseEnabled()) {
      payload.updated_at = new Date().toISOString();
      const rows = await supabaseRequest(`/tier_templates${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(payload) });
      if (!rows?.[0]) return res.status(404).json({ error: 'No encontrado' });
      return res.json(toClient(rows[0]));
    }
    const doc = await TierTemplate.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(toClient(doc));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/tier-templates/:id
router.delete('/:id', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      await supabaseRequest(`/tier_templates${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
      return res.json({ ok: true });
    }
    await TierTemplate.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
