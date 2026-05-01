import { Router } from 'express';
import { nanoid } from 'nanoid';
import Quote from '../models/Quote.js';
import Route from '../models/Route.js';
import Package from '../models/Package.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { syncRouteStats } from './deliveryRoutes.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/quotes
router.get('/', async (req, res) => {
  try {
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
    const quote = await Quote.create(req.body);
    res.status(201).json(quote);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/quotes/:id
router.patch('/:id', async (req, res) => {
  try {
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
    await Quote.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotes/:id/send — generate share token, set status to 'sent'
router.post('/:id/send', async (req, res) => {
  try {
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
    const quote = await Quote.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
