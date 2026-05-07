import { Router } from 'express';
import Company from '../models/Company.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isSupabaseEnabled, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth);

// GET /api/companies
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest(`/companies${qs({ active: 'eq.true', select: '*', order: 'created_at.desc' })}`);
      return res.json(rows.map(c => ({
        _id: c.id, id: c.id, name: c.name, rut: c.rut, address: c.address,
        contactPerson: c.contact_person, contactEmail: c.contact_email, contactPhone: c.contact_phone,
        notes: c.notes, active: c.active, createdAt: c.created_at, updatedAt: c.updated_at,
      })));
    }
    const companies = await Company.find({ active: true }).lean();
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
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
        }),
      });
      const c = rows?.[0];
      return res.status(201).json({ ...c, _id: c.id, contactPerson: c.contact_person, contactEmail: c.contact_email, contactPhone: c.contact_phone });
    }
    const company = await Company.create(req.body);
    res.status(201).json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/companies/:id
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const payload = {};
      if (req.body.name !== undefined) payload.name = req.body.name;
      if (req.body.rut !== undefined) payload.rut = req.body.rut || null;
      if (req.body.address !== undefined) payload.address = req.body.address || null;
      if (req.body.contactPerson !== undefined) payload.contact_person = req.body.contactPerson || null;
      if (req.body.contactEmail !== undefined) payload.contact_email = req.body.contactEmail || null;
      if (req.body.contactPhone !== undefined) payload.contact_phone = req.body.contactPhone || null;
      if (req.body.notes !== undefined) payload.notes = req.body.notes || null;
      if (req.body.active !== undefined) payload.active = req.body.active;
      payload.updated_at = new Date().toISOString();
      const rows = await supabaseRequest(`/companies${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(payload) });
      const c = rows?.[0];
      return res.json(c ? { ...c, _id: c.id, contactPerson: c.contact_person, contactEmail: c.contact_email, contactPhone: c.contact_phone } : null);
    }
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      await supabaseRequest(`/companies${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify({ active: false }) });
      return res.json({ ok: true });
    }
    await Company.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
