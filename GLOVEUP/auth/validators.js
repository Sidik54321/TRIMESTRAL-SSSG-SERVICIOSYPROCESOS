/**
 * validators.js — Funciones puras de validación de formularios de autenticación.
 * Sin dependencias del DOM — testeables de forma aislada.
 * Usadas tanto en auth.js como en otros módulos del frontend.
 */

// ─── VALIDACIÓN DE EMAIL ─────────────────────────────────────────────────────

/** Verifica que el email tenga formato válido (contiene @ y dominio). */
export function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── VALIDACIÓN DE CONTRASEÑA ────────────────────────────────────────────────

/** La contraseña debe ser string y tener al menos 8 caracteres. */
export function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 8;
}

// ─── VALIDACIÓN DE DNI / LICENCIA ────────────────────────────────────────────

/**
 * DNI/Licencia: entre 6 y 20 caracteres alfanuméricos.
 * Se normaliza a mayúsculas antes de validar.
 */
export function isValidDni(dni) {
    const clean = (dni || '').toString().trim().toUpperCase();
    return clean.length >= 6 && clean.length <= 20;
}

// ─── COMPARACIÓN DE CONTRASEÑAS ──────────────────────────────────────────────

/** Comprueba que las dos contraseñas introducidas sean idénticas. */
export function doPasswordsMatch(pass, repeat) {
    return pass === repeat;
}

// ─── ESCAPE PARA REGEXP ──────────────────────────────────────────────────────

/**
 * Escapa caracteres especiales para usar el valor en un RegExp.
 * Evita inyecciones accidentales en expresiones regulares dinámicas.
 */
export function escapeRegex(value) {
    return (value || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── VALIDACIÓN DE NOMBRE ────────────────────────────────────────────────────

/**
 * Valida que el nombre no esté vacío y tenga longitud razonable (2–100 chars).
 */
export function isValidName(name) {
    const clean = (name || '').toString().trim();
    return clean.length >= 2 && clean.length <= 100;
}
