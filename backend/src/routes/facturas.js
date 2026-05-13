const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Factura = require('../models/Factura');

// GET /api/facturas/:empresaId
router.get('/:empresaId', auth, async (req, res) => {
  const { estado } = req.query;
  const filter = { empresa: req.params.empresaId };
  if (estado) filter.estado = estado;

  const facturas = await Factura.find(filter).sort({ fechaVencimiento: 1 });
  res.json(facturas);
});

// POST /api/facturas
router.post('/', auth, async (req, res) => {
  try {
    const factura = await Factura.create(req.body);
    res.status(201).json(factura);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/facturas/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const factura = await Factura.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(factura);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/facturas/:id
router.delete('/:id', auth, async (req, res) => {
  const factura = await Factura.findByIdAndDelete(req.params.id);
  if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json({ message: 'Eliminada' });
});

module.exports = router;
