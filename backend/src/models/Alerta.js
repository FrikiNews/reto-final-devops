const mongoose = require('mongoose');

const alertaSchema = new mongoose.Schema({
  empresa:     { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  titulo:      { type: String, required: true, trim: true },
  descripcion: { type: String, trim: true },
  prioridad:   { type: String, enum: ['critica', 'atencion', 'info'], default: 'info', index: true },
  resuelta:    { type: Boolean, default: false, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Alerta', alertaSchema);
