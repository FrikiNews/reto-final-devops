const mongoose = require('mongoose');

const proyeccionSchema = new mongoose.Schema({
  empresa:         { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  horizonteDias:   { type: Number, enum: [30, 60, 90], required: true },
  flujoNeto:       { type: Number },
  runwayMeses:     { type: Number },
  margenOperativo: { type: Number },
  puntoRiesgo:     { type: Date },
  supuestos:       { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('Proyeccion', proyeccionSchema);
