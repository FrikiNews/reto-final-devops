import { useLocation } from 'react-router-dom';
import styles from './Header.module.css';

const titles = {
  '/dashboard':   { label: 'Dashboard' },
  '/proyeccion':  { label: 'Proyección de Flujo' },
  '/alertas':     { label: 'Alertas' },
  '/facturas':    { label: 'Facturas' },
  '/movimientos': { label: 'Movimientos' },
  '/cxc':         { label: 'Cuentas por Cobrar' },
  '/xml-sat':     { label: 'CFDIs / XML del SAT' },
  '/estatus-sat': { label: 'Estatus ante el SAT' },
  '/reportes':    { label: 'Descargar Reportes' },
  '/perfil':      { label: 'Mi Perfil / e.firma' },
};

export default function Header() {
  const { pathname } = useLocation();
  const info = titles[pathname] || { label: 'Zenta' };

  const user = JSON.parse(localStorage.getItem('zenta_user') || '{}');
  const empresa = user.empresa?.nombre || 'Mi empresa';

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{info.label}</h1>
      </div>
      <div className={styles.right}>
        <span className={styles.empresa}>{empresa}</span>
        <span className={styles.dot} />
        <span className={styles.time}>{new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      </div>
    </header>
  );
}
