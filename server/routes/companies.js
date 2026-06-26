import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth);

function normalizeCompany(c) {
  return {
    _id: c.id, id: c.id, name: c.name, rut: c.rut, address: c.address,
    contactPerson: c.contact_person, contactEmail: c.contact_email, contactPhone: c.contact_phone,
    notes: c.notes, active: c.active, createdAt: c.created_at, updatedAt: c.updated_at,
    webhookUrl: c.webhook_url || null, webhookName: c.webhook_name || null,
  };
}

// GET /api/companies
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const rows = await supabaseRequest(`/companies${qs({ active: 'eq.true', select: '*', order: 'created_at.desc' })}`);
    return res.json(rows.map(normalizeCompany));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const rows = await supabaseRequest('/companies', {
      method: 'POST',
      body: JSON.stringify({
        name: req.body.name,
        rut: req.body.rut || null,
        address: req.body.address || null,
        contact_person: req.body.contactPerson || null,
        contact_email: req.body.contactEmail || null,
        contact_phone: req.body.contactPhone || null,
        notes: req.body.notes || null,
        active: req.body.active ?? true,
        webhook_url: req.body.webhookUrl || null,
        webhook_name: req.body.webhookName || null,
      }),
    });
    const c = rows?.[0];
    return res.status(201).json(normalizeCompany(c));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/companies/:id
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const payload = {};
    if (req.body.name !== undefined) payload.name = req.body.name;
    if (req.body.rut !== undefined) payload.rut = req.body.rut || null;
    if (req.body.address !== undefined) payload.address = req.body.address || null;
    if (req.body.contactPerson !== undefined) payload.contact_person = req.body.contactPerson || null;
    if (req.body.contactEmail !== undefined) payload.contact_email = req.body.contactEmail || null;
    if (req.body.contactPhone !== undefined) payload.contact_phone = req.body.contactPhone || null;
    if (req.body.notes !== undefined) payload.notes = req.body.notes || null;
    if (req.body.active !== undefined) payload.active = req.body.active;
    if (req.body.webhookUrl !== undefined) payload.webhook_url = req.body.webhookUrl || null;
    if (req.body.webhookName !== undefined) payload.webhook_name = req.body.webhookName || null;
    payload.updated_at = new Date().toISOString();
    const rows = await supabaseRequest(`/companies${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(payload) });
    const c = rows?.[0];
    return res.json(c ? normalizeCompany(c) : null);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await supabaseRequest(`/companies${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify({ active: false }) });
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
