import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Package from '../models/Package.js';
import { syncRouteStats } from './deliveryRoutes.js';
import { suggestPrice, roundPrice } from '../utils/priceByCommune.js';
import { getDbPricesMap } from './priceRoutes.js';
import { geocodeAddress, sleep } from '../utils/geocode.js';
import Zone from '../models/Zone.js';
import { pointInPolygon } from '../utils/zones.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const PARSE_PROMPT = `Eres un asistente que extrae datos de delivery para Chile.
Analiza los datos entregados y extrae TODOS los registros de entrega.

Para cada entrega devuelve un objeto JSON con estos campos exactos (null si no está disponible):
- customerName: string (solo el nombre, sin apellido)
- customerLastName: string (apellido)
- customerPhone: string (teléfono, incluye +56 si lo ves)
- address: string (dirección, SIN número de depto/piso)
- commune: string (comuna exacta de Chile)
- aptFloor: string (Depto, Piso, Casa, Torre, número de dpto — solo esto)
- price: number o null (si hay precio en los datos, de lo contrario null)
- zone: string o null (zona o sector si aparece)
- lat: number o null
- lng: number o null

REGLAS:
- Si el nombre está completo en un campo, separa en customerName y customerLastName
- Normaliza teléfonos chilenos: si empieza con 9 agrégale +569, si con 56 agrégale +
- Devuelve SOLO el array JSON válido, sin texto adicional, sin markdown

Ejemplo de respuesta:
[{"customerName":"María","customerLastName":"González","customerPhone":"+56912345678","address":"Av. Providencia 1100","commune":"Providencia","aptFloor":"Dpto 202","price":null,"zone":null,"lat":null,"lng":null}]`;

async function parseWithClaude(client, content) {
  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    messages: [{ role: 'user', content }]
  });

  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Claude no pudo extraer datos. Intenta con otro formato.');
  return JSON.parse(jsonMatch[0]);
}

function normalize(str) {
  return (str || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function applyPrices(packages, dbPricesMap = {}, zones = []) {
  return packages.map((p, i) => {
    const key = normalize(p.commune);
    const dbPrice = dbPricesMap[key];

    let price = p.price ? roundPrice(p.price) : null;
    if (!price) {
      // Custom zone takes priority over commune price (more specific area)
      if (p.lat && p.lng && zones.length) {
        const zone = zones.find(z => pointInPolygon([p.lng, p.lat], z.polygon.coordinates[0]));
        if (zone) price = zone.price;
      }
      if (!price) price = dbPrice || suggestPrice(p.commune);
    }
    return { ...p, price, _suggestedPrice: !p.price, order: i };
  });
}

// POST /api/import/:routeId/preview — parse file, return preview without saving
router.post('/:routeId/preview', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
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
      // Claude Vision reads the table from the image
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const mediaType = allowedTypes.includes(mime) ? mime : 'image/jpeg';
      const base64 = req.file.buffer.toString('base64');

      packages = await parseWithClaude(client, [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: PARSE_PROMPT }
      ]);

    } else if (isExcel) {
      // Parse xlsx → convert to CSV text → send to Claude
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
      Zone.find().lean().catch(() => [])
    ]);
    const withPrices = applyPrices(packages, dbPricesMap, zones);
    res.json({ count: withPrices.length, packages: withPrices });

  } catch (err) {
    console.error('Import AI error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/:routeId/confirm — save previewed packages, auto-geocode missing coords
router.post('/:routeId/confirm', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { packages } = req.body;
    if (!packages?.length) return res.status(400).json({ error: 'No hay paquetes para guardar' });

    const existing = await Package.countDocuments({ routeId: req.params.routeId });

    // Geocode packages that have no coordinates
    const docs = [];
    for (let i = 0; i < packages.length; i++) {
      const { _preview, _suggestedPrice, ...p } = packages[i];
      const doc = { ...p, routeId: req.params.routeId, order: existing + i };

      if ((!doc.lat || !doc.lng) && doc.address) {
        const geo = await geocodeAddress(doc.address, doc.commune);
        if (geo) { doc.lat = geo.lat; doc.lng = geo.lng; }
        await sleep(1100); // Nominatim rate limit: 1 req/s
      }
      docs.push(doc);
    }

    const created = await Package.insertMany(docs);
    await syncRouteStats(req.params.routeId);
    res.status(201).json({ count: created.length, packages: created });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/import/price-suggestion?commune=Vitacura
router.get('/price-suggestion', requireAuth, async (req, res) => {
  const dbMap = await getDbPricesMap().catch(() => ({}));
  const key = normalize(req.query.commune);
  const price = dbMap[key] || suggestPrice(req.query.commune);
  res.json({ price, commune: req.query.commune });
});

export default router;
