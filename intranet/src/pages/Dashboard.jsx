import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './Dashboard.module.css';

const fmt  = (n) => n != null ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n) : '—';
const fmtN = (n) => n != null ? n.toFixed(1) : '—';

export default function Dashboard() {
  const [data, setData]     = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(true);

  const empresaId = JSON.parse(localStorage.getItem('zenta_user') || '{}')?.empresa?._id;

  useEffect(() => {
    if (!empresaId) { setError('No hay empresa asociada'); setLoading(false); return; }
    api.dashboard(empresaId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [empresaId]);

  if (loading) return <div className={styles.state}>Cargando dashboard…</div>;
  if (error)   return <div className={`${styles.state} ${styles.err}`}>{error}</div>;

  const alertTotal = (data.alertas?.critica ?? 0) + (data.alertas?.atencion ?? 0) + (data.alertas?.info ?? 0);

  const kpis = [
    { label: 'Runway estimado',      value: `${fmtN(data.runway_meses)} meses`, sub: 'Con flujo actual', ok: (data.runway_meses ?? 0) >= 3 },
    { label: 'Flujo neto (30d)',      value: fmt(data.flujo_30d),               sub: 'Proyección a 30 días', ok: (data.flujo_30d ?? 0) >= 0 },
    { label: 'Facturas por cobrar',   value: fmt(data.facturas_total),          sub: `${data.facturas_cantidad} facturas`, ok: data.facturas_cantidad === 0 },
    { label: 'Margen operativo',      value: `${data.margen_operativo ?? 0}%`,  sub: 'Últimos 90 días', ok: (data.margen_operativo ?? 0) >= 15 },
    { label: 'Alertas activas',       value: alertTotal,                        sub: `${data.alertas?.critica ?? 0} críticas`, ok: (data.alertas?.critica ?? 0) === 0 },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} className={`${styles.kpi} ${k.ok ? styles.kpiOk : styles.kpiBad}`}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>{k.label}</span>
            </div>
            <div className={styles.kpiVal}>{k.value}</div>
            <div className={styles.kpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Alerts summary */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Resumen de alertas</h2>
        <div className={styles.alertBars}>
          <AlertBar label="Críticas"  count={data.alertas?.critica  ?? 0} color="#ff5050" />
          <AlertBar label="Atención"  count={data.alertas?.atencion ?? 0} color="#ffc107" />
          <AlertBar label="Info"      count={data.alertas?.info     ?? 0} color="#63b3ed" />
        </div>
      </div>

      {/* Quick links */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Acciones rápidas</h2>
        <div className={styles.quickLinks}>
          {[
            { label: 'Ver facturas',     to: '/facturas'    },
            { label: 'Ver alertas',      to: '/alertas'     },
            { label: 'Proyección',       to: '/proyeccion'  },
            { label: 'Movimientos',      to: '/movimientos' },
          ].map(q => (
            <a key={q.to} href={q.to} className={styles.quickLink}>
              <span>{q.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertBar({ label, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: '.8rem', color: 'var(--muted)', width: 70 }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--card-bg2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(count * 20, 100)}%`, background: color, borderRadius: 4, transition: 'width .5s' }} />
      </div>
      <span style={{ fontSize: '.875rem', fontWeight: 700, color, minWidth: 20 }}>{count}</span>
    </div>
  );
}
