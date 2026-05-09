import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { normalizeCredential, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

// GET /api/credentials - lista credenciales sin exponer secretos completos
router.get('/', async (_req, res) => {
  try {
    const rows = await supabaseRequest(`/api_credentials${qs({ select: 'id,name,key_id,prefix,revoked,created_by,last_used_at,revoked_at,created_at,updated_at', order: 'created_at.desc' })}`);
    return res.json(rows.map(normalizeCredential));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/credentials - crea una API key para integraciones MUVE
router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim() || 'Integracion MUVE';
    const keyId = `muve_${crypto.randomBytes(8).toString('hex')}`;
    const secret = `sk_muve_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
    const rows = await supabaseRequest('/api_credentials', {
      method: 'POST',
      body: JSON.stringify({
        name,
        key_id: keyId,
        secret_hash: secretHash,
        prefix: secret.slice(0, 16),
        created_by: req.user._id || req.user.id,
      }),
    });
    return res.status(201).json({ ...normalizeCredential(rows?.[0]), secret });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/credentials/:id - revoca una credencial
router.delete('/:id', async (req, res) => {
  try {
    const rows = await supabaseRequest(`/api_credentials${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({ revoked: true, revoked_at: new Date().toISOString() }),
    });
    const credential = rows?.[0];
    if (!credential) return res.status(404).json({ error: 'Credencial no encontrada' });
    return res.json(normalizeCredential(credential));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
