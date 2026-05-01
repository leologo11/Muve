import { Router } from 'express';
import Package from '../models/Package.js';
import Route from '../models/Route.js';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload, uploadToCloudinary, deletePhoto } from '../utils/cloudinary.js';
import { syncRouteStats } from './deliveryRoutes.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';

const router = Router();

// PUBLIC: customer lookup by tracking ID (no auth required)
router.get('/track/:trackingId', async (req, res) => {
  try {
    const pkg = await Package.findOne({ trackingId: req.params.trackingId.toUpperCase() })
      .populate('routeId', 'date routeCode')
      .populate('deliveredBy', 'name')
      .lean();

    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });

    // Return only safe fields for customer
    res.json({
      trackingId: pkg.trackingId,
      status: pkg.status,
      customerName: pkg.customerName,
      address: pkg.address,
      commune: pkg.commune,
      note: pkg.note,
      failReason: pkg.failReason,
      photoUrl: pkg.photoUrl,
      deliveredAt: pkg.deliveredAt,
      deliveredBy: pkg.deliveredBy?.name,
      routeDate: pkg.routeId?.date,
      routeCode: pkg.routeId?.routeCode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All routes below require auth
router.use(requireAuth);

// GET /api/packages/all — admin: all packages across all routes
router.get('/all', requireRole('admin'), async (req, res) => {
  try {
    const { search, status, routeId, driverId, companyName, page = 1, limit = 60 } = req.query;

    const filter = {};
    if (status && status !== 'todos') filter.status = status;
    if (routeId) filter.routeId = routeId;

    let pkgs = await Package.find(filter)
      .populate({
        path: 'routeId',
        select: 'routeCode name date driverId status clientCompany',
        populate: { path: 'driverId', select: 'name phone' }
      })
      .sort({ createdAt: -1 })
      .lean();

    if (driverId) {
      pkgs = pkgs.filter(p => String(p.routeId?.driverId?._id) === driverId);
    }
    if (companyName) {
      const q = companyName.toLowerCase();
      pkgs = pkgs.filter(p => (p.routeId?.clientCompany?.name || '').toLowerCase().includes(q));
    }

    if (search) {
      const q = search.toLowerCase();
      pkgs = pkgs.filter(p =>
        [p.customerName, p.customerLastName, p.address, p.commune, p.trackingId, p.customerPhone]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }

    const total = pkgs.length;
    const skip = (Number(page) - 1) * Number(limit);
    res.json({ packages: pkgs.slice(skip, skip + Number(limit)), total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packages?routeId=xxx — list packages for a route
router.get('/', async (req, res) => {
  try {
    const { routeId } = req.query;
    if (!routeId) return res.status(400).json({ error: 'routeId requerido' });

    const pkgs = await Package.find({ routeId })
      .sort({ order: 1 })
      .lean();
    res.json(pkgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const normStr = s => (s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');

// POST /api/packages — admin adds package to route
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const count = await Package.countDocuments({ routeId: req.body.routeId });
    const data = { ...req.body, order: count };

    // Auto-price from route's tariff when no price sent
    if ((data.price == null || data.price === '') && data.routeId) {
      const route = await Route.findById(data.routeId).populate('tariffId').lean();
      if (route?.tariffId) {
        const tariff = route.tariffId;
        const item = tariff.items?.find(i => normStr(i.commune) === normStr(data.commune));
        data.price = item ? item.price : tariff.defaultPrice;
      }
    }

    // Auto-geocode if no coordinates provided
    if ((!data.lat || !data.lng) && data.address) {
      const geo = await geocodeAddress(data.address, data.commune);
      if (geo) { data.lat = geo.lat; data.lng = geo.lng; }
    }

    const pkg = await Package.create(data);
    await syncRouteStats(pkg.routeId);
    res.status(201).json(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/packages/bulk — admin imports multiple packages at once
router.post('/bulk', requireRole('admin'), async (req, res) => {
  try {
    const { routeId, packages } = req.body;
    if (!routeId || !packages?.length) {
      return res.status(400).json({ error: 'routeId y packages requeridos' });
    }

    const existing = await Package.countDocuments({ routeId });
    const docs = packages.map((p, i) => ({ ...p, routeId, order: existing + i }));
    const created = await Package.insertMany(docs);
    await syncRouteStats(routeId);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/packages/:id — driver or admin updates status/note
router.patch('/:id', async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });

    // Drivers can only update status/note on their own route
    if (req.user.role === 'driver') {
      const route = await Route.findById(pkg.routeId).lean();
      if (String(route?.driverId) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Sin acceso a este paquete' });
      }
      if (route.status === 'completed') {
        return res.status(403).json({ error: 'La ruta ya fue finalizada por el administrador' });
      }
      const { status, note, failReason } = req.body;
      if (status) {
        if (pkg.status === 'entregado' && status !== 'entregado') {
          return res.status(403).json({ error: 'No puedes cambiar el estado de un paquete ya entregado' });
        }
        pkg.status = status;
        if (status === 'entregado') {
          pkg.deliveredAt = new Date();
          pkg.deliveredBy = req.user._id;
        }
        if (status !== 'no-entregado') pkg.failReason = '';
      }
      if (note !== undefined) pkg.note = note;
      if (failReason !== undefined) pkg.failReason = failReason;
    } else if (req.user.role === 'admin') {
      const oldRouteId = String(pkg.routeId);
      const { photoUrl, photoPublicId, photoUploadedAt, ...rest } = req.body;
      Object.assign(pkg, rest);
      if (rest.status === 'entregado' && !pkg.deliveredAt) {
        pkg.deliveredAt = new Date();
        pkg.deliveredBy = req.user._id;
      }
      await pkg.save();
      await syncRouteStats(pkg.routeId);
      if (String(pkg.routeId) !== oldRouteId) await syncRouteStats(oldRouteId);
      return res.json(pkg);
    } else {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    await pkg.save();
    await syncRouteStats(pkg.routeId);
    res.json(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/packages/:id/photo?n=1|2 — upload delivery photo (max 2 per package)
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });

    if (req.user.role === 'driver') {
      const route = await Route.findById(pkg.routeId).lean();
      if (String(route?.driverId) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Sin acceso a este paquete' });
      }
    } else if (!['admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    const n = req.query.n === '2' ? 2 : 1;

    if (n === 2) {
      if (pkg.photo2PublicId) await deletePhoto(pkg.photo2PublicId);
      const result = await uploadToCloudinary(req.file.buffer);
      pkg.photo2Url = result.secure_url;
      pkg.photo2PublicId = result.public_id;
      pkg.photo2UploadedAt = new Date();
    } else {
      if (pkg.photoPublicId) await deletePhoto(pkg.photoPublicId);
      const result = await uploadToCloudinary(req.file.buffer);
      pkg.photoUrl = result.secure_url;
      pkg.photoPublicId = result.public_id;
      pkg.photoUploadedAt = new Date();
    }

    await pkg.save();
    res.json({
      photoUrl: pkg.photoUrl, photo2Url: pkg.photo2Url,
      photoUploadedAt: pkg.photoUploadedAt, photo2UploadedAt: pkg.photo2UploadedAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/packages/:id — admin soft-deletes (marks as eliminado)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(
      req.params.id,
      { status: 'eliminado' },
      { new: true }
    );
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
    await syncRouteStats(pkg.routeId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/packages/:id/restore — admin restores a deleted package
router.patch('/:id/restore', requireRole('admin'), async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(
      req.params.id,
      { status: 'pendiente' },
      { new: true }
    );
    await syncRouteStats(pkg.routeId);
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/packages/reorder — admin reorders packages
router.patch('/reorder/batch', requireRole('admin'), async (req, res) => {
  try {
    const { order } = req.body; // [{ id, order }, ...]
    await Promise.all(order.map(({ id, order: o }) =>
      Package.findByIdAndUpdate(id, { order: o })
    ));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
