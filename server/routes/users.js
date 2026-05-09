import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { normalizeUser, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth);

// GET /api/users — admin only
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const rows = await supabaseRequest(`/app_users${qs({ select: '*', order: 'created_at.desc' })}`);
    return res.json(rows.map(normalizeUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — admin creates users
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash(req.body.password || 'Temp1234!', 10);
    const vehicles = Array.isArray(req.body.vehicles) ? req.body.vehicles : [];
    const rows = await supabaseRequest('/app_users', {
      method: 'POST',
      body: JSON.stringify({
        name: req.body.name,
        email: String(req.body.email || '').toLowerCase().trim(),
        password_hash: passwordHash,
        role: req.body.role,
        company_id: req.body.companyId || null,
        active: req.body.active ?? true,
        phone: req.body.phone || null,
        vehicle: vehicles[0]?.type || req.body.vehicle || null,
        license_plate: vehicles[0]?.plate || req.body.licensePlate || null,
        vehicles: vehicles.length > 0 ? JSON.stringify(vehicles) : null,
        company_name: req.body.companyName || null,
        rut: req.body.rut || null,
      }),
    });
    return res.status(201).json(normalizeUser(rows?.[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/users/:id — admin updates user
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const payload = {};
    if (req.body.name !== undefined) payload.name = req.body.name;
    if (req.body.email !== undefined) payload.email = String(req.body.email).toLowerCase().trim();
    if (req.body.role !== undefined) payload.role = req.body.role;
    if (req.body.companyId !== undefined) payload.company_id = req.body.companyId || null;
    if (req.body.active !== undefined) payload.active = req.body.active;
    if (req.body.phone !== undefined) payload.phone = req.body.phone || null;
    if (Array.isArray(req.body.vehicles)) {
      const vehicles = req.body.vehicles;
      payload.vehicles = vehicles.length > 0 ? JSON.stringify(vehicles) : null;
      payload.vehicle = vehicles[0]?.type || null;
      payload.license_plate = vehicles[0]?.plate || null;
    } else {
      if (req.body.vehicle !== undefined) payload.vehicle = req.body.vehicle || null;
      if (req.body.licensePlate !== undefined) payload.license_plate = req.body.licensePlate || null;
    }
    if (req.body.companyName !== undefined) payload.company_name = req.body.companyName || null;
    if (req.body.rut !== undefined) payload.rut = req.body.rut || null;
    if (req.body.password) payload.password_hash = await bcrypt.hash(req.body.password, 10);
    payload.updated_at = new Date().toISOString();
    
    const rows = await supabaseRequest(`/app_users${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!rows?.[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(normalizeUser(rows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/users/me/location — driver sends their GPS position
router.patch('/me/location', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Solo drivers' });
    const { lat, lng, heading, speed, accuracy } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: 'lat/lng requeridos' });
    
    await supabaseRequest(`/app_users${qs({ id: `eq.${req.user._id || req.user.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({ location: { lat, lng, heading, speed, accuracy, updatedAt: new Date().toISOString() } }),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id — admin deactivates user
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await supabaseRequest(`/app_users${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
