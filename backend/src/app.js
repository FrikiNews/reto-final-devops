require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const connectDB = require('./config/db');

const app = express();

connectDB();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/empresas',     require('./routes/empresas'));
app.use('/api/movimientos',  require('./routes/movimientos'));
app.use('/api/facturas',     require('./routes/facturas'));
app.use('/api/alertas',      require('./routes/alertas'));
app.use('/api/proyecciones', require('./routes/proyecciones'));
app.use('/api/cxc',          require('./routes/cxc'));
app.use('/api/sat',          require('./routes/sat'));
app.use('/api/reportes',     require('./routes/reportes'));
app.use('/api/efirma',       require('./routes/efirma'));

// ── Health-check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀  Zenta API on port ${PORT}`));
