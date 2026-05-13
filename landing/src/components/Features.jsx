import styles from './Features.module.css';

const features = [
  {
    icon: '📉',
    title: 'Proyección de Flujo de Caja',
    desc:  'Anticipa entradas y salidas a 30, 60 y 90 días con modelos de ML entrenados en miles de PyMEs mexicanas.',
  },
  {
    icon: '🚨',
    title: 'Alertas Predictivas',
    desc:  'Detectamos señales de riesgo financiero semanas antes: facturas vencidas, caída de margen, gastos atípicos.',
  },
  {
    icon: '🎮',
    title: 'Simulador de Escenarios',
    desc:  '¿Qué pasa si contratas 3 empleados? ¿O si un cliente no paga? Simula sin arriesgar tu negocio real.',
  },
  {
    icon: '💰',
    title: 'Cuentas por Cobrar',
    desc:  'Gestiona facturas, fechas de vencimiento y prioriza cobros con base en el impacto real en tu liquidez.',
  },
  {
    icon: '🏆',
    title: 'Benchmarking Sectorial',
    desc:  'Compara tu desempeño financiero contra empresas similares en tu sector y región.',
  },
  {
    icon: '📊',
    title: 'Dashboard Ejecutivo',
    desc:  'KPIs clave en una sola pantalla: runway, margen operativo, alertas activas y tendencias del mes.',
  },
];

export default function Features() {
  return (
    <section id="funciones" className={`section ${styles.section}`}>
      <div className="container">
        <p className="section-label">Funciones</p>
        <h2 className={`section-title ${styles.title}`}>
          Todo lo que necesitas para tomar<br />decisiones financieras inteligentes
        </h2>
        <p className="section-sub">
          Diseñado para contadores, directores y dueños de PyME que quieren claridad,
          no complicación.
        </p>
        <div className={styles.grid}>
          {features.map(f => (
            <div key={f.title} className={styles.card}>
              <div className={styles.icon}>{f.icon}</div>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
