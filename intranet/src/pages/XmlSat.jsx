import { useEffect, useState, useRef } from 'react';
import api from '../api/client';
import styles from './XmlSat.module.css';

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const TC_LABEL = { I: 'Ingreso', E: 'Egreso', T: 'Traslado', N: 'Nómina', P: 'Pago' };

const ESTATUS_CLASS = {
  vigente:                 'badge-green',
  cancelado:               'badge-red',
  cancelacion_en_proceso:  'badge-yellow',
  no_encontrado:           'badge-gray',
};
const ESTATUS_LABEL = {
  vigente: 'Vigente', cancelado: 'Cancelado', cancelacion_en_proceso: 'Cancelación en proceso', no_encontrado: 'No encontrado',
};

export default function XmlSat() {
  const [tab, setTab]           = useState('emitido');
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef();

  // ── Sincronizar con SAT ─────────────────────────────────────────────────
  const [showSync, setShowSync] = useState(false);
  const [syncForm, setSyncForm] = useState({
    fechaInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,16),
    fechaFin:    new Date().toISOString().slice(0,16),
    tipo:        'ambos',
  });
  const [syncEstado, setSyncEstado] = useState(null); // null | 'cargando' | 'ok' | 'error'
  const [syncMsg,    setSyncMsg]    = useState('');

  const empresaId = localStorage.getItem('empresaId') ||
                    JSON.parse(localStorage.getItem('zenta_user') || '{}')?.empresa?._id;

  const load = () => {
    if (!empresaId) return;
    setLoading(true);
    const q = [`tipo=${tab}`, filtroEstatus && `estatus=${filtroEstatus}`].filter(Boolean).join('&');
    api.satXmlList(empresaId, q ? `?${q}` : '').then(setDocs).finally(() => setLoading(false));
  };

  useEffect(load, [empresaId, tab, filtroEstatus]);

  const sincronizar = async () => {
    setSyncEstado('cargando');
    setSyncMsg('Autenticando con el SAT…');
    try {
      const res = await api.satSincronizar(empresaId, {
        fechaInicio: syncForm.fechaInicio.replace('T', 'T') + ':00',
        fechaFin:    syncForm.fechaFin.replace('T', 'T')    + ':00',
        tipo:        syncForm.tipo,
      });
      setSyncEstado('ok');
      const errTxt = res.errores ? ` (advertencias: ${res.errores.map(e => e.tipo).join(', ')})` : '';
      setSyncMsg(`${res.sincronizados} CFDIs sincronizados${errTxt}`);
      load();
    } catch (e) {
      setSyncEstado('error');
      setSyncMsg(e.message || 'Error de conexión con SAT');
    }
  };

  const descargarXml = async (doc) => {
    const token = localStorage.getItem('zenta_token');
    const BASE  = import.meta.env.VITE_API_URL || '/api';
    const res   = await fetch(`${BASE}/sat/xml/${empresaId}/${doc._id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { alert('XML no disponible en el sistema'); return; }
    const blob  = await res.blob();
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `${doc.uuid}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const text = ev.target.result;
        // Extrae atributos básicos del XML para registrarlo
        const attr = (name) => {
          const m = text.match(new RegExp(`${name}="([^"]+)"`));
          return m ? m[1] : '';
        };
        const uuid = text.match(/UUID="([^"]+)"/i)?.[1] || `MANUAL-${Date.now()}`;
        const body = {
          empresa:        empresaId,
          tipo:           tab,
          uuid,
          rfcEmisor:      attr('RfcEmisor') || attr('rfc'),
          nombreEmisor:   attr('NombreEmisor') || attr('Nombre'),
          rfcReceptor:    attr('RfcReceptor'),
          nombreReceptor: attr('NombreReceptor'),
          folio:          attr('Folio'),
          serie:          attr('Serie'),
          fechaTimbrado:  attr('FechaTimbrado') || attr('Fecha') || new Date().toISOString(),
          subtotal:       parseFloat(attr('SubTotal')) || 0,
          total:          parseFloat(attr('Total')) || 0,
          tipoComprobante: attr('TipoDeComprobante') || 'I',
          xmlContenido:   text,
        };
        await api.satXmlImport(body);
        load();
      };
      reader.readAsText(file, 'utf-8');
    });
    e.target.value = '';
    setShowImport(false);
  };

  const totalMonto = docs.reduce((s, d) => s + d.total, 0);

  return (
    <div className={styles.page}>
      {/* Tabs emitidos / recibidos */}
      <div className={styles.tabs}>
        {['emitido', 'recibido'].map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
            {t === 'emitido' ? 'Emitidos' : 'Recibidos'}
          </button>
        ))}
        <span className={styles.tabTotal}>{docs.length} CFDIs · {fmt(totalMonto)}</span>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {['', 'vigente', 'cancelacion_en_proceso', 'cancelado', 'no_encontrado'].map(e => (
            <button key={e} className={`${styles.filterBtn} ${filtroEstatus === e ? styles.active : ''}`}
              onClick={() => setFiltroEstatus(e)}>
              {e ? ESTATUS_LABEL[e] : 'Todos'}
            </button>
          ))}
        </div>
        <button className="btn btn-green" onClick={() => { setShowImport(true); setTimeout(() => fileRef.current?.click(), 50); }}>
          ⬆ Importar XML
        </button>
        <button className="btn btn-primary" onClick={() => { setShowSync(s => !s); setSyncEstado(null); setSyncMsg(''); }}>
          Sincronizar con SAT
        </button>
        <input ref={fileRef} type="file" accept=".xml" multiple hidden onChange={handleFileImport} />
      </div>

      {/* ── Panel de sincronización ─────────────────────────────────── */}
      {showSync && (
        <div className={styles.syncPanel}>
          <h4 className={styles.syncTitle}>Descarga Masiva SAT</h4>
          <div className={styles.syncRow}>
            <label>Desde</label>
            <input type="datetime-local" value={syncForm.fechaInicio}
              onChange={e => setSyncForm(f => ({ ...f, fechaInicio: e.target.value }))} />
            <label>Hasta</label>
            <input type="datetime-local" value={syncForm.fechaFin}
              onChange={e => setSyncForm(f => ({ ...f, fechaFin: e.target.value }))} />
            <label>Tipo</label>
            <select value={syncForm.tipo} onChange={e => setSyncForm(f => ({ ...f, tipo: e.target.value }))}>
              <option value="ambos">Emitidos y recibidos</option>
              <option value="emitido">Solo emitidos</option>
              <option value="recibido">Solo recibidos</option>
            </select>
          </div>
          <div className={styles.syncAcciones}>
            <button className="btn btn-primary" onClick={sincronizar} disabled={syncEstado === 'cargando'}>
              {syncEstado === 'cargando' ? '⏳ Descargando…' : '▶ Iniciar descarga'}
            </button>
            <button className="btn" onClick={() => setShowSync(false)}>Cancelar</button>
          </div>
          {syncMsg && (
            <div className={`${styles.syncMsg} ${syncEstado === 'ok' ? styles.syncOk : syncEstado === 'error' ? styles.syncError : styles.syncInfo}`}>
              {syncMsg}
            </div>
          )}
          {syncEstado === 'cargando' && (
            <p className={styles.syncHint}>
              El SAT puede tardar varios minutos en preparar los paquetes. Por favor espera…
            </p>
          )}
        </div>
      )}

      {/* Tabla */}
      {loading ? <p className={styles.loading}>Cargando…</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>UUID</th>
                <th>{tab === 'emitido' ? 'Receptor' : 'Emisor'}</th>
                <th>{tab === 'emitido' ? 'RFC Receptor' : 'RFC Emisor'}</th>
                <th>Tipo</th><th>Folio</th><th>Fecha timbrado</th>
                <th>Subtotal</th><th>IVA</th><th>Total</th>
                <th>Estatus SAT</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d._id}>
                  <td className={styles.uuid} title={d.uuid}>{d.uuid.slice(0, 8)}…</td>
                  <td>{tab === 'emitido' ? d.nombreReceptor : d.nombreEmisor}</td>
                  <td className={styles.rfc}>{tab === 'emitido' ? d.rfcReceptor : d.rfcEmisor}</td>
                  <td><span className="badge badge-blue">{TC_LABEL[d.tipoComprobante] || d.tipoComprobante}</span></td>
                  <td>{d.serie}{d.folio}</td>
                  <td>{fmtDate(d.fechaTimbrado)}</td>
                  <td>{fmt(d.subtotal)}</td>
                  <td>{fmt(d.iva)}</td>
                  <td className={styles.total}>{fmt(d.total)}</td>
                  <td><span className={`badge ${ESTATUS_CLASS[d.estatusSat] || ''}`}>{ESTATUS_LABEL[d.estatusSat]}</span></td>
                  <td>
                    <button className={`btn ${styles.btnXml}`} onClick={() => descargarXml(d)} title="Descargar XML">
                      ⬇ XML
                    </button>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={11} className={styles.empty}>Sin CFDIs registrados para este tipo</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.hint}>
        Sincroniza directamente desde el SAT con tu e.firma, o importa XMLs manualmente.
        Configura tu e.firma en <a href="/perfil">Mi Perfil</a>.
      </p>
    </div>
  );
}
