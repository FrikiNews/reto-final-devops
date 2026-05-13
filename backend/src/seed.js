/**
 * seed.js — Poblar MongoDB con datos de prueba para Zenta
 * Uso: npm run seed
 */
require('dotenv').config();
const connectDB  = require('./config/db');
const Empresa    = require('./models/Empresa');
const User       = require('./models/User');
const Movimiento = require('./models/Movimiento');
const Factura    = require('./models/Factura');
const Alerta     = require('./models/Alerta');
const Proyeccion = require('./models/Proyeccion');
const CuentaCobrar = require('./models/CuentaCobrar');
const XmlSat     = require('./models/XmlSat');

const rand      = (min, max) => Math.random() * (max - min) + min;
const daysAgo   = (n) => new Date(Date.now() - n * 86400000);
const daysLater = (n) => new Date(Date.now() + n * 86400000);

async function seed() {
  await connectDB();

  await Promise.all([
    Empresa.deleteMany({}), User.deleteMany({}), Movimiento.deleteMany({}),
    Factura.deleteMany({}), Alerta.deleteMany({}), Proyeccion.deleteMany({}),
    CuentaCobrar.deleteMany({}), XmlSat.deleteMany({}),
  ]);
  console.log('Colecciones limpiadas');

  // ── Empresa ────────────────────────────────────────────────────────────────
  const empresa = await Empresa.create({
    nombre: 'Tech PyME S.A. de C.V.',
    rfc:    'TPY210101ABC',
    sector: 'Tecnología',
    plan:   'pro',
  });
  console.log(`Empresa: ${empresa.nombre}`);

  // ── Usuario admin ──────────────────────────────────────────────────────────
  await User.create({
    nombre: 'Admin Zenta', email: 'admin@zenta.mx',
    password: 'zenta2024', empresa: empresa._id, rol: 'admin',
  });
  console.log('Usuario: admin@zenta.mx / zenta2024');

  // ── Movimientos (últimos 90 días) ──────────────────────────────────────────
  const movs = [];
  for (let i = 90; i >= 0; i -= 3) {
    movs.push({ empresa: empresa._id, tipo: 'ingreso', monto: rand(45000, 75000), concepto: 'Cobro a cliente',        fecha: daysAgo(i) });
    movs.push({ empresa: empresa._id, tipo: 'egreso',  monto: rand(28000, 42000), concepto: 'Nómina y operaciones',   fecha: daysAgo(i) });
  }
  await Movimiento.insertMany(movs);
  console.log(`${movs.length} movimientos creados`);

  // ── Facturas ───────────────────────────────────────────────────────────────
  await Factura.insertMany([
    { empresa: empresa._id, cliente: 'Grupo Industrial Norte',   numeroFactura: 'F-2024-001', monto: 45000, fechaVencimiento: daysLater(15), estado: 'pendiente' },
    { empresa: empresa._id, cliente: 'Comercial Regio S.A.',     numeroFactura: 'F-2024-002', monto: 28500, fechaVencimiento: daysAgo(5),    estado: 'vencida'   },
    { empresa: empresa._id, cliente: 'Servicios Monterrey S.C.', numeroFactura: 'F-2024-003', monto: 72000, fechaVencimiento: daysLater(30), estado: 'pendiente' },
    { empresa: empresa._id, cliente: 'Constructora del Norte',   numeroFactura: 'F-2024-004', monto: 15000, fechaVencimiento: daysAgo(10),   estado: 'vencida'   },
    { empresa: empresa._id, cliente: 'Logística Express MX',     numeroFactura: 'F-2024-005', monto: 90000, fechaVencimiento: daysLater(7),  estado: 'pendiente' },
    { empresa: empresa._id, cliente: 'Distribuidora Central',    numeroFactura: 'F-2024-006', monto: 33000, fechaVencimiento: daysAgo(20),   estado: 'pagada', fechaCobro: daysAgo(18) },
  ]);
  console.log('6 facturas creadas');

  // ── Alertas ────────────────────────────────────────────────────────────────
  await Alerta.insertMany([
    { empresa: empresa._id, titulo: 'Flujo de caja crítico en 15 días',      descripcion: 'Proyección indica riesgo de liquidez severo si no se cobran facturas pendientes.',  prioridad: 'critica'  },
    { empresa: empresa._id, titulo: '2 facturas vencidas sin cobrar',         descripcion: 'Total en riesgo: $43,500 MXN. Clientes: Comercial Regio y Constructora del Norte.', prioridad: 'atencion' },
    { empresa: empresa._id, titulo: 'Gasto en nómina supera el promedio',     descripcion: '+18% vs. el mes anterior. Revisar horas extra y contrataciones recientes.',         prioridad: 'atencion' },
    { empresa: empresa._id, titulo: 'Nuevo cliente de alto riesgo detectado', descripcion: 'Constructora del Norte tiene historial de pagos tardíos (>30 días).',               prioridad: 'info'     },
  ]);
  console.log('4 alertas creadas');

  // ── Proyecciones ───────────────────────────────────────────────────────────
  await Proyeccion.insertMany([
    { empresa: empresa._id, horizonteDias: 30, flujoNeto:  85000, runwayMeses: 4.2, margenOperativo: 32.5 },
    { empresa: empresa._id, horizonteDias: 60, flujoNeto: 165000, runwayMeses: 5.8, margenOperativo: 30.1 },
    { empresa: empresa._id, horizonteDias: 90, flujoNeto: 240000, runwayMeses: 7.1, margenOperativo: 28.7 },
  ]);
  console.log('3 proyecciones creadas');

  // ── Cuentas por Cobrar ─────────────────────────────────────────────────────
  await CuentaCobrar.insertMany([
    { empresa: empresa._id, cliente: 'Grupo Industrial Norte',   rfc: 'GIN920301XY0', concepto: 'Consultoría Q1 2024',        monto: 68000,  montoAbonado: 20000, fechaVencimiento: daysLater(10), estado: 'vigente'    },
    { empresa: empresa._id, cliente: 'Comercial Regio S.A.',     rfc: 'CRS010203AB1', concepto: 'Licencias software anuales', monto: 45000,  montoAbonado: 0,     fechaVencimiento: daysAgo(8),    estado: 'vencida'    },
    { empresa: empresa._id, cliente: 'Servicios Monterrey S.C.', rfc: 'SMS150701CD2', concepto: 'Desarrollo web fase 2',      monto: 120000, montoAbonado: 60000, fechaVencimiento: daysLater(25), estado: 'vigente'    },
    { empresa: empresa._id, cliente: 'Logística Express MX',     rfc: 'LEM180901EF3', concepto: 'Integración API',            monto: 35000,  montoAbonado: 35000, fechaVencimiento: daysAgo(15),   estado: 'cobrada', fechaCobro: daysAgo(14) },
    { empresa: empresa._id, cliente: 'Constructora del Norte',   rfc: 'CDN200101GH4', concepto: 'Módulo reportes',            monto: 28000,  montoAbonado: 0,     fechaVencimiento: daysAgo(30),   estado: 'vencida'    },
    { empresa: empresa._id, cliente: 'Distribuidora Central',    rfc: 'DCE190501IJ5', concepto: 'Mantenimiento anual',        monto: 18000,  montoAbonado: 9000,  fechaVencimiento: daysLater(5),  estado: 'por_vencer' },
  ]);
  console.log('6 cuentas por cobrar creadas');

  // ── CFDIs SAT ─────────────────────────────────────────────────────────────
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16).toUpperCase();
  });
  await XmlSat.insertMany([
    { empresa: empresa._id, uuid: uuid(), tipo: 'emitido',  rfcEmisor: 'TPY210101ABC', nombreEmisor: 'Tech PyME S.A. de C.V.', rfcReceptor: 'GIN920301XY0', nombreReceptor: 'Grupo Industrial Norte',   folio: 'A001', serie: 'A', fechaTimbrado: daysAgo(5),  subtotal: 58621,  iva: 9379,  total: 68000,  estatusSat: 'vigente' },
    { empresa: empresa._id, uuid: uuid(), tipo: 'emitido',  rfcEmisor: 'TPY210101ABC', nombreEmisor: 'Tech PyME S.A. de C.V.', rfcReceptor: 'CRS010203AB1', nombreReceptor: 'Comercial Regio S.A.',     folio: 'A002', serie: 'A', fechaTimbrado: daysAgo(15), subtotal: 38793,  iva: 6207,  total: 45000,  estatusSat: 'vigente' },
    { empresa: empresa._id, uuid: uuid(), tipo: 'emitido',  rfcEmisor: 'TPY210101ABC', nombreEmisor: 'Tech PyME S.A. de C.V.', rfcReceptor: 'SMS150701CD2', nombreReceptor: 'Servicios Monterrey S.C.', folio: 'A003', serie: 'A', fechaTimbrado: daysAgo(20), subtotal: 103448, iva: 16552, total: 120000, estatusSat: 'cancelacion_en_proceso' },
    { empresa: empresa._id, uuid: uuid(), tipo: 'emitido',  rfcEmisor: 'TPY210101ABC', nombreEmisor: 'Tech PyME S.A. de C.V.', rfcReceptor: 'LEM180901EF3', nombreReceptor: 'Logística Express MX',     folio: 'A004', serie: 'A', fechaTimbrado: daysAgo(45), subtotal: 30172,  iva: 4828,  total: 35000,  estatusSat: 'cancelado' },
    { empresa: empresa._id, uuid: uuid(), tipo: 'recibido', rfcEmisor: 'PRO120601KL6', nombreEmisor: 'Proveedor Software S.A.',  rfcReceptor: 'TPY210101ABC', nombreReceptor: 'Tech PyME S.A. de C.V.', folio: 'B100', serie: 'B', fechaTimbrado: daysAgo(3),  subtotal: 12069,  iva: 1931,  total: 14000,  estatusSat: 'vigente' },
    { empresa: empresa._id, uuid: uuid(), tipo: 'recibido', rfcEmisor: 'ARR090201MN7', nombreEmisor: 'Arrendadora Regia',        rfcReceptor: 'TPY210101ABC', nombreReceptor: 'Tech PyME S.A. de C.V.', folio: 'C050', serie: 'C', fechaTimbrado: daysAgo(10), subtotal: 25862,  iva: 4138,  total: 30000,  estatusSat: 'vigente' },
    { empresa: empresa._id, uuid: uuid(), tipo: 'recibido', rfcEmisor: 'NOM780301OP8', nombreEmisor: 'Nómina Externalizada MX',  rfcReceptor: 'TPY210101ABC', nombreReceptor: 'Tech PyME S.A. de C.V.', folio: 'D001', serie: 'D', fechaTimbrado: daysAgo(30), subtotal: 68966,  iva: 11034, total: 80000,  estatusSat: 'vigente' },
  ]);
  console.log('7 CFDIs SAT creados');

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed fallido:', err);
  process.exit(1);
});
