/**
 * middleware/adminAuth.js — Autenticación del panel de administración.
 *
 * No hay una cuenta de admin en la colección "usuarios": el acceso se
 * comprueba contra una contraseña única guardada en la variable de entorno
 * ADMIN_PASSWORD (igual de sencillo que el resto de la autenticación de
 * este backend, que tampoco usa JWT). Lo único que añade esto sobre el
 * login normal es que la contraseña no viaja en cada petición: al acertar
 * se emite un token opaco de un solo uso por sesión de admin, guardado en
 * memoria con su caducidad, y las rutas protegidas sólo aceptan ese token.
 *
 * El almacén en memoria sigue el mismo patrón que el limitador de
 * peticiones de app.js: se pierde si el proceso se reinicia, lo cual es
 * aceptable aquí (obliga a volver a introducir la contraseña, nada más).
 */

import crypto from 'crypto';

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const tokens = new Map(); // token -> expiresAt

/** Compara dos contraseñas en tiempo constante, sin filtrar la longitud. */
function passwordMatches(candidate, expected) {
    const a = Buffer.from(String(candidate));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) {
        // timingSafeEqual exige buffers del mismo tamaño; comparar igualmente
        // contra sí mismo evita filtrar por temporización si las longitudes difieren.
        crypto.timingSafeEqual(a, a);
        return false;
    }
    return crypto.timingSafeEqual(a, b);
}

/**
 * Verifica la contraseña de administrador y emite un token si es correcta.
 *
 * @param {string} candidate
 * @returns {string|null} El token, o null si la contraseña no coincide.
 */
export function verifyAdminPassword(candidate) {
    const expected = process.env.ADMIN_PASSWORD || '';
    if (!expected || !candidate) return null;
    if (!passwordMatches(candidate, expected)) return null;

    const token = crypto.randomBytes(32).toString('hex');
    tokens.set(token, Date.now() + TOKEN_TTL_MS);
    return token;
}

/** Middleware: exige un token de admin válido en "Authorization: Bearer …". */
export function requireAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const expiresAt = token ? tokens.get(token) : undefined;

    if (!expiresAt || Date.now() > expiresAt) {
        if (expiresAt) tokens.delete(token); // caducado: no dejarlo ocupando memoria
        return res.status(401).json({ error: 'Sesión de administrador no válida' });
    }

    next();
}
