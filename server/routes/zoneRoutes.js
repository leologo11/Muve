import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { PRICES } from '../utils/priceByCommune.js';
import { qs, supabaseRequest } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const PRICE_PROMPT = `Eres un asistente que extrae listas de precios de delivery por comuna en Chile.
Analiza los datos entregados y extrae TODOS los pares (comuna, precio) que encuentres.
Devuelve SOLO un JSON array con objetos {commune, price}:
- commune: nombre de la comuna capitalizado (ej: "Santiago", "Las Condes", "Puente Alto")
- price: precio en CLP como número entero sin puntos ni símbolos
Si hay varias columnas de precios usa la primera o el precio unitario principal.
Devuelve SOLO el array JSON sin texto adicional ni markdown.
Ejemplo: [{"commune":"Santiago","price":4500},{"commune":"Buin","price":12000}]`;

const GEO_URL = 'https://raw.githubusercontent.com/robsalasco/precenso_2016_geojson_chile/master/Comunas_Metropolitana.geojson';

const TIER_COLOR = (price) => {
  if (price <= 2000) return '#2a9940';
  if (price <= 3500) return '#66bb6a';
  if (price <= 5000) return '#f57c00';
  if (price <= 7000) return '#e53935';
  return '#7b1fa2';
};

function norm(s) {
  return (s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function communeName(props) {
  return props?.NOM_COMUNA || props?.NOMBRE || props?.nombre || props?.name || props?.Comuna || '';
}

// GET /api/zones
router.get('/', async (req, res) => {
  try {
    const rows = await supabaseRequest(`/zones${qs({ select: '*', order: 'source.asc,name.asc' })}`);
    return res.json(rows.map(z => ({
      _id: z.id,
      id: z.id,
      name: z.name,
      price: Number(z.price || 0),
      tiers: z.tiers || [],
      color: z.color,
      source: z.source,
      polygon: z.polygon,
      createdAt: z.created_at,
      updatedAt: z.updated_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/zones
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const rows = await supabaseRequest('/zones', {
      method: 'POST',
      body: JSON.stringify({
        name: req.body.name,
        price: Number(req.body.price || 0),
        tiers: req.body.tiers || [],
        color: req.body.color || '#0052FF',
        source: req.body.source || 'custom',
        polygon: req.body.polygon,
      }),
    });
    const z = rows?.[0];
    return res.status(201).json({ ...z, _id: z.id, price: Number(z.price || 0), tiers: z.tiers || [] });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/zones/:id
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const payload = {};
    if (req.body.name !== undefined) payload.name = req.body.name;
    if (req.body.price !== undefined) payload.price = Number(req.body.price);
    if (req.body.tiers !== undefined) payload.tiers = req.body.tiers;
    if (req.body.color !== undefined) payload.color = req.body.color;
    if (req.body.source !== undefined) payload.source = req.body.source;
    if (req.body.polygon !== undefined) payload.polygon = req.body.polygon;
    payload.updated_at = new Date().toISOString();
    const rows = await supabaseRequest(`/zones${qs({ id: `eq.${req.params.id}` })}`, { method: 'PATCH', body: JSON.stringify(payload) });
    if (!rows?.[0]) return res.status(404).json({ error: 'No encontrado' });
    return res.json({ ...rows[0], _id: rows[0].id, price: Number(rows[0].price || 0), tiers: rows[0].tiers || [] });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/zones/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await supabaseRequest(`/zones${qs({ id: `eq.${req.params.id}` })}`, { method: 'DELETE' });
    return res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/zones/communes/all
router.delete('/communes/all', requireRole('admin'), async (req, res) => {
  try {
    const rows = await supabaseRequest(`/zones${qs({ source: 'eq.commune', select: 'id' })}`);
    await supabaseRequest(`/zones${qs({ source: 'eq.commune' })}`, { method: 'DELETE' });
    return res.json({ deleted: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/zones/seed-communes
router.post('/seed-communes', requireRole('admin'), async (req, res) => {
  try {
    let features;
    if (Array.isArray(req.body?.features) && req.body.features.length > 0) {
      features = req.body.features;
    } else {
      const r = await fetch(GEO_URL, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error('No se pudo descargar el mapa de comunas del RM');
      const geoData = await r.json();
      features = geoData.features;
    }

    const configs = await supabaseRequest(`/price_configs${qs({ select: '*' })}`);
    const priceMap = {};
    configs.forEach(c => { priceMap[norm(c.commune)] = Number(c.price || 0); });

    const defaultPrice = PRICES['_default'] || 3500;
    function getPrice(name) {
      return priceMap[norm(name)] || PRICES[norm(name)] || defaultPrice;
    }

    let created = 0, skipped = 0, errors = 0;
    for (const feat of features) {
      const rawName = communeName(feat.properties);
      if (!rawName) continue;
      const name = titleCase(rawName);

      const exists = await supabaseRequest(`/zones${qs({ name: `ilike.${name}`, source: 'eq.commune', select: 'id' })}`);
      if (exists?.length) { skipped++; continue; }

      let polygon;
      if (feat.geometry?.type === 'Polygon') {
        polygon = feat.geometry;
      } else if (feat.geometry?.type === 'MultiPolygon') {
        const largest = feat.geometry.coordinates.reduce((a, b) => a[0].length >= b[0].length ? a : b);
        polygon = { type: 'Polygon', coordinates: largest };
      } else {
        continue;
      }

      const price = getPrice(name);
      try {
        await supabaseRequest('/zones', {
          method: 'POST',
          body: JSON.stringify({ name, price, tiers: [], color: TIER_COLOR(price), source: 'commune', polygon }),
        });
        created++;
      } catch { errors++; }
    }

    res.json({ created, skipped, errors, total: features.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zones/parse-prices-ai — extrae precios de imagen, Excel, CSV o texto con Claude
router.post('/parse-prices-ai', requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    let content;

    if (req.file) {
      const mime = req.file.mimetype;
      const name = req.file.originalname.toLowerCase();

      if (mime.startsWith('image/')) {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const mediaType = allowed.includes(mime) ? mime : 'image/jpeg';
        content = [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: req.file.buffer.toString('base64') } },
          { type: 'text', text: PRICE_PROMPT },
        ];
      } else if (name.match(/\.(xlsx|xls)$/)) {
        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
        content = `${PRICE_PROMPT}\n\nDatos del archivo Excel:\n${csv.slice(0, 8000)}`;
      } else {
        content = `${PRICE_PROMPT}\n\nDatos CSV:\n${req.file.buffer.toString('utf-8').slice(0, 8000)}`;
      }
    } else if (req.body?.text) {
      content = `${PRICE_PROMPT}\n\nLista de precios:\n${String(req.body.text).slice(0, 8000)}`;
    } else {
      return res.status(400).json({ error: 'Requiere archivo o texto' });
    }

    const msg = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    });

    const text = msg.content[0].text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Claude no pudo extraer precios. Intenta con otro formato o archivo más claro.');
    const items = JSON.parse(match[0]);
    res.json({ items, count: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zones/bulk-tiers — actualiza precio + tiers en comunas por nombre
// Body: [{commune, price, tiers: [{minQty, price},...]}]
router.post('/bulk-tiers', requireRole('admin'), async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items) || !items.length)
      return res.status(400).json({ error: 'Array requerido' });

    const zones = await supabaseRequest(`/zones${qs({ source: 'eq.commune', select: 'id,name' })}`);
    let updated = 0;

    for (const item of items) {
      const zone = zones.find(z => norm(z.name) === norm(item.commune));
      if (!zone) continue;
      await supabaseRequest(`/zones${qs({ id: `eq.${zone.id}` })}`, {
        method: 'PATCH',
        body: JSON.stringify({ price: Number(item.price), tiers: item.tiers || [], updated_at: new Date().toISOString() }),
      });
      updated++;
    }

    // Sync price_configs (precio base)
    const priceRows = items.map(({ commune, price }) => ({
      commune: String(commune).trim(),
      price: Number(price),
      zone: '',
      updated_at: new Date().toISOString(),
    }));
    await supabaseRequest('/price_configs?on_conflict=commune', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(priceRows),
    }).catch(() => {});

    res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
