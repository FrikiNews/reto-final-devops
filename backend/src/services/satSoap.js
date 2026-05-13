/**
 * services/satSoap.js
 *
 * Implementa el protocolo de Descarga Masiva CFDI del SAT.
 * Basado en la documentación oficial SAT Dic 2023 v1.2.
 *
 * Flujo:
 *   1. autenticarSat()         → WRAP token (válido ~5 min)
 *   2. solicitarDescarga()     → IdSolicitud
 *   3. verificarSolicitud()    → IdsPaquetes[] (polling hasta EstadoSolicitud=3)
 *   4. descargarPaquete()      → Buffer ZIP con XMLs
 *   5. parsearZipCfdis()       → Array de objetos CFDI extraídos
 *
 * Autenticación: WS-Security 1.0 con certificado X.509 (BinarySecurityToken)
 * + firma XMLDSig RSA-SHA1 del Timestamp.
 */

const axios    = require('axios');
const forge    = require('node-forge');
const { create: xmlCreate } = require('xmlbuilder2');
const AdmZip   = require('adm-zip');
const crypto   = require('crypto');

// ── URLs reales del SAT (CFDI 4.0 — mismo endpoint acepta ambas versiones) ──
const SAT_URL = {
  autenticacion: process.env.SAT_AUTH_URL      || 'https://cfdidescargamasivaterceros.sat.gob.mx/CFDI33/Autenticacion/Autenticacion.svc',
  solicitud:     process.env.SAT_SOLICITUD_URL || 'https://cfdidescargamasivaterceros.sat.gob.mx/CFDI33/SolicitaDescarga/SolicitaDescarga.svc',
  verificacion:  process.env.SAT_VERIFICACION_URL || 'https://cfdidescargamasivaterceros.sat.gob.mx/CFDI33/VerificaSolicitudDescarga/VerificaSolicitudDescargaService.svc',
  descarga:      process.env.SAT_DESCARGA_URL  || 'https://cfdidescargamasivaterceros.sat.gob.mx/CFDI33/Descargar/DescargarService.svc',
};

// ── Helper: fecha ISO sin milisegundos ─────────────────────────────────────
function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
}

// ── Helper: generar UUID v4 simple ─────────────────────────────────────────
function uuid() {
  return crypto.randomUUID();
}

/**
 * Parsea el certificado DER (base64) y la llave privada PEM cifrada.
 * Retorna { certPem, certDerB64, privateKey (forge), certForge }.
 */
function parsarCredenciales(certificadoB64, llavePrivadaPem, contrasena) {
  // Certificado: puede venir como DER base64 o PEM
  let certDer;
  try {
    certDer = forge.util.decode64(certificadoB64);
  } catch {
    throw new Error('Certificado inválido: no es base64 válido');
  }

  const certAsn1  = forge.asn1.fromDer(certDer);
  const certForge = forge.pki.certificateFromAsn1(certAsn1);
  const certPem   = forge.pki.certificateToPem(certForge);

  // Llave privada: puede venir como PEM cifrado (PKCS#8 o PKCS#12)
  let privateKey;
  try {
    // Intenta PEM directamente
    if (llavePrivadaPem.includes('-----BEGIN')) {
      if (contrasena) {
        privateKey = forge.pki.decryptRsaPrivateKey(llavePrivadaPem, contrasena);
      } else {
        privateKey = forge.pki.privateKeyFromPem(llavePrivadaPem);
      }
    } else {
      // Asume DER en base64
      const keyDer = forge.util.decode64(llavePrivadaPem);
      const keyAsn1 = forge.asn1.fromDer(keyDer);
      // Intentar PKCS#8 cifrado
      try {
        const decrypted = forge.pki.decryptPrivateKeyInfo(keyAsn1, contrasena);
        privateKey = forge.pki.privateKeyFromAsn1(decrypted);
      } catch {
        privateKey = forge.pki.privateKeyFromAsn1(keyAsn1);
      }
    }
  } catch (e) {
    throw new Error(`Llave privada inválida o contraseña incorrecta: ${e.message}`);
  }

  if (!privateKey) throw new Error('No se pudo descifrar la llave privada. Verifica la contraseña.');

  return { certPem, certDerB64: certificadoB64, privateKey, certForge };
}

