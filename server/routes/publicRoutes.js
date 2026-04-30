import { Router } from 'express';
import Route from '../models/Route.js';
import Package from '../models/Package.js';

const router = Router();

// GET /api/public/route/:shareToken — company tracking (no auth required)
router.get('/route/:shareToken', async (req, res) => {
  try {
    const route = await Route.findOne({ shareToken: req.params.shareToken })
      .populate('driverId', 'name')
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
        clientCompany: { name: route.clientCompany?.name || null },
        startPoint: route.startPoint,
        distanceKm: route.distanceKm,
        stats: route.stats
      },
      packages: publicPackages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
