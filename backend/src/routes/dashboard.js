const router     = require('express').Router();
const auth       = require('../middleware/auth');
const { Types }  = require('mongoose');
const Proyeccion = require('../models/Proyeccion');
const Factura    = require('../models/Factura');
const Alerta     = require('../models/Alerta');
const Movimiento = require('../models/Movimiento');

// GET /api/dashboard/:empresaId
router.get('/:empresaId', auth, async (req, res) => {
  try {
    const eid = new Types.ObjectId(req.params.empresaId);
    const hace90dias = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [proyeccion, facturaStats, alertasRaw, movRaw] = await Promise.all([
      Proyeccion.findOne({ empresa: eid, horizonteDias: 30 }).sort({ createdAt: -1 }),

      Factura.aggregate([
        { $match: { empresa: eid, estado: { $in: ['pendiente', 'vencida'] } } },
        { $group: { _id: null, cantidad: { $sum: 1 }, total: { $sum: '$monto' } } },
      ]),

      Alerta.aggregate([
        { $match: { empresa: eid, resuelta: false } },
        { $group: { _id: '$prioridad', count: { $sum: 1 } } },
      ]),

      Movimiento.aggregate([
        { $match: { empresa: eid, fecha: { $gte: hace90dias } } },
        { $group: { _id: '$tipo', total: { $sum: '$monto' } } },
      ]),
    ]);

    const alertas = { critica: 0, atencion: 0, info: 0 };
    alertasRaw.forEach(a => { alertas[a._id] = a.count; });

    const mov = { ingreso: 0, egreso: 0 };
    movRaw.forEach(m => { mov[m._id] = m.total; });
    const margen = mov.ingreso
      ? parseFloat(((mov.ingreso - mov.egreso) / mov.ingreso * 100).toFixed(2))
      : 0;

    res.json({
      runway_meses:       proyeccion?.runwayMeses  ?? null,
      flujo_30d:          proyeccion?.flujoNeto    ?? null,
      facturas_total:     facturaStats[0]?.total   ?? 0,
      facturas_cantidad:  facturaStats[0]?.cantidad ?? 0,
      alertas,
      margen_operativo:   margen,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
