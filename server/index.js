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

app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }));
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

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log('✅ MongoDB conectado');
    app.listen(PORT, () => console.log(`🚀 Routiflow API corriendo en http://localhost:${PORT}`));
    // Run cleanup once at startup, then every 24 hours
    runCleanup().catch(err => console.error('Cleanup error:', err.message));
    setInterval(() => runCleanup().catch(err => console.error('Cleanup error:', err.message)), 24 * 60 * 60 * 1000);
  })
  .catch(err => {
    console.error('❌ Error conectando MongoDB:', err.message);
    process.exit(1);
  });
