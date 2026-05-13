import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './CuentasCobrar.module.css';

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const ESTADO_CLASS = {
  vigente:    'badge-green',
  por_vencer: 'badge-yellow',
  vencida:    'badge-red',
  cobrada:    'badge-blue',
  incobrable: 'badge-gray',
};

const ESTADO_LABEL = {
  vigente: 'Vigente', por_vencer: 'Por vencer', vencida: 'Vencida', cobrada: 'Cobrada', incobrable: 'Incobrable',
};

export default function CuentasCobrar() {
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [abonoId, setAbonoId] = useState(null);
  const [abonoVal, setAbonoVal] = useState('');

  const empresaId = JSON.parse(localStorage.getItem('zenta_user') || '{}')?.empresa?._id;

  const load = () => {
    if (!empresaId) return;
    setLoading(true);
    const q = filtro ? `?estado=${filtro}` : '';
    api.cxcList(empresaId, q).then(setDocs).finally(() => setLoading(false));
  };

  useEffect(load, [empresaId, filtro]);

  const aplicarAbono = async (id) => {
    const monto = parseFloat(abonoVal);
    if (!monto || monto <= 0) return;
    const doc = docs.find(d => d._id === id);
    const nuevoAbonado = (doc.montoAbonado || 0) + monto;
    const estado = nuevoAbonado >= doc.monto ? 'cobrada' : doc.estado;
    await api.cxcPatch(id, { montoAbonado: nuevoAbonado, estado, ...(estado === 'cobrada' ? { fechaCobro: new Date() } : {}) });
    setAbonoId(null);
    setAbonoVal('');
    load();
  };

  const resumen = {
    total:     docs.reduce((s, d) => s + d.monto, 0),
    cobrado:   docs.reduce((s, d) => s + d.montoAbonado, 0),
    pendiente: docs.reduce((s, d) => s + (d.monto - d.montoAbonado), 0),
    vencidas:  docs.filter(d => d.estado === 'vencida').length,
  };

  return (
    <div className={styles.page}>
      {/* Resumen KPIs */}
      <div className={styles.kpis}>
        <div className={styles.kpi}><span className={styles.kpiVal}>{fmt(resumen.pendiente)}</span><span className={styles.kpiLabel}>Por cobrar</span></div>
        <div className={styles.kpi}><span className={styles.kpiVal}>{fmt(resumen.cobrado)}</span><span className={styles.kpiLabel}>Cobrado</span></div>
        <div className={styles.kpi}><span className={`${styles.kpiVal} ${resumen.vencidas > 0 ? styles.danger : ''}`}>{resumen.vencidas}</span><span className={styles.kpiLabel}>Cuentas vencidas</span></div>
        <div className={styles.kpi}><span className={styles.kpiVal}>{docs.length}</span><span className={styles.kpiLabel}>Total registros</span></div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {['', 'vigente', 'por_vencer', 'vencida', 'cobrada'].map(e => (
            <button key={e} className={`${styles.filterBtn} ${filtro === e ? styles.active : ''}`}
              onClick={() => setFiltro(e)}>
              {e ? ESTADO_LABEL[e] : 'Todas'}
            </button>
          ))}
        </div>
        <button className="btn btn-green" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nueva cuenta'}
        </button>
      </div>

      {showForm && <NuevaCuentaForm empresaId={empresaId} onSave={() => { setShowForm(false); load(); }} />}

      {/* Tabla */}
      {loading ? <p className={styles.loading}>Cargando…</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th><th>RFC</th><th>Concepto</th><th>Total</th>
                <th>Abonado</th><th>Saldo</th><th>Vencimiento</th><th>Estatus</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d._id} className={d.estado === 'vencida' ? styles.rowDanger : ''}>
                  <td>{d.cliente}</td>
                  <td className={styles.rfc}>{d.rfc || '—'}</td>
                  <td>{d.concepto}</td>
                  <td>{fmt(d.monto)}</td>
                  <td className={styles.green}>{fmt(d.montoAbonado)}</td>
                  <td className={d.monto - d.montoAbonado > 0 ? styles.orange : styles.green}>
                    {fmt(d.monto - d.montoAbonado)}
                  </td>
                  <td className={d.estado === 'vencida' ? styles.textDanger : ''}>{fmtDate(d.fechaVencimiento)}</td>
                  <td><span className={`badge ${ESTADO_CLASS[d.estado] || ''}`}>{ESTADO_LABEL[d.estado]}</span></td>
                  <td>
                    {d.estado !== 'cobrada' && d.estado !== 'incobrable' && (
                      abonoId === d._id ? (
                        <div className={styles.abonoRow}>
                          <input type="number" className={styles.abonoInput} placeholder="Monto" value={abonoVal}
                            onChange={e => setAbonoVal(e.target.value)} />
                          <button className="btn btn-green" style={{padding:'4px 10px'}} onClick={() => aplicarAbono(d._id)}>✓</button>
                          <button className="btn" style={{padding:'4px 10px'}} onClick={() => setAbonoId(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="btn btn-green" style={{padding:'4px 12px'}} onClick={() => { setAbonoId(d._id); setAbonoVal(''); }}>
                          + Abono
                        </button>
                      )
                    )}
                    {d.estado === 'cobrada' && <span className={styles.cobradaMark}>✓ Cobrada {fmtDate(d.fechaCobro)}</span>}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={9} className={styles.empty}>Sin registros</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NuevaCuentaForm({ empresaId, onSave }) {
  const [form, setForm] = useState({ cliente: '', rfc: '', concepto: '', monto: '', fechaVencimiento: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    await api.cxcAdd({ ...form, empresa: empresaId, monto: Number(form.monto) });
    onSave();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formGrid}>
        <div className={styles.field}><label>Cliente *</label><input required value={form.cliente} onChange={e => set('cliente', e.target.value)} /></div>
        <div className={styles.field}><label>RFC</label><input value={form.rfc} onChange={e => set('rfc', e.target.value.toUpperCase())} maxLength={13} /></div>
        <div className={styles.field}><label>Concepto *</label><input required value={form.concepto} onChange={e => set('concepto', e.target.value)} /></div>
        <div className={styles.field}><label>Monto (MXN) *</label><input required type="number" min="0" value={form.monto} onChange={e => set('monto', e.target.value)} /></div>
        <div className={styles.field}><label>Fecha vencimiento *</label><input required type="date" value={form.fechaVencimiento} onChange={e => set('fechaVencimiento', e.target.value)} /></div>
      </div>
      <button type="submit" className="btn btn-green">Guardar cuenta</button>
    </form>
  );
}
