import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const user = await User.findOne({ email });
    if (!user || !user.active) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register (admin only — seeded separately)
// We keep this here for the initial admin seed check
router.post('/seed-admin', async (req, res) => {
  try {
    const exists = await User.findOne({ role: 'admin' });
    if (exists) return res.status(409).json({ error: 'Admin ya existe' });

    const admin = await User.create({
      name: 'Admin',
      email: req.body.email || 'admin@routiflow.com',
      password: req.body.password || 'Admin1234!',
      role: 'admin'
    });

    const token = signToken(admin);
    res.status(201).json({ token, user: admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
import { requireAuth } from '../middleware/auth.js';
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
