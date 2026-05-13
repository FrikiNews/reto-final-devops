import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import styles from './Perfil.module.css';

export default function Perfil() {
  const empresaId = localStorage.getItem('empresaId');
  const userStr   = localStorage.getItem('user');
  const user      = userStr ? JSON.parse(userStr) : {};

  const [efirma, setEfirma] = useState(null);
  const [form, setForm] = useState({ rfc: '', contrasena: '' });
  const [cerFile, setCerFile] = useState(null);
  const [keyFile, setKeyFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [probando, setProbando] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo: 'ok'|'error', texto }

  const cerRef = useRef();
  const keyRef = useRef();

  useEffect(() => { cargarEfirma(); }, []);

  async function cargarEfirma() {
    try {
      const data = await api.efirmaGet(empresaId);
      setEfirma(data);
      if (data.rfc) setForm(f => ({ ...f, rfc: data.rfc }));
    } catch { /* si no hay configuración retorna 200 con {configurado:false} */ }
  }

  function leerArchivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]); // solo base64
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function guardar(e) {
    e.preventDefault();
    if (!cerFile) return setMsg({ tipo: 'error', texto: 'Selecciona el archivo .cer' });
    if (!keyFile) return setMsg({ tipo: 'error', texto: 'Selecciona el archivo .key' });
    if (!form.contrasena) return setMsg({ tipo: 'error', texto: 'La contraseña de la llave privada es requerida' });
    if (!form.rfc) return setMsg({ tipo: 'error', texto: 'El RFC es requerido' });

    setLoading(true);
    setMsg(null);
    try {
      const [certB64, keyB64] = await Promise.all([
        leerArchivoBase64(cerFile),
        leerArchivoBase64(keyFile),
      ]);

      await api.efirmaSave({
        empresaId,
        rfc: form.rfc,
        certificadoB64: certB64,
        llavePrivadaB64: keyB64,
        contrasena: form.contrasena,
      });

      setMsg({ tipo: 'ok', texto: 'e.firma guardada correctamente' });
      setCerFile(null);
      setKeyFile(null);
      setForm(f => ({ ...f, contrasena: '' }));
      if (cerRef.current) cerRef.current.value = '';
      if (keyRef.current) keyRef.current.value = '';
      await cargarEfirma();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.message || 'Error al guardar' });
    } finally {
      setLoading(false);
    }
  }

  async function probarConexion() {
    setProbando(true);
    setMsg(null);
    try {
      const res = await api.efirmaProbar(empresaId);
      setMsg({ tipo: 'ok', texto: `Conexión exitosa con el SAT. Token válido hasta ${new Date(res.tokenExpira).toLocaleTimeString()}` });
      await cargarEfirma();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.message || 'Error de conexión con SAT' });
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.titulo}>Mi Perfil</h1>

      {/* ── Datos de cuenta ─────────────────────────────────────────── */}
      <section className={styles.card}>
        <h2>Datos de cuenta</h2>
        <div className={styles.infoRow}>
          <span className={styles.label}>Nombre</span>
          <span>{user.nombre || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Email</span>
          <span>{user.email || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Rol</span>
          <span className={styles.badge}>{user.rol || 'usuario'}</span>
        </div>
      </section>

      {/* ── Estado e.firma ──────────────────────────────────────────── */}
      {efirma && (
        <section className={`${styles.card} ${efirma.configurado ? styles.cardOk : styles.cardWarn}`}>
          <div className={styles.estadoHeader}>

            <span className={styles.estadoTexto}>
              {efirma.configurado
                ? `e.firma configurada — RFC: ${efirma.rfc}`
                : 'e.firma no configurada'}
            </span>
          </div>
          {efirma.configurado && (
            <div className={styles.estadoDetalle}>
              <span>
                Token SAT: {efirma.tokenVigente
                  ? <strong className={styles.ok}>Vigente</strong>
                  : <span className={styles.warn}>Expirado (se renovará al sincronizar)</span>}
              </span>
              {efirma.ultimaSincronizacion && (
                <span>Última sync: {new Date(efirma.ultimaSincronizacion).toLocaleString()}</span>
              )}
              {efirma.ultimoError && (
                <div className={styles.errorBox}>{efirma.ultimoError}</div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Mensaje de feedback ─────────────────────────────────────── */}
      {msg && (
        <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgError}`}>
          {msg.texto}
        </div>
      )}

      {/* ── Formulario e.firma ──────────────────────────────────────── */}
      <section className={styles.card}>
        <h2>Configuración e.firma SAT</h2>
        <p className={styles.hint}>
          Tu e.firma solo se carga una vez. Las credenciales se guardan cifradas y se usan
          automáticamente para sincronizar CFDIs del SAT.
        </p>

        <form onSubmit={guardar} className={styles.form}>
          <div className={styles.field}>
            <label>RFC del contribuyente *</label>
            <input
              type="text"
              value={form.rfc}
              onChange={e => setForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
              placeholder="XAXX010101000"
              maxLength={13}
              required
            />
          </div>

          <div className={styles.field}>
            <label>Certificado (.cer) *</label>
            <input
              ref={cerRef}
              type="file"
              accept=".cer"
              onChange={e => setCerFile(e.target.files[0])}
            />
            {cerFile && <span className={styles.filename}>{cerFile.name}</span>}
          </div>

          <div className={styles.field}>
            <label>Llave privada (.key) *</label>
            <input
              ref={keyRef}
              type="file"
              accept=".key"
              onChange={e => setKeyFile(e.target.files[0])}
            />
            {keyFile && <span className={styles.filename}>{keyFile.name}</span>}
          </div>

          <div className={styles.field}>
            <label>Contraseña de la llave privada *</label>
            <input
              type="password"
              value={form.contrasena}
              onChange={e => setForm(f => ({ ...f, contrasena: e.target.value }))}
              placeholder="Contraseña de tu e.firma"
              autoComplete="current-password"
            />
          </div>

          <div className={styles.acciones}>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar e.firma'}
            </button>

            {efirma?.configurado && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={probarConexion}
                disabled={probando}
              >
                {probando ? 'Probando...' : 'Probar conexión SAT'}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <h2>¿Qué es la e.firma?</h2>
        <p className={styles.hint}>
          La e.firma (antes FIEL) es emitida por el SAT y permite autenticarte en sus servicios.
          Con ella, Zenta descarga automáticamente tus CFDIs emitidos y recibidos sin que tengas
          que ingresar al portal del SAT manualmente.<br /><br />
          Si no tienes tu e.firma, puedes tramitarla en cualquier módulo SAT presentando
          identificación oficial.
        </p>
      </section>
    </div>
  );
}
