import { Router } from 'express';
import { nanoid } from 'nanoid';
import Route from '../models/Route.js';
import Package from '../models/Package.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';
import { upload, uploadToCloudinary, deletePhoto } from '../utils/cloudinary.js';

const router = Router();
router.use(requireAuth);

async function syncRouteStats(routeId) {
  const pkgs = await Package.find({ routeId, status: { $ne: 'eliminado' } }).lean();
  const stats = {
    total: pkgs.length,
    delivered: pkgs.filter(p => p.status === 'entregado').length,
    failed: pkgs.filter(p => p.status === 'no-entregado').length,
    pending: pkgs.filter(p => p.status === 'pendiente').length,
    totalAmount: pkgs.reduce((s, p) => s + (p.price || 0), 0),
    collectedAmount: pkgs.filter(p => p.status === 'entregado').reduce((s, p) => s + (p.price || 0), 0)
  };
  await Route.findByIdAndUpdate(routeId, { stats });
  return stats;
}

// GET /api/routes — admin sees all, driver sees assigned, company sees their routes
router.get('/', async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'driver') filter.driverId = req.user._id;
    if (req.user.role === 'company') filter.companyId = req.user.companyId;

    const routes = await Route.find(filter)
      .populate('driverId', 'name email phone')
      .populate('companyId', 'name')
      .sort({ date: -1 })
      .lean();
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/:id — single route with packages
router.get('/:id', async (req, res) => {
  try {
    const route = await Route.findById(req.params.id)
      .populate('driverId', 'name email phone vehicle licensePlate')
      .populate('companyId', 'name')
      .populate('tariffId', 'name defaultPrice items')
      .lean();
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    // Access control
    if (req.user.role === 'driver' && String(route.driverId?._id) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Sin acceso a esta ruta' });
    }
    if (req.user.role === 'company' && String(route.companyId?._id) !== String(req.user.companyId)) {
      return res.status(403).json({ error: 'Sin acceso a esta ruta' });
    }

    const packages = await Package.find({ routeId: route._id }).sort({ order: 1 }).lean();
    res.json({ route, packages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes — admin creates route
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.startPoint?.address && (!body.startPoint.lat || !body.startPoint.lng)) {
      const coords = await geocodeAddress(body.startPoint.address);
      if (coords) { body.startPoint.lat = coords.lat; body.startPoint.lng = coords.lng; }
    }
    const route = await Route.create(body);
    res.status(201).json(route);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/routes/:id — admin updates route (use save() so pre-save hook runs for net30 dueDate)
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });
    const { invoice, clientCompany, startPoint, stats, ...rest } = req.body;
    Object.assign(route, rest);
    // Nested objects require explicit set + markModified so Mongoose detects the change
    if (invoice !== undefined) { route.set('invoice', { ...route.invoice?.toObject?.() || {}, ...invoice }); route.markModified('invoice'); }
    if (clientCompany !== undefined) { route.set('clientCompany', { ...route.clientCompany?.toObject?.() || {}, ...clientCompany }); route.markModified('clientCompany'); }
    if (startPoint !== undefined) {
      const sp = { ...route.startPoint?.toObject?.() || {}, ...startPoint };
      if (sp.address && (!sp.lat || !sp.lng)) {
        const coords = await geocodeAddress(sp.address);
        if (coords) { sp.lat = coords.lat; sp.lng = coords.lng; }
      }
      route.set('startPoint', sp);
      route.markModified('startPoint');
    }
    await route.save();
    res.json(route);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/routes/:id/invoice-file?type=invoice|proof — upload invoice or payment proof
router.post('/:id/invoice-file', requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });
    const isProof = req.query.type === 'proof';
    const pidField = isProof ? 'paymentProofPublicId' : 'invoiceFilePublicId';
    const urlField = isProof ? 'paymentProofUrl' : 'invoiceFileUrl';
    const existingPid = route.invoice?.[pidField];
    if (existingPid) await deletePhoto(existingPid);
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'routiflow/invoices',
      resource_type: 'auto',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp', 'heic']
    });
    route.set(`invoice.${urlField}`, result.secure_url);
    route.set(`invoice.${pidField}`, result.public_id);
    route.markModified('invoice');
    await route.save();
    res.json({ invoiceFileUrl: route.invoice.invoiceFileUrl, paymentProofUrl: route.invoice.paymentProofUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/routes/:id — admin cancels route (status change only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await Route.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/routes/:id/permanent — permanently deletes route + all its packages
router.delete('/:id/permanent', requireRole('admin'), async (req, res) => {
  try {
    const deleted = await Package.deleteMany({ routeId: req.params.id });
    await Route.findByIdAndDelete(req.params.id);
    res.json({ ok: true, packagesDeleted: deleted.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Haversine straight-line distance (km) between two {lat,lng} points
function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Nearest-neighbor greedy TSP starting from `start`, then 2-opt improvement
function tspOptimize(start, points) {
  if (points.length <= 1) return [...points];

  // Step 1: Nearest-neighbor — greedily pick closest unvisited at each step
  const unvisited = [...points];
  const route = [];
  let cur = start;
  while (unvisited.length) {
    let bestIdx = 0, bestDist = haversine(cur, unvisited[0]);
    for (let i = 1; i < unvisited.length; i++) {
      const d = haversine(cur, unvisited[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    cur = unvisited[bestIdx];
    route.push(unvisited.splice(bestIdx, 1)[0]);
  }

  // Step 2: 2-opt — swap pairs of edges if it reduces total distance
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const prev = i === 0 ? start : route[i - 1];
        const next = j === route.length - 1 ? null : route[j + 1];
        const dOld = haversine(prev, route[i]) + (next ? haversine(route[j], next) : 0);
        const dNew = haversine(prev, route[j]) + (next ? haversine(route[i], next) : 0);
        if (dNew < dOld - 1e-6) {
          route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return route;
}

// POST /api/routes/:id/optimize — nearest-neighbor + 2-opt TSP optimization
router.post('/:id/optimize', requireRole('admin'), async (req, res) => {
  try {
    const route = await Route.findById(req.params.id).lean();
    const packages = await Package.find({ routeId: req.params.id, status: { $ne: 'eliminado' } }).lean();

    if (packages.length < 2) return res.json({ message: 'La ruta ya está optimizada', packages });

    const withCoords = packages.filter(p => p.lat && p.lng);
    if (withCoords.length < 2) {
      return res.status(400).json({ error: 'Se necesitan al menos 2 paquetes con coordenadas. Usa "Geocodificar ruta" primero.' });
    }

    // Use start point if available, otherwise centroid of all packages
    const start = (route.startPoint?.lat && route.startPoint?.lng)
      ? route.startPoint
      : { lat: withCoords.reduce((s, p) => s + p.lat, 0) / withCoords.length, lng: withCoords.reduce((s, p) => s + p.lng, 0) / withCoords.length };

    // Run TSP on packages with coordinates
    const sorted = tspOptimize(start, withCoords);

    // Save new order
    await Promise.all(sorted.map((pkg, i) => Package.findByIdAndUpdate(pkg._id, { order: i })));

    // Packages without coords go at the end
    const noCoords = packages.filter(p => !p.lat || !p.lng);
    await Promise.all(noCoords.map((p, i) => Package.findByIdAndUpdate(p._id, { order: sorted.length + i })));

    // Get actual road distance from OSRM (best-effort)
    let distanceKm = null;
    try {
      const pts = [start, ...sorted].map(p => `${p.lng},${p.lat}`).join(';');
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${pts}?overview=false`, {
        headers: { 'User-Agent': 'Routiflow/1.0' }, signal: AbortSignal.timeout(8000)
      });
      const d = await r.json();
      if (d.routes?.[0]?.distance) distanceKm = parseFloat((d.routes[0].distance / 1000).toFixed(1));
    } catch {}

    // Persist distanceKm on the route so driver can see it
    await Route.findByIdAndUpdate(req.params.id, { distanceKm: distanceKm || undefined });

    const updatedPackages = await Package.find({ routeId: req.params.id }).sort({ order: 1 }).lean();
    res.json({ optimized: true, packages: updatedPackages, distanceKm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/:id/stats — force recalculate stats
router.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const stats = await syncRouteStats(req.params.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/:id/geocode — batch geocode packages missing coordinates
router.post('/:id/geocode', requireRole('admin'), async (req, res) => {
  try {
    const pkgs = await Package.find({
      routeId: req.params.id,
      status: { $ne: 'eliminado' },
      $or: [{ lat: null }, { lng: null }, { lat: { $exists: false } }, { lng: { $exists: false } }]
    }).lean();

    let geocoded = 0;
    for (const pkg of pkgs) {
      const geo = await geocodeAddress(pkg.address, pkg.commune);
      if (geo) {
        await Package.findByIdAndUpdate(pkg._id, { lat: geo.lat, lng: geo.lng });
        geocoded++;
      }
      if (pkgs.length > 1) await sleep(1200);
    }
    res.json({ geocoded, skipped: pkgs.length - geocoded, total: pkgs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/:id/share — generate (or return existing) public share token
router.post('/:id/share', requireRole('admin'), async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });
    if (!route.shareToken) {
      route.shareToken = nanoid(20);
      await route.save();
    }
    res.json({ shareToken: route.shareToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/osrm-path — proxy OSRM road geometry (avoids browser CORS)
router.post('/osrm-path', async (req, res) => {
  try {
    const { coords } = req.body;
    if (!coords?.length || coords.length < 2) return res.json({ geometry: null });
    const pts = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`,
      { headers: { 'User-Agent': 'Routiflow/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    res.json({ geometry: d.routes?.[0]?.geometry || null });
  } catch {
    res.json({ geometry: null });
  }
});

// DELETE /api/routes/:id/share — revoke public share token
router.delete('/:id/share', requireRole('admin'), async (req, res) => {
  try {
    await Route.findByIdAndUpdate(req.params.id, { $unset: { shareToken: 1 } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { syncRouteStats };
export default router;
