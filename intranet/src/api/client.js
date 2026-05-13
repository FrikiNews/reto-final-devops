/* ── Centralized API client ──────────────────────────────────────────────── */
const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('zenta_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('zenta_token');
    localStorage.removeItem('zenta_user');
    window.location.href = '/login';
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

const api = {
  login:      (body)       => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me:         ()           => request('/auth/me'),

  dashboard:  (eid)        => request(`/dashboard/${eid}`),

  movimientos: (eid, q='') => request(`/movimientos/${eid}${q}`),
  addMovimiento: (body)    => request('/movimientos', { method: 'POST', body: JSON.stringify(body) }),

  facturas:   (eid, q='')  => request(`/facturas/${eid}${q}`),
  addFactura: (body)       => request('/facturas', { method: 'POST', body: JSON.stringify(body) }),
  patchFactura: (id, body) => request(`/facturas/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  alertas:    (eid, q='')  => request(`/alertas/${eid}${q}`),
  resolverAlerta: (id)     => request(`/alertas/${id}/resolver`, { method: 'PATCH' }),

  proyeccion: (eid, h=30)  => request(`/proyecciones/${eid}?horizonte=${h}`),

  cxcList:    (eid, q='')  => request(`/cxc/${eid}${q}`),
  cxcAdd:     (body)       => request('/cxc', { method: 'POST', body: JSON.stringify(body) }),
  cxcPatch:   (id, body)   => request(`/cxc/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  satXmlList:  (eid, q='') => request(`/sat/xml/${eid}${q}`),
  satXmlImport:(body)      => request('/sat/xml', { method: 'POST', body: JSON.stringify(body) }),
  satXmlCambiarEstatus: (id, estatusSat) => request(`/sat/xml/${id}/estatus`, { method: 'PATCH', body: JSON.stringify({ estatusSat }) }),
  satEstatus:  (eid)       => request(`/sat/estatus/${eid}`),
  satSincronizar: (eid, body) => request(`/sat/sincronizar/${eid}`, { method: 'POST', body: JSON.stringify(body) }),

  efirmaGet:   (eid)       => request(`/efirma/${eid}`),
  efirmaSave:  (body)      => request('/efirma', { method: 'POST', body: JSON.stringify(body) }),
  efirmaProbar:(eid)       => request(`/efirma/${eid}/probar`, { method: 'POST' }),
  efirmaDelete:(eid)       => request(`/efirma/${eid}`, { method: 'DELETE' }),
};

export { api };
export default api;
