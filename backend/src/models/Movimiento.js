const mongoose = require('mongoose');

const movimientoSchema = new mongoose.Schema({
  empresa:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  tipo:     { type: String, enum: ['ingreso', 'egreso'], required: true },
  monto:    { type: Number, required: true, min: 0 },
  concepto: { type: String, trim: true },
  fecha:    { type: Date, default: Date.now, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Movimiento', movimientoSchema);
