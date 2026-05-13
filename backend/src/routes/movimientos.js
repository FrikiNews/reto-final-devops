const router     = require('express').Router();
const auth       = require('../middleware/auth');
const Movimiento = require('../models/Movimiento');

// GET /api/movimientos/:empresaId
router.get('/:empresaId', auth, async (req, res) => {
  const { desde, hasta, tipo, limit = 100 } = req.query;
  const filter = { empresa: req.params.empresaId };

  if (tipo) filter.tipo = tipo;
  if (desde || hasta) {
    filter.fecha = {};
    if (desde) filter.fecha.$gte = new Date(desde);
    if (hasta) filter.fecha.$lte = new Date(hasta);
  }

  const movimientos = await Movimiento.find(filter)
    .sort({ fecha: -1 })
    .limit(parseInt(limit, 10));
  res.json(movimientos);
});

// POST /api/movimientos
router.post('/', auth, async (req, res) => {
  try {
    const mov = await Movimiento.create(req.body);
    res.status(201).json(mov);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/movimientos/:id
router.delete('/:id', auth, async (req, res) => {
  const mov = await Movimiento.findByIdAndDelete(req.params.id);
  if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
  res.json({ message: 'Eliminado' });
});

module.exports = router;
