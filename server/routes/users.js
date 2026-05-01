import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/users — admin only
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — admin creates users
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/users/:id — admin updates user
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    Object.assign(user, rest);
    if (password) user.password = password;
    await user.save();
    res.json(user);
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
    await User.findByIdAndUpdate(req.user._id, {
      location: { lat, lng, heading: heading ?? null, speed: speed ?? null, accuracy: accuracy ?? null, updatedAt: new Date() }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id — admin deactivates user
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
