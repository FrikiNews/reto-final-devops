const mongoose = require('mongoose');

const empresaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  rfc:    { type: String, required: true, unique: true, uppercase: true, trim: true },
  sector: { type: String, trim: true },
  plan:   { type: String, enum: ['basico', 'pro', 'enterprise'], default: 'basico' },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Empresa', empresaSchema);
