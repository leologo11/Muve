import { Router } from 'express';
import Company from '../models/Company.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/companies
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const companies = await Company.find({ active: true }).lean();
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const company = await Company.create(req.body);
    res.status(201).json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/companies/:id
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await Company.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
