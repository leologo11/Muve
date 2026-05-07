import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { isSupabaseEnabled, normalizeUser, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id || user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });

    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest(`/app_users${qs({ email: `eq.${String(email).toLowerCase().trim()}`, select: '*' })}`);
      const row = rows?.[0];
      if (!row || !row.active) return res.status(401).json({ error: 'Credenciales incorrectas' });
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
      const user = normalizeUser(row);
      return res.json({ token: signToken(user), user });
    }

    const user = await User.findOne({ email });
    if (!user || !user.active) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    res.json({ token: signToken(user), user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/seed-admin', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const exists = await supabaseRequest(`/app_users${qs({ role: 'eq.admin', select: 'id' })}`);
      if (exists?.length) return res.status(409).json({ error: 'Admin ya existe' });

      const passwordHash = await bcrypt.hash(req.body.password || 'Admin1234!', 10);
      const rows = await supabaseRequest('/app_users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Admin',
          email: String(req.body.email || 'admin@muve.cl').toLowerCase(),
          password_hash: passwordHash,
          role: 'admin',
          active: true,
        }),
      });
      const user = normalizeUser(rows?.[0]);
      return res.status(201).json({ token: signToken(user), user });
    }

    const exists = await User.findOne({ role: 'admin' });
    if (exists) return res.status(409).json({ error: 'Admin ya existe' });

    const admin = await User.create({
      name: 'Admin',
      email: req.body.email || 'admin@MUVE.com',
      password: req.body.password || 'Admin1234!',
      role: 'admin',
    });

    res.status(201).json({ token: signToken(admin), user: admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
