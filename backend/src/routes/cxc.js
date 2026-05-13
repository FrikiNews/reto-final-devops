const router = require('express').Router();
const auth   = require('../middleware/auth');
const CuentaCobrar = require('../models/CuentaCobrar');

router.use(auth);

// GET /api/cxc/:empresaId  — lista con filtros opcionales (?estado=vencida)
router.get('/:empresaId', async (req, res, next) => {
  try {
    const q = { empresa: req.params.empresaId };
    if (req.query.estado) q.estado = req.query.estado;

    // Actualiza estados automáticamente según fecha de vencimiento
    const hoy = new Date();
    const docs = await CuentaCobrar.find(q).sort({ fechaVencimiento: 1 });

    // Mapea diasVencimiento dinámicamente sin guardar (para no saturar escrituras)
    const resultado = docs.map(d => {
      const obj = d.toJSON();
      const diff = Math.floor((hoy - d.fechaVencimiento) / 86400000);
      obj.diasVencimiento = diff > 0 ? diff : 0;
      if (obj.estado === 'vigente' && diff > 0) obj.estado = 'vencida';
      else if (obj.estado === 'vigente' && diff > -8) obj.estado = 'por_vencer';
      return obj;
    });

    res.json(resultado);
  } catch (e) { next(e); }
});

// POST /api/cxc  — nueva cuenta por cobrar
router.post('/', async (req, res, next) => {
  try {
    const doc = await CuentaCobrar.create(req.body);
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

// PATCH /api/cxc/:id  — abonar o cambiar estado
router.patch('/:id', async (req, res, next) => {
  try {
    const doc = await CuentaCobrar.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  } catch (e) { next(e); }
});

// DELETE /api/cxc/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await CuentaCobrar.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
