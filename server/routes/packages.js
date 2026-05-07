import { Router } from 'express';
import { nanoid } from 'nanoid';
import Package from '../models/Package.js';
import Route from '../models/Route.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload, uploadToCloudinary, deletePhoto } from '../utils/cloudinary.js';
import { syncRouteStats } from './deliveryRoutes.js';
import { geocodeAddress } from '../utils/geocode.js';
import { isSupabaseEnabled, qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();

function normStr(s) { return (s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function normalizePackage(p) {
  return {
    _id: p.id, id: p.id, trackingId: p.tracking_id, routeId: p.route_id,
    customerName: p.customer_name, customerLastName: p.customer_last_name, customerPhone: p.customer_phone,
    address: p.address, commune: p.commune, aptFloor: p.apt_floor, zone: p.zone, price: Number(p.price || 0),
    lat: p.lat, lng: p.lng, order: p.stop_order, status: p.status, failReason: p.fail_reason, note: p.note,
    photoUrl: p.photo_url, photo2Url: p.photo2_url,
    photoUploadedAt: p.photo_uploaded_at, photo2UploadedAt: p.photo2_uploaded_at,
    deliveredAt: p.delivered_at,
  };
}

// PUBLIC: customer lookup by tracking ID (no auth required)
router.get('/track/:trackingId', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest(`/packages${qs({ tracking_id: `eq.${req.params.trackingId.toUpperCase()}`, select: '*' })}`);
      const pkg = rows?.[0];
      if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
      return res.json({
        trackingId: pkg.tracking_id,
        status: pkg.status,
        customerName: pkg.customer_name,
        address: pkg.address,
        commune: pkg.commune,
        note: pkg.note,
        failReason: pkg.fail_reason,
        photoUrl: pkg.photo_url,
        deliveredAt: pkg.delivered_at,
      });
    }
    const pkg = await Package.findOne({ trackingId: req.params.trackingId.toUpperCase() })
      .populate('routeId', 'date routeCode')
      .populate('deliveredBy', 'name')
      .lean();
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
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
    if (isSupabaseEnabled()) {
      const { page = 1, limit = 60, status, routeId } = req.query;
      const params = { select: '*', order: 'created_at.desc', limit, offset: (Number(page) - 1) * Number(limit) };
      if (status && status !== 'todos') params.status = `eq.${status}`;
      if (routeId) params.route_id = `eq.${routeId}`;
      const rows = await supabaseRequest(`/packages${qs(params)}`);
      return res.json({ packages: rows.map(normalizePackage), total: rows.length, page: Number(page), limit: Number(limit) });
    }
    const { search, status, routeId, driverId, companyName, page = 1, limit = 60 } = req.query;
    const pageNum  = Number(page);
    const limitNum = Number(limit);
    const pkgFilter = {};
    if (status && status !== 'todos') pkgFilter.status = status;
    if (routeId) pkgFilter.routeId = routeId;
    if (driverId) {
      const routeIds = await Route.find({ driverId }).select('_id').lean();
      pkgFilter.routeId = { $in: routeIds.map(r => r._id) };
    }
    if (companyName) {
      const q = companyName.toLowerCase();
      const matchingRoutes = await Route.find({ 'clientCompany.name': { $regex: q, $options: 'i' } }).select('_id').lean();
      const ids = matchingRoutes.map(r => r._id);
      pkgFilter.routeId = pkgFilter.routeId
        ? { $in: pkgFilter.routeId.$in.filter(id => ids.some(i => String(i) === String(id))) }
        : { $in: ids };
    }
    const populate = { path: 'routeId', select: 'routeCode name date driverId status clientCompany', populate: { path: 'driverId', select: 'name phone' } };
    if (!search) {
      const [total, pkgs] = await Promise.all([
        Package.countDocuments(pkgFilter),
        Package.find(pkgFilter).populate(populate).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean()
      ]);
      return res.json({ packages: pkgs, total, page: pageNum, limit: limitNum });
    }
    let pkgs = await Package.find(pkgFilter).populate(populate).sort({ createdAt: -1 }).lean();
    const q = search.toLowerCase();
    pkgs = pkgs.filter(p =>
      [p.customerName, p.customerLastName, p.address, p.commune, p.trackingId, p.customerPhone]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    );
    res.json({ packages: pkgs.slice((pageNum - 1) * limitNum, pageNum * limitNum), total: pkgs.length, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packages?routeId=xxx
router.get('/', async (req, res) => {
  try {
    const { routeId } = req.query;
    if (!routeId) return res.status(400).json({ error: 'routeId requerido' });
    if (isSupabaseEnabled()) {
      const rows = await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}`, select: '*', order: 'stop_order.asc' })}`);
      return res.json(rows.map(normalizePackage));
    }
    const pkgs = await Package.find({ routeId }).sort({ order: 1 }).lean();
    res.json(pkgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/packages — admin adds package to route
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const existingPkgs = await supabaseRequest(`/packages${qs({ route_id: `eq.${req.body.routeId}`, select: 'stop_order', order: 'stop_order.desc', limit: 1 })}`);
      const stopOrder = existingPkgs.length > 0 ? (existingPkgs[0].stop_order ?? 0) + 1 : 0;

      let price = req.body.price != null && req.body.price !== '' ? Number(req.body.price) : null;
      if (price == null && req.body.routeId) {
        const routes = await supabaseRequest(`/routes${qs({ id: `eq.${req.body.routeId}`, select: 'tariff_id' })}`);
        const tariffId = routes?.[0]?.tariff_id;
        if (tariffId) {
          const [tariffs, items] = await Promise.all([
            supabaseRequest(`/tariffs${qs({ id: `eq.${tariffId}`, select: 'default_price' })}`),
            supabaseRequest(`/tariff_items${qs({ tariff_id: `eq.${tariffId}`, select: 'commune,price' })}`),
          ]);
          const item = items.find(i => normStr(i.commune) === normStr(req.body.commune));
          price = item ? Number(item.price) : Number(tariffs?.[0]?.default_price || 0);
        }
      }

      let lat = req.body.lat || null;
      let lng = req.body.lng || null;
      if ((!lat || !lng) && req.body.address) {
        const geo = await geocodeAddress(req.body.address, req.body.commune);
        if (geo) { lat = geo.lat; lng = geo.lng; }
      }

      const rows = await supabaseRequest('/packages', {
        method: 'POST',
        body: JSON.stringify({
          tracking_id: `PKG-${nanoid(8).toUpperCase()}`,
          route_id: req.body.routeId,
          customer_name: req.body.customerName || '',
          customer_last_name: req.body.customerLastName || null,
          customer_phone: req.body.customerPhone || null,
          address: req.body.address,
          commune: req.body.commune || null,
          apt_floor: req.body.aptFloor || null,
          zone: req.body.zone || null,
          price: price ?? 0,
          lat, lng,
          stop_order: stopOrder,
          status: 'pendiente',
          note: req.body.note || null,
        }),
      });
      await syncRouteStats(req.body.routeId);
      return res.status(201).json(normalizePackage(rows[0]));
    }
    const count = await Package.countDocuments({ routeId: req.body.routeId });
    const data = { ...req.body, order: count };
    if ((data.price == null || data.price === '') && data.routeId) {
      const route = await Route.findById(data.routeId).populate('tariffId').lean();
      if (route?.tariffId) {
        const tariff = route.tariffId;
        const item = tariff.items?.find(i => normStr(i.commune) === normStr(data.commune));
        data.price = item ? item.price : tariff.defaultPrice;
      }
    }
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

// POST /api/packages/bulk
router.post('/bulk', requireRole('admin'), async (req, res) => {
  try {
    const { routeId, packages } = req.body;
    if (!routeId || !packages?.length) return res.status(400).json({ error: 'routeId y packages requeridos' });
    if (isSupabaseEnabled()) {
      const existingPkgs = await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}`, select: 'stop_order', order: 'stop_order.desc', limit: 1 })}`);
      const baseOrder = existingPkgs.length > 0 ? (existingPkgs[0].stop_order ?? -1) + 1 : 0;
      const docs = packages.map((p, i) => ({
        tracking_id: `PKG-${nanoid(8).toUpperCase()}`,
        route_id: routeId,
        customer_name: p.customerName || p.customer_name || '',
        customer_last_name: p.customerLastName || p.customer_last_name || null,
        customer_phone: p.customerPhone || p.customer_phone || null,
        address: p.address,
        commune: p.commune || null,
        apt_floor: p.aptFloor || p.apt_floor || null,
        zone: p.zone || null,
        price: Number(p.price || 0),
        lat: p.lat || null,
        lng: p.lng || null,
        stop_order: baseOrder + i,
        status: 'pendiente',
        note: p.note || null,
      }));
      const created = await supabaseRequest('/packages', { method: 'POST', body: JSON.stringify(docs) });
      await syncRouteStats(routeId);
      return res.status(201).json(created.map(normalizePackage));
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

// PATCH /api/packages/:id
router.patch('/:id', async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const pkgs = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}`, select: '*' })}`);
      const pkg = pkgs?.[0];
      if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });

      if (req.user.role === 'driver') {
        const routes = await supabaseRequest(`/routes${qs({ id: `eq.${pkg.route_id}`, select: 'driver_id,status' })}`);
        const route = routes?.[0];
        const userId = req.user._id || req.user.id;
        if (String(route?.driver_id) !== String(userId)) return res.status(403).json({ error: 'Sin acceso a este paquete' });
        if (route.status === 'completed') return res.status(403).json({ error: 'La ruta ya fue finalizada por el administrador' });
        const { status, note, failReason } = req.body;
        const update = {};
        if (status) {
          if (pkg.status === 'entregado' && status !== 'entregado') return res.status(403).json({ error: 'No puedes cambiar el estado de un paquete ya entregado' });
          update.status = status;
          if (status === 'entregado') { update.delivered_at = new Date().toISOString(); update.delivered_by = userId; }
          if (status !== 'no-entregado') update.fail_reason = '';
        }
        if (note !== undefined) update.note = note;
        if (failReason !== undefined) update.fail_reason = failReason;
        update.updated_at = new Date().toISOString();
        const rows = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(update) });
        await syncRouteStats(pkg.route_id);
        return res.json(normalizePackage(rows[0]));
      }

      if (req.user.role === 'admin') {
        const { photoUrl, photoPublicId, photoUploadedAt, photo2Url, photo2PublicId, photo2UploadedAt, ...rest } = req.body;
        const update = {};
        if (rest.customerName !== undefined) update.customer_name = rest.customerName;
        if (rest.customerLastName !== undefined) update.customer_last_name = rest.customerLastName;
        if (rest.customerPhone !== undefined) update.customer_phone = rest.customerPhone;
        if (rest.address !== undefined) update.address = rest.address;
        if (rest.commune !== undefined) update.commune = rest.commune;
        if (rest.aptFloor !== undefined) update.apt_floor = rest.aptFloor;
        if (rest.zone !== undefined) update.zone = rest.zone;
        if (rest.price !== undefined) update.price = Number(rest.price);
        if (rest.lat !== undefined) update.lat = rest.lat;
        if (rest.lng !== undefined) update.lng = rest.lng;
        if (rest.note !== undefined) update.note = rest.note;
        if (rest.failReason !== undefined) update.fail_reason = rest.failReason;
        if (rest.routeId !== undefined) update.route_id = rest.routeId;
        if (rest.status !== undefined) {
          update.status = rest.status;
          if (rest.status === 'entregado' && !pkg.delivered_at) {
            update.delivered_at = new Date().toISOString();
            update.delivered_by = req.user._id || req.user.id;
          }
        }
        update.updated_at = new Date().toISOString();
        const rows = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(update) });
        await syncRouteStats(pkg.route_id);
        if (rest.routeId && rest.routeId !== pkg.route_id) await syncRouteStats(pkg.route_id);
        return res.json(normalizePackage(rows[0]));
      }

      return res.status(403).json({ error: 'Sin permisos' });
    }

    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
    if (req.user.role === 'driver') {
      const route = await Route.findById(pkg.routeId).lean();
      if (String(route?.driverId) !== String(req.user._id)) return res.status(403).json({ error: 'Sin acceso a este paquete' });
      if (route.status === 'completed') return res.status(403).json({ error: 'La ruta ya fue finalizada por el administrador' });
      const { status, note, failReason } = req.body;
      if (status) {
        if (pkg.status === 'entregado' && status !== 'entregado') return res.status(403).json({ error: 'No puedes cambiar el estado de un paquete ya entregado' });
        pkg.status = status;
        if (status === 'entregado') { pkg.deliveredAt = new Date(); pkg.deliveredBy = req.user._id; }
        if (status !== 'no-entregado') pkg.failReason = '';
      }
      if (note !== undefined) pkg.note = note;
      if (failReason !== undefined) pkg.failReason = failReason;
    } else if (req.user.role === 'admin') {
      const oldRouteId = String(pkg.routeId);
      const { photoUrl, photoPublicId, photoUploadedAt, ...rest } = req.body;
      Object.assign(pkg, rest);
      if (rest.status === 'entregado' && !pkg.deliveredAt) { pkg.deliveredAt = new Date(); pkg.deliveredBy = req.user._id; }
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

// POST /api/packages/:id/photo?n=1|2
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const pkgs = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}`, select: 'id,route_id,photo_public_id,photo2_public_id' })}`);
      const pkg = pkgs?.[0];
      if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
      if (req.user.role === 'driver') {
        const routes = await supabaseRequest(`/routes${qs({ id: `eq.${pkg.route_id}`, select: 'driver_id' })}`);
        const userId = req.user._id || req.user.id;
        if (String(routes?.[0]?.driver_id) !== String(userId)) return res.status(403).json({ error: 'Sin acceso a este paquete' });
      } else if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Sin permisos' });
      }
      const n = req.query.n === '2' ? 2 : 1;
      const update = {};
      if (n === 2) {
        if (pkg.photo2_public_id) await deletePhoto(pkg.photo2_public_id);
        const result = await uploadToCloudinary(req.file.buffer);
        update.photo2_url = result.secure_url;
        update.photo2_public_id = result.public_id;
        update.photo2_uploaded_at = new Date().toISOString();
      } else {
        if (pkg.photo_public_id) await deletePhoto(pkg.photo_public_id);
        const result = await uploadToCloudinary(req.file.buffer);
        update.photo_url = result.secure_url;
        update.photo_public_id = result.public_id;
        update.photo_uploaded_at = new Date().toISOString();
      }
      update.updated_at = new Date().toISOString();
      const rows = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(update) });
      const updated = rows[0];
      return res.json({
        photoUrl: updated.photo_url, photo2Url: updated.photo2_url,
        photoUploadedAt: updated.photo_uploaded_at, photo2UploadedAt: updated.photo2_uploaded_at,
      });
    }
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
    if (req.user.role === 'driver') {
      const route = await Route.findById(pkg.routeId).lean();
      if (String(route?.driverId) !== String(req.user._id)) return res.status(403).json({ error: 'Sin acceso a este paquete' });
    } else if (!['admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const n = req.query.n === '2' ? 2 : 1;
    if (n === 2) {
      if (pkg.photo2PublicId) await deletePhoto(pkg.photo2PublicId);
      const result = await uploadToCloudinary(req.file.buffer);
      pkg.photo2Url = result.secure_url; pkg.photo2PublicId = result.public_id; pkg.photo2UploadedAt = new Date();
    } else {
      if (pkg.photoPublicId) await deletePhoto(pkg.photoPublicId);
      const result = await uploadToCloudinary(req.file.buffer);
      pkg.photoUrl = result.secure_url; pkg.photoPublicId = result.public_id; pkg.photoUploadedAt = new Date();
    }
    await pkg.save();
    res.json({ photoUrl: pkg.photoUrl, photo2Url: pkg.photo2Url, photoUploadedAt: pkg.photoUploadedAt, photo2UploadedAt: pkg.photo2UploadedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/packages/:id — soft-delete
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const pkgs = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}`, select: 'id,route_id' })}`);
      if (!pkgs?.[0]) return res.status(404).json({ error: 'Paquete no encontrado' });
      await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}` })}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'eliminado', updated_at: new Date().toISOString() }),
      });
      await syncRouteStats(pkgs[0].route_id);
      return res.json({ ok: true });
    }
    const pkg = await Package.findByIdAndUpdate(req.params.id, { status: 'eliminado' }, { new: true });
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });
    await syncRouteStats(pkg.routeId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/packages/:id/restore
router.patch('/:id/restore', requireRole('admin'), async (req, res) => {
  try {
    if (isSupabaseEnabled()) {
      const pkgs = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}`, select: 'id,route_id' })}`);
      if (!pkgs?.[0]) return res.status(404).json({ error: 'Paquete no encontrado' });
      const rows = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}` })}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'pendiente', updated_at: new Date().toISOString() }),
      });
      await syncRouteStats(pkgs[0].route_id);
      return res.json(normalizePackage(rows[0]));
    }
    const pkg = await Package.findByIdAndUpdate(req.params.id, { status: 'pendiente' }, { new: true });
    await syncRouteStats(pkg.routeId);
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/packages/reorder/batch
router.patch('/reorder/batch', requireRole('admin'), async (req, res) => {
  try {
    const { order } = req.body; // [{ id, order }, ...]
    if (isSupabaseEnabled()) {
      await Promise.all(order.map(({ id, order: o }) =>
        supabaseRequest(`/packages${qs({ id: `eq.${id}` })}`, {
          method: 'PATCH', body: JSON.stringify({ stop_order: o, updated_at: new Date().toISOString() }),
        })
      ));
      return res.json({ ok: true });
    }
    await Promise.all(order.map(({ id, order: o }) => Package.findByIdAndUpdate(id, { order: o })));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
