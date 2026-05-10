import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isSupabaseEnabled, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

function normalizeItem(r) {
  return {
    _id: r.id,
    id: r.item_key,
    name: r.name,
    icon: r.icon || '📦',
    cat: r.category || 'Otros',
    vol: Number(r.volume_m3 || 0),
    minVehicleType: r.min_vehicle_type || 'furgon',
    requiredHelpers: Number(r.required_helpers || 0),
    active: r.active !== false,
    sortOrder: r.sort_order || 0,
  };
}

router.get('/', async (_req, res) => {
  try {
    if (!isSupabaseEnabled()) return res.json([]);
    const rows = await supabaseRequest(`/inventory_item_configs${qs({ select: '*', order: 'category.asc,sort_order.asc,name.asc' })}`);
    res.json(rows.map(normalizeItem));
  } catch (err) {
    if (err.message.includes('inventory_item_configs') || err.message.includes('schema cache')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (!isSupabaseEnabled()) return res.status(503).json({ error: 'Solo disponible con Supabase' });
    const payload = {};
    if (req.body.name !== undefined) payload.name = req.body.name || '';
    if (req.body.icon !== undefined) payload.icon = req.body.icon || '📦';
    if (req.body.cat !== undefined) payload.category = req.body.cat || 'Otros';
    if (req.body.vol !== undefined) payload.volume_m3 = Number(req.body.vol || 0);
    if (req.body.minVehicleType !== undefined) payload.min_vehicle_type = req.body.minVehicleType || 'furgon';
    if (req.body.requiredHelpers !== undefined) payload.required_helpers = Number(req.body.requiredHelpers || 0);
    if (req.body.active !== undefined) payload.active = Boolean(req.body.active);
    if (req.body.sortOrder !== undefined) payload.sort_order = Number(req.body.sortOrder || 0);
    payload.updated_at = new Date().toISOString();
    const rows = await supabaseRequest(`/inventory_item_configs${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!rows?.[0]) return res.status(404).json({ error: 'Articulo no encontrado' });
    res.json(normalizeItem(rows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
