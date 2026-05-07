import { Router } from 'express';
import { nanoid } from 'nanoid';
import Quote from '../models/Quote.js';
import Route from '../models/Route.js';
import Package from '../models/Package.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { syncRouteStats } from './deliveryRoutes.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';
import { isSupabaseEnabled, normalizeQuote, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/quotes
router.get('/', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
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
    }
    const quotes = await Quote.find()
      .populate('tariffId', 'name defaultPrice')
      .populate('driverId', 'name')
      .populate('convertedRouteId', 'routeCode')
      .sort({ createdAt: -1 })
      .lean();
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quotes/:id
router.get('/:id', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const [quotes, items] = await Promise.all([
        supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}`, select: '*' })}`),
        supabaseRequest(`/quote_items${qs({ quote_id: `eq.${req.params.id}`, select: '*' })}`),
      ]);
      if (!quotes?.[0]) return res.status(404).json({ error: 'Cotizacion no encontrada' });
      return res.json(normalizeQuote(quotes[0], items || []));
    }
    const quote = await Quote.findById(req.params.id)
      .populate('tariffId', 'name defaultPrice items')
      .populate('driverId', 'name')
      .populate('convertedRouteId', 'routeCode')
      .lean();
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes
router.post('/', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const d = new Date();
      const ds = d.toISOString().slice(0, 10).replace(/-/g, '');
      const quoteCode = req.body.quoteCode || `MUVE-${ds}-${nanoid(4).toUpperCase()}`;
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
          tariff_id: req.body.tariffId || null,
        }),
      });
      return res.status(201).json(normalizeQuote(rows?.[0], []));
    }
    const quote = await Quote.create(req.body);
    res.status(201).json(quote);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/quotes/:id
router.patch('/:id', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
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
      if (req.body.needsPacking !== undefined) payload.needs_packing = Boolean(req.body.needsPacking);
      if (req.body.isConserjeria !== undefined) payload.is_conserjeria = Boolean(req.body.isConserjeria);
      if (req.body.itemsDescription !== undefined) payload.items_description = req.body.itemsDescription || '';
      if (req.body.priceMin !== undefined) payload.price_min = req.body.priceMin != null ? Number(req.body.priceMin) : null;
      if (req.body.priceMax !== undefined) payload.price_max = req.body.priceMax != null ? Number(req.body.priceMax) : null;
      payload.updated_at = new Date().toISOString();
      let rows;
      try {
        rows = await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } catch (schemaErr) {
        if (schemaErr.message.includes('column') || schemaErr.message.includes('schema cache')) {
          // Migration not run — save only base fields
          const safe = {};
          const BASE = ['client_company','contact_person','contact_email','contact_phone','delivery_date','admin_notes','client_notes','status','updated_at'];
          BASE.forEach(k => { if (payload[k] !== undefined) safe[k] = payload[k]; });
          rows = await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, {
            method: 'PATCH',
            body: JSON.stringify(safe),
          });
        } else {
          throw schemaErr;
        }
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
    }
    const quote = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('tariffId', 'name defaultPrice items')
      .populate('driverId', 'name')
      .populate('convertedRouteId', 'routeCode');
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(quote);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/quotes/:id
router.delete('/:id', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
      return res.json({ ok: true });
    }
    await Quote.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/send — generate share token, set status to 'sent'
router.post('/:id/send', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const token = nanoid(24);
      const rows = await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, {
        method: 'PATCH',
        body: JSON.stringify({ share_token: token, status: 'sent', updated_at: new Date().toISOString() }),
      });
      if (!rows?.[0]) return res.status(404).json({ error: 'Cotizacion no encontrada' });
      return res.json({ shareToken: rows[0].share_token, status: rows[0].status });
    }
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    if (!quote.shareToken) quote.shareToken = nanoid(24);
    if (quote.status === 'draft') quote.status = 'sent';
    await quote.save();
    res.json({ shareToken: quote.shareToken, status: quote.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/approve — approve and create Route
router.post('/:id/approve', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
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
          route_code: `RT-${ds}-${nanoid(4).toUpperCase()}`,
          name: quote.client_company || quote.quote_code,
          date: d.toISOString(),
          driver_id: driverId || null,
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
    }
    const quote = await Quote.findById(req.params.id).populate('tariffId').lean();
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    const { driverId } = req.body;

    const route = await Route.create({
      name: quote.clientCompany || quote.quoteCode,
      date: quote.deliveryDate || new Date(),
      driverId: driverId || undefined,
      tariffId: quote.tariffId?._id || undefined,
      status: 'active',
      clientCompany: {
        name: quote.clientCompany || '',
        contactPerson: quote.contactPerson || '',
        contactPhone: quote.contactPhone || ''
      }
    });

    if (quote.items?.length) {
      // Geocode items that are missing coordinates
      const pkgsToInsert = [];
      for (let i = 0; i < quote.items.length; i++) {
        const item = quote.items[i];
        let lat = item.lat, lng = item.lng;
        if ((!lat || !lng) && item.address) {
          const geo = await geocodeAddress(item.address, item.commune);
          if (geo) { lat = geo.lat; lng = geo.lng; }
          if (quote.items.length > 1) await sleep(1100);
        }
        pkgsToInsert.push({
          routeId: route._id,
          customerName: item.customerName || '',
          customerLastName: item.customerLastName || '',
          customerPhone: item.customerPhone || '',
          address: item.address,
          commune: item.commune || '',
          price: item.price || 0,
          lat: lat || undefined,
          lng: lng || undefined,
          note: item.note || '',
          status: 'pendiente',
          order: i,
        });
      }
      await Package.insertMany(pkgsToInsert);
      await syncRouteStats(route._id);
    }

    await Quote.findByIdAndUpdate(quote._id, {
      status: 'approved',
      driverId: driverId || undefined,
      convertedRouteId: route._id
    });

    res.json({ route, quoteId: quote._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest(`/quotes${qs({ id: `eq.${req.params.id}` })}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected', updated_at: new Date().toISOString() }),
      });
      if (!rows?.[0]) return res.status(404).json({ error: 'Cotizacion no encontrada' });
      return res.json(normalizeQuote(rows[0], []));
    }
    const quote = await Quote.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
