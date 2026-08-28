/**
 * login-modal.js — Controla el modal "Inicia sesión en GloveUp".
 *
 * El modal vive en layout/login-modal.php, fuera de #app-view, así que se
 * conecta una sola vez (init) y persiste entre navegaciones. Cualquier
 * módulo puede pedir que se abra con open(): la landing y los botones que
 * siempre exigen cuenta llevan data-login-trigger (wireTriggers los
 * conecta); las páginas explorables sin cuenta (Gimnasios, Sparring) llevan
 * data-guest-lock en los enlaces estáticos que sólo deben bloquearse sin
 * sesión (wireGuestLocks, ver app/js/app.js) y llaman a open() a mano desde
 * el contenido que generan por JavaScript (tarjetas, botón de retar…).
 */

let modal = null;

/** Conecta el cierre del modal. Sólo hace falta una vez por carga de página. */
export function init() {
    modal = document.getElementById('login-modal');
    if (!modal || modal.dataset.ready) return;
    modal.dataset.ready = '1';

    modal.querySelectorAll('[data-modal-close]').forEach((el) => {
        el.addEventListener('click', close);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) close();
    });
}

export function open() {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
}

export function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
}

/**
 * Conecta los disparadores que siempre abren el modal, dentro de un ámbito
 * recién insertado (una vista de la SPA). Se llama en cada navegación.
 *
 * @param {ParentNode} [scope]
 */
export function wireTriggers(scope = document) {
    scope.querySelectorAll('[data-login-trigger]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            open();
        });
    });
}

/**
 * Conecta los enlaces que sólo deben bloquearse cuando no hay sesión. A
 * diferencia de wireTriggers, sólo tiene sentido llamarla una vez para el
 * chrome persistente (sidebar, topbar): si hay sesión no se llama, y esos
 * elementos se comportan como enlaces normales.
 *
 * @param {ParentNode} [scope]
 */
export function wireGuestLocks(scope = document) {
    scope.querySelectorAll('[data-guest-lock]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            open();
        });
    });
}