/**
 * Construye el SOAP Envelope de autenticación con WS-Security.
 * Incluye BinarySecurityToken (cert X.509) + Signature XMLDSig RSA-SHA1 del Timestamp.
 */
function buildAuthEnvelope(certDerB64, privateKey) {
  const tokenId   = `uuid-${uuid()}-1`;
  const created   = isoNow(0);
  const expires   = isoNow(300); // 5 minutos
  const timestampId = '_0';

  // ── Canonical string del Timestamp para firmar ─────────────────────────
  const timestampCanon = `<u:Timestamp xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" u:Id="${timestampId}"><u:Created>${created}</u:Created><u:Expires>${expires}</u:Expires></u:Timestamp>`;

  // ── SHA1 digest del timestamp ──────────────────────────────────────────
  const md = forge.md.sha1.create();
  md.update(timestampCanon, 'utf8');
  const digestB64 = forge.util.encode64(md.digest().bytes());

  // ── SignedInfo canonical ───────────────────────────────────────────────
  const signedInfoCanon =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${timestampId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></Transform></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${digestB64}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  // ── Firma RSA-SHA1 del SignedInfo ──────────────────────────────────────
  const mdSig = forge.md.sha1.create();
  mdSig.update(signedInfoCanon, 'utf8');
  const sigBytes  = privateKey.sign(mdSig);
  const sigB64    = forge.util.encode64(sigBytes);

  // ── Construir el envelope ──────────────────────────────────────────────
  const xml = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header>
    <o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <u:Timestamp u:Id="${timestampId}">
        <u:Created>${created}</u:Created>
        <u:Expires>${expires}</u:Expires>
      </u:Timestamp>
      <o:BinarySecurityToken u:Id="${tokenId}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${certDerB64}</o:BinarySecurityToken>
      <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
        <SignedInfo>
          <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
          <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
          <Reference URI="#${timestampId}">
            <Transforms><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></Transforms>
            <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
            <DigestValue>${digestB64}</DigestValue>
          </Reference>
        </SignedInfo>
        <SignatureValue>${sigB64}</SignatureValue>
        <KeyInfo>
          <o:SecurityTokenReference>
            <o:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" URI="#${tokenId}"/>
          </o:SecurityTokenReference>
        </KeyInfo>
      </Signature>
    </o:Security>
  </s:Header>
  <s:Body>
    <Autentica xmlns="http://DescargaMasivaTerceros.gob.mx"/>
  </s:Body>
</s:Envelope>`;

  return xml;
}

/**
 * Llama al WS de autenticación del SAT.
 * @returns {string} WRAP token
 */
async function autenticarSat(certificadoB64, llavePrivadaRaw, contrasena) {
  const { certDerB64, privateKey } = parsarCredenciales(certificadoB64, llavePrivadaRaw, contrasena);
  const soapBody = buildAuthEnvelope(certDerB64, privateKey);

  const res = await axios.post(SAT_URL.autenticacion, soapBody, {
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction': 'http://DescargaMasivaTerceros.gob.mx/IAutenticacion/Autentica',
    },
    timeout: 30000,
  });

  // Extraer token del XML de respuesta
  const match = res.data.match(/<AutenticaResult>([^<]+)<\/AutenticaResult>/);
  if (!match) throw new Error('No se obtuvo token del SAT. Respuesta: ' + res.data.slice(0, 300));
  return match[1].trim();
}

/**
 * Construye y envía la solicitud de descarga masiva.
 * @param {string} wrapToken  Token WRAP del SAT
 * @param {string} rfcSolicitante RFC del contribuyente
 * @param {object} params { rfcEmisor?, rfcReceptor?, fechaInicio, fechaFin, tipoSolicitud ('CFDI'|'Metadata'), tipoComprobante? }
 * @returns {string} IdSolicitud
 */
async function solicitarDescarga(wrapToken, rfcSolicitante, certDerB64, privateKey, params) {
  const { fechaInicio, fechaFin, rfcEmisor, rfcReceptor, tipoSolicitud = 'CFDI', tipoComprobante = '' } = params;
  const solicitudId = uuid().toUpperCase();

  const attrEmisor   = rfcEmisor   ? ` RfcEmisor="${rfcEmisor}"`   : '';
  const attrReceptor = rfcReceptor ? ` RfcReceptor="${rfcReceptor}"` : '';
  const attrTipo     = tipoComprobante ? ` TipoComprobante="${tipoComprobante}"` : '';

  // El elemento a firmar
  const solicitudXml =
    `<des:SolicitaDescarga xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx">` +
    `<des:solicitud FechaInicial="${fechaInicio}" FechaFinal="${fechaFin}"` +
    attrEmisor + attrReceptor +
    ` RfcSolicitante="${rfcSolicitante}" TipoSolicitud="${tipoSolicitud}"${attrTipo}/>` +
    `</des:SolicitaDescarga>`;

  // Firma del elemento solicitud
  const md = forge.md.sha1.create();
  md.update(solicitudXml, 'utf8');
  const digestB64 = forge.util.encode64(md.digest().bytes());

  const signedInfoCanon =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${digestB64}</DigestValue></Reference>` +
    `</SignedInfo>`;

  const mdSig = forge.md.sha1.create();
  mdSig.update(signedInfoCanon, 'utf8');
  const sigB64 = forge.util.encode64(privateKey.sign(mdSig));

  const soapBody = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
  <soapenv:Header/>
  <soapenv:Body>
    <des:SolicitaDescarga>
      <des:solicitud FechaInicial="${fechaInicio}" FechaFinal="${fechaFin}"${attrEmisor}${attrReceptor} RfcSolicitante="${rfcSolicitante}" TipoSolicitud="${tipoSolicitud}"${attrTipo}>
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
          <SignedInfo>
            <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
            <Reference URI="">
              <Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>
              <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
              <DigestValue>${digestB64}</DigestValue>
            </Reference>
          </SignedInfo>
          <SignatureValue>${sigB64}</SignatureValue>
          <KeyInfo><X509Data><X509Certificate>${certDerB64}</X509Certificate></X509Data></KeyInfo>
        </Signature>
      </des:solicitud>
    </des:SolicitaDescarga>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await axios.post(SAT_URL.solicitud, soapBody, {
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescarga',
      'Authorization': `WRAP access_token="${wrapToken}"`,
    },
    timeout: 30000,
  });

  const matchId  = res.data.match(/IdSolicitud="([^"]+)"/);
  const matchCod = res.data.match(/CodEstatus="([^"]+)"/);
  const matchMsg = res.data.match(/Mensaje="([^"]+)"/);

  if (!matchId) {
    throw new Error(`SAT no retornó IdSolicitud. Código: ${matchCod?.[1]} — ${matchMsg?.[1] || res.data.slice(0, 200)}`);
  }

  return { idSolicitud: matchId[1], codEstatus: matchCod?.[1], mensaje: matchMsg?.[1] };
}

/**
 * Verifica el estado de la solicitud.
 * Hace polling máximo 12 veces con 5s de espera entre intentos.
 * @returns {{ idsPaquetes: string[], numeroCfdis: number, estadoSolicitud: number }}
 */
async function verificarSolicitud(wrapToken, idSolicitud, rfcSolicitante, certDerB64, privateKey) {
  const MAX_REINTENTOS = 12;
  const ESPERA_MS      = 5000;

  for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
    // Firma del elemento solicitud
    const elementoFirmar = `<des:solicitud xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" IdSolicitud="${idSolicitud}" RfcSolicitante="${rfcSolicitante}"/>`;
    const md = forge.md.sha1.create();
    md.update(elementoFirmar, 'utf8');
    const digestB64 = forge.util.encode64(md.digest().bytes());

    const signedInfoCanon =
      `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      `<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod>` +
      `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
      `<Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
      `<DigestValue>${digestB64}</DigestValue></Reference>` +
      `</SignedInfo>`;

    const mdSig = forge.md.sha1.create();
    mdSig.update(signedInfoCanon, 'utf8');
    const sigB64 = forge.util.encode64(privateKey.sign(mdSig));

    const soapBody = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx">
  <soapenv:Header/>
  <soapenv:Body>
    <des:VerificaSolicitudDescarga>
      <des:solicitud IdSolicitud="${idSolicitud}" RfcSolicitante="${rfcSolicitante}">
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
          <SignedInfo>
            <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
            <Reference URI="">
              <Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>
              <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
              <DigestValue>${digestB64}</DigestValue>
            </Reference>
          </SignedInfo>
          <SignatureValue>${sigB64}</SignatureValue>
          <KeyInfo><X509Data><X509Certificate>${certDerB64}</X509Certificate></X509Data></KeyInfo>
        </Signature>
      </des:solicitud>
    </des:VerificaSolicitudDescarga>
  </soapenv:Body>
</soapenv:Envelope>`;

    const res = await axios.post(SAT_URL.verificacion, soapBody, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga',
        'Authorization': `WRAP access_token="${wrapToken}"`,
      },
      timeout: 30000,
    });

    const estadoMatch  = res.data.match(/EstadoSolicitud="(\d+)"/);
    const codMatch     = res.data.match(/CodEstatus="([^"]+)"/);
    const numMatch     = res.data.match(/NumeroCFDIs="(\d+)"/);
    const estado       = parseInt(estadoMatch?.[1] || '0', 10);
    const codEstado    = res.data.match(/CodigoEstadoSolicitud="([^"]+)"/)?.[1];

    // Extraer IdsPaquetes
    const paquetesMatch = [...res.data.matchAll(/<IdsPaquetes>([^<]+)<\/IdsPaquetes>/g)];
    const idsPaquetes   = paquetesMatch.map(m => m[1]);

    // EstadoSolicitud: 1=Aceptada, 2=En Proceso, 3=Terminada, 4=Error, 5=Rechazada, 6=Vencida
    if (estado === 3) {
      return { idsPaquetes, numeroCfdis: parseInt(numMatch?.[1] || '0', 10), estadoSolicitud: estado, codEstado };
    }

    if (estado === 4 || estado === 5) {
      throw new Error(`Solicitud rechazada/error. Estado: ${estado}, Código: ${codEstado || codMatch?.[1]}`);
    }

    if (estado === 6) {
      throw new Error('Solicitud vencida (más de 72 horas). Genera una nueva solicitud.');
    }

    if (intento < MAX_REINTENTOS) {
      await new Promise(r => setTimeout(r, ESPERA_MS));
    }
  }

  throw new Error('Tiempo de espera agotado. La solicitud sigue en proceso en el SAT. Intenta verificar más tarde.');
}

