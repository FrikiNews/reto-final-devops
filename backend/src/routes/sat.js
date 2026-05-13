const router       = require('express').Router();
const auth         = require('../middleware/auth');
const XmlSat       = require('../models/XmlSat');
const EfirmaConfig = require('../models/EfirmaConfig');
const { decryptString, encrypt } = require('../utils/crypto');
const satSoap = require('../services/satSoap');

router.use(auth);

// ── Helper: obtener token SAT vigente (o renovarlo) ────────────────────────
async function obtenerTokenSat(cfg) {
  // Si el token existe y le quedan más de 60 segundos de vida, reutilizarlo
  if (cfg.tokenSatEnc && cfg.tokenSatExpira && cfg.tokenSatExpira > new Date(Date.now() + 60000)) {
    return decryptString(cfg.tokenSatEnc, cfg.tokenSatIv);
  }
  // Renovar
  const llavePrivada = decryptString(cfg.llavePrivadaEnc, cfg.llavePrivadaIv);
  const contrasena   = decryptString(cfg.contrasenaEnc,   cfg.contrasenaIv);
  const token        = await satSoap.autenticarSat(cfg.certificadoB64, llavePrivada, contrasena);
  const tokenEnc     = encrypt(token);
  const expira       = new Date(Date.now() + 4 * 60 * 1000);
  await EfirmaConfig.updateOne({ _id: cfg._id }, {
    tokenSatEnc: tokenEnc.enc, tokenSatIv: tokenEnc.iv, tokenSatExpira: expira,
  });
  return token;
}

