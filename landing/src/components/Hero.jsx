import { useState, useEffect } from 'react';
import styles from './Hero.module.css';

const generateBars = (days) => {
  const bars = [];
  for (let i = 0; i < days; i++) {
    const h = 30 + Math.sin(i * 0.3) * 20 + Math.random() * 15;
    const positive = i < days * 0.75;
    bars.push({ h, positive });
  }
  return bars;
};

export default function Hero() {
  const [tab, setTab] = useState(30);
  const [bars, setBars] = useState(() => generateBars(30));

  useEffect(() => {
    setBars(generateBars(tab));
  }, [tab]);

  return (
    <section className={styles.hero}>
      <div className={`container ${styles.inner}`}>
        {/* Copy */}
        <div className={styles.copy}>
          <div className={styles.badge}>✦ Inteligencia Financiera Predictiva</div>
          <h1 className={styles.h1}>
            Sabe cuándo llegará tu <em className={styles.em}>próxima crisis</em> antes de que pase
          </h1>
          <p className={styles.desc}>
            Zenta proyecta tu flujo de caja a 90 días. Detectamos señales de riesgo
            semanas antes para que actúes con tiempo, no con pánico.
          </p>
          <div className={styles.actions}>
            <a href="#simulador" className="btn-primary">Simular mi empresa gratis</a>
            <a href="#como-funciona" className="btn-ghost">Ver cómo funciona →</a>
          </div>
          <div className={styles.proof}>
            <div className={styles.avatars}>
              {['JR', 'AM', 'CL', '+'].map(av => (
                <div key={av} className={styles.av}>{av}</div>
              ))}
            </div>
            <p className={styles.proofText}>
              <strong>+1,200 PyMEs</strong> ya toman decisiones con Zenta en México
            </p>
          </div>
        </div>

        {/* Chart widget */}
        <div className={styles.chartWidget}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>📊 Proyección de Flujo de Caja</span>
            <div className={styles.tabs}>
              {[30, 60, 90].map(d => (
                <button
                  key={d}
                  className={`${styles.tab} ${tab === d ? styles.active : ''}`}
                  onClick={() => setTab(d)}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className={styles.bars}>
            {bars.map((b, i) => (
              <div
                key={i}
                className={`${styles.bar} ${b.positive ? styles.pos : styles.neg}`}
                style={{ height: `${b.h}%` }}
              />
            ))}
          </div>
          <div className={styles.widgetStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Runway estimado</span>
              <span className={styles.statVal}>4.2 meses</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Flujo neto {tab}d</span>
              <span className={styles.statVal} style={{ color: 'var(--green)' }}>$85,000</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Riesgo detectado</span>
              <span className={styles.statVal} style={{ color: '#ff6b6b' }}>Día 17</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