/**
 * Descarga un paquete ZIP y retorna su contenido como Buffer.
 */
async function descargarPaquete(wrapToken, idPaquete, rfcSolicitante, certDerB64, privateKey) {
  const md = forge.md.sha1.create();
  const elemento = `<des:peticionDescarga xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" IdPaquete="${idPaquete}" RfcSolicitante="${rfcSolicitante}"/>`;
  md.update(elemento, 'utf8');
  const digestB64 = forge.util.encode64(md.digest().bytes());

  const signedInfoCanon =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${digestB64}</DigestValue></Reference>` +
    `</SignedInfo>`;

  const mdSig = forge.md.sha1.create();
  mdSig.update(signedInfoCanon, 'utf8');
  const sigB64 = forge.util.encode64(privateKey.sign(mdSig));

  const soapBody = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx">
  <soapenv:Header/>
  <soapenv:Body>
    <des:PeticionDescargaMasivaTerceroEntrada>
      <des:peticionDescarga IdPaquete="${idPaquete}" RfcSolicitante="${rfcSolicitante}">
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
          <SignedInfo>
            <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
            <Reference URI="">
              <Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>
              <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
              <DigestValue>${digestB64}</DigestValue>
            </Reference>
          </SignedInfo>
          <SignatureValue>${sigB64}</SignatureValue>
          <KeyInfo><X509Data><X509Certificate>${certDerB64}</X509Certificate></X509Data></KeyInfo>
        </Signature>
      </des:peticionDescarga>
    </des:PeticionDescargaMasivaTerceroEntrada>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await axios.post(SAT_URL.descarga, soapBody, {
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/Descargar',
      'Authorization': `WRAP access_token="${wrapToken}"`,
    },
    timeout: 60000,
    responseType: 'text',
  });

  // El paquete viene en base64 dentro de <Paquete>...</Paquete>
  const paqueteMatch = res.data.match(/<Paquete>([^<]+)<\/Paquete>/);
  if (!paqueteMatch) throw new Error('SAT no retornó paquete. ' + res.data.slice(0, 200));

  return Buffer.from(paqueteMatch[1], 'base64');
}

/**
 * Extrae y parsea los CFDIs de un Buffer ZIP.
 * @returns {Array} Array de objetos con datos del CFDI extraídos del XML
 */
function parsearZipCfdis(zipBuffer, empresaId, tipoDefault = 'emitido') {
  const zip    = new AdmZip(zipBuffer);
  const cfdis  = [];

  for (const entry of zip.getEntries()) {
    if (!entry.entryName.toLowerCase().endsWith('.xml')) continue;
    try {
      const xmlText = entry.getData().toString('utf8');
      const cfdi = parsearCfdiXml(xmlText, empresaId, tipoDefault);
      if (cfdi) cfdis.push(cfdi);
    } catch (e) {
      console.warn(`[SAT] Error parseando ${entry.entryName}: ${e.message}`);
    }
  }

  return cfdis;
}

/**
 * Parsea un XML CFDI y extrae los campos relevantes.
 */
function parsearCfdiXml(xmlText, empresaId, tipoDefault) {
  // Extraer atributos del nodo raíz Comprobante (CFDI 4.0 y 3.3)
  const attr = (name) => {
    const patterns = [
      new RegExp(`\\b${name}="([^"]+)"`, 'i'),
      new RegExp(`\\b${name}='([^']+)'`, 'i'),
    ];
    for (const p of patterns) {
      const m = xmlText.match(p);
      if (m) return m[1];
    }
    return '';
  };

  const uuid          = attr('UUID') || attr('Folio');
  const rfcEmisor     = attr('RfcEmisor');
  const nombreEmisor  = attr('NombreEmisor') || attr('Nombre');
  const rfcReceptor   = attr('RfcReceptor');
  const nombreReceptor= attr('NombreReceptor');
  const folio         = attr('Folio');
  const serie         = attr('Serie');
  const fecha         = attr('FechaTimbrado') || attr('Fecha');
  const subtotal      = parseFloat(attr('SubTotal') || attr('Subtotal') || '0');
  const total         = parseFloat(attr('Total') || '0');
  const tipoComp      = attr('TipoDeComprobante') || 'I';

  // Calcular IVA aproximado
  const ivaMatch = xmlText.match(/Importe="([^"]+)"[^>]*Impuesto="002"/i);
  const iva = ivaMatch ? parseFloat(ivaMatch[1]) : Math.round((total - subtotal) * 100) / 100;

  if (!uuid) return null;

  return {
    empresa: empresaId,
    tipo: tipoDefault,
    uuid: uuid.toUpperCase(),
    rfcEmisor:      rfcEmisor.toUpperCase(),
    nombreEmisor,
    rfcReceptor:    rfcReceptor.toUpperCase(),
    nombreReceptor,
    folio,
    serie,
    fechaTimbrado:  fecha ? new Date(fecha) : new Date(),
    subtotal,
    iva,
    total,
    tipoComprobante: tipoComp,
    estatusSat: 'vigente',
    xmlContenido: xmlText,
  };
}

module.exports = {
  autenticarSat,
  solicitarDescarga,
  verificarSolicitud,
  descargarPaquete,
  parsearZipCfdis,
  parsarCredenciales,
};
