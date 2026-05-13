import styles from './Pricing.module.css';

const plans = [
  {
    name: 'Básico',
    price: '$499',
    period: '/mes',
    desc: 'Ideal para arrancar con claridad financiera',
    features: [
      'Proyección a 30 días',
      'Dashboard de KPIs',
      'Hasta 100 movimientos/mes',
      'Alertas básicas',
      'Soporte por email',
    ],
    cta: 'Empezar gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$1,199',
    period: '/mes',
    desc: 'Para PyMEs que quieren anticiparse a todo',
    features: [
      'Proyección a 30, 60 y 90 días',
      'Simulador de escenarios ilimitado',
      'Movimientos ilimitados',
      'Alertas predictivas avanzadas',
      'Benchmarking sectorial',
      'Gestión de cuentas por cobrar',
      'Soporte prioritario',
    ],
    cta: 'Elegir Pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'A medida',
    period: '',
    desc: 'Para empresas con necesidades especiales',
    features: [
      'Todo lo de Pro',
      'Multi-empresa',
      'API de integración',
      'Onboarding personalizado',
      'SLA garantizado',
      'Gerente de cuenta dedicado',
    ],
    cta: 'Contactar ventas',
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section id="planes" className={`section ${styles.section}`}>
      <div className="container">
        <p className="section-label">Planes</p>
        <h2 className={`section-title ${styles.centered}`}>Precios transparentes, sin sorpresas</h2>
        <p className={`section-sub ${styles.centered}`}>Prueba cualquier plan gratis por 14 días. Sin tarjeta de crédito.</p>
        <div className={styles.grid}>
          {plans.map(p => (
            <div key={p.name} className={`${styles.card} ${p.highlight ? styles.highlight : ''}`}>
              {p.highlight && <div className={styles.badge}>Más popular</div>}
              <div className={styles.planName}>{p.name}</div>
              <div className={styles.price}>
                {p.price}<span className={styles.period}>{p.period}</span>
              </div>
              <p className={styles.desc}>{p.desc}</p>
              <ul className={styles.features}>
                {p.features.map(f => (
                  <li key={f} className={styles.feature}>
                    <span className={styles.check}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="#" className={p.highlight ? 'btn-primary' : 'btn-ghost'} style={{ marginTop: 'auto', textAlign: 'center', justifyContent: 'center' }}>
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
