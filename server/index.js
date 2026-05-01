import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import companyRoutes from './routes/companies.js';
import routeRoutes from './routes/deliveryRoutes.js';
import packageRoutes from './routes/packages.js';
import importRoutes from './routes/importAI.js';
import priceRoutes from './routes/priceRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import zoneRoutes from './routes/zoneRoutes.js';
import tariffRoutes from './routes/tariffRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import { runCleanup } from './utils/cleanup.js';

const app = express();
const PORT = process.env.PORT || 4000;

// CORS — en producción el frontend y backend son el mismo servidor, se permite todo
app.use(cors({
  origin: (origin, cb) => {
    if (process.env.NODE_ENV === 'production') return cb(null, true);
    const allowed = ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean);
    if (!origin || allowed.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Routes
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/import', importRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/tariffs', tariffRoutes);
app.use('/api/quotes', quoteRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

// Reset completo — elimina rutas, paquetes, cotizaciones, tarifas y precios
// Solo ejecutable por admin autenticado
app.post('/api/admin/reset-data', async (req, res) => {
  try {
    const { requireAuth, requireRole } = await import('./middleware/auth.js');
    await new Promise((resolve, reject) => requireAuth(req, res, err => err ? reject(err) : resolve()));
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo admins' });

    const [Route, Package, Quote, Tariff, Price, Zone] = await Promise.all([
      import('./models/Route.js').then(m => m.default),
      import('./models/Package.js').then(m => m.default),
      import('./models/Quote.js').then(m => m.default).catch(() => null),
      import('./models/Tariff.js').then(m => m.default).catch(() => null),
      import('./models/Price.js').then(m => m.default).catch(() => null),
      import('./models/Zone.js').then(m => m.default).catch(() => null),
    ]);

    const results = await Promise.all([
      Route.deleteMany({}),
      Package.deleteMany({}),
      Quote   ? Quote.deleteMany({})   : { deletedCount: 0 },
      Tariff  ? Tariff.deleteMany({})  : { deletedCount: 0 },
      Price   ? Price.deleteMany({})   : { deletedCount: 0 },
      Zone    ? Zone.deleteMany({})    : { deletedCount: 0 },
    ]);

    console.log('🗑️ Reset completo ejecutado por', req.user.email);
    res.json({
      ok: true,
      deleted: {
        routes:   results[0].deletedCount,
        packages: results[1].deletedCount,
        quotes:   results[2].deletedCount,
        tariffs:  results[3].deletedCount,
        prices:   results[4].deletedCount,
        zones:    results[5].deletedCount,
      }
    });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/cleanup', async (req, res) => {
  try {
    const result = await runCleanup();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

// Serve built React app in production
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// Arrancar el servidor PRIMERO para que el healthcheck responda,
// luego conectar MongoDB en segundo plano con reintentos
app.listen(PORT, () => console.log(`🚀 Routiflow escuchando en puerto ${PORT}`));

async function connectMongo(attempt = 1) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 15000 });
    console.log('✅ MongoDB conectado');
    runCleanup().catch(err => console.error('Cleanup error:', err.message));
    setInterval(() => runCleanup().catch(err => console.error('Cleanup error:', err.message)), 24 * 60 * 60 * 1000);
  } catch (err) {
    console.error(`❌ MongoDB intento ${attempt} fallido: ${err.message}`);
    if (attempt >= 5) { console.error('No se pudo conectar a MongoDB tras 5 intentos.'); return; }
    const delay = Math.min(5000 * attempt, 30000);
    console.log(`Reintentando en ${delay / 1000}s…`);
    setTimeout(() => connectMongo(attempt + 1), delay);
  }
}
connectMongo();
