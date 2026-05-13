import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const nav = [
  { section: 'Principal', items: [
    { label: 'Dashboard',        to: '/dashboard'   },
    { label: 'Proyección',       to: '/proyeccion'  },
  ]},
  { section: 'Gestión', items: [
    { label: 'Alertas',          to: '/alertas'     },
    { label: 'Facturas',         to: '/facturas'    },
    { label: 'Cuentas x Cobrar', to: '/cxc'         },
    { label: 'Movimientos',      to: '/movimientos' },
  ]},
  { section: 'SAT & Reportes', items: [
    { label: 'CFDIs / XML SAT',  to: '/xml-sat'     },
    { label: 'Estatus SAT',      to: '/estatus-sat' },
    { label: 'Descargar Reporte',to: '/reportes'    },
  ]},
  { section: 'Mi Cuenta', items: [
    { label: 'Perfil / e.firma',  to: '/perfil'      },
  ]},
];

export default function Sidebar() {
  const user = JSON.parse(localStorage.getItem('zenta_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('zenta_token');
    localStorage.removeItem('zenta_user');
    window.location.href = '/login';
  };

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoBox}>Z</div>
        <div>
          <span className={styles.logoText}>Zenta</span>
          <span className={styles.logoBadge}>Intranet</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {nav.map(group => (
          <div key={group.section}>
            <p className={styles.sectionLabel}>{group.section}</p>
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className={styles.user}>
        <div className={styles.avatar}>
          {user.nombre?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.nombre || 'Usuario'}</span>
          <span className={styles.userRole}>{user.rol || 'usuario'}</span>
        </div>
        <button className={styles.logout} onClick={handleLogout} title="Cerrar sesión">Salir</button>
      </div>
    </aside>
  );
}
