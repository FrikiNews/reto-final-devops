const mongoose = require('mongoose');

const cuentaCobrarSchema = new mongoose.Schema({
  empresa:          { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  cliente:          { type: String, required: true, trim: true },
  rfc:              { type: String, trim: true, uppercase: true },
  concepto:         { type: String, required: true, trim: true },
  monto:            { type: Number, required: true, min: 0 },
  montoAbonado:     { type: Number, default: 0, min: 0 },
  fechaEmision:     { type: Date, default: Date.now },
  fechaVencimiento: { type: Date, required: true },
  fechaCobro:       { type: Date },
  diasVencimiento:  { type: Number, default: 0 },
  estado:           { type: String, enum: ['vigente', 'por_vencer', 'vencida', 'cobrada', 'incobrable'], default: 'vigente', index: true },
  notas:            { type: String, trim: true },
}, { timestamps: true });

// Calcula saldo pendiente virtual
cuentaCobrarSchema.virtual('saldo').get(function () {
  return this.monto - this.montoAbonado;
});

cuentaCobrarSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('CuentaCobrar', cuentaCobrarSchema);
