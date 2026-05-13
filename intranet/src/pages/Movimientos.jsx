import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './Movimientos.module.css';

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Movimientos() {
  const [movs, setMovs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tipo, setTipo]         = useState('');
  const [showForm, setShowForm] = useState(false);

  const empresaId = JSON.parse(localStorage.getItem('zenta_user') || '{}')?.empresa?._id;

  const load = () => {
    if (!empresaId) return;
    setLoading(true);
    const q = tipo ? `?tipo=${tipo}` : '';
    api.movimientos(empresaId, q).then(setMovs).finally(() => setLoading(false));
  };

  useEffect(load, [empresaId, tipo]);

  const totalIngresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const totalEgresos  = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {['', 'ingreso', 'egreso'].map(t => (
            <button key={t} className={`${styles.filterBtn} ${tipo === t ? styles.active : ''}`}
              onClick={() => setTipo(t)}>
              {t || 'Todos'}
            </button>
          ))}
        </div>
        <button className="btn btn-green" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Registrar'}
        </button>
      </div>

      <div className={styles.summary}>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Total ingresos</span>
          <span className={`${styles.sumVal} ${styles.green}`}>{fmt(totalIngresos)}</span>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Total egresos</span>
          <span className={`${styles.sumVal} ${styles.red}`}>{fmt(totalEgresos)}</span>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Flujo neto</span>
          <span className={`${styles.sumVal} ${totalIngresos - totalEgresos >= 0 ? styles.green : styles.red}`}>
            {fmt(totalIngresos - totalEgresos)}
          </span>
        </div>
      </div>

      {showForm && <NuevoMovForm empresaId={empresaId} onSave={() => { setShowForm(false); load(); }} />}

      {loading ? <p className={styles.state}>Cargando…</p> : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Tipo</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {movs.map(m => (
                <tr key={m._id}>
                  <td className={styles.date}>{fmtDate(m.fecha)}</td>
                  <td>{m.concepto || '—'}</td>
                  <td>
                    <span className={`badge ${m.tipo === 'ingreso' ? 'badge-green' : 'badge-red'}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className={`${styles.monto} ${m.tipo === 'ingreso' ? styles.green : styles.red}`}>
                    {m.tipo === 'egreso' ? '−' : '+'}{fmt(m.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NuevoMovForm({ empresaId, onSave }) {
  const [form, setForm] = useState({ tipo: 'ingreso', monto: '', concepto: '', fecha: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.addMovimiento({ ...form, empresa: empresaId, monto: parseFloat(form.monto) });
      onSave();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '.9rem', fontWeight: 700 }}>Nuevo movimiento</h3>
      <div className={styles.formGrid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: '.78rem', color: 'var(--muted)', fontWeight: 600 }}>Tipo</label>
          <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
            style={{ padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font)' }}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
        </div>
        {[
          { k: 'monto',   label: 'Monto (MXN)', type: 'number' },
          { k: 'concepto',label: 'Concepto',     type: 'text'   },
          { k: 'fecha',   label: 'Fecha',        type: 'date'   },
        ].map(f => (
          <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '.78rem', color: 'var(--muted)', fontWeight: 600 }}>{f.label}</label>
            <input type={f.type} value={form[f.k]} onChange={e => set(f.k, e.target.value)}
              style={{ padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '.875rem' }}
            />
          </div>
        ))}
      </div>
      <button type="submit" className="btn btn-green" disabled={loading}>
        {loading ? 'Guardando…' : 'Guardar movimiento'}
      </button>
    </form>
  );
}
