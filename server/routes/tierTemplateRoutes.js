import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

function toClient(r) {
  return {
    _id: r.id,
    name: r.name,
    qty2: Number(r.qty2 ?? 4),
    qty3: Number(r.qty3 ?? 8),
    mode: r.mode ?? 'flat',
    discount2: Number(r.discount2 ?? 0),
    discount3: Number(r.discount3 ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// GET /api/tier-templates
router.get('/', async (req, res) => {
  try {
    const rows = await supabaseRequest(`/tier_templates${qs({ select: '*', order: 'created_at.desc' })}`);
    res.json(rows.map(toClient));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tier-templates
router.post('/', async (req, res) => {
  try {
    const { name, qty2, qty3, mode, discount2, discount3 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'nombre requerido' });
    const payload = {
      name: name.trim(),
      qty2: Number(qty2 ?? 4),
      qty3: Number(qty3 ?? 8),
      mode: mode ?? 'flat',
      discount2: Number(discount2 ?? 0),
      discount3: Number(discount3 ?? 0),
    };
    const rows = await supabaseRequest('/tier_templates', { method: 'POST', body: JSON.stringify(payload) });
    res.status(201).json(toClient(rows[0]));
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
    payload.updated_at = new Date().toISOString();
    const rows = await supabaseRequest(`/tier_templates${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(payload) });
    if (!rows?.[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(toClient(rows[0]));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/tier-templates/:id
router.delete('/:id', async (req, res) => {
  try {
    await supabaseRequest(`/tier_templates${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
