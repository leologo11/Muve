import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Package from '../models/Package.js';
import { syncRouteStats } from './deliveryRoutes.js';
import { suggestPrice, roundPrice } from '../utils/priceByCommune.js';

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

function applyPrices(packages) {
  return packages.map((p, i) => ({
    ...p,
    price: p.price ? roundPrice(p.price) : suggestPrice(p.commune),
    _suggestedPrice: !p.price,
    order: i
  }));
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

    const withPrices = applyPrices(packages);
    res.json({ count: withPrices.length, packages: withPrices });

  } catch (err) {
    console.error('Import AI error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/:routeId/confirm — save previewed packages to DB
router.post('/:routeId/confirm', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { packages } = req.body;
    if (!packages?.length) return res.status(400).json({ error: 'No hay paquetes para guardar' });

    const existing = await Package.countDocuments({ routeId: req.params.routeId });
    const docs = packages.map((p, i) => {
      const { _preview, _suggestedPrice, ...rest } = p;
      return { ...rest, routeId: req.params.routeId, order: existing + i };
    });

    const created = await Package.insertMany(docs);
    await syncRouteStats(req.params.routeId);
    res.status(201).json({ count: created.length, packages: created });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/import/price-suggestion?commune=Vitacura
router.get('/price-suggestion', requireAuth, (req, res) => {
  const price = suggestPrice(req.query.commune);
  res.json({ price, commune: req.query.commune });
});

export default router;
