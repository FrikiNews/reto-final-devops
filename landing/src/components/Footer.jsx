import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <span className={styles.logoBox}>📈</span>
            <span className={styles.logoText}>Zenta</span>
          </div>
          <p className={styles.tagline}>Inteligencia financiera para PyMEs mexicanas.</p>
        </div>
        <div className={styles.links}>
          <div>
            <p className={styles.colTitle}>Producto</p>
            <a href="#funciones">Funciones</a>
            <a href="#planes">Planes</a>
            <a href="#como-funciona">Cómo funciona</a>
          </div>
          <div>
            <p className={styles.colTitle}>Empresa</p>
            <a href="#">Acerca de</a>
            <a href="#">Blog</a>
            <a href="#">Contacto</a>
          </div>
          <div>
            <p className={styles.colTitle}>Legal</p>
            <a href="#">Privacidad</a>
            <a href="#">Términos</a>
          </div>
        </div>
      </div>
      <div className={`container ${styles.bottom}`}>
        <p>© {new Date().getFullYear()} Zenta. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
