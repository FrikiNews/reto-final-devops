const mongoose = require('mongoose');

/**
 * Almacena la configuración de e.firma del SAT por empresa.
 * La llave privada y la contraseña se guardan CIFRADAS con AES-256-CBC.
 * El token SAT (WRAP) se guarda cifrado y tiene TTL de 5 minutos.
 * El frontend NUNCA recibe la llave privada, la contraseña ni el token.
 */
const efirmaConfigSchema = new mongoose.Schema({
  empresa:       { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, unique: true },
  rfc:           { type: String, required: true, trim: true, uppercase: true },

  // Certificado público (.cer) en base64 — no es dato sensible pero se guarda aquí por conveniencia
  certificadoB64: { type: String, required: true },

  // Llave privada (.key) cifrada con AES-256-CBC
  llavePrivadaEnc: { type: String, required: true },
  llavePrivadaIv:  { type: String, required: true },

  // Contraseña de la llave privada cifrada con AES-256-CBC
  contrasenaEnc: { type: String, required: true },
  contrasenaIv:  { type: String, required: true },

  // Token WRAP obtenido del SAT (cifrado, TTL ~5min)
  tokenSatEnc:     { type: String, default: null },
  tokenSatIv:      { type: String, default: null },
  tokenSatExpira:  { type: Date,   default: null },

  activo:           { type: Boolean, default: true },
  ultimaSincronizacion: { type: Date, default: null },
  ultimoError:      { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('EfirmaConfig', efirmaConfigSchema);