// ── POST /api/sat/sincronizar/:empresaId — descarga masiva real del SAT ────
router.post('/sincronizar/:empresaId', async (req, res, next) => {
  try {
    const eid = req.params.empresaId;
    const cfg = await EfirmaConfig.findOne({ empresa: eid, activo: true });
    if (!cfg) return res.status(400).json({ error: 'e.firma no configurada para esta empresa. Configúrala en tu Perfil.' });

    const { fechaInicio, fechaFin, tipo = 'ambos' } = req.body;
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin son requeridos (YYYY-MM-DDTHH:mm:ss)' });

    const llavePrivada = decryptString(cfg.llavePrivadaEnc, cfg.llavePrivadaIv);
    const contrasena   = decryptString(cfg.contrasenaEnc,   cfg.contrasenaIv);
    const { certDerB64, privateKey } = satSoap.parsarCredenciales(cfg.certificadoB64, llavePrivada, contrasena);

    const token = await obtenerTokenSat(cfg);

    let totalNuevos = 0;
    const errores   = [];
    const tiposADescargar = tipo === 'ambos' ? ['emitido', 'recibido'] : [tipo];

    for (const tipoActual of tiposADescargar) {
      try {
        const params = {
          fechaInicio,
          fechaFin,
          rfcEmisor:    tipoActual === 'emitido'  ? cfg.rfc : undefined,
          rfcReceptor:  tipoActual === 'recibido' ? cfg.rfc : undefined,
          tipoSolicitud: 'CFDI',
        };

        // 1. Solicitar descarga
        const { idSolicitud } = await satSoap.solicitarDescarga(token, cfg.rfc, certDerB64, privateKey, params);

        // 2. Verificar (polling interno)
        const { idsPaquetes } = await satSoap.verificarSolicitud(token, idSolicitud, cfg.rfc, certDerB64, privateKey);

        // 3. Descargar y parsear cada paquete
        for (const idPaquete of idsPaquetes) {
          const zipBuffer = await satSoap.descargarPaquete(token, idPaquete, cfg.rfc, certDerB64, privateKey);
          const cfdis     = satSoap.parsearZipCfdis(zipBuffer, eid, tipoActual);

          for (const cfdi of cfdis) {
            await XmlSat.findOneAndUpdate(
              { empresa: eid, uuid: cfdi.uuid },
              cfdi,
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            totalNuevos++;
          }
        }
      } catch (e) {
        errores.push({ tipo: tipoActual, error: e.message });
      }
    }

    // Actualizar última sincronización
    await EfirmaConfig.updateOne({ _id: cfg._id }, {
      ultimaSincronizacion: new Date(),
      ultimoError: errores.length > 0 ? errores.map(e => `${e.tipo}: ${e.error}`).join(' | ') : null,
    });

    res.json({
      ok: true,
      sincronizados: totalNuevos,
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (e) { next(e); }
});

// ── POST /api/sat/token/:empresaId — renovar/obtener token SAT (usado al login)
router.post('/token/:empresaId', async (req, res, next) => {
  try {
    const cfg = await EfirmaConfig.findOne({ empresa: req.params.empresaId, activo: true });
    if (!cfg) return res.json({ ok: false, motivo: 'sin_efirma' });
    const token = await obtenerTokenSat(cfg);
    res.json({ ok: true, tokenExpira: cfg.tokenSatExpira });
  } catch (e) {
    await EfirmaConfig.updateOne({ empresa: req.params.empresaId }, { ultimoError: e.message }).catch(() => {});
    res.json({ ok: false, motivo: e.message });
  }
});

// GET /api/sat/xml/:empresaId  — lista CFDIs con filtros
router.get('/xml/:empresaId', async (req, res, next) => {
  try {
    const q = { empresa: req.params.empresaId };
    if (req.query.tipo)       q.tipo       = req.query.tipo;
    if (req.query.estatus)    q.estatusSat = req.query.estatus;
    if (req.query.desde)      q.fechaTimbrado = { $gte: new Date(req.query.desde) };
    if (req.query.hasta)      q.fechaTimbrado = { ...q.fechaTimbrado, $lte: new Date(req.query.hasta) };

    const docs = await XmlSat.find(q, '-xmlContenido').sort({ fechaTimbrado: -1 }).limit(200);
    res.json(docs);
  } catch (e) { next(e); }
});

// POST /api/sat/xml  — registrar/importar un CFDI
router.post('/xml', async (req, res, next) => {
  try {
    const doc = await XmlSat.findOneAndUpdate(
      { empresa: req.body.empresa, uuid: req.body.uuid.toUpperCase() },
      req.body,
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

// GET /api/sat/xml/:empresaId/:id/download  — descarga el XML raw
router.get('/xml/:empresaId/:id/download', async (req, res, next) => {
  try {
    const doc = await XmlSat.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    if (!doc.xmlContenido) return res.status(404).json({ error: 'XML no disponible' });
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.uuid}.xml"`);
    res.send(doc.xmlContenido);
  } catch (e) { next(e); }
});

// PATCH /api/sat/xml/:id/estatus  — actualizar estatus SAT (cancelación, etc.)
router.patch('/xml/:id/estatus', async (req, res, next) => {
  try {
    const { estatusSat } = req.body;
    const doc = await XmlSat.findByIdAndUpdate(req.params.id, { estatusSat }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  } catch (e) { next(e); }
});

// DELETE /api/sat/xml/:id
router.delete('/xml/:id', async (req, res, next) => {
  try {
    await XmlSat.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/sat/estatus/:empresaId  — resumen de estatus ante el SAT
router.get('/estatus/:empresaId', async (req, res, next) => {
  try {
    const eid = req.params.empresaId;
    const [emitidos, recibidos] = await Promise.all([
      XmlSat.find({ empresa: eid, tipo: 'emitido' }, '-xmlContenido').sort({ fechaTimbrado: -1 }),
      XmlSat.find({ empresa: eid, tipo: 'recibido' }, '-xmlContenido').sort({ fechaTimbrado: -1 }),
    ]);

    const resumen = (arr) => ({
      total: arr.length,
      vigentes:            arr.filter(x => x.estatusSat === 'vigente').length,
      cancelados:          arr.filter(x => x.estatusSat === 'cancelado').length,
      cancelacionProceso:  arr.filter(x => x.estatusSat === 'cancelacion_en_proceso').length,
      noEncontrados:       arr.filter(x => x.estatusSat === 'no_encontrado').length,
      totalMonto:          arr.reduce((s, x) => s + x.total, 0),
    });

    res.json({
      emitidos: { ...resumen(emitidos), docs: emitidos.slice(0, 50) },
      recibidos: { ...resumen(recibidos), docs: recibidos.slice(0, 50) },
    });
  } catch (e) { next(e); }
});

module.exports = router;
