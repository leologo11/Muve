import { Router } from 'express';
import crypto from 'crypto';
import { syncRouteStats } from './deliveryRoutes.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';
import { normalizeQuote, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/quotes
router.get('/', async (req, res) => {
  try {
    const [quotes, items] = await Promise.all([
      supabaseRequest(`/quotes${qs({ select: '*', order: 'created_at.desc' })}`),
      supabaseRequest(`/quote_items${qs({ select: '*' })}`),
    ]);
    const byQuote = new Map();
    items.forEach(item => {
      const list = byQuote.get(item.quote_id) || [];
      list.push(item);
      byQuote.set(item.quote_id, list);
    });
    return res.json(quotes.map(q => normalizeQuote(q, byQuote.get(q.id) || [])));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quotes/:id
router.get('/:id', async (req, res) => {
  try {
    const [quotes, items] = await Promise.all([
      supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}`, select: '*' })}`),
      supabaseRequest(`/quote_items${qs({ quote_id: `eq.${req.params.id}`, select: '*' })}`),
    ]);
    const quote = quotes?.[0];
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    return res.json(normalizeQuote(quote, items || []));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes
router.post('/', async (req, res) => {
  try {
    const d = new Date();
    const ds = d.toISOString().slice(0, 10).replace(/-/g, '');
    const quoteCode = req.body.quoteCode || `MUVE-${ds}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    
    const rows = await supabaseRequest('/quotes', {
      method: 'POST',
      body: JSON.stringify({
        quote_code: quoteCode,
        service_type: req.body.serviceType || 'flete',
        status: req.body.status || 'draft',
        client_company: req.body.clientCompany || '',
        contact_person: req.body.contactPerson || '',
        contact_email: req.body.contactEmail || '',
        contact_phone: req.body.contactPhone || '',
        delivery_date: req.body.deliveryDate || null,
        admin_notes: req.body.adminNotes || '',
        client_notes: req.body.clientNotes || '',
        tariff_id: req.body.tariff_id || null,
      }),
    });
    return res.status(201).json(normalizeQuote(rows?.[0], []));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/quotes/:id
router.patch('/:id', async (req, res) => {
  try {
    const payload = {};
    if (req.body.clientCompany !== undefined) payload.client_company = req.body.clientCompany;
    if (req.body.contactPerson !== undefined) payload.contact_person = req.body.contactPerson;
    if (req.body.contactEmail !== undefined) payload.contact_email = req.body.contactEmail;
    if (req.body.contactPhone !== undefined) payload.contact_phone = req.body.contactPhone;
    if (req.body.deliveryDate !== undefined) payload.delivery_date = req.body.deliveryDate || null;
    if (req.body.adminNotes !== undefined) payload.admin_notes = req.body.adminNotes;
    if (req.body.clientNotes !== undefined) payload.client_notes = req.body.clientNotes;
    if (req.body.status !== undefined) payload.status = req.body.status;
    // Flete/mudanza pricing fields
    if (req.body.driverHelps !== undefined) payload.driver_helps = Boolean(req.body.driverHelps);
    if (req.body.vehicleType !== undefined) payload.vehicle_type = req.body.vehicleType || null;
    if (req.body.distanceKm !== undefined) payload.distance_km = req.body.distanceKm != null ? Number(req.body.distanceKm) : null;
    if (req.body.numHelpers !== undefined) payload.num_helpers = Number(req.body.numHelpers || 0);
    if (req.body.numFloors !== undefined) payload.num_floors = Number(req.body.numFloors || 0);
    if (req.body.originFloors !== undefined) payload.origin_floors = Number(req.body.originFloors || 0);
    if (req.body.destinationFloors !== undefined) payload.destination_floors = Number(req.body.destinationFloors || 0);
    if (req.body.needsPacking !== undefined) payload.needs_packing = Boolean(req.body.needsPacking);
    if (req.body.isConserjeria !== undefined) payload.is_conserjeria = Boolean(req.body.isConserjeria);
    if (req.body.itemsDescription !== undefined) payload.items_description = req.body.itemsDescription || '';
    if (req.body.priceMin   !== undefined) payload.price_min   = req.body.priceMin   != null ? Number(req.body.priceMin)   : null;
    if (req.body.priceMax   !== undefined) payload.price_max   = req.body.priceMax   != null ? Number(req.body.priceMax)   : null;
    if (req.body.priceFinal !== undefined) payload.price_final = req.body.priceFinal != null ? Number(req.body.priceFinal) : null;
    payload.updated_at = new Date().toISOString();
    let rows;
    try {
      rows = await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } catch (schemaErr) {
      if (schemaErr.message.includes('column') || schemaErr.message.includes('schema cache')) {
        const safe = {};
        const BASE = ['client_company','contact_person','contact_email','contact_phone','delivery_date','admin_notes','client_notes','status','updated_at','driver_helps','vehicle_type','distance_km','num_helpers','num_floors','needs_packing','is_conserjeria','items_description','price_min','price_max','price_final'];
        BASE.forEach(k => { if (payload[k] !== undefined) safe[k] = payload[k]; });
        rows = await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, {
          method: 'PATCH',
          body: JSON.stringify(safe),
        });
      } else { throw schemaErr; }
    }
    if (!rows?.[0]) return res.status(404).json({ error: 'Cotizacion no encontrada' });
    if (Array.isArray(req.body.items)) {
      await supabaseRequest(`/quote_items${qs({ quote_id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
      if (req.body.items.length) {
        await supabaseRequest('/quote_items', {
          method: 'POST',
          body: JSON.stringify(req.body.items.map(item => ({
            quote_id: req.params.id,
            customer_name: item.customerName || '',
            customer_last_name: item.customerLastName || '',
            customer_phone: item.customerPhone || '',
            address: item.address,
            commune: item.commune || '',
            price: Number(item.price || 0),
            lat: item.lat || null,
            lng: item.lng || null,
            note: item.note || '',
          }))),
        });
      }
    }
    const items = await supabaseRequest(`/quote_items${qs({ quote_id: `eq.${req.params.id}`, select: '*' })}`);
    return res.json(normalizeQuote(rows[0], items || []));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/quotes/:id
router.delete('/:id', async (req, res) => {
  try {
    await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/send — generate share token, set status to 'sent'
router.post('/:id/send', async (req, res) => {
  try {
    const token = crypto.randomBytes(12).toString('hex');
    const rows = await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({ share_token: token, status: 'sent', updated_at: new Date().toISOString() }),
    });
    const quote = rows?.[0];
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    return res.json({ shareToken: quote.share_token, status: quote.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/approve — approve and create Route
router.post('/:id/approve', async (req, res) => {
  try {
    const [quotes, items] = await Promise.all([
      supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}`, select: '*' })}`),
      supabaseRequest(`/quote_items${qs({ quote_id: `eq.${req.params.id}`, select: '*', order: 'created_at.asc' })}`),
    ]);
    const quote = quotes?.[0];
    if (!quote) return res.status(404).json({ error: 'Cotizacion no encontrada' });

    const { driverId } = req.body;
    const d = quote.delivery_date ? new Date(quote.delivery_date) : new Date();
    const ds = d.toISOString().slice(0, 10).replace(/-/g, '');
    const routeRows = await supabaseRequest('/routes', {
      method: 'POST',
      body: JSON.stringify({
        route_code: `RT-${ds}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        name: quote.client_company || quote.quote_code,
        date: d.toISOString(),
        tariff_id: quote.tariff_id || null,
        status: 'active',
        client_company: {
          name: quote.client_company || '',
          contactPerson: quote.contact_person || '',
          contactPhone: quote.contact_phone || ''
        },
      }),
    });
    const route = routeRows[0];

    if (items?.length) {
      const pkgsToInsert = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let lat = item.lat;
        let lng = item.lng;
        if ((!lat || !lng) && item.address) {
          const geo = await geocodeAddress(item.address, item.commune);
          if (geo) { lat = geo.lat; lng = geo.lng; }
          if (items.length > 1) await sleep(1100);
        }
        pkgsToInsert.push({
          tracking_id: `MUVE${Date.now().toString(36).toUpperCase()}${String(i + 1).padStart(3, '0')}`,
          route_id: route.id,
          customer_name: item.customer_name || '',
          customer_last_name: item.customer_last_name || '',
          customer_phone: item.customer_phone || '',
          address: item.address || '',
          commune: item.commune || '',
          price: Number(item.price || 0),
          lat: lat || null,
          lng: lng || null,
          note: item.note || '',
          status: 'pendiente',
          stop_order: i,
        });
      }
      await supabaseRequest('/packages', {
        method: 'POST',
        body: JSON.stringify(pkgsToInsert),
      });
      await syncRouteStats(route.id);
    }

    await supabaseRequest(`/quotes${qs({ id: `eq.${quote.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'approved',
        driver_id: driverId || null,
        converted_route_id: route.id,
        updated_at: new Date().toISOString(),
      }),
    });

    return res.json({
      route: {
        _id: route.id,
        id: route.id,
        routeCode: route.route_code,
        name: route.name,
        date: route.date,
        status: route.status,
        clientCompany: route.client_company || {},
        stats: route.stats || {},
      },
      quoteId: quote.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const rows = await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', updated_at: new Date().toISOString() }),
    });
    const quote = rows?.[0];
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
