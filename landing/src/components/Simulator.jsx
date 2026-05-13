import { useState } from 'react';
import styles from './Simulator.module.css';

export default function Simulator() {
  const [ingresos, setIngresos]   = useState(120000);
  const [egresos, setEgresos]     = useState(85000);
  const [cxc, setCxc]             = useState(45000);
  const [horizonte, setHorizonte] = useState(30);

  const flujoNeto    = ingresos - egresos;
  const liquidezProy = flujoNeto * (horizonte / 30) + cxc;
  const runway       = liquidezProy > 0 ? (liquidezProy / (egresos || 1) * 30).toFixed(1) : 0;
  const margen       = ingresos ? ((flujoNeto / ingresos) * 100).toFixed(1) : 0;
  const riesgo       = flujoNeto < 0 || runway < 2 ? 'alto' : runway < 4 ? 'medio' : 'bajo';

  const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

  return (
    <section id="simulador" className={`section ${styles.section}`}>
      <div className="container">
        <p className="section-label">Simulador</p>
        <h2 className="section-title">Simula tu flujo de caja en tiempo real</h2>
        <p className="section-sub">Mueve los controles y ve cómo Zenta proyecta la salud financiera de tu empresa.</p>

        <div className={styles.wrapper}>
          {/* Controls */}
          <div className={styles.controls}>
            <SliderField label="Ingresos mensuales" value={ingresos} onChange={setIngresos} min={10000} max={500000} step={5000} fmt={fmt} />
            <SliderField label="Egresos mensuales"  value={egresos}  onChange={setEgresos}  min={5000}  max={500000} step={5000} fmt={fmt} />
            <SliderField label="CxC pendientes"     value={cxc}      onChange={setCxc}      min={0}     max={300000} step={5000} fmt={fmt} />
            <div className={styles.field}>
              <div className={styles.fieldHeader}>
                <span>Horizonte de proyección</span>
                <strong>{horizonte} días</strong>
              </div>
              <div className={styles.tabRow}>
                {[30, 60, 90].map(d => (
                  <button key={d}
                    className={`${styles.tabBtn} ${horizonte === d ? styles.active : ''}`}
                    onClick={() => setHorizonte(d)}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className={styles.results}>
            <div className={`${styles.riskBanner} ${styles[riesgo]}`}>
              <span className={styles.riskDot} />
              Riesgo {riesgo === 'alto' ? 'Alto 🔴' : riesgo === 'medio' ? 'Medio 🟡' : 'Bajo 🟢'}
            </div>
            <div className={styles.kpis}>
              <KPI label="Flujo neto mensual" value={fmt(flujoNeto)} sub={flujoNeto >= 0 ? 'Positivo' : 'Negativo'} ok={flujoNeto >= 0} />
              <KPI label={`Liquidez proy. ${horizonte}d`} value={fmt(liquidezProy)} sub="Estimado" ok={liquidezProy > 0} />
              <KPI label="Runway estimado" value={`${runway} meses`} sub="Con flujo actual" ok={parseFloat(runway) >= 3} />
              <KPI label="Margen operativo" value={`${margen}%`} sub="Sobre ingresos" ok={parseFloat(margen) >= 15} />
            </div>
            <a href="#" className={`btn-primary ${styles.ctaBtn}`}>
              Analizar mi empresa real →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderField({ label, value, onChange, min, max, step, fmt }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHeader}>
        <span>{label}</span>
        <strong>{fmt(value)}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} className={styles.slider} />
    </div>
  );
}

function KPI({ label, value, sub, ok }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={`${styles.kpiValue} ${ok ? styles.ok : styles.bad}`}>{value}</span>
      <span className={styles.kpiSub}>{sub}</span>
    </div>
  );
}
