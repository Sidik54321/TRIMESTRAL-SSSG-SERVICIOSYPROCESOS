/**
 * validators.js — Funciones puras de validación de formularios de autenticación.
 *
 * Módulo sin efectos secundarios: no accede al DOM, a la red ni a localStorage.
 * Diseñado para ser testeable de forma totalmente aislada (ver tests/frontend/validators.test.js).
 * Exportado como módulo ES para uso en auth.js y cualquier otro módulo que lo necesite.
 *
 * Funciones exportadas:
 *  - isValidEmail      → valida formato de email
 *  - isValidPassword   → comprueba longitud mínima, mayúscula y número
 *  - isValidDni        → valida longitud de DNI/Licencia
 *  - doPasswordsMatch  → compara dos cadenas de contraseña
 *  - escapeRegex       → escapa metacaracteres de RegExp
 *  - isValidName       → valida longitud de nombre
 */

// ─── VALIDACIÓN DE EMAIL ─────────────────────────────────────────────────────

/**
 * Verifica que el email tenga formato básico válido (usuario@dominio.tld).
 * Usa una expresión regular RFC-básica: requiere al menos un carácter antes
 * del '@', un dominio no vacío y una extensión después del último punto.
 * No hace verificación de existencia real del dominio (eso es del servidor).
 *
 * @param {*} email - Valor a validar (se comprueba el tipo antes del regex).
 * @returns {boolean} true si el email tiene formato válido; false en cualquier otro caso.
 */
export function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── VALIDACIÓN DE CONTRASEÑA ────────────────────────────────────────────────

/**
 * Comprueba que la contraseña cumpla los tres requisitos mínimos:
 *  - Al menos 8 caracteres.
 *  - Al menos 1 letra mayúscula (A-Z).
 *  - Al menos 1 dígito numérico (0-9).
 *
 * @param {*} password - Contraseña a validar.
 * @returns {boolean} true si cumple todos los requisitos; false si no.
 */
export function isValidPassword(password) {
    if (typeof password !== 'string' || password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
}

// ─── VALIDACIÓN DE DNI / LICENCIA ────────────────────────────────────────────

/**
 * Valida que el DNI o número de licencia tenga entre 6 y 20 caracteres.
 * Acepta cualquier combinación alfanumérica (DNI español, licencia de boxeo, etc.).
 * El límite de 20 previene desbordamientos si alguien pega datos erróneos.
 * Se normaliza a mayúsculas y se elimina whitespace antes de medir la longitud.
 * Soporta valores null/undefined (devuelve false en lugar de lanzar error).
 *
 * @param {*} dni - DNI o número de licencia a validar.
 * @returns {boolean} true si tiene entre 6 y 20 caracteres; false si no.
 */
export function isValidDni(dni) {
    const clean = (dni || '').toString().trim().toUpperCase();
    return clean.length >= 6 && clean.length <= 20;
}

// ─── COMPARACIÓN DE CONTRASEÑAS ──────────────────────────────────────────────

/**
 * Comprueba que las dos contraseñas introducidas sean estrictamente idénticas.
 * Usa comparación con === (sensible a mayúsculas y tipos).
 * Devuelve false si cualquiera de las dos está vacía o no definida.
 *
 * @param {string} pass   - Primera contraseña (campo "contraseña").
 * @param {string} repeat - Segunda contraseña (campo "repetir contraseña").
 * @returns {boolean} true si son exactamente iguales; false si difieren.
 */
export function doPasswordsMatch(pass, repeat) {
    return pass === repeat;
}

// ─── ESCAPE PARA REGEXP ──────────────────────────────────────────────────────

/**
 * Escapa todos los metacaracteres de RegExp en el valor dado.
 * Necesario cuando se construyen expresiones regulares dinámicamente a partir
 * de texto introducido por el usuario (ej: búsquedas en el listado de boxeadores).
 * Sin este escape, un punto "." en el nombre matchearía cualquier carácter.
 * Devuelve '' para valores null, undefined o vacíos (sin lanzar error).
 *
 * Caracteres escapados: . * + ? ^ $ { } ( ) | [ ] \
 *
 * @param {*} value - Cadena a escapar.
 * @returns {string} Cadena con los metacaracteres escapados con barra invertida.
 */
export function escapeRegex(value) {
    return (value || '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── VALIDACIÓN DE NOMBRE ────────────────────────────────────────────────────

/**
 * Valida que el nombre tenga una longitud razonable: mínimo 2 y máximo 100 caracteres.
 * Se aplica trim() antes de medir para que espacios en blanco solos fallen la validación.
 * El límite inferior de 2 excluye iniciales sueltas ("A") que no son nombres completos.
 * El límite de 100 descarta posibles intentos de inyección de texto muy largo.
 *
 * @param {*} name - Nombre a validar.
 * @returns {boolean} true si tiene entre 2 y 100 caracteres (sin espacios exteriores).
 */
export function isValidName(name) {
    const clean = (name || '').toString().trim();
    return clean.length >= 2 && clean.length <= 100;
}
