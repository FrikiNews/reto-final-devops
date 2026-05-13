import styles from './HowItWorks.module.css';

const steps = [
  {
    num: '01',
    title: 'Conecta tus datos',
    desc:  'Importa movimientos bancarios, facturas y gastos en minutos. Compatible con SAT, Excel y las principales plataformas contables.',
  },
  {
    num: '02',
    title: 'Zenta analiza y proyecta',
    desc:  'Nuestro motor de IA procesa tus patrones históricos y genera proyecciones de flujo de caja a 30, 60 y 90 días.',
  },
  {
    num: '03',
    title: 'Actúa antes que la crisis',
    desc:  'Recibe alertas anticipadas, simula escenarios y toma decisiones con datos reales, no intuición.',
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className={`section ${styles.section}`}>
      <div className="container">
        <p className="section-label">Cómo funciona</p>
        <h2 className="section-title">En 3 pasos tienes claridad financiera total</h2>
        <div className={styles.steps}>
          {steps.map((s, i) => (
            <div key={s.num} className={styles.step}>
              <div className={styles.stepNum}>{s.num}</div>
              {i < steps.length - 1 && <div className={styles.connector} />}
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
