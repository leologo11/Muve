import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { syncRouteStats } from './deliveryRoutes.js';
import { suggestPrice, roundPrice } from '../utils/priceByCommune.js';
import { getDbPricesMap } from './priceRoutes.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';
import { pointInPolygon } from '../utils/zones.js';
import { qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const PARSE_PROMPT = `Eres un asistente experto en extracción de datos de delivery para Chile.
Analiza el documento y extrae TODOS los registros de entrega que encuentres.

Para cada entrega devuelve un objeto JSON con EXACTAMENTE estos campos (null si no está disponible):
- customerName: string — solo el primer nombre (sin apellido)
- customerLastName: string — apellido(s)
- customerPhone: string — teléfono normalizado con prefijo +56 (ej: +56912345678)
- address: string — dirección completa de calle y número, SIN depto/piso/casa
- commune: string — comuna exacta de Chile (ej: "Las Condes", "Providencia")
- aptFloor: string — SOLO el número de depto, piso, casa o torre (ej: "Dpto 3B", "Casa 12", "Piso 4")
- _flags: array de strings con nombres de campos dudosos, ilegibles o inferidos. Array vacío [] si todo es claro.

REGLAS ESTRICTAS:
- Si nombre y apellido están en un solo campo, sepáralos correctamente
- Teléfonos: si empieza con 9 → "+569XXXXXXXX", si con 56 → "+56XXXXXXXX", si con +56 déjalo igual
- La dirección NO debe incluir depto/piso/casa — eso va en aptFloor
- Si la comuna no es clara o es abreviada, infiere la más probable de Chile y agrégala a _flags
- Si un campo está vacío, ilegible o ambiguo → ponlo en _flags
- NO incluyas campos price, zone, lat, lng — no los necesitamos
- Devuelve SOLO el array JSON válido, sin markdown ni texto adicional

Ejemplo de respuesta correcta:
[{"customerName":"María","customerLastName":"González López","customerPhone":"+56912345678","address":"Av. Providencia 1100","commune":"Providencia","aptFloor":"Dpto 202","_flags":[]},{"customerName":"Juan","customerLastName":null,"customerPhone":"+56987654321","address":"Los Cactus 2040","commune":"Colina","aptFloor":null,"_flags":["customerLastName","commune"]}]`;

async function parseWithClaude(client, content) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content }]
  });

  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Claude no pudo extraer datos. Intenta con otro formato.');
  return JSON.parse(jsonMatch[0]);
}

