const router       = require('express').Router();
const jwt          = require('jsonwebtoken');
const User         = require('../models/User');
const EfirmaConfig = require('../models/EfirmaConfig');
const { decryptString, encrypt } = require('../utils/crypto');
const satSoap      = require('../services/satSoap');

// Renueva el token SAT en background (sin bloquear la respuesta de login)
async function renovarTokenSatBackground(empresaId) {
  try {
    const cfg = await EfirmaConfig.findOne({ empresa: empresaId, activo: true });
    if (!cfg) return;
    // Solo renovar si está por expirar o ya expiró
    if (cfg.tokenSatExpira && cfg.tokenSatExpira > new Date(Date.now() + 60000)) return;

    const llavePrivada = decryptString(cfg.llavePrivadaEnc, cfg.llavePrivadaIv);
    const contrasena   = decryptString(cfg.contrasenaEnc,   cfg.contrasenaIv);
    const token        = await satSoap.autenticarSat(cfg.certificadoB64, llavePrivada, contrasena);
    const tokenEnc     = encrypt(token);
    await EfirmaConfig.updateOne({ _id: cfg._id }, {
      tokenSatEnc:    tokenEnc.enc,
      tokenSatIv:     tokenEnc.iv,
      tokenSatExpira: new Date(Date.now() + 4 * 60 * 1000),
      ultimoError:    null,
    });
    console.log(`[SAT] Token renovado para empresa ${empresaId}`);
  } catch (e) {
    console.warn(`[SAT] No se pudo renovar token para empresa ${empresaId}: ${e.message}`);
    await EfirmaConfig.updateOne({ empresa: empresaId }, { ultimoError: e.message }).catch(() => {});
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const user = await User.findOne({ email }).populate('empresa');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user._id, empresa: user.empresa?._id, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Responder inmediatamente y renovar token SAT en background
    res.json({ token, user });

    if (user.empresa?._id) {
      renovarTokenSatBackground(user.empresa._id.toString());
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, empresaId } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).json({ error: 'nombre, email y password requeridos' });

    const user = await User.create({ nombre, email, password, empresa: empresaId });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'Email ya registrado' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  const user = await User.findById(req.user.id).populate('empresa');
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

module.exports = router;
