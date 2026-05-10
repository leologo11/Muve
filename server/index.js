import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

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
import credentialRoutes from './routes/credentials.js';
import vehicleConfigRoutes from './routes/vehicleConfigRoutes.js';
import { runCleanup } from './utils/cleanup.js';
import { isSupabaseEnabled } from './utils/supabase.js';

const app = express();
const PORT = process.env.PORT || 4000;

// CORS — en producción el frontend y backend son el mismo servidor, se permite todo
app.use(cors({
  origin: (origin, cb) => {
    if (process.env.NODE_ENV === 'production') return cb(null, true);
    const allowed = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
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
app.use('/api/credentials', credentialRoutes);
app.use('/api/vehicle-configs', vehicleConfigRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

// Reset selectivo — elimina solo los targets indicados
// Solo ejecutable por admin autenticado
app.post('/api/admin/reset-data', async (req, res) => {
  try {
    const { requireAuth } = await import('./middleware/auth.js');
    await new Promise((resolve, reject) => requireAuth(req, res, err => err ? reject(err) : resolve()));
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo admins' });

    const ALL = ['routes', 'quotes', 'tariffs', 'prices', 'zones', 'companies'];
    const targets = Array.isArray(req.body?.targets) ? req.body.targets.filter(t => ALL.includes(t)) : ALL;

    const { supabaseRequest, qs } = await import('./utils/supabase.js');
    const deleted = { routes: 0, packages: 0, quotes: 0, tariffs: 0, prices: 0, zones: 0, companies: 0 };

    if (targets.includes('routes')) {
      const [pkgs, routes] = await Promise.all([
        supabaseRequest(`/packages${qs({ select: 'id' })}`),
        supabaseRequest(`/routes${qs({ select: 'id' })}`),
      ]);
      await supabaseRequest('/packages?id=not.is.null', { method: 'DELETE' });
      await supabaseRequest('/routes?id=not.is.null', { method: 'DELETE' });
      deleted.packages = pkgs.length;
      deleted.routes = routes.length;
    }
    if (targets.includes('quotes')) {
      const rows = await supabaseRequest(`/quotes${qs({ select: 'id' })}`);
      await supabaseRequest('/quote_items?id=not.is.null', { method: 'DELETE' });
      await supabaseRequest('/quotes?id=not.is.null', { method: 'DELETE' });
      deleted.quotes = rows.length;
    }
    if (targets.includes('tariffs')) {
      const rows = await supabaseRequest(`/tariffs${qs({ select: 'id' })}`);
      await supabaseRequest('/tariff_items?id=not.is.null', { method: 'DELETE' });
      await supabaseRequest('/tariffs?id=not.is.null', { method: 'DELETE' });
      deleted.tariffs = rows.length;
    }
    if (targets.includes('prices')) {
      const rows = await supabaseRequest(`/price_configs${qs({ select: 'id' })}`);
      await supabaseRequest('/price_configs?id=not.is.null', { method: 'DELETE' });
      deleted.prices = rows.length;
    }
    if (targets.includes('zones')) {
      const rows = await supabaseRequest(`/zones${qs({ select: 'id' })}`);
      await supabaseRequest('/zones?id=not.is.null', { method: 'DELETE' });
      deleted.zones = rows.length;
    }
    if (targets.includes('companies')) {
      const rows = await supabaseRequest(`/companies${qs({ select: 'id' })}`);
      await supabaseRequest('/companies?id=not.is.null', { method: 'DELETE' });
      deleted.companies = rows.length;
    }

    console.log('Reset Supabase ejecutado por', req.user.email, '| targets:', targets);
    res.json({ ok: true, deleted });
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

// Servir la app React compilada (siempre, no solo en production)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../client/dist');

if (fs.existsSync(clientDist)) {
  console.log('📦 Sirviendo frontend desde:', clientDist);
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.includes('.')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), err => { if (err) next(err); });
  });
}

// Arrancar el servidor
app.listen(PORT, () => console.log(`MUVE escuchando en puerto ${PORT}`));
console.log('Base de datos activa: Supabase.');
