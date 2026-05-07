import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isSupabaseEnabled, normalizeUser, qs, supabaseRequest } from '../utils/supabase.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest(`/app_users${qs({ id: `eq.${payload.id}`, select: '*' })}`);
      const user = normalizeUser(rows?.[0]);
      if (!user || !user.active) return res.status(401).json({ error: 'Sesion invalida' });
      req.user = user;
      return next();
    }
    const user = await User.findById(payload.id).lean();
    if (!user || !user.active) return res.status(401).json({ error: 'Sesión inválida' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sin permisos para esta acción' });
    }
    next();
  };
}
