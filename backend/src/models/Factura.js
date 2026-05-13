const mongoose = require('mongoose');

const facturaSchema = new mongoose.Schema({
  empresa:          { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  cliente:          { type: String, required: true, trim: true },
  numeroFactura:    { type: String, required: true, trim: true },
  monto:            { type: Number, required: true, min: 0 },
  fechaEmision:     { type: Date, default: Date.now },
  fechaVencimiento: { type: Date, required: true },
  fechaCobro:       { type: Date },
  estado:           { type: String, enum: ['pendiente', 'vencida', 'pagada', 'cancelada'], default: 'pendiente', index: true },
  notas:            { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Factura', facturaSchema);
