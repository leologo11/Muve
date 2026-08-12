import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload, uploadToCloudinary, deletePhoto } from '../utils/cloudinary.js';
import { syncRouteStats } from './deliveryRoutes.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';
import { qs, supabaseRequest, supabaseRequestWithCount } from '../utils/supabase.js';

const router = Router();

function normStr(s) { return (s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

async function fireDeliveryWebhook(pkg) {
  if (!pkg.company_id) return;
  try {
    const companies = await supabaseRequest(`/companies${qs({ id: `eq.${pkg.company_id}`, select: 'webhook_url,webhook_name,name' })}`);
    const company = companies?.[0];
    if (!company?.webhook_url) return;
    const payload = {
      event: 'package_delivered',
      webhookName: company.webhook_name || company.name,
      trackingId: pkg.tracking_id,
      customerName: [pkg.customer_name, pkg.customer_last_name].filter(Boolean).join(' '),
      customerPhone: pkg.customer_phone || null,
      address: pkg.address || null,
      commune: pkg.commune || null,
      deliveredAt: new Date().toISOString(),
    };
    console.log(`[webhook] Disparando para empresa "${company.name}" → ${company.webhook_url}`);
    const res = await fetch(company.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`[webhook] Respuesta: ${res.status} ${res.statusText} — tracking: ${pkg.tracking_id}`);
  } catch (err) {
    console.error(`[webhook] Error al disparar webhook empresa ${pkg.company_id}:`, err.message);
  }
}

async function patchPackageWithSchemaFallback(id, update) {
  try {
    return await supabaseRequest(`/packages${qs({ id: `eq.${id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  } catch (err) {
    if (update.delivery_meta !== undefined && /delivery_meta|schema cache|column/i.test(err.message)) {
      const { delivery_meta, ...withoutMeta } = update;
      return await supabaseRequest(`/packages${qs({ id: `eq.${id}` })}`, {
        method: 'PATCH',
        body: JSON.stringify(withoutMeta),
      });
    }
    throw err;
  }
}

function normalizePackage(p) {
  return {
    _id: p.id, id: p.id, trackingId: p.tracking_id, routeId: p.route_id,
    companyId: p.company_id,
    customerName: p.customer_name, customerLastName: p.customer_last_name, customerPhone: p.customer_phone,
    address: p.address, commune: p.commune, aptFloor: p.apt_floor, zone: p.zone, price: Number(p.price || 0),
    lat: p.lat, lng: p.lng, order: p.stop_order, status: p.status, failReason: p.fail_reason, note: p.note,
    photoUrl: p.photo_url, photo2Url: p.photo2_url,
    photoUploadedAt: p.photo_uploaded_at, photo2UploadedAt: p.photo2_uploaded_at,
    deliveredAt: p.delivered_at,
    deliveryMeta: p.delivery_meta || {},
    aiFlags: p.ai_flags || [],
    history: p.history || [],
    createdAt: p.created_at, updatedAt: p.updated_at,
  };
}

// PUBLIC: customer lookup by tracking ID (no auth required)
router.get('/track/:trackingId', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All routes below require auth
router.use(requireAuth);

// GET /api/packages/map — admin: all geocoded packages for the general map view
router.get('/map', requireRole('admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = {
      select: 'id,tracking_id,address,commune,lat,lng,status,fail_reason,customer_name,customer_last_name,delivered_at,created_at,route_id,company_id',
      status: 'neq.eliminado',
      order: 'created_at.desc',
      limit: 10000,
    };
    let packagesPath = `/packages${qs(params)}`;
    const extraDateFilters = [];
    if (from) extraDateFilters.push(`created_at=gte.${encodeURIComponent(new Date(`${from}T00:00:00`).toISOString())}`);
    if (to) extraDateFilters.push(`created_at=lte.${encodeURIComponent(new Date(`${to}T23:59:59`).toISOString())}`);
    if (extraDateFilters.length) packagesPath += `${packagesPath.includes('?') ? '&' : '?'}${extraDateFilters.join('&')}`;
    const rows = await supabaseRequest(packagesPath);
    const routeIds = [...new Set(rows.map(p => p.route_id).filter(Boolean))];
    const companyIds = [...new Set(rows.map(p => p.company_id).filter(Boolean))];
    const routeMap = new Map();
    const companyMap = new Map();
    const driverMap = new Map();
    if (routeIds.length) {
      const routeRows = await supabaseRequest(`/routes${qs({
        id: `in.(${routeIds.join(',')})`,
        select: 'id,route_code,status,driver_id',
      })}`);
      routeRows.forEach(r => routeMap.set(r.id, r));
      const driverIds = [...new Set(routeRows.map(r => r.driver_id).filter(Boolean))];
      if (driverIds.length) {
        const driverRows = await supabaseRequest(`/app_users${qs({
          id: `in.(${driverIds.join(',')})`,
          select: 'id,name',
        })}`);
        driverRows.forEach(u => driverMap.set(u.id, u));
      }
    }
    if (companyIds.length) {
      const companyRows = await supabaseRequest(`/companies${qs({
        id: `in.(${companyIds.join(',')})`,
        select: 'id,name',
      })}`);
      companyRows.forEach(c => companyMap.set(c.id, c));
    }
    return res.json(rows.map(p => ({
      _id: p.id, id: p.id,
      trackingId: p.tracking_id,
      address: p.address, commune: p.commune,
      lat: p.lat != null ? Number(p.lat) : null,
      lng: p.lng != null ? Number(p.lng) : null,
      status: p.status, failReason: p.fail_reason,
      customerName: [p.customer_name, p.customer_last_name].filter(Boolean).join(' '),
      deliveredAt: p.delivered_at,
      createdAt: p.created_at,
      routeId: p.route_id,
      routeCode: routeMap.get(p.route_id)?.route_code,
      routeStatus: routeMap.get(p.route_id)?.status || null,
      driverName: driverMap.get(routeMap.get(p.route_id)?.driver_id)?.name || null,
      companyName: companyMap.get(p.company_id)?.name || null,
      companyId: p.company_id,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packages/all — admin: all packages across all routes
router.get('/all', requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 60, status, routeId, companyId, search, driverId } = req.query;
    const params = { select: '*', order: 'created_at.desc', limit, offset: (Number(page) - 1) * Number(limit) };
    if (status && status !== 'todos') params.status = `eq.${status}`;
    if (companyId) params.company_id = `eq.${companyId}`;

    // routeId='pool' → packages without route (the dispatch pool)
    if (routeId === 'pool') {
      params.route_id = 'is.null';
      if (!status || status === 'todos') params.status = 'neq.eliminado';
      let poolPath = `/packages${qs(params)}`;
      if (search && search.trim()) {
        const s = search.trim().replace(/[*()]/g, '');
        const orClause = [
          `customer_name.ilike.*${s}*`, `customer_last_name.ilike.*${s}*`,
          `address.ilike.*${s}*`, `tracking_id.ilike.*${s}*`,
          `commune.ilike.*${s}*`, `customer_phone.ilike.*${s}*`,
        ].join(',');
        poolPath += `&or=(${orClause})`;
      }
      const { rows: poolRows, total: poolTotal } = await supabaseRequestWithCount(poolPath);
      return res.json({ packages: poolRows.map(normalizePackage), total: poolTotal, page: Number(page), limit: Number(limit) });
    }

    // driverId filter: resolve to route IDs for that driver first
    let resolvedRouteId = routeId || null;
    if (driverId && !routeId) {
      const driverRoutes = await supabaseRequest(`/routes${qs({ driver_id: `eq.${driverId}`, select: 'id' })}`).catch(() => []);
      const ids = driverRoutes.map(r => r.id).filter(Boolean);
      resolvedRouteId = ids.length ? `route_ids:${ids.join(',')}` : 'none';
    }
    if (resolvedRouteId === 'none') {
      return res.json({ packages: [], total: 0, page: Number(page), limit: Number(limit) });
    }
    if (resolvedRouteId && !resolvedRouteId.startsWith('route_ids:')) {
      params.route_id = `eq.${resolvedRouteId}`;
    } else if (resolvedRouteId?.startsWith('route_ids:')) {
      params.route_id = `in.(${resolvedRouteId.slice('route_ids:'.length)})`;
    }

    let path = `/packages${qs(params)}`;

    // Full-text search across name, address, tracking ID, commune
    if (search && search.trim()) {
      const s = search.trim().replace(/[*()]/g, ''); // strip PostgREST reserved chars
      const orClause = [
        `customer_name.ilike.*${s}*`,
        `customer_last_name.ilike.*${s}*`,
        `address.ilike.*${s}*`,
        `tracking_id.ilike.*${s}*`,
        `commune.ilike.*${s}*`,
        `customer_phone.ilike.*${s}*`,
      ].join(',');
      path += `${path.includes('?') ? '&' : '?'}or=(${orClause})`;
    }

    const { rows, total } = await supabaseRequestWithCount(path);
    return res.json({ packages: rows.map(normalizePackage), total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packages/pool-summary — pool counts grouped by company (dispatch board)
router.get('/pool-summary', requireRole('admin'), async (req, res) => {
  try {
    const rows = await supabaseRequest(`/packages${qs({
      route_id: 'is.null',
      status: 'neq.eliminado',
      select: 'company_id,lat',
      limit: 10000,
    })}`);
    const byCompany = {};
    let noGeo = 0;
    rows.forEach(p => {
      const key = p.company_id || 'none';
      byCompany[key] = (byCompany[key] || 0) + 1;
      if (p.lat == null) noGeo++;
    });
    const companyIds = Object.keys(byCompany).filter(k => k !== 'none');
    const companyMap = new Map();
    if (companyIds.length) {
      const companies = await supabaseRequest(`/companies${qs({ id: `in.(${companyIds.join(',')})`, select: 'id,name' })}`);
      companies.forEach(c => companyMap.set(c.id, c.name));
    }
    const summary = Object.entries(byCompany)
      .map(([companyId, count]) => ({
        companyId: companyId === 'none' ? null : companyId,
        companyName: companyId === 'none' ? 'Sin empresa' : (companyMap.get(companyId) || 'Empresa'),
        count,
      }))
      .sort((a, b) => b.count - a.count);
    return res.json({ total: rows.length, noGeo, companies: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/packages/bulk-assign — move many packages to a route (or to pool with routeId=null) in one shot
router.post('/bulk-assign', requireRole('admin'), async (req, res) => {
  try {
    const { ids, routeId = null } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids requeridos' });

    if (routeId) {
      const routes = await supabaseRequest(`/routes${qs({ id: `eq.${routeId}`, select: 'id,status' })}`);
      if (!routes?.[0]) return res.status(404).json({ error: 'Ruta no encontrada' });
    }

    // Capture previous routes so their stats can be refreshed after the move
    const prev = await supabaseRequest(`/packages${qs({ id: `in.(${ids.join(',')})`, select: 'id,route_id' })}`);
    const prevRouteIds = [...new Set(prev.map(p => p.route_id).filter(Boolean))];

    // Append at the end of the target route's stop order
    let nextOrder = 0;
    if (routeId) {
      const existing = await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}`, select: 'stop_order', order: 'stop_order.desc', limit: 1 })}`);
      nextOrder = (existing?.[0]?.stop_order ?? -1) + 1;
    }

    await supabaseRequest(`/packages${qs({ id: `in.(${ids.join(',')})` })}`, {
      method: 'PATCH',
      body: JSON.stringify({
        route_id: routeId,
        ...(routeId ? { stop_order: nextOrder } : {}),
        updated_at: new Date().toISOString(),
      }),
    });

    const affected = [...new Set([...prevRouteIds, ...(routeId ? [routeId] : [])])];
    await Promise.all(affected.map(id => syncRouteStats(id)));

    return res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packages/pool — packages with no route (pool), searchable
router.get('/pool', requireRole('admin'), async (req, res) => {
  try {
    const { search, companyId } = req.query;
    const params = { route_id: 'is.null', status: 'neq.eliminado', select: '*', order: 'created_at.desc', limit: 200 };
    if (companyId) params.company_id = `eq.${companyId}`;
    const rows = await supabaseRequest(`/packages${qs(params)}`);
    const q = search?.toLowerCase();
    const filtered = q
      ? rows.filter(p => [p.customer_name, p.customer_last_name, p.address, p.commune, p.tracking_id].filter(Boolean).join(' ').toLowerCase().includes(q))
      : rows;
    return res.json(filtered.map(normalizePackage));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packages?routeId=xxx
router.get('/', async (req, res) => {
  try {
    const { routeId } = req.query;
    if (!routeId) return res.status(400).json({ error: 'routeId requerido' });
    const rows = await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}`, select: '*', order: 'stop_order.asc' })}`);
    return res.json(rows.map(normalizePackage));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/packages — admin adds package (routeId optional — null goes to pool)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const routeId   = req.body.routeId || null;
    const companyId = req.body.companyId || null;
    if (!companyId) return res.status(400).json({ error: 'companyId es requerido' });

    let stopOrder = 0;
    if (routeId) {
      const existingPkgs = await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}`, select: 'stop_order', order: 'stop_order.desc', limit: 1 })}`);
      stopOrder = existingPkgs.length > 0 ? (existingPkgs[0].stop_order ?? -1) + 1 : 0;
    }

    let price = req.body.price != null && req.body.price !== '' ? Number(req.body.price) : null;
    if (price == null && routeId) {
      const routes = await supabaseRequest(`/routes${qs({ id: `eq.${routeId}`, select: 'tariff_id' })}`);
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
        tracking_id: `PKG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        company_id: companyId,
        route_id: routeId,
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
    if (routeId) await syncRouteStats(routeId);
    return res.status(201).json(normalizePackage(rows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/packages/bulk — routeId optional (null = pool), companyId required
router.post('/bulk', requireRole('admin'), async (req, res) => {
  try {
    const { routeId: rawRouteId, companyId: rawCompanyId, packages } = req.body;
    if (!packages?.length) return res.status(400).json({ error: 'packages requeridos' });
    if (!rawCompanyId) return res.status(400).json({ error: 'companyId es requerido' });
    const routeId   = rawRouteId || null;
    const companyId = rawCompanyId;

    let baseOrder = 0;
    if (routeId) {
      const existingPkgs = await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}`, select: 'stop_order', order: 'stop_order.desc', limit: 1 })}`);
      baseOrder = existingPkgs.length > 0 ? (existingPkgs[0].stop_order ?? -1) + 1 : 0;
    }
    const docs = packages.map((p, i) => ({
      tracking_id: `PKG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      company_id: companyId,
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
    if (routeId) await syncRouteStats(routeId);
    res.status(201).json(created.map(normalizePackage));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/packages/bulk-delete
// If already eliminado → hard delete. Otherwise → soft delete (status=eliminado).
router.post('/bulk-delete', requireRole('admin'), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids requeridos' });
  try {
    const pkgs = await supabaseRequest(`/packages${qs({ id: `in.(${ids.join(',')})`, select: 'id,status' })}`);
    const statusMap = Object.fromEntries((pkgs || []).map(p => [String(p.id), p.status]));
    await Promise.all(ids.map(id => {
      if (statusMap[String(id)] === 'eliminado') {
        return supabaseRequest(`/packages${qs({ id: `eq.${id}` })}`, { method: 'DELETE' });
      }
      return supabaseRequest(`/packages${qs({ id: `eq.${id}` })}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'eliminado', updated_at: new Date().toISOString() }),
      });
    }));
    return res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/packages/demo-archive — soft-archive every active package in one shot (reversible via demo-restore)
router.post('/demo-archive', requireRole('admin'), async (req, res) => {
  try {
    const rows = await supabaseRequest(`/packages${qs({ status: 'neq.eliminado', select: 'id' })}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'eliminado', updated_at: new Date().toISOString() }),
    });
    return res.json({ ids: (rows || []).map(r => r.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/packages/demo-restore — bring back packages archived via demo-archive
router.post('/demo-restore', requireRole('admin'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.json({ restored: 0 });
    const rows = await supabaseRequest(`/packages${qs({ id: `in.(${ids.join(',')})` })}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'pendiente', updated_at: new Date().toISOString() }),
    });
    return res.json({ restored: (rows || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/packages/geocode-batch — re-geocode all packages that have address but no lat/lng
router.post('/geocode-batch', requireRole('admin'), async (req, res) => {
  try {
    const rows = await supabaseRequest(`/packages${qs({
      lat: 'is.null',
      status: 'neq.eliminado',
      select: 'id,address,commune',
      limit: 200,
    })}`);
    const toGeocode = (rows || []).filter(p => (p.address || '').trim().length > 0);
    let geocoded = 0;
    const errors = [];
    for (const pkg of toGeocode) {
      try {
        const geo = await geocodeAddress(pkg.address, pkg.commune);
        if (geo) {
          await supabaseRequest(`/packages${qs({ id: `eq.${pkg.id}` })}`, {
            method: 'PATCH',
            body: JSON.stringify({ lat: geo.lat, lng: geo.lng, updated_at: new Date().toISOString() }),
          });
          geocoded++;
        }
      } catch (e) {
        errors.push(pkg.id);
      }
      await sleep(300);
    }
    return res.json({ total: toGeocode.length, geocoded, errors: errors.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/packages/:id
router.patch('/:id', async (req, res) => {
  try {
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
      if (req.body.deliveryMeta !== undefined) update.delivery_meta = req.body.deliveryMeta || {};
      update.updated_at = new Date().toISOString();
      const rows = await patchPackageWithSchemaFallback(req.params.id, update);
      await syncRouteStats(pkg.route_id);
      if (status === 'entregado') fireDeliveryWebhook({ ...pkg, ...update });
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
      if (rest.deliveryMeta !== undefined) update.delivery_meta = rest.deliveryMeta || {};
      if (rest.routeId !== undefined) update.route_id = rest.routeId;
      if (rest.aiFlags !== undefined) update.ai_flags = rest.aiFlags;
      const wasDelivered = pkg.status === 'entregado';
      if (rest.status !== undefined) {
        update.status = rest.status;
        if (rest.status === 'entregado' && !pkg.delivered_at) {
          update.delivered_at = new Date().toISOString();
          update.delivered_by = req.user._id || req.user.id;
        }
      }
      // Auto-geocode if address/commune changed and package has no coordinates yet
      const addressChanged = rest.address !== undefined || rest.commune !== undefined;
      const newAddress = rest.address ?? pkg.address;
      const newCommune = rest.commune ?? pkg.commune;
      if (addressChanged && newAddress && !pkg.lat && !pkg.lng) {
        const geo = await geocodeAddress(newAddress, newCommune).catch(() => null);
        if (geo) { update.lat = geo.lat; update.lng = geo.lng; }
      }

      update.updated_at = new Date().toISOString();
      const rows = await patchPackageWithSchemaFallback(req.params.id, update);
      const oldRouteId = pkg.route_id || null;
      if (oldRouteId) await syncRouteStats(oldRouteId);
      if (rest.routeId && rest.routeId !== oldRouteId) await syncRouteStats(rest.routeId);
      if (rest.status === 'entregado' && !wasDelivered) fireDeliveryWebhook({ ...pkg, ...update });
      return res.json(normalizePackage(rows[0]));
    }

    return res.status(403).json({ error: 'Sin permisos' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/packages/:id/photo?n=1|2
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// DELETE /api/packages/:id — soft-delete first; hard-delete if already eliminado
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const pkgs = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}`, select: 'id,route_id,status' })}`);
    if (!pkgs?.[0]) return res.status(404).json({ error: 'Paquete no encontrado' });
    const pkg = pkgs[0];
    if (pkg.status === 'eliminado') {
      await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
    } else {
      await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}` })}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'eliminado', updated_at: new Date().toISOString() }),
      });
    }
    await syncRouteStats(pkg.route_id);
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/packages/:id/restore
router.patch('/:id/restore', requireRole('admin'), async (req, res) => {
  try {
    const pkgs = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}`, select: 'id,route_id' })}`);
    if (!pkgs?.[0]) return res.status(404).json({ error: 'Paquete no encontrado' });
    const rows = await supabaseRequest(`/packages${qs({ id: `eq.${req.params.id}` })}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'pendiente', updated_at: new Date().toISOString() }),
    });
    await syncRouteStats(pkgs[0].route_id);
    return res.json(normalizePackage(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/packages/reorder/batch
router.patch('/reorder/batch', requireRole('admin'), async (req, res) => {
  try {
    const { order } = req.body; // [{ id, order }, ...]
    await Promise.all(order.map(({ id, order: o }) =>
      supabaseRequest(`/packages${qs({ id: `eq.${id}` })}`, {
        method: 'PATCH', body: JSON.stringify({ stop_order: o, updated_at: new Date().toISOString() }),
      })
    ));
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/packages/webhook-test/:companyId — dispara webhook de prueba (solo admin)
router.post('/webhook-test/:companyId', requireRole('admin'), async (req, res) => {
  try {
    const companies = await supabaseRequest(`/companies${qs({ id: `eq.${req.params.companyId}`, select: 'webhook_url,webhook_name,name' })}`);
    const company = companies?.[0];
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
    if (!company.webhook_url) return res.status(400).json({ error: 'Esta empresa no tiene webhook configurado' });
    const payload = {
      event: 'package_delivered',
      webhookName: company.webhook_name || company.name,
      trackingId: 'PKG-TEST-0000',
      customerName: 'Cliente de Prueba',
      customerPhone: '+56900000000',
      address: 'Dirección de prueba 123',
      commune: 'Santiago',
      deliveredAt: new Date().toISOString(),
    };
    const response = await fetch(company.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await response.text().catch(() => '');
    res.json({ ok: response.ok, status: response.status, statusText: response.statusText, response: text.slice(0, 500), payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
