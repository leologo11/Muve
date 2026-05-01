import { Router } from 'express';
import Route from '../models/Route.js';
import Package from '../models/Package.js';
import Quote from '../models/Quote.js';
import Zone from '../models/Zone.js';

const router = Router();

// GET /api/public/route/:shareToken — company tracking (no auth required)
router.get('/route/:shareToken', async (req, res) => {
  try {
    const route = await Route.findOne({ shareToken: req.params.shareToken })
      .populate('driverId', 'name phone')
      .lean();
    if (!route) return res.status(404).json({ error: 'Enlace no válido o expirado' });

    const packages = await Package.find({ routeId: route._id })
      .sort({ order: 1 })
      .lean();

    const publicPackages = packages
      .filter(p => p.status !== 'eliminado')
      .map(p => ({
        _id: p._id,
        trackingId: p.trackingId,
        customerName: p.customerName,
        customerLastName: p.customerLastName ? p.customerLastName[0] + '.' : '',
        address: p.address,
        commune: p.commune,
        aptFloor: p.aptFloor,
        status: p.status,
        note: p.note,
        failReason: p.failReason,
        photoUrl: p.photoUrl,
        photo2Url: p.photo2Url,
        photoUploadedAt: p.photoUploadedAt,
        photo2UploadedAt: p.photo2UploadedAt,
        deliveredAt: p.deliveredAt,
        order: p.order,
        lat: p.lat,
        lng: p.lng
      }));

    const STATUS_LABELS = { draft: 'Borrador', active: 'En curso', paused: 'Pausada', completed: 'Completada', cancelled: 'Cancelada' };

    res.json({
      route: {
        _id: route._id,
        routeCode: route.routeCode,
        name: route.name,
        date: route.date,
        status: route.status,
        statusLabel: STATUS_LABELS[route.status] || route.status,
        driverName: route.driverId?.name || null,
        driverPhone: route.driverId?.phone || null,
        clientCompany: {
          name: route.clientCompany?.name || null,
          contactPerson: route.clientCompany?.contactPerson || null,
          contactPhone: route.clientCompany?.contactPhone || null
        },
        startPoint: route.startPoint,
        distanceKm: route.distanceKm,
        stats: route.stats,
        invoiceAmount: route.invoice?.amount || null
      },
      packages: publicPackages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/quote/:token — client opens quote view
router.get('/quote/:token', async (req, res) => {
  try {
    const quote = await Quote.findOne({ shareToken: req.params.token })
      .populate('tariffId', 'name defaultPrice items')
      .lean();
    if (!quote) return res.status(404).json({ error: 'Enlace de cotización no válido o expirado' });

    const zones = await Zone.find().select('name price color source polygon').lean();

    res.json({
      quote: {
        _id: quote._id,
        quoteCode: quote.quoteCode,
        status: quote.status,
        clientCompany: quote.clientCompany,
        contactPerson: quote.contactPerson,
        contactEmail: quote.contactEmail,
        deliveryDate: quote.deliveryDate,
        adminNotes: quote.adminNotes,
        items: quote.items,
      },
      tariff: quote.tariffId || null,
      zones,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/public/quote/:token — client updates items (saves draft)
router.patch('/quote/:token', async (req, res) => {
  try {
    const quote = await Quote.findOne({ shareToken: req.params.token });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    if (['approved', 'rejected', 'submitted'].includes(quote.status)) {
      return res.status(403).json({ error: 'Esta cotización ya no puede modificarse' });
    }
    const { items, clientNotes } = req.body;
    if (items !== undefined) quote.items = items;
    if (clientNotes !== undefined) quote.clientNotes = clientNotes;
    await quote.save();
    res.json({ ok: true, items: quote.items });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/public/quote/:token/submit — client submits for admin review
router.post('/quote/:token/submit', async (req, res) => {
  try {
    const quote = await Quote.findOne({ shareToken: req.params.token });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    if (['approved', 'rejected', 'submitted'].includes(quote.status)) {
      return res.status(403).json({ error: 'Esta cotización ya fue enviada' });
    }
    const { items, clientNotes } = req.body;
    if (items !== undefined) quote.items = items;
    if (clientNotes !== undefined) quote.clientNotes = clientNotes;
    quote.status = 'submitted';
    await quote.save();
    res.json({ ok: true, status: quote.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
