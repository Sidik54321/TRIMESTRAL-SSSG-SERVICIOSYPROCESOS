/**
 * cdn-loader.js — Carga perezosa de librerías de terceros vía CDN.
 *
 * Chart.js y FullCalendar sólo las usa el dashboard de Inicio; cargarlas en
 * el shell global las descargaría en cada página de la SPA. Se inyectan una
 * sola vez (el resultado se cachea) y sólo cuando una vista las necesita de
 * verdad.
 */

const loaded = new Map();

/**
 * Inyecta un <script> y espera a que cargue. Repetir la llamada con la
 * misma URL devuelve la promesa ya resuelta, no duplica la etiqueta.
 *
 * @param {string} src
 * @returns {Promise<void>}
 */
export function loadScript(src) {
    if (loaded.has(src)) return loaded.get(src);

    const promise = new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.onload = () => resolve();
        el.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(el);
    });

    loaded.set(src, promise);
    return promise;
}

/** Inyecta un <link rel="stylesheet"> si no está ya presente. */
export function loadStyle(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = href;
    document.head.appendChild(el);
}

/** @returns {Promise<typeof window.Chart>} */
export async function loadChart() {
    await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js');
    return window.Chart;
}

/**
 * @returns {Promise<typeof window.FullCalendar>}
 *
 * "locales-all.min.js" trae todos los idiomas en un solo archivo. La ruta
 * específica de español que usaba la versión clásica ("locales/es.global.
 * min.js") no existe para esta versión de FullCalendar y devuelve 404 — el
 * calendario nunca llegó a localizarse en producción.
 */
export async function loadFullCalendar() {
    loadStyle('https://cdn.jsdelivr.net/npm/fullcalendar@5.11.5/main.min.css');
    await loadScript('https://cdn.jsdelivr.net/npm/fullcalendar@5.11.5/main.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/fullcalendar@5.11.5/locales-all.min.js');
    return window.FullCalendar;
}
