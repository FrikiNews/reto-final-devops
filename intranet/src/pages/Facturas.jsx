import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './Facturas.module.css';

const ESTADOS = { pendiente: 'badge-blue', vencida: 'badge-red', pagada: 'badge-green', cancelada: 'badge-yellow' };
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState('');
  const [showForm, setShowForm] = useState(false);

  const empresaId = JSON.parse(localStorage.getItem('zenta_user') || '{}')?.empresa?._id;

  const load = () => {
    if (!empresaId) return;
    setLoading(true);
    const q = filtro ? `?estado=${filtro}` : '';
    api.facturas(empresaId, q).then(setFacturas).finally(() => setLoading(false));
  };

  useEffect(load, [empresaId, filtro]);

  const marcarPagada = async (id) => {
    await api.patchFactura(id, { estado: 'pagada', fechaCobro: new Date() });
    load();
  };

  const total = facturas.reduce((s, f) => s + f.monto, 0);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {['', 'pendiente', 'vencida', 'pagada'].map(e => (
            <button key={e} className={`${styles.filterBtn} ${filtro === e ? styles.active : ''}`}
              onClick={() => setFiltro(e)}>
              {e || 'Todas'}
            </button>
          ))}
        </div>
        <button className="btn btn-green" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nueva factura'}
        </button>
      </div>

      {showForm && <NuevaFacturaForm empresaId={empresaId} onSave={() => { setShowForm(false); load(); }} />}

      <div className={styles.summary}>
        <span>{facturas.length} facturas</span>
        <span>Total: <strong>{fmt(total)}</strong></span>
      </div>

      {loading ? (
        <p className={styles.state}>Cargando facturas…</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <tr key={f._id}>
                  <td className={styles.folio}>{f.numeroFactura}</td>
                  <td>{f.cliente}</td>
                  <td className={styles.monto}>{fmt(f.monto)}</td>
                  <td>{fmtDate(f.fechaVencimiento)}</td>
                  <td><span className={`badge ${ESTADOS[f.estado]}`}>{f.estado}</span></td>
                  <td>
                    {f.estado !== 'pagada' && f.estado !== 'cancelada' && (
                      <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '.78rem' }}
                        onClick={() => marcarPagada(f._id)}>
                        Cobrada ✓
                      </button>
                    )}
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

function NuevaFacturaForm({ empresaId, onSave }) {
  const [form, setForm] = useState({ cliente: '', numeroFactura: '', monto: '', fechaVencimiento: '' });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.addFactura({ ...form, empresa: empresaId, monto: parseFloat(form.monto) });
      onSave();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.formTitle}>Nueva factura</h3>
      <div className={styles.formGrid}>
        <Field label="Cliente"      value={form.cliente}          onChange={v => set('cliente', v)}          type="text" required />
        <Field label="Folio"        value={form.numeroFactura}    onChange={v => set('numeroFactura', v)}    type="text" required />
        <Field label="Monto (MXN)"  value={form.monto}            onChange={v => set('monto', v)}            type="number" required />
        <Field label="Vencimiento"  value={form.fechaVencimiento} onChange={v => set('fechaVencimiento', v)} type="date"   required />
      </div>
      <button type="submit" className="btn btn-green" disabled={loading}>
        {loading ? 'Guardando…' : 'Guardar factura'}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '.78rem', color: 'var(--muted)', fontWeight: 600 }}>{label}</label>
      <input
        type={type} required={required} value={value}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '.875rem' }}
      />
    </div>
  );
}
