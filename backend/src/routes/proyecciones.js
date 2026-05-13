const router     = require('express').Router();
const auth       = require('../middleware/auth');
const Proyeccion = require('../models/Proyeccion');

// GET /api/proyecciones/:empresaId?horizonte=30
router.get('/:empresaId', auth, async (req, res) => {
  const horizonte = parseInt(req.query.horizonte ?? 30, 10);
  if (![30, 60, 90].includes(horizonte))
    return res.status(400).json({ error: 'horizonte debe ser 30, 60 o 90' });

  const proj = await Proyeccion.findOne({
    empresa: req.params.empresaId,
    horizonteDias: horizonte,
  }).sort({ createdAt: -1 });

  if (!proj) return res.status(404).json({ error: 'Sin proyección disponible' });
  res.json(proj);
});

// POST /api/proyecciones
router.post('/', auth, async (req, res) => {
  try {
    const proj = await Proyeccion.create(req.body);
    res.status(201).json(proj);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
