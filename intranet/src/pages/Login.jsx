import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login({ email, password });
      localStorage.setItem('zenta_token', token);
      localStorage.setItem('zenta_user', JSON.stringify(user));
      // Guardar empresaId directamente para acceso rápido
      if (user?.empresa?._id) localStorage.setItem('empresaId', user.empresa._id);
      else if (user?.empresa)  localStorage.setItem('empresaId', user.empresa);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.top}>
          <div className={styles.logoBox}>Z</div>
          <h1 className={styles.title}>Zenta</h1>
          <p className={styles.sub}>Panel Financiero Interno</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label className={styles.label}>Correo electrónico</label>
            <input
              type="email" required autoFocus
              className={styles.input}
              placeholder="admin@zenta.mx"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Contraseña</label>
            <input
              type="password" required
              className={styles.input}
              placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className={`btn btn-green ${styles.submitBtn}`} disabled={loading}>
            {loading ? 'Iniciando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className={styles.hint}>Demo: admin@zenta.mx / zenta2024</p>
      </div>
    </div>
  );
}
