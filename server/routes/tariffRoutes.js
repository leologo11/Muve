import { Router } from 'express';
import Tariff from '../models/Tariff.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', async (req, res) => {
  try {
    const tariffs = await Tariff.find().sort({ createdAt: -1 }).lean();
    res.json(tariffs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tariff = await Tariff.findById(req.params.id).lean();
    if (!tariff) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.json(tariff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const tariff = await Tariff.create(req.body);
    res.status(201).json(tariff);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const tariff = await Tariff.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!tariff) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.json(tariff);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Tariff.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const original = await Tariff.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ error: 'Tarifa no encontrada' });
    const { _id, createdAt, updatedAt, __v, ...rest } = original;
    const copy = await Tariff.create({ ...rest, name: rest.name + ' (copia)' });
    res.status(201).json(copy);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
