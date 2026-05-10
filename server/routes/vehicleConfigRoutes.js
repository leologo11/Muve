import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isSupabaseEnabled, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

function normalizeConfig(r) {
  return {
    _id: r.id, id: r.id,
    vehicleType: r.vehicle_type,
    serviceType: r.service_type || 'flete',
    name: r.name,
    description: r.description,
    basePrice: Number(r.base_price || 0),
    kmTiers: r.km_tiers || [],
    extras: r.extras || { helper: 8000, floor: 5000, packing: 15000 },
    active: r.active,
    onlyRegions: r.only_regions,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

router.get('/', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      let rows;
      try {
        rows = await supabaseRequest(`/vehicle_configs${qs({ select: '*', order: 'service_type.asc,sort_order.asc' })}`);
      } catch (err) {
        if (!err.message.includes('service_type') && !err.message.includes('schema cache')) throw err;
        rows = await supabaseRequest(`/vehicle_configs${qs({ select: '*', order: 'sort_order.asc' })}`);
      }
      return res.json(rows.map(normalizeConfig));
    }
    res.json([]);
  } catch (err) {
    // Tabla no existe todavía (migración pendiente) — devolver vacío en vez de 500
    if (err.message.includes('vehicle_configs') || err.message.includes('schema cache')) {
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const payload = {};
      if (req.body.name !== undefined) payload.name = req.body.name;
      if (req.body.description !== undefined) payload.description = req.body.description || '';
      if (req.body.serviceType !== undefined) payload.service_type = req.body.serviceType || 'flete';
      if (req.body.basePrice !== undefined) payload.base_price = Number(req.body.basePrice);
      if (req.body.kmTiers !== undefined) payload.km_tiers = req.body.kmTiers;
      if (req.body.extras !== undefined) payload.extras = req.body.extras;
      if (req.body.active !== undefined) payload.active = req.body.active;
      if (req.body.onlyRegions !== undefined) payload.only_regions = req.body.onlyRegions;
      if (req.body.sortOrder !== undefined) payload.sort_order = req.body.sortOrder;
      payload.updated_at = new Date().toISOString();
      const rows = await supabaseRequest(`/vehicle_configs${qs({ id: `eq.${req.params.id}` })}`, {
        method: 'PATCH', body: JSON.stringify(payload),
      });
      if (!rows?.[0]) return res.status(404).json({ error: 'Config no encontrada' });
      return res.json(normalizeConfig(rows[0]));
    }
    res.status(503).json({ error: 'Solo disponible con Supabase' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

export default router;
