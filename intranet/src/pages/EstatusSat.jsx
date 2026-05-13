import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './EstatusSat.module.css';

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const ESTATUS_CLASS = {
  vigente:                 'badge-green',
  cancelado:               'badge-red',
  cancelacion_en_proceso:  'badge-yellow',
  no_encontrado:           'badge-gray',
};
const ESTATUS_LABEL = {
  vigente: 'Vigente',
  cancelado: 'Cancelado',
  cancelacion_en_proceso: 'Cancelación en proceso',
  no_encontrado: 'No encontrado en SAT',
};

const ACCIONES_CANCELACION = [
  { value: 'cancelacion_en_proceso', label: '⏳ Solicitar cancelación', color: '#f59e0b' },
  { value: 'cancelado',              label: 'Marcar como cancelado',   color: '#ef4444' },
  { value: 'vigente',                label: 'Reactivar (vigente)',      color: '#00d47e' },
];

export default function EstatusSat() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('emitido');
  const [confirm, setConfirm]   = useState(null); // { id, accion, uuid }

  const empresaId = JSON.parse(localStorage.getItem('zenta_user') || '{}')?.empresa?._id;

  const load = () => {
    if (!empresaId) return;
    setLoading(true);
    api.satEstatus(empresaId).then(setData).finally(() => setLoading(false));
  };

  useEffect(load, [empresaId]);

  const cambiarEstatus = async () => {
    if (!confirm) return;
    await api.satXmlCambiarEstatus(confirm.id, confirm.accion);
    setConfirm(null);
    load();
  };

  const grupo = tab === 'emitido' ? data?.emitidos : data?.recibidos;

  return (
    <div className={styles.page}>
      {/* KPIs de estatus */}
      {data && (
        <div className={styles.kpisWrap}>
          {['emitidos', 'recibidos'].map(k => {
            const g = data[k];
            return (
              <div key={k} className={styles.kpiGroup}>
                <p className={styles.kpiGroupTitle}>{k === 'emitidos' ? 'Emitidos' : 'Recibidos'}</p>
                <div className={styles.kpis}>
                  <div className={styles.kpi}><span className={styles.kpiVal}>{g.total}</span><span className={styles.kpiLabel}>Total</span></div>
                  <div className={styles.kpi}><span className={`${styles.kpiVal} ${styles.green}`}>{g.vigentes}</span><span className={styles.kpiLabel}>Vigentes</span></div>
                  <div className={styles.kpi}><span className={`${styles.kpiVal} ${styles.yellow}`}>{g.cancelacionProceso}</span><span className={styles.kpiLabel}>En cancelación</span></div>
                  <div className={styles.kpi}><span className={`${styles.kpiVal} ${styles.red}`}>{g.cancelados}</span><span className={styles.kpiLabel}>Cancelados</span></div>
                  <div className={styles.kpi}><span className={styles.kpiVal}>{fmt(g.totalMonto)}</span><span className={styles.kpiLabel}>Monto total</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {['emitido', 'recibido'].map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
            {t === 'emitido' ? 'Emitidos' : 'Recibidos'}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? <p className={styles.loading}>Cargando…</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>UUID</th>
                <th>{tab === 'emitido' ? 'Receptor' : 'Emisor'}</th>
                <th>Folio</th><th>Fecha timbrado</th><th>Total</th>
                <th>Estatus SAT</th><th>Acción cancelación</th>
              </tr>
            </thead>
            <tbody>
              {(grupo?.docs || []).map(d => (
                <tr key={d._id} className={d.estatusSat === 'cancelado' ? styles.rowCancelado : d.estatusSat === 'cancelacion_en_proceso' ? styles.rowProceso : ''}>
                  <td className={styles.uuid} title={d.uuid}>{d.uuid.slice(0,13)}…</td>
                  <td>{tab === 'emitido' ? (d.nombreReceptor || d.rfcReceptor) : (d.nombreEmisor || d.rfcEmisor)}</td>
                  <td>{d.serie}{d.folio}</td>
                  <td>{fmtDate(d.fechaTimbrado)}</td>
                  <td className={styles.total}>{fmt(d.total)}</td>
                  <td><span className={`badge ${ESTATUS_CLASS[d.estatusSat] || ''}`}>{ESTATUS_LABEL[d.estatusSat]}</span></td>
                  <td>
                    {d.estatusSat !== 'cancelado' && (
                      <div className={styles.accionesWrap}>
                        {ACCIONES_CANCELACION.filter(a => a.value !== d.estatusSat).map(a => (
                          <button key={a.value} className={styles.accionBtn}
                            style={{ '--accion-color': a.color }}
                            onClick={() => setConfirm({ id: d._id, accion: a.value, uuid: d.uuid, label: a.label })}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {d.estatusSat === 'cancelado' && <span className={styles.canceladoMark}>CFDI cancelado</span>}
                  </td>
                </tr>
              ))}
              {(grupo?.docs || []).length === 0 && <tr><td colSpan={7} className={styles.empty}>Sin CFDIs registrados</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal confirmación cancelación */}
      {confirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Confirmar acción</h3>
            <p className={styles.modalDesc}>
              <strong>{confirm.label}</strong><br />
              UUID: <code className={styles.code}>{confirm.uuid}</code>
            </p>
            <div className={styles.modalNote}>
              <span></span>
              <span>Este cambio actualiza el estatus en el sistema Zenta. Para cancelar un CFDI ante el SAT debes hacerlo desde el portal del SAT o con tu PCCFDI autorizado.</span>
            </div>
            <div className={styles.modalActions}>
              <button className="btn" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-green" onClick={cambiarEstatus}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <p className={styles.hint}>
        Los cambios de estatus aquí son registros internos. Para cancelaciones fiscales válidas ante el SAT usa el portal sat.gob.mx o tu PCCFDI.
      </p>
    </div>
  );
}
