const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Empresa = require('../models/Empresa');

// GET /api/empresas
router.get('/', auth, async (_req, res) => {
  const empresas = await Empresa.find({ activo: true }).sort({ nombre: 1 });
  res.json(empresas);
});

// GET /api/empresas/:id
router.get('/:id', auth, async (req, res) => {
  const empresa = await Empresa.findById(req.params.id);
  if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
  res.json(empresa);
});

// POST /api/empresas
router.post('/', auth, async (req, res) => {
  try {
    const empresa = await Empresa.create(req.body);
    res.status(201).json(empresa);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'RFC ya registrado' });
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/empresas/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const empresa = await Empresa.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(empresa);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
