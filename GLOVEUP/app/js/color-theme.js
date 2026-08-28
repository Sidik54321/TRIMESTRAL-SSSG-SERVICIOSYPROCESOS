/**
 * color-theme.js — Personalización en vivo de los colores de marca.
 *
 * Migración del sistema de paleta de settings.js. La versión clásica
 * sobrescribía variables --glv-* que su CSS leía con fallback (--color-accent:
 * var(--glv-accent, #f97316)). Tailwind v4 genera el mismo patrón para sus
 * utilidades de color (comprobado en el CSS compilado: .bg-accent{background-
 * color:var(--color-accent)}), así que aquí se sobrescriben directamente los
 * tokens de tema de la SPA (--color-accent, --color-ink, --color-canvas) en
 * <html>, sin depender de ninguna capa de compatibilidad adicional.
 *
 * El fondo personalizado sólo tiene efecto en tema claro: el modo oscuro no
 * usa --color-canvas para sus superficies (usa --color-night/-night-soft vía
 * clases dark:), así que queda a salvo sin necesidad de código especial —
 * igual que advertía la versión clásica ("el fondo sólo afecta al modo claro").
 */

const KEYS = {
    bg: 'gloveup_theme_bg',
    primary: 'gloveup_theme_primary',
    accent: 'gloveup_theme_accent',
};

const DEFAULTS = { bg: '#f8fafc', primary: '#0a0a0a', accent: '#f97316' };

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function hexToRgb(hex) {
    const cleaned = (hex || '').toString().trim().replace('#', '');
    if (cleaned.length !== 6) return null;
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return [r, g, b].some(Number.isNaN) ? null : { r, g, b };
}

function rgbToHex({ r, g, b }) {
    const toHex = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    if (!a || !b) return hexA;
    const tt = clamp(t, 0, 1);
    return rgbToHex({ r: a.r * (1 - tt) + b.r * tt, g: a.g * (1 - tt) + b.g * tt, b: a.b * (1 - tt) + b.b * tt });
}

function rgbaString(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) return `rgba(0,0,0,${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`;
}

/** Aclara colores oscuros y oscurece colores claros: el hover siempre se nota. */
function autoHover(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const toLinear = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const lum = 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
    return lum < 0.5 ? mixHex(hex, '#ffffff', 0.12) : mixHex(hex, '#000000', 0.12);
}

/** @param {string} hex @returns {Record<string,string>} Variables CSS derivadas */
function deriveBg(hex) {
    return { '--color-canvas': hex, '--color-sunken': mixHex(hex, '#0f172a', 0.06) };
}
function derivePrimary(hex) {
    return { '--color-ink': hex, '--color-ink-hover': autoHover(hex) };
}
function deriveAccent(hex) {
    return { '--color-accent': hex, '--color-accent-hover': mixHex(hex, '#000000', 0.18), '--color-accent-soft': rgbaString(hex, 0.1) };
}

const DERIVERS = { bg: deriveBg, primary: derivePrimary, accent: deriveAccent };

function readStored(slot) {
    try {
        const raw = localStorage.getItem(KEYS[slot]);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function setVars(vars) {
    Object.entries(vars).forEach(([name, value]) => document.documentElement.style.setProperty(name, value));
}

function removeVars(vars) {
    Object.keys(vars).forEach((name) => document.documentElement.style.removeProperty(name));
}

/** Aplica cualquier personalización guardada. Llamar en el arranque de cada página. */
export function applyStoredTheme() {
    Object.keys(KEYS).forEach((slot) => {
        const stored = readStored(slot);
        if (stored) setVars(stored.vars);
    });
}

/** @param {'bg'|'primary'|'accent'} slot @returns {string} El hex base guardado, o el de fábrica */
export function currentColor(slot) {
    return readStored(slot)?.base || DEFAULTS[slot];
}

/** @param {'bg'|'primary'|'accent'} slot @param {string} hex */
export function applyColor(slot, hex) {
    if (!hexToRgb(hex)) return; // valor parcial mientras el usuario arrastra el selector
    const vars = DERIVERS[slot](hex);
    localStorage.setItem(KEYS[slot], JSON.stringify({ base: hex, vars }));
    setVars(vars);
}

/** @param {'bg'|'primary'|'accent'} slot */
export function resetColor(slot) {
    const stored = readStored(slot);
    if (stored) removeVars(stored.vars);
    localStorage.removeItem(KEYS[slot]);
}
