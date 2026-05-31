/**
 * utils/crypto.js — Utilidad de cifrado simétrico AES-256-CBC
 *
 * Proporciona funciones de cifrado y descifrado para datos sensibles
 * como el DNI o el número de licencia de los usuarios.
 *
 * Algoritmo: AES-256-CBC (Advanced Encryption Standard, bloque de 256 bits,
 * modo Cipher Block Chaining). Se usa un IV (vector de inicialización)
 * aleatorio de 16 bytes por cada cifrado para garantizar que el mismo
 * texto plano produzca siempre un cifrado diferente.
 *
 * Formato del texto cifrado almacenado: "iv_hex:encrypted_hex"
 *
 * Requisito: la variable de entorno ENCRYPTION_KEY debe contener exactamente
 * 64 caracteres hexadecimales (= 32 bytes). Si no está configurada, las
 * funciones devuelven el texto tal cual (modo pasivo/fallback).
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES requiere un IV de 16 bytes (128 bits)
const SECRET_KEY = process.env.ENCRYPTION_KEY || '';

/**
 * Comprueba si hay una clave de cifrado válida configurada.
 * La clave debe ser exactamente 64 caracteres hex (32 bytes en binario).
 *
 * @returns {boolean} true si el cifrado está habilitado
 */
function isEncryptionEnabled() {
    return SECRET_KEY.length === 64; // 32 bytes en hex = 64 caracteres
}

/**
 * Cifra un texto con AES-256-CBC.
 *
 * Genera un IV aleatorio en cada llamada para que textos idénticos
 * produzcan resultados cifrados distintos (seguridad semántica).
 *
 * @param {string} text - Texto en claro a cifrar
 * @returns {string} Texto cifrado en formato "iv_hex:encrypted_hex",
 *                   o el texto original si el cifrado está deshabilitado.
 */
export function encrypt(text) {
    if (!text || !isEncryptionEnabled()) return text;
    try {
        // Generar un IV aleatorio de 16 bytes para esta operación concreta
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'hex'), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        // Concatenar IV y datos cifrados separados por ":" para poder descifrar después
        return iv.toString('hex') + ':' + encrypted;
    } catch {
        return text; // Fallback: devolver sin cifrar si algo falla
    }
}

/**
 * Descifra un texto cifrado con AES-256-CBC.
 *
 * Extrae el IV del prefijo del string y reconstruye el texto original.
 * Si el string no tiene el formato esperado (sin ":"), se asume que es
 * texto plano y se devuelve tal cual (compatibilidad con datos antiguos).
 *
 * @param {string} encryptedText - Texto cifrado en formato "iv_hex:encrypted_hex"
 * @returns {string} Texto original descifrado,
 *                   o el valor recibido si no se puede descifrar.
 */
export function decrypt(encryptedText) {
    if (!encryptedText || !isEncryptionEnabled()) return encryptedText;
    // Si no tiene el separador ":" no es un texto cifrado con este sistema → devolver tal cual
    if (!encryptedText.includes(':')) return encryptedText;
    try {
        const [ivHex, encrypted] = encryptedText.split(':');
        if (ivHex.length !== 32) return encryptedText; // Un IV válido tiene 32 hex chars (16 bytes)
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'hex'), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        return encryptedText; // Fallback: devolver tal cual si el descifrado falla
    }
}
