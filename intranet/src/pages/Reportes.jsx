import { useState } from 'react';
import styles from './Reportes.module.css';

const BASE = import.meta.env.VITE_API_URL || '/api';

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);

const REPORTES = [
  {
    id: 'movimientos',
    titulo: 'Movimientos',
    desc: 'Historial completo de ingresos y egresos registrados.',
    endpoint: (eid) => `${BASE}/reportes/${eid}/movimientos.xlsx`,
    filename: 'movimientos.xlsx',
  },
  {
    id: 'facturas',
    titulo: 'Facturas',
    desc: 'Todas las facturas emitidas con estado de cobro.',
    endpoint: (eid) => `${BASE}/reportes/${eid}/facturas.xlsx`,
    filename: 'facturas.xlsx',
  },
  {
    id: 'cxc',
    titulo: 'Cuentas por Cobrar',
    desc: 'Saldos pendientes, abonos realizados y fechas de vencimiento.',
    endpoint: (eid) => `${BASE}/reportes/${eid}/cxc.xlsx`,
    filename: 'cxc.xlsx',
  },
];

export default function Reportes() {
  const user     = JSON.parse(localStorage.getItem('zenta_user') || '{}');
  const empresaId = user?.empresa?._id;
  const token    = localStorage.getItem('zenta_token');

  const [resumen, setResumen]   = useState(null);
  const [loadRes, setLoadRes]   = useState(false);
  const [desde, setDesde]       = useState('');
  const [hasta, setHasta]       = useState('');
  const [descargando, setDescargando] = useState('');

  const cargarResumen = async () => {
    if (!empresaId) return;
    setLoadRes(true);
    try {
      const q = new URLSearchParams();
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      const res = await fetch(`${BASE}/reportes/${empresaId}/resumen?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setResumen(data);
    } finally {
      setLoadRes(false);
    }
  };

  const descargarCSV = async (reporte) => {
    if (!empresaId) return;
    setDescargando(reporte.id);
    try {
      const res = await fetch(reporte.endpoint(empresaId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = reporte.filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando('');
    }
  };

  return (
    <div className={styles.page}>
      {/* Filtro de periodo */}
      <div className={styles.periodo}>
        <h3 className={styles.sectionTitle}>Resumen de periodo</h3>
        <div className={styles.periodoRow}>
          <div className={styles.field}>
            <label>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <button className="btn btn-green" onClick={cargarResumen} disabled={loadRes}>
            {loadRes ? 'Calculando…' : 'Generar resumen'}
          </button>
        </div>

        {resumen && (
          <div className={styles.resumenGrid}>
            <div className={styles.resumenCard}>

              <div>
                <p className={styles.resumenTitle}>Flujo Neto</p>
                <p className={`${styles.resumenVal} ${resumen.movimientos.flujoNeto >= 0 ? styles.green : styles.red}`}>
                  {fmt(resumen.movimientos.flujoNeto)}
                </p>
                <p className={styles.resumenSub}>{resumen.movimientos.total} movimientos</p>
              </div>
            </div>
            <div className={styles.resumenCard}>

              <div>
                <p className={styles.resumenTitle}>Ingresos</p>
                <p className={`${styles.resumenVal} ${styles.green}`}>{fmt(resumen.movimientos.ingresos)}</p>
              </div>
            </div>
            <div className={styles.resumenCard}>

              <div>
                <p className={styles.resumenTitle}>Egresos</p>
                <p className={`${styles.resumenVal} ${styles.red}`}>{fmt(resumen.movimientos.egresos)}</p>
              </div>
            </div>
            <div className={styles.resumenCard}>

              <div>
                <p className={styles.resumenTitle}>Pendiente cobro</p>
                <p className={styles.resumenVal}>{fmt(resumen.facturas.pendienteCobro)}</p>
                <p className={styles.resumenSub}>{resumen.facturas.total} facturas</p>
              </div>
            </div>
            <div className={styles.resumenCard}>

              <div>
                <p className={styles.resumenTitle}>CxC por cobrar</p>
                <p className={styles.resumenVal}>{fmt(resumen.cxc.porCobrar)}</p>
                <p className={styles.resumenSub}>{resumen.cxc.total} cuentas</p>
              </div>
            </div>
            <div className={styles.resumenCard}>

              <div>
                <p className={styles.resumenTitle}>CFDIs SAT</p>
                <p className={styles.resumenVal}>{resumen.cfdi.total}</p>
                <p className={styles.resumenSub}>{resumen.cfdi.emitidos} emit. · {resumen.cfdi.recibidos} recib.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Descargas CSV */}
      <div>
        <h3 className={styles.sectionTitle}>Exportar datos (CSV)</h3>
        <div className={styles.descargasGrid}>
          {REPORTES.map(r => (
            <div key={r.id} className={styles.descargaCard}>
              <div className={styles.descargaInfo}>
                <p className={styles.descargaTitulo}>{r.titulo}</p>
                <p className={styles.descargaDesc}>{r.desc}</p>
              </div>
              <button
                className={`btn btn-green ${styles.descargaBtn}`}
                onClick={() => descargarCSV(r)}
                disabled={descargando === r.id}
              >
                {descargando === r.id ? 'Descargando…' : 'Descargar Excel'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className={styles.hint}>
        Los archivos CSV son compatibles con Excel, Google Sheets y cualquier herramienta de análisis.
      </p>
    </div>
  );
}
