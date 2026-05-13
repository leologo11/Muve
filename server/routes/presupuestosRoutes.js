import express from 'express';
import { supabaseRequest, qs } from '../utils/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

function toRow(b) {
  const r = { updated_at: new Date().toISOString() };
  if (b.code             !== undefined) r.code                = b.code;
  if (b.date             !== undefined) r.date                = b.date;
  if (b.validDays        !== undefined) r.valid_days          = Number(b.validDays) || 7;
  if (b.clientName       !== undefined) r.client_name         = b.clientName || null;
  if (b.clientPhone      !== undefined) r.client_phone        = b.clientPhone || null;
  if (b.clientEmail      !== undefined) r.client_email        = b.clientEmail || null;
  if (b.originAddress    !== undefined) r.origin_address      = b.originAddress || null;
  if (b.destinationAddress !== undefined) r.destination_address = b.destinationAddress || null;
  if (b.distanceKm       !== undefined) r.distance_km         = b.distanceKm ? Number(b.distanceKm) : null;
  if (b.showKm           !== undefined) r.show_km             = Boolean(b.showKm);
  if (b.items            !== undefined) r.items               = b.items || [];
  if (b.subtotal         !== undefined) r.subtotal            = Number(b.subtotal) || 0;
  if (b.discount         !== undefined) r.discount            = Number(b.discount) || 0;
  if (b.includeIVA       !== undefined) r.include_iva         = Boolean(b.includeIVA);
  if (b.ivaAmount        !== undefined) r.iva_amount          = Number(b.ivaAmount) || 0;
  if (b.total            !== undefined) r.total               = Number(b.total) || 0;
  if (b.notes            !== undefined) r.notes               = b.notes || null;
  if (b.status           !== undefined) r.status              = b.status;
  return r;
}

function fromRow(r) {
  return {
    id: r.id, code: r.code, date: r.date, validDays: r.valid_days,
    clientName: r.client_name, clientPhone: r.client_phone, clientEmail: r.client_email,
    originAddress: r.origin_address, destinationAddress: r.destination_address,
    distanceKm: r.distance_km, showKm: r.show_km,
    items: Array.isArray(r.items) ? r.items : [],
    subtotal: Number(r.subtotal || 0), discount: Number(r.discount || 0),
    includeIVA: r.include_iva, ivaAmount: Number(r.iva_amount || 0),
    total: Number(r.total || 0), notes: r.notes, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

router.get('/', async (req, res) => {
  try {
    const rows = await supabaseRequest(
      `/presupuestos${qs({ select: '*', order: 'created_at.desc', limit: 200 })}`,
    ) || [];
    res.json(rows.map(fromRow));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const row = { ...toRow(req.body), status: 'draft', created_at: new Date().toISOString() };
    if (!row.code) {
      row.code = `P-${new Date().getFullYear()}-${Math.floor(Math.random() * 8000 + 1000)}`;
    }
    if (!row.date) row.date = new Date().toISOString().split('T')[0];
    const [saved] = await supabaseRequest('/presupuestos', {
      method: 'POST',
      body: JSON.stringify(row),
      headers: { Prefer: 'return=representation' },
    });
    res.status(201).json(fromRow(saved));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const [saved] = await supabaseRequest(
      `/presupuestos${qs({ id: `eq.${req.params.id}` })}`,
      { method: 'PATCH', body: JSON.stringify(toRow(req.body)), headers: { Prefer: 'return=representation' } },
    );
    res.json(fromRow(saved));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await supabaseRequest(`/presupuestos${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
