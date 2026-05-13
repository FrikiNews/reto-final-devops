const mongoose = require('mongoose');

// Representa un CFDI descargado del SAT (emitido o recibido)
const xmlSatSchema = new mongoose.Schema({
  empresa:        { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  tipo:           { type: String, enum: ['emitido', 'recibido'], required: true, index: true },
  uuid:           { type: String, required: true, trim: true, uppercase: true },
  rfcEmisor:      { type: String, required: true, trim: true, uppercase: true },
  nombreEmisor:   { type: String, trim: true },
  rfcReceptor:    { type: String, required: true, trim: true, uppercase: true },
  nombreReceptor: { type: String, trim: true },
  folio:          { type: String, trim: true },
  serie:          { type: String, trim: true },
  fechaTimbrado:  { type: Date, required: true },
  subtotal:       { type: Number, default: 0 },
  iva:            { type: Number, default: 0 },
  total:          { type: Number, required: true },
  moneda:         { type: String, default: 'MXN' },
  tipoComprobante:{ type: String, enum: ['I', 'E', 'T', 'N', 'P'], default: 'I' }, // Ingreso, Egreso, Traslado, Nómina, Pago
  estatusSat:     { type: String, enum: ['vigente', 'cancelado', 'cancelacion_en_proceso', 'no_encontrado'], default: 'vigente', index: true },
  xmlContenido:   { type: String }, // XML base64 o texto raw
  descargado:     { type: Date, default: Date.now },
}, { timestamps: true });

xmlSatSchema.index({ empresa: 1, uuid: 1 }, { unique: true });

module.exports = mongoose.model('XmlSat', xmlSatSchema);
