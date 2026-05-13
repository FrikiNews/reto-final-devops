import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './Alertas.module.css';

const PRIO = { critica: { label: 'Crítica', cls: 'badge-red' }, atencion: { label: 'Atención', cls: 'badge-yellow' }, info: { label: 'Info', cls: 'badge-blue' } };

export default function Alertas() {
  const [alertas, setAlertas]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [soloActivas, setSoloActivas] = useState(true);

  const empresaId = JSON.parse(localStorage.getItem('zenta_user') || '{}')?.empresa?._id;

  const load = () => {
    if (!empresaId) return;
    setLoading(true);
    api.alertas(empresaId, soloActivas ? '' : '?activas=false')
      .then(setAlertas)
      .finally(() => setLoading(false));
  };

  useEffect(load, [empresaId, soloActivas]);

  const resolver = async (id) => {
    await api.resolverAlerta(id);
    load();
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h2 className={styles.count}>{alertas.length} alertas {soloActivas ? 'activas' : 'totales'}</h2>
        <label className={styles.toggle}>
          <input type="checkbox" checked={soloActivas} onChange={e => setSoloActivas(e.target.checked)} />
          Solo activas
        </label>
      </div>

      {loading ? (
        <p className={styles.state}>Cargando alertas…</p>
      ) : alertas.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}></span>
          <p>Sin alertas activas. ¡Todo en orden!</p>
        </div>
      ) : (
        <div className={styles.list}>
          {alertas.map(a => {
            const p = PRIO[a.prioridad] || PRIO.info;
            return (
              <div key={a._id} className={`${styles.item} ${a.resuelta ? styles.resuelta : ''}`}>
                <div className={styles.itemLeft}>
                  <span className={`badge ${p.cls}`}>{p.label}</span>
                  <div>
                    <p className={styles.itemTitle}>{a.titulo}</p>
                    {a.descripcion && <p className={styles.itemDesc}>{a.descripcion}</p>}
                    <p className={styles.itemDate}>{new Date(a.createdAt).toLocaleString('es-MX')}</p>
                  </div>
                </div>
                {!a.resuelta && (
                  <button className="btn btn-ghost" onClick={() => resolver(a._id)}>
                    Resolver
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
