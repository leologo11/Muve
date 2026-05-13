import express from 'express';
import { supabaseRequest, qs } from '../utils/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/analytics/track — público, sin auth
router.post('/track', async (req, res) => {
  try {
    const { sessionId, step, serviceType, submitted, device, source } = req.body;
    if (!sessionId || !step) return res.status(400).json({ error: 'sessionId and step required' });

    // on_conflict=session_id → upsert conflicts on the UNIQUE session_id, not the PK
    await supabaseRequest('/analytics_sessions?on_conflict=session_id', {
      method: 'POST',
      body: JSON.stringify({
        session_id:   sessionId,
        service_type: serviceType || null,
        max_step:     Number(step) || 1,
        submitted:    submitted === true,
        device:       device   || null,
        source:       source   || null,
        updated_at:   new Date().toISOString(),
      }),
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });

    res.json({ ok: true });
  } catch (err) {
    // analytics nunca debe bloquear al cliente
    console.error('analytics track error:', err.message);
    res.json({ ok: false });
  }
});

// GET /api/analytics/funnel?days=7 — admin only
router.get('/funnel', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const sessions = await supabaseRequest(
      `/analytics_sessions${qs({
        select:     'max_step,submitted,service_type,device,source,created_at',
        created_at: `gte.${since}`,
        limit:      10000,
      })}`,
    ) || [];

    const total   = sessions.length;
    const step2   = sessions.filter(s => s.max_step >= 2).length;
    const step3   = sessions.filter(s => s.max_step >= 3).length;
    const step4   = sessions.filter(s => s.max_step >= 4).length;
    const submits = sessions.filter(s => s.submitted).length;

    // Por tipo de servicio
    const byService = {};
    for (const s of sessions) {
      const type = s.service_type || 'sin_tipo';
      if (!byService[type]) byService[type] = { sessions: 0, submits: 0 };
      byService[type].sessions++;
      if (s.submitted) byService[type].submits++;
    }

    // Por dispositivo
    const byDevice = {};
    for (const s of sessions) {
      const d = s.device || 'desconocido';
      if (!byDevice[d]) byDevice[d] = { sessions: 0, submits: 0 };
      byDevice[d].sessions++;
      if (s.submitted) byDevice[d].submits++;
    }

    // Por fuente
    const bySource = {};
    for (const s of sessions) {
      const src = s.source || 'desconocido';
      if (!bySource[src]) bySource[src] = { sessions: 0, submits: 0 };
      bySource[src].sessions++;
      if (s.submitted) bySource[src].submits++;
    }

    // Por día (para el gráfico de tendencia)
    const byDay = {};
    for (const s of sessions) {
      const day = (s.created_at || '').slice(0, 10);
      if (!day) continue;
      if (!byDay[day]) byDay[day] = { visits: 0, submits: 0 };
      byDay[day].visits++;
      if (s.submitted) byDay[day].submits++;
    }

    res.json({
      days,
      total,
      funnel: [
        { step: 1, label: 'Visitas',            count: total,   pct: 100 },
        { step: 2, label: 'Eligieron servicio', count: step2,   pct: total ? Math.round(step2   / total * 100) : 0 },
        { step: 3, label: 'Inventario',         count: step3,   pct: total ? Math.round(step3   / total * 100) : 0 },
        { step: 4, label: 'Formulario',         count: step4,   pct: total ? Math.round(step4   / total * 100) : 0 },
        { step: 5, label: 'Cotización enviada', count: submits, pct: total ? Math.round(submits / total * 100) : 0 },
      ],
      byService,
      byDevice,
      bySource,
      byDay,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
