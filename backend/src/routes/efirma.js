/**
 * routes/efirma.js
 * Gestión de la e.firma del SAT por empresa.
 * SEGURIDAD: la llave privada y contraseña se cifran con AES-256-CBC.
 * El GET nunca devuelve datos sensibles.
 */
const router       = require('express').Router();
const auth         = require('../middleware/auth');
const EfirmaConfig = require('../models/EfirmaConfig');
const { encrypt, decryptString } = require('../utils/crypto');
const { parsarCredenciales, autenticarSat } = require('../services/satSoap');

router.use(auth);

// ── GET /api/efirma/:empresaId — solo metadatos, sin datos sensibles
router.get('/:empresaId', async (req, res, next) => {
  try {
    const cfg = await EfirmaConfig.findOne({ empresa: req.params.empresaId });
    if (!cfg) return res.json({ configurado: false });

    res.json({
      configurado:          true,
      rfc:                  cfg.rfc,
      ultimaSincronizacion: cfg.ultimaSincronizacion,
      ultimoError:          cfg.ultimoError,
      tokenVigente:         cfg.tokenSatExpira ? cfg.tokenSatExpira > new Date() : false,
      activo:               cfg.activo,
    });
  } catch (e) { next(e); }
});

// ── POST /api/efirma — guardar o actualizar e.firma
// Body (multipart no soportado aquí, recibimos base64 desde el frontend):
// { rfc, certificadoB64, llavePrivadaB64, contrasena }
router.post('/', async (req, res, next) => {
  try {
    const { rfc, certificadoB64, llavePrivadaB64, contrasena, empresaId } = req.body;

    if (!rfc || !certificadoB64 || !llavePrivadaB64 || !contrasena || !empresaId) {
      return res.status(400).json({ error: 'RFC, certificado (.cer), llave (.key) y contraseña son requeridos' });
    }

    // Validar que el certificado y la llave sean correctos antes de guardar
    try {
      parsarCredenciales(certificadoB64, llavePrivadaB64, contrasena);
    } catch (e) {
      return res.status(422).json({ error: `Credenciales inválidas: ${e.message}` });
    }

    // Cifrar llave privada y contraseña
    const llaveEnc  = encrypt(llavePrivadaB64);
    const passEnc   = encrypt(contrasena);

    const cfg = await EfirmaConfig.findOneAndUpdate(
      { empresa: empresaId },
      {
        empresa:         empresaId,
        rfc:             rfc.toUpperCase().trim(),
        certificadoB64,
        llavePrivadaEnc: llaveEnc.enc,
        llavePrivadaIv:  llaveEnc.iv,
        contrasenaEnc:   passEnc.enc,
        contrasenaIv:    passEnc.iv,
        activo:          true,
        ultimoError:     null,
        // Limpiar token anterior al actualizar credenciales
        tokenSatEnc:     null,
        tokenSatIv:      null,
        tokenSatExpira:  null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true, rfc: cfg.rfc });
  } catch (e) { next(e); }
});

// ── POST /api/efirma/:empresaId/probar — probar conexión con el SAT
router.post('/:empresaId/probar', async (req, res, next) => {
  try {
    const cfg = await EfirmaConfig.findOne({ empresa: req.params.empresaId });
    if (!cfg) return res.status(404).json({ error: 'e.firma no configurada' });

    const llavePrivada = decryptString(cfg.llavePrivadaEnc, cfg.llavePrivadaIv);
    const contrasena   = decryptString(cfg.contrasenaEnc,   cfg.contrasenaIv);

    const token = await autenticarSat(cfg.certificadoB64, llavePrivada, contrasena);

    // Guardar token cifrado
    const tokenEnc = encrypt(token);
    const expira   = new Date(Date.now() + 4 * 60 * 1000); // 4 min de margen
    await EfirmaConfig.updateOne({ _id: cfg._id }, {
      tokenSatEnc:    tokenEnc.enc,
      tokenSatIv:     tokenEnc.iv,
      tokenSatExpira: expira,
      ultimoError:    null,
    });

    res.json({ ok: true, mensaje: 'Conexión exitosa con el SAT', tokenExpira: expira });
  } catch (e) {
    // Guardar el error para mostrarlo en el perfil
    await EfirmaConfig.updateOne({ empresa: req.params.empresaId }, { ultimoError: e.message }).catch(() => {});
    next(e);
  }
});

// ── DELETE /api/efirma/:empresaId — eliminar configuración
router.delete('/:empresaId', async (req, res, next) => {
  try {
    await EfirmaConfig.deleteOne({ empresa: req.params.empresaId });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
