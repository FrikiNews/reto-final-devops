import { useState, useEffect } from 'react';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Simulador', href: '#simulador' },
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Funciones', href: '#funciones' },
    { label: 'Planes', href: '#planes' },
  ];

  return (
    <header className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <a href="#" className={styles.logo}>
          <span className={styles.logoBox}>📈</span>
          <span className={styles.logoText}>Zenta</span>
        </a>

        {/* Desktop nav */}
        <nav className={styles.nav}>
          {links.map(l => (
            <a key={l.label} href={l.href} className={styles.link}>{l.label}</a>
          ))}
        </nav>

        {/* CTA */}
        <div className={styles.cta}>
          <a href="/intranet" className="btn-ghost" style={{ padding: '10px 20px', fontSize: '.875rem' }}>
            Iniciar sesión
          </a>
          <a href="#simulador" className="btn-primary" style={{ padding: '10px 20px', fontSize: '.875rem' }}>
            Probar gratis
          </a>
        </div>

        {/* Hamburger */}
        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menú"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          {links.map(l => (
            <a key={l.label} href={l.href} className={styles.mobileLink}
               onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="/intranet" className={styles.mobileLink}>Iniciar sesión</a>
        </div>
      )}
    </header>
  );
}
