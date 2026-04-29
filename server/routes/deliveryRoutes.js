import { Router } from 'express';
import Route from '../models/Route.js';
import Package from '../models/Package.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Anthropic from '@anthropic-ai/sdk';

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
      .populate('driverId', 'name email')
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

// PATCH /api/routes/:id — admin updates route
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
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

// POST /api/routes/:id/optimize — Claude AI reorders packages considering start point
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

    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const packageList = packages.map((p, i) => ({
      index: i,
      id: String(p._id),
      address: `${p.address}${p.commune ? ', ' + p.commune : ''}`,
      lat: p.lat,
      lng: p.lng,
      zone: p.zone
    }));

    const startInfo = route?.startPoint?.address
      ? `\nPUNTO DE INICIO (bodega/pickup): ${route.startPoint.address}${route.startPoint.lat ? ` (lat:${route.startPoint.lat}, lng:${route.startPoint.lng})` : ''}\n`
      : '\nNo hay punto de inicio definido, empieza por la parada más al norte.\n';

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Eres un experto en optimización de rutas de delivery en Santiago de Chile.
${startInfo}
Tienes estas paradas con coordenadas GPS. Ordénalas para hacer el recorrido más eficiente:
- Minimiza la distancia total recorrida
- Agrupa por zonas geográficas contiguas (ej: todas las Condes juntas, luego Vitacura, etc.)
- Considera el flujo natural del tráfico en Santiago (hora punta, autopistas, etc.)
- La ruta debe ser secuencial y lógica geográficamente
- Empieza desde el punto de inicio si está definido

Devuelve SOLO un array JSON con los valores del campo "id" en el orden óptimo.
Sin explicaciones, sin markdown, solo el JSON.

Paradas:
${JSON.stringify(packageList, null, 2)}`
      }]
    });

    let orderedIds;
    try {
      const text = message.content[0].text.trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      orderedIds = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(422).json({ error: 'No se pudo parsear la respuesta de la IA' });
    }

    // Update order field for each package
    await Promise.all(
      orderedIds.map((id, idx) =>
        Package.findByIdAndUpdate(id, { order: idx })
      )
    );

    const updatedPackages = await Package.find({ routeId: req.params.id }).sort({ order: 1 }).lean();
    res.json({ optimized: true, packages: updatedPackages });
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

export { syncRouteStats };
export default router;
