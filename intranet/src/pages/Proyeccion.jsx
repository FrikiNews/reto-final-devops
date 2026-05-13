import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './Proyeccion.module.css';

const fmt  = (n) => n != null ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n) : '—';
const fmtN = (n, d = 1) => n != null ? n.toFixed(d) : '—';

export default function Proyeccion() {
  const [horizonte, setHorizonte] = useState(30);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const empresaId = JSON.parse(localStorage.getItem('zenta_user') || '{}')?.empresa?._id;

  useEffect(() => {
    if (!empresaId) return;
    setLoading(true);
    setError('');
    api.proyeccion(empresaId, horizonte)
      .then(setData)
      .catch(e => { setError(e.message); setData(null); })
      .finally(() => setLoading(false));
  }, [empresaId, horizonte]);

  return (
    <div className={styles.page}>
      <div className={styles.tabRow}>
        {[30, 60, 90].map(h => (
          <button key={h}
            className={`${styles.tab} ${horizonte === h ? styles.active : ''}`}
            onClick={() => setHorizonte(h)}>
            {h} días
          </button>
        ))}
      </div>

      {loading && <p className={styles.state}>Cargando proyección…</p>}
      {error   && <p className={`${styles.state} ${styles.err}`}>{error}</p>}

      {data && !loading && (
        <>
          <div className={styles.kpiGrid}>
            <KPI label="Flujo neto proyectado"  value={fmt(data.flujoNeto)}               sub={`En ${horizonte} días`} accent={data.flujoNeto >= 0 ? 'green' : 'red'} />
            <KPI label="Runway estimado"         value={`${fmtN(data.runwayMeses)} meses`} sub="Con flujo actual"       accent={data.runwayMeses >= 3 ? 'green' : 'red'} />
            <KPI label="Margen operativo"        value={`${fmtN(data.margenOperativo)}%`}  sub="Sobre ingresos"         accent={data.margenOperativo >= 15 ? 'green' : 'red'} />
          </div>

          <div className={styles.chart}>
            <h3 className={styles.chartTitle}>Proyección visual — {horizonte} días</h3>
            <FakeBars horizonte={horizonte} flujoNeto={data.flujoNeto} />
            <p className={styles.chartNote}>
              Basado en el historial de movimientos y proyecciones registradas en el sistema.
            </p>
          </div>

          {data.supuestos && (
            <div className={styles.supuestos}>
              <h3 className={styles.chartTitle}>Supuestos del modelo</h3>
              <pre className={styles.pre}>{JSON.stringify(data.supuestos, null, 2)}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KPI({ label, value, sub, accent }) {
  return (
    <div className={`${styles.kpi} ${styles[accent]}`}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiVal}>{value}</span>
      <span className={styles.kpiSub}>{sub}</span>
    </div>
  );
}

function FakeBars({ horizonte, flujoNeto }) {
  const bars = Array.from({ length: horizonte }, (_, i) => {
    const trend = (flujoNeto ?? 0) > 0 ? 1 : -1;
    const h = 30 + Math.sin(i * 0.3) * 18 + (i / horizonte) * 20 * trend;
    return { h: Math.max(5, h), pos: h > 0 };
  });

  return (
    <div className={styles.bars}>
      {bars.map((b, i) => (
        <div key={i} className={`${styles.bar} ${b.pos ? styles.barPos : styles.barNeg}`}
          style={{ height: `${b.h}%` }} />
      ))}
    </div>
  );
}
