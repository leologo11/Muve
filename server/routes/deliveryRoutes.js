import { Router } from 'express';
import Route from '../models/Route.js';
import Package from '../models/Package.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';

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
      .populate('driverId', 'name email')
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
    const route = await Route.create(req.body);
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
    Object.assign(route, req.body);
    await route.save();
    res.json(route);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/routes/:id — admin cancels route
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await Route.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/:id/optimize — OSRM real-road TSP optimization
router.post('/:id/optimize', requireRole('admin'), async (req, res) => {
  try {
    const route = await Route.findById(req.params.id).lean();
    const packages = await Package.find({
      routeId: req.params.id,
      status: { $ne: 'eliminado' }
    }).lean();

    if (packages.length < 2) {
      return res.json({ message: 'La ruta ya está optimizada', packages });
    }

    const pkgsWithCoords = packages.filter(p => p.lat && p.lng);
    if (pkgsWithCoords.length < 2) {
      return res.status(400).json({ error: 'Se necesitan al menos 2 paquetes con coordenadas. Usa "Geocodificar ruta" primero.' });
    }

    const startPoint = route.startPoint?.lat && route.startPoint?.lng ? route.startPoint : null;

    // Build coordinate list: optional start point + packages with coords (max 100 for OSRM)
    const batch = pkgsWithCoords.slice(0, startPoint ? 99 : 100);
    const coordParts = [
      ...(startPoint ? [`${startPoint.lng},${startPoint.lat}`] : []),
      ...batch.map(p => `${p.lng},${p.lat}`)
    ];

    const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordParts.join(';')}?source=first&roundtrip=false&annotations=false`;

    const osrmRes = await fetch(osrmUrl, {
      headers: { 'User-Agent': 'Routiflow/1.0' },
      signal: AbortSignal.timeout(15000)
    });

    if (!osrmRes.ok) throw new Error(`OSRM error HTTP ${osrmRes.status}`);
    const osrmData = await osrmRes.json();
    if (osrmData.code !== 'Ok') throw new Error('OSRM: ' + (osrmData.message || osrmData.code));

    // OSRM waypoints are in INPUT order; each has .waypoint_index = position in optimal trip
    const startOffset = startPoint ? 1 : 0;
    const sorted = [...osrmData.waypoints]
      .map((wp, inputIdx) => ({ inputIdx, waypointIdx: wp.waypoint_index }))
      .sort((a, b) => a.waypointIdx - b.waypointIdx)
      .filter(x => x.inputIdx >= startOffset)
      .map(x => batch[x.inputIdx - startOffset]);

    // Update order for optimized packages
    await Promise.all(sorted.map((pkg, i) => Package.findByIdAndUpdate(pkg._id, { order: i })));

    // Packages without coords (or beyond batch limit) go at the end
    const remainder = packages.filter(p => !p.lat || !p.lng || pkgsWithCoords.indexOf(p) >= 100);
    await Promise.all(remainder.map((p, i) => Package.findByIdAndUpdate(p._id, { order: sorted.length + i })));

    const updatedPackages = await Package.find({ routeId: req.params.id }).sort({ order: 1 }).lean();
    const distanceKm = osrmData.trips?.[0]?.distance ? (osrmData.trips[0].distance / 1000).toFixed(1) : null;
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

export { syncRouteStats };
export default router;
