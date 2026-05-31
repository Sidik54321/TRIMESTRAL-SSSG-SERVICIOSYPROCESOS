/**
 * Funciones puras de validación de formularios.
 * Sin dependencias del DOM — testeable de forma aislada.
 */

export function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 8;
}

/**
 * DNI/Licencia: entre 6 y 20 caracteres alfanuméricos.
 */
export function isValidDni(dni) {
    const clean = (dni || '').toString().trim().toUpperCase();
    return clean.length >= 6 && clean.length <= 20;
}

export function doPasswordsMatch(pass, repeat) {
    return pass === repeat;
}

/**
 * Escapa caracteres especiales para usar el valor en un RegExp.
 */
export function escapeRegex(value) {
    return (value || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Valida que el nombre no esté vacío y tenga longitud razonable.
 */
export function isValidName(name) {
    const clean = (name || '').toString().trim();
    return clean.length >= 2 && clean.length <= 100;
}