function normalize(str) {
  return (str || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function applyPrices(packages, dbPricesMap = {}, zones = []) {
  return packages.map((p, i) => {
    const key = normalize(p.commune);
    const dbPrice = dbPricesMap[key];

    let price = p.price ? roundPrice(p.price) : null;
    if (!price) {
      // Custom zone takes priority over commune price (more specific area)
      if (p.lat && p.lng && zones.length) {
        const zone = zones.find(z => {
          const ring = z.polygon?.coordinates?.[0] || z.polygon?.geometry?.coordinates?.[0];
          return ring && pointInPolygon([p.lng, p.lat], ring);
        });
        if (zone) price = zone.price;
      }
      if (!price) price = dbPrice || suggestPrice(p.commune);
    }
    return { ...p, price, _suggestedPrice: !p.price, order: i };
  });
}

// POST /api/import/pool/preview — parse file for pool (no routeId)
router.post('/pool/preview', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  req.params.routeId = null;
  return handlePreview(req, res);
});

// POST /api/import/pool/confirm — save parsed packages to pool (no routeId)
router.post('/pool/confirm', requireAuth, requireRole('admin'), async (req, res) => {
  req.params.routeId = null;
  return handleConfirm(req, res);
});

async function handlePreview(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido (imagen, Excel o CSV)' });

    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    const mime = req.file.mimetype;
    const name = req.file.originalname.toLowerCase();
    const isImage = mime.startsWith('image/');
    const isExcel = name.match(/\.(xlsx|xls)$/);
    const isCsv = name.endsWith('.csv') || mime === 'text/csv';

    let packages = [];

    if (isImage) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const mediaType = allowedTypes.includes(mime) ? mime : 'image/jpeg';
      const base64 = req.file.buffer.toString('base64');
      packages = await parseWithClaude(client, [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: PARSE_PROMPT }
      ]);
    } else if (isExcel) {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws);
      packages = await parseWithClaude(client,
        `${PARSE_PROMPT}\n\nDatos del archivo Excel (CSV):\n${csv.slice(0, 8000)}`
      );
    } else if (isCsv) {
      const text = req.file.buffer.toString('utf-8');
      packages = await parseWithClaude(client,
        `${PARSE_PROMPT}\n\nDatos CSV:\n${text.slice(0, 8000)}`
      );
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Usa imagen (JPG/PNG), Excel (.xlsx) o CSV.' });
    }

    const [dbPricesMap, zones] = await Promise.all([
      getDbPricesMap().catch(() => ({})),
      supabaseRequest(`/zones${qs({ select: 'name,price,polygon' })}`).catch(() => [])
    ]);
    const withPrices = applyPrices(packages, dbPricesMap, zones);
    res.json({ count: withPrices.length, packages: withPrices });
  } catch (err) {
    console.error('Import AI error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function handleConfirm(req, res) {
  try {
    const routeId   = req.params.routeId || null;
    const companyId = req.body.companyId || null;
    const { packages } = req.body;
    if (!packages?.length) return res.status(400).json({ error: 'No hay paquetes para guardar' });
    if (!companyId) return res.status(400).json({ error: 'companyId es requerido' });

    // Cargar zonas una vez para aplicar precios tras geocodificar
    const zones = await supabaseRequest(`/zones${qs({ select: 'name,price,polygon' })}`).catch(() => []);

    let existing = 0;
    if (routeId) {
      const existingRows = await supabaseRequest(`/packages${qs({ route_id: `eq.${routeId}`, select: 'id' })}`);
      existing = existingRows.length;
    }
    const docs = [];
    for (let i = 0; i < packages.length; i++) {
      const { _preview, _suggestedPrice: isSuggested, _flags, ...p } = packages[i];
      const doc = { ...p };
      if ((!doc.lat || !doc.lng) && doc.address) {
        const geo = await geocodeAddress(doc.address, doc.commune);
        if (geo) {
          doc.lat = geo.lat;
          doc.lng = geo.lng;
          // Re-aplicar precio de zona ahora que tenemos coordenadas reales.
          // Solo si el precio fue sugerido automáticamente (no puesto por el usuario).
          if (isSuggested && zones.length) {
            const matched = zones.find(z => {
              const ring = z.polygon?.coordinates?.[0] || z.polygon?.geometry?.coordinates?.[0];
              return ring && pointInPolygon([doc.lng, doc.lat], ring);
            });
            if (matched?.price) doc.price = matched.price;
          }
        }
        await sleep(1100);
      }
      docs.push({
        tracking_id: doc.trackingId || `MUVE${Date.now().toString(36).toUpperCase()}${String(existing + i + 1).padStart(3, '0')}`,
        company_id: companyId,
        route_id: routeId,
        customer_name: doc.customerName || '',
        customer_last_name: doc.customerLastName || '',
        customer_phone: doc.customerPhone || '',
        address: doc.address || '',
        commune: doc.commune || '',
        apt_floor: doc.aptFloor || '',
        zone: doc.zone || '',
        price: Number(doc.price || 0),
        lat: doc.lat || null,
        lng: doc.lng || null,
        stop_order: existing + i,
        status: doc.status || 'pendiente',
        note: doc.note || '',
        ai_flags: _flags || [],
      });
    }
    const created = await supabaseRequest('/packages', { method: 'POST', body: JSON.stringify(docs) });
    if (routeId) await syncRouteStats(routeId);
    return res.status(201).json({ count: created.length, packages: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/import/:routeId/preview — parse file, return preview without saving
router.post('/:routeId/preview', requireAuth, requireRole('admin'), upload.single('file'), handlePreview);

// POST /api/import/:routeId/confirm — save previewed packages, auto-geocode missing coords
router.post('/:routeId/confirm', requireAuth, requireRole('admin'), handleConfirm);

// GET /api/import/price-suggestion?commune=Vitacura
router.get('/price-suggestion', requireAuth, async (req, res) => {
  const dbMap = await getDbPricesMap().catch(() => ({}));
  const key = normalize(req.query.commune);
  const price = dbMap[key] || suggestPrice(req.query.commune);
  res.json({ price, commune: req.query.commune });
});

export default router;
