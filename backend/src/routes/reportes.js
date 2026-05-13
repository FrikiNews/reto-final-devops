const router  = require('express').Router();
const ExcelJS = require('exceljs');
const auth    = require('../middleware/auth');
const XmlSat  = require('../models/XmlSat');
const Movimiento = require('../models/Movimiento');
const Factura    = require('../models/Factura');
const CuentaCobrar = require('../models/CuentaCobrar');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const BORDER = { style: 'thin', color: { argb: 'FFCCCCCC' } };
const CELL_BORDER = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const MXN_FMT = '"$"#,##0.00';
const DATE_FMT = 'dd/mm/yyyy';

function styleHeader(worksheet) {
  worksheet.getRow(1).eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = CELL_BORDER;
  });
  worksheet.getRow(1).height = 22;
}

function styleDataRows(worksheet, rowCount) {
  for (let r = 2; r <= rowCount + 1; r++) {
    const fill = r % 2 === 0
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FB' } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    worksheet.getRow(r).eachCell({ includeEmpty: true }, cell => {
      cell.fill = fill;
      cell.border = CELL_BORDER;
      cell.alignment = { vertical: 'middle' };
    });
    worksheet.getRow(r).height = 18;
  }
}

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

router.use(auth);

// ── GET /api/reportes/:empresaId/resumen  — KPIs generales (para descarga)
router.get('/:empresaId/resumen', async (req, res, next) => {
  try {
    const eid = req.params.empresaId;
    const { desde, hasta } = req.query;
    const dateQ = {};
    if (desde) dateQ.$gte = new Date(desde);
    if (hasta) dateQ.$lte = new Date(hasta);

    const movQ = { empresa: eid, ...(desde || hasta ? { fecha: dateQ } : {}) };

    const [movimientos, facturas, cxc, xmls] = await Promise.all([
      Movimiento.find(movQ).sort({ fecha: -1 }),
      Factura.find({ empresa: eid }),
      CuentaCobrar.find({ empresa: eid }),
      XmlSat.find({ empresa: eid }).sort({ fechaTimbrado: -1 }).limit(100),
    ]);

    const ingresos  = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const egresos   = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    const pendCobro = facturas.filter(f => f.estado === 'pendiente').reduce((s, f) => s + f.monto, 0);
    const cxcTotal  = cxc.filter(c => c.estado !== 'cobrada').reduce((s, c) => s + (c.monto - c.montoAbonado), 0);

    res.json({
      periodo: { desde: desde || null, hasta: hasta || null },
      movimientos: { total: movimientos.length, ingresos, egresos, flujoNeto: ingresos - egresos },
      facturas:    { total: facturas.length, pendienteCobro: pendCobro },
      cxc:         { total: cxc.length, porCobrar: cxcTotal },
      cfdi:        { total: xmls.length, emitidos: xmls.filter(x => x.tipo === 'emitido').length, recibidos: xmls.filter(x => x.tipo === 'recibido').length },
      generadoEn:  new Date(),
    });
  } catch (e) { next(e); }
});

// ── GET /api/reportes/:empresaId/movimientos.xlsx
router.get('/:empresaId/movimientos.xlsx', async (req, res, next) => {
  try {
    const movs = await Movimiento.find({ empresa: req.params.empresaId }).sort({ fecha: -1 });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Zenta';
    const ws = wb.addWorksheet('Movimientos');

    ws.columns = [
      { header: 'Fecha',    key: 'fecha',    width: 14 },
      { header: 'Tipo',     key: 'tipo',     width: 12 },
      { header: 'Concepto', key: 'concepto', width: 40 },
      { header: 'Monto',    key: 'monto',    width: 16 },
    ];

    movs.forEach(m => {
      const row = ws.addRow({
        fecha:    new Date(m.fecha),
        tipo:     m.tipo,
        concepto: m.concepto,
        monto:    m.monto,
      });
      row.getCell('fecha').numFmt = DATE_FMT;
      row.getCell('monto').numFmt = MXN_FMT;
      row.getCell('tipo').font = { color: { argb: m.tipo === 'ingreso' ? 'FF00854A' : 'FFCC0000' } };
    });

    styleHeader(ws);
    styleDataRows(ws, movs.length);
    await sendWorkbook(res, wb, 'movimientos.xlsx');
  } catch (e) { next(e); }
});

// ── GET /api/reportes/:empresaId/facturas.xlsx
router.get('/:empresaId/facturas.xlsx', async (req, res, next) => {
  try {
    const docs = await Factura.find({ empresa: req.params.empresaId }).sort({ fechaEmision: -1 });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Zenta';
    const ws = wb.addWorksheet('Facturas');

    ws.columns = [
      { header: 'Folio',             key: 'folio',     width: 14 },
      { header: 'Cliente',           key: 'cliente',   width: 35 },
      { header: 'Fecha Emisión',     key: 'emision',   width: 16 },
      { header: 'Fecha Vencimiento', key: 'vence',     width: 18 },
      { header: 'Monto',             key: 'monto',     width: 16 },
      { header: 'Estado',            key: 'estado',    width: 14 },
    ];

    docs.forEach(d => {
      const row = ws.addRow({
        folio:   d.numeroFactura,
        cliente: d.cliente,
        emision: new Date(d.fechaEmision),
        vence:   new Date(d.fechaVencimiento),
        monto:   d.monto,
        estado:  d.estado,
      });
      row.getCell('emision').numFmt = DATE_FMT;
      row.getCell('vence').numFmt   = DATE_FMT;
      row.getCell('monto').numFmt   = MXN_FMT;
    });

    styleHeader(ws);
    styleDataRows(ws, docs.length);
    await sendWorkbook(res, wb, 'facturas.xlsx');
  } catch (e) { next(e); }
});

// ── GET /api/reportes/:empresaId/cxc.xlsx
router.get('/:empresaId/cxc.xlsx', async (req, res, next) => {
  try {
    const docs = await CuentaCobrar.find({ empresa: req.params.empresaId }).sort({ fechaVencimiento: 1 });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Zenta';
    const ws = wb.addWorksheet('Cuentas por Cobrar');

    ws.columns = [
      { header: 'Cliente',           key: 'cliente',   width: 35 },
      { header: 'RFC',               key: 'rfc',       width: 16 },
      { header: 'Concepto',          key: 'concepto',  width: 35 },
      { header: 'Monto',             key: 'monto',     width: 16 },
      { header: 'Abonado',           key: 'abonado',   width: 16 },
      { header: 'Saldo Pendiente',   key: 'saldo',     width: 18 },
      { header: 'Fecha Vencimiento', key: 'vence',     width: 18 },
      { header: 'Estado',            key: 'estado',    width: 14 },
    ];

    docs.forEach(d => {
      const saldo = d.monto - d.montoAbonado;
      const row = ws.addRow({
        cliente:  d.cliente,
        rfc:      d.rfc || '',
        concepto: d.concepto,
        monto:    d.monto,
        abonado:  d.montoAbonado,
        saldo,
        vence:    new Date(d.fechaVencimiento),
        estado:   d.estado,
      });
      ['monto','abonado','saldo'].forEach(k => { row.getCell(k).numFmt = MXN_FMT; });
      row.getCell('vence').numFmt = DATE_FMT;
      if (saldo > 0 && new Date(d.fechaVencimiento) < new Date()) {
        row.getCell('saldo').font = { bold: true, color: { argb: 'FFCC0000' } };
      }
    });

    styleHeader(ws);
    styleDataRows(ws, docs.length);
    await sendWorkbook(res, wb, 'cxc.xlsx');
  } catch (e) { next(e); }
});

module.exports = router;
