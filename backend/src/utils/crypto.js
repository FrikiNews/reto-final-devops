/**
 * utils/crypto.js
 * Cifrado/descifrado AES-256-CBC para datos sensibles de e.firma.
 * La clave maestra se lee de EFIRMA_SECRET en .env.
 * NUNCA exponer la clave maestra ni los datos cifrados al frontend.
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY_LEN   = 32; // 256 bits
const IV_LEN    = 16; // 128 bits

function getMasterKey() {
  const secret = process.env.EFIRMA_SECRET;
  if (!secret) throw new Error('EFIRMA_SECRET no configurado en .env');
  // Derivar 32 bytes desde el secret usando SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Cifra un string o Buffer.
 * @returns {{ enc: string, iv: string }} — ambos en hex
 */
function encrypt(plaintext) {
  const key = getMasterKey();
  const iv  = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const input  = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return { enc: encrypted.toString('hex'), iv: iv.toString('hex') };
}

/**
 * Descifra un valor cifrado con encrypt().
 * @returns {Buffer}
 */
function decrypt(enc, ivHex) {
  const key = getMasterKey();
  const iv  = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc, 'hex')),
    decipher.final(),
  ]);
  return decrypted;
}

/**
 * Descifra y devuelve string UTF-8.
 */
function decryptString(enc, ivHex) {
  return decrypt(enc, ivHex).toString('utf8');
}

module.exports = { encrypt, decrypt, decryptString };
