import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';
import { upload, uploadToCloudinary, deletePhoto } from '../utils/cloudinary.js';
import { qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth);

function normalizeRoute(r) {
  const driver = r.driver_id
    ? {
        _id: r.driver_id,
        id: r.driver_id,
        name: r.driver_name || r.driver?.name || '',
        phone: r.driver_phone || r.driver?.phone || '',
      }
    : null;
  return {
    _id: r.id,
    id: r.id,
    routeCode: r.route_code,
    name: r.name,
    date: r.date,
    driverId: driver,
    companyId: r.company_id,
    tariffId: r.tariff_id,
    status: r.status,
    clientCompany: r.client_company || {},
    invoice: r.invoice || {},
    driverPayout: Number(r.driver_payout || 0),
    driverSettlement: r.driver_settlement || {},
    startPoint: r.start_point || {},
    distanceKm: r.distance_km,
    shareToken: r.share_token,
    stats: r.stats || {},
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function attachSupabaseDrivers(rows = []) {
  const driverIds = [...new Set(rows.map(r => r.driver_id).filter(Boolean))];
  if (!driverIds.length) return rows;
  const users = await supabaseRequest(`/app_users${qs({ id: `in.(${driverIds.join(',')})`, select: 'id,name,phone' })}`);
  const userMap = new Map(users.map(u => [u.id, u]));
  return rows.map(r => {
    const driver = userMap.get(r.driver_id);
    return {
      ...r,
      driver_name: driver?.name || '',
      driver_phone: driver?.phone || '',
    };
  });
}

function normalizePackage(p) {
  return {
    _id: p.id, id: p.id, trackingId: p.tracking_id, routeId: p.route_id,
    companyId: p.company_id, companyName: p.companyName,
    customerName: p.customer_name, customerLastName: p.customer_last_name, customerPhone: p.customer_phone,
    address: p.address, commune: p.commune, aptFloor: p.apt_floor, zone: p.zone, price: Number(p.price || 0),
    lat: p.lat, lng: p.lng, order: p.stop_order, status: p.status, failReason: p.fail_reason, note: p.note,
    photoUrl: p.photo_url, photo2Url: p.photo2_url,
    photoUploadedAt: p.photo_uploaded_at, photo2UploadedAt: p.photo2_uploaded_at,
    deliveredAt: p.delivered_at,
    deliveryMeta: p.delivery_meta || {},
  };
}

async function syncRouteStats(routeId) {
  if (!routeId) return null;
  const pkgs = await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}`, status: `neq.eliminado`, select: 'status,price' })}`);
  const stats = {
    total: pkgs.length,
    delivered: pkgs.filter(p => p.status === 'entregado').length,
    failed: pkgs.filter(p => p.status === 'no-entregado').length,
    pending: pkgs.filter(p => p.status === 'pendiente').length,
    totalAmount: pkgs.reduce((s, p) => s + Number(p.price || 0), 0),
    // entregado + no-entregado: both are billed (client pays for the attempt)
    collectedAmount: pkgs.filter(p => p.status === 'entregado' || p.status === 'no-entregado').reduce((s, p) => s + Number(p.price || 0), 0),
  };
  await supabaseRequest(`/routes${qs({ id: `eq.${routeId}` })}`, {
    method: 'PATCH',
    body: JSON.stringify({ stats, updated_at: new Date().toISOString() }),
  });
  return stats;
}
// GET /api/routes
router.get('/', async (req, res) => {
  try {
    const params = { select: '*', order: 'date.desc' };
    if (req.user.role === 'driver') params.driver_id = `eq.${req.user._id || req.user.id}`;
    if (req.user.role === 'company' && req.user.companyId) params.company_id = `eq.${req.user.companyId}`;
    const rows = await supabaseRequest(`/routes${qs(params)}`);
    const withDrivers = await attachSupabaseDrivers(rows);
    return res.json(withDrivers.map(normalizeRoute));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/:id
router.get('/:id', async (req, res) => {
  try {
    const [routes, pkgs] = await Promise.all([
      supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}`, select: '*' })}`),
      supabaseRequest(`/packages${qs({ route_id: `eq.${req.params.id}`, select: '*', order: 'stop_order.asc' })}`),
    ]);
    const r = (await attachSupabaseDrivers(routes))?.[0];
    if (!r) return res.status(404).json({ error: 'Ruta no encontrada' });
    const companyIds = [...new Set(pkgs.map(p => p.company_id).filter(Boolean))];
    const companyMap = new Map();
    if (companyIds.length) {
      const companies = await supabaseRequest(`/companies${qs({ id: `in.(${companyIds.join(',')})`, select: 'id,name' })}`);
      companies.forEach(c => companyMap.set(c.id, c.name));
    }
    return res.json({ route: normalizeRoute(r), packages: pkgs.map(p => normalizePackage({ ...p, companyName: companyMap.get(p.company_id) || null })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const d = req.body.date ? new Date(req.body.date) : new Date();
    const ds = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rows = await supabaseRequest('/routes', {
      method: 'POST',
      body: JSON.stringify({
        route_code: `RT-${ds}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        name: req.body.name || '',
        date: d.toISOString(),
        driver_id: req.body.driverId || null,
        company_id: req.body.companyId || null,
        tariff_id: req.body.tariffId || null,
        status: req.body.status || 'active',
        client_company: req.body.clientCompany || {},
        invoice: req.body.invoice || {},
        driver_payout: req.body.driverPayout || null,
        driver_settlement: req.body.driverSettlement || undefined,
        start_point: req.body.startPoint || {},
        notes: req.body.notes || null,
      }),
    });
    return res.status(201).json(normalizeRoute(rows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/routes/:id
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { invoice, clientCompany, startPoint, stats, driverId, companyId, tariffId, driverSettlement, ...rest } = req.body;
    const payload = {};
    if (rest.name !== undefined) payload.name = rest.name;
    if (rest.date !== undefined) payload.date = new Date(rest.date).toISOString();
    if (rest.status !== undefined) payload.status = rest.status;
    if (rest.notes !== undefined) payload.notes = rest.notes || null;
    if (rest.driverPayout !== undefined) payload.driver_payout = rest.driverPayout || null;
    if (rest.distanceKm !== undefined) payload.distance_km = rest.distanceKm || null;
    if (driverId !== undefined) payload.driver_id = driverId || null;
    if (companyId !== undefined) payload.company_id = companyId || null;
    if (tariffId !== undefined) payload.tariff_id = tariffId || null;

    if (invoice !== undefined || clientCompany !== undefined || startPoint !== undefined || driverSettlement !== undefined) {
      const existing = await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}`, select: 'invoice,client_company,start_point,driver_settlement' })}`);
      const cur = existing?.[0] || {};
      if (invoice !== undefined) payload.invoice = { ...(cur.invoice || {}), ...invoice };
      if (clientCompany !== undefined) payload.client_company = { ...(cur.client_company || {}), ...clientCompany };
      if (driverSettlement !== undefined) payload.driver_settlement = { ...(cur.driver_settlement || {}), ...driverSettlement };
      if (startPoint !== undefined) {
        const sp = { ...(cur.start_point || {}), ...startPoint };
        if (sp.address && (!sp.lat || !sp.lng)) {
          const coords = await geocodeAddress(sp.address);
          if (coords) { sp.lat = coords.lat; sp.lng = coords.lng; }
        }
        payload.start_point = sp;
      }
    }

    payload.updated_at = new Date().toISOString();
    const rows = await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!rows?.[0]) return res.status(404).json({ error: 'Ruta no encontrada' });
    return res.json(normalizeRoute(rows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/routes/:id/invoice-file?type=invoice|proof
router.post('/:id/invoice-file', requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    const routes = await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}`, select: 'invoice' })}`);
    if (!routes?.[0]) return res.status(404).json({ error: 'Ruta no encontrada' });
    const isProof = req.query.type === 'proof';
    const pidField = isProof ? 'paymentProofPublicId' : 'invoiceFilePublicId';
    const urlField = isProof ? 'paymentProofUrl' : 'invoiceFileUrl';
    const existingInvoice = routes[0].invoice || {};
    if (existingInvoice[pidField]) await deletePhoto(existingInvoice[pidField]);
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'MUVE/invoices',
      resource_type: 'auto',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp', 'heic'],
    });
    const newInvoice = { ...existingInvoice, [urlField]: result.secure_url, [pidField]: result.public_id };
    await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({ invoice: newInvoice, updated_at: new Date().toISOString() }),
    });
    return res.json({ invoiceFileUrl: newInvoice.invoiceFileUrl, paymentProofUrl: newInvoice.paymentProofUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/routes/:id — soft cancel
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }),
    });
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/routes/:id/permanent
// Packages are NEVER deleted — they are detached (routeId set to null) and remain in the system.
// The only way to delete a package is through the All Packages view.
router.delete('/:id/permanent', requireRole('admin'), async (req, res) => {
  try {
    const routeId = req.params.id;
    // Detach packages from this route (set route_id = null, status back to pendiente if not delivered)
    const pkgs = await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}`, select: 'id,status' })}`);
    if (pkgs.length) {
      await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}` })}`, {
        method: 'PATCH',
        body: JSON.stringify({ route_id: null, updated_at: new Date().toISOString() }),
      });
    }
    await supabaseRequest(`/routes${qs({ id: `eq.${routeId}` })}`, { method: 'DELETE' });
    return res.json({ ok: true, packagesDetached: pkgs.length });
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

// Nearest-neighbor greedy TSP + 2-opt improvement
function tspOptimize(start, points) {
  if (points.length <= 1) return [...points];
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

// POST /api/routes/:id/optimize
router.post('/:id/optimize', requireRole('admin'), async (req, res) => {
  try {
    const [routes, packages] = await Promise.all([
      supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}`, select: '*' })}`),
      supabaseRequest(`/packages${qs({ route_id: `eq.${req.params.id}`, status: `neq.eliminado`, select: '*' })}`),
    ]);
    const routeRow = routes?.[0];
    if (packages.length < 2) return res.json({ message: 'La ruta ya está optimizada', packages: packages.map(normalizePackage) });

    const withCoords = packages.filter(p => p.lat && p.lng).map(p => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) }));
    if (withCoords.length < 2) {
      return res.status(400).json({ error: 'Se necesitan al menos 2 paquetes con coordenadas. Usa "Geocodificar ruta" primero.' });
    }

    const start = (routeRow?.start_point?.lat && routeRow?.start_point?.lng)
      ? { lat: Number(routeRow.start_point.lat), lng: Number(routeRow.start_point.lng) }
      : { lat: withCoords.reduce((s, p) => s + p.lat, 0) / withCoords.length, lng: withCoords.reduce((s, p) => s + p.lng, 0) / withCoords.length };

    const sorted = tspOptimize(start, withCoords);
    const noCoords = packages.filter(p => !p.lat || !p.lng);

    await Promise.all([
      ...sorted.map((pkg, i) => supabaseRequest(`/packages${qs({ id: `eq.${pkg.id}` })}`, {
        method: 'PATCH', body: JSON.stringify({ stop_order: i, updated_at: new Date().toISOString() }),
      })),
      ...noCoords.map((p, i) => supabaseRequest(`/packages${qs({ id: `eq.${p.id}` })}`, {
        method: 'PATCH', body: JSON.stringify({ stop_order: sorted.length + i, updated_at: new Date().toISOString() }),
      })),
    ]);

    let distanceKm = null;
    try {
      const pts = [start, ...sorted].map(p => `${p.lng},${p.lat}`).join(';');
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${pts}?overview=false`, {
        headers: { 'User-Agent': 'MUVE/1.0' }, signal: AbortSignal.timeout(8000)
      });
      const d = await r.json();
      if (d.routes?.[0]?.distance) distanceKm = parseFloat((d.routes[0].distance / 1000).toFixed(1));
    } catch {}

    await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH', body: JSON.stringify({ distance_km: distanceKm || null, updated_at: new Date().toISOString() }),
    });

    const updatedPkgs = await supabaseRequest(`/packages${qs({ route_id: `eq.${req.params.id}`, select: '*', order: 'stop_order.asc' })}`);
    return res.json({ optimized: true, packages: updatedPkgs.map(normalizePackage), distanceKm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/:id/stats
router.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const stats = await syncRouteStats(req.params.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/:id/geocode
router.post('/:id/geocode', requireRole('admin'), async (req, res) => {
  try {
    const pkgs = await supabaseRequest(`/packages${qs({
      route_id: `eq.${req.params.id}`,
      status: `neq.eliminado`,
      lat: 'is.null',
      select: 'id,address,commune',
    })}`);
    let geocoded = 0;
    for (const pkg of pkgs) {
      const geo = await geocodeAddress(pkg.address, pkg.commune);
      if (geo) {
        await supabaseRequest(`/packages${qs({ id: `eq.${pkg.id}` })}`, {
          method: 'PATCH',
          body: JSON.stringify({ lat: geo.lat, lng: geo.lng, updated_at: new Date().toISOString() }),
        });
        geocoded++;
      }
      if (pkgs.length > 1) await sleep(1200);
    }
    return res.json({ geocoded, skipped: pkgs.length - geocoded, total: pkgs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/:id/share
router.post('/:id/share', requireRole('admin'), async (req, res) => {
  try {
    const routes = await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}`, select: 'id,share_token' })}`);
    if (!routes?.[0]) return res.status(404).json({ error: 'Ruta no encontrada' });
    let shareToken = routes[0].share_token;
    if (!shareToken) {
      shareToken = crypto.randomBytes(10).toString('hex');
      await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}` })}`, {
        method: 'PATCH',
        body: JSON.stringify({ share_token: shareToken, updated_at: new Date().toISOString() }),
      });
    }
    return res.json({ shareToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/osrm-path — proxy OSRM road geometry
router.post('/osrm-path', async (req, res) => {
  try {
    const { coords } = req.body;
    if (!coords?.length || coords.length < 2) return res.json({ geometry: null });
    const pts = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`,
      { headers: { 'User-Agent': 'MUVE/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    res.json({ geometry: d.routes?.[0]?.geometry || null });
  } catch {
    res.json({ geometry: null });
  }
});

// GET /api/routes/:id/driver-location
router.get('/:id/driver-location', requireRole('admin'), async (req, res) => {
  try {
    const routes = await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}`, select: 'driver_id' })}`);
    if (!routes?.[0]) return res.status(404).json({ error: 'Ruta no encontrada' });
    const driverId = routes[0].driver_id;
    if (!driverId) return res.json({ location: null, driverName: null });
    const users = await supabaseRequest(`/app_users${qs({ id: `eq.${driverId}`, select: 'name,location' })}`);
    const driver = users?.[0];
    const loc = driver?.location;
    if (!loc?.lat || !loc?.lng) return res.json({ location: null, driverName: driver?.name || null });
    return res.json({ location: loc, driverName: driver.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/routes/:id/share
router.delete('/:id/share', requireRole('admin'), async (req, res) => {
  try {
    await supabaseRequest(`/routes${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({ share_token: null, updated_at: new Date().toISOString() }),
    });
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { syncRouteStats };
export default router;
