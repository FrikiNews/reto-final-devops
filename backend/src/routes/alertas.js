const router = require('express').Router();
const auth   = require('../middleware/auth');
const Alerta = require('../models/Alerta');

const PRIO_ORDER = { critica: 1, atencion: 2, info: 3 };

// GET /api/alertas/:empresaId
router.get('/:empresaId', auth, async (req, res) => {
  const { activas = 'true' } = req.query;
  const filter = { empresa: req.params.empresaId };
  if (activas !== 'false') filter.resuelta = false;

  const alertas = await Alerta.find(filter).sort({ createdAt: -1 });
  alertas.sort((a, b) => (PRIO_ORDER[a.prioridad] ?? 4) - (PRIO_ORDER[b.prioridad] ?? 4));
  res.json(alertas);
});

// POST /api/alertas
router.post('/', auth, async (req, res) => {
  try {
    const alerta = await Alerta.create(req.body);
    res.status(201).json(alerta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/alertas/:id/resolver
router.patch('/:id/resolver', auth, async (req, res) => {
  const alerta = await Alerta.findByIdAndUpdate(
    req.params.id, { resuelta: true }, { new: true }
  );
  if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });
  res.json(alerta);
});

module.exports = router;
