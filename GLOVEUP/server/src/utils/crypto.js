/**
 * Utilidad de cifrado simétrico AES-256-CBC
 * Permite cifrar y descifrar datos sensibles (ej: DNI/Licencia)
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const SECRET_KEY = process.env.ENCRYPTION_KEY || '';

/**
 * Comprueba si hay una clave de cifrado configurada
 */
function isEncryptionEnabled() {
    return SECRET_KEY.length === 64; // 32 bytes en hex = 64 caracteres
}

/**
 * Cifra un texto con AES-256-CBC
 * @param {string} text - Texto a cifrar
 * @returns {string} - Texto cifrado en formato "iv_hex:encrypted_hex"
 */
export function encrypt(text) {
    if (!text || !isEncryptionEnabled()) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'hex'), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch {
        return text; // Fallback: devolver sin cifrar
    }
}

/**
 * Descifra un texto cifrado con AES-256-CBC
 * @param {string} encryptedText - Texto cifrado en formato "iv_hex:encrypted_hex"
 * @returns {string} - Texto original descifrado
 */
export function decrypt(encryptedText) {
    if (!encryptedText || !isEncryptionEnabled()) return encryptedText;
    // Si no tiene el formato iv:encrypted, es texto plano
    if (!encryptedText.includes(':')) return encryptedText;
    try {
        const [ivHex, encrypted] = encryptedText.split(':');
        if (ivHex.length !== 32) return encryptedText; // No es un IV válido
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'hex'), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        return encryptedText; // Fallback: devolver tal cual
    }
}
