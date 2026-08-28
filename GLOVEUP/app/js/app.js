/**
 * app.js — Punto de entrada de la SPA.
 *
 * Ordena el arranque: primero el control de sesión (para no enseñar datos a
 * quien no ha entrado), después el chrome persistente —tema, menú lateral,
 * datos del usuario— y por último el router.
 *
 * Modo invitado: Gimnasios y Sparring (data-guest-ok en su vista) se pueden
 * explorar sin sesión, así que guard() se salta para esas dos. El resto de
 * vistas con sidebar lo siguen exigiendo, tanto en la carga inicial como en
 * cada navegación de la SPA (guardRender), porque guard() sólo corre una
 * vez al arrancar. Dentro de las vistas explorables, cada acción que sí
 * necesita cuenta (retar, favoritos, ver perfil…) la gatean los propios
 * módulos de página llamando a loginModal.open().
 */

import { start } from './router.js';
import { api } from './api.js';
import * as session from './session.js';
import * as loginModal from './login-modal.js';

const isApp = document.body.dataset.shell === 'app';

boot();

async function boot() {
    if (isApp && !isGuestOkRoute() && !(await session.guard())) return;

    loginModal.init();
    setupTheme();
    setupSidebar();

    if (isApp) {
        applyRoleVisibility();
        applyAuthVisibility();
        fillUserChip();
        // Chrome persistente (sidebar, topbar): se conecta una sola vez aquí
        // porque, a diferencia del contenido de #app-view, no se vuelve a
        // insertar en cada navegación. Con sesión no hace falta: esos
        // enlaces deben comportarse con normalidad.
        if (!session.email()) loginModal.wireGuestLocks(document);
    }

    start({
        onRender: (view) => {
            loginModal.wireTriggers(view);
            guardRender(view);
        },
    });
}

/** ¿La vista ya renderizada en el documento se puede ver sin sesión? */
function isGuestOkRoute() {
    return !!document.querySelector('[data-page][data-guest-ok]');
}

/**
 * Repite la comprobación de sesión en cada navegación de la SPA, no sólo al
 * arrancar: si alguien sin sesión llegara por SPA a una vista que no sea
 * explorable (no debería, todos sus enlaces están gateados, pero esto es
 * el cinturón de seguridad), se le manda a iniciar sesión igual que haría
 * una carga completa de esa misma URL.
 */
function guardRender(view) {
    if (!isApp || session.email()) return;

    const root = view.querySelector('[data-page]');
    if (root && !root.hasAttribute('data-guest-ok')) {
        window.location.replace('/legacy/auth/index.html');
    }
}

/* ── Tema claro / oscuro ───────────────────────────────────────────── */

function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    const root = document.documentElement;

    // El shell ya aplicó la clase antes del primer pintado; aquí sólo
    // se sincroniza el icono y se engancha el botón.
    paintThemeButton(btn, root.classList.contains('theme-dark'));

    btn?.addEventListener('click', () => {
        const dark = root.classList.toggle('theme-dark');
        // La clase también va en <body> porque las páginas clásicas la leen ahí
        document.body.classList.toggle('theme-dark', dark);
        localStorage.setItem('gloveup_theme', dark ? 'dark' : 'light');
        paintThemeButton(btn, dark);
    });
}

function paintThemeButton(btn, dark) {
    if (!btn) return;
    const icon = btn.querySelector('i');
    const label = btn.querySelector('span');
    if (icon) icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
    if (label) label.textContent = dark ? 'Tema Claro' : 'Tema Oscuro';
}

/* ── Menú lateral ──────────────────────────────────────────────────── */

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const root = document.documentElement;
    if (!sidebar) return;

    // Colapsar / expandir en escritorio
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        const collapsed = root.classList.toggle('sidebar-collapsed');
        localStorage.setItem('gloveup_sidebar_collapsed', String(collapsed));
        // 300 ms = duración de la transición; los mapas y calendarios que
        // se añadan en fases siguientes necesitan recalcular su tamaño
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    });

    // Abrir / cerrar en móvil
    const setOpen = (open) => {
        sidebar.dataset.open = String(open);
        backdrop.hidden = !open;
    };

    document.getElementById('sidebar-open')?.addEventListener('click', () => setOpen(true));
    backdrop?.addEventListener('click', () => setOpen(false));

    // Al navegar se cierra solo, si no el menú tapa la vista nueva
    sidebar.addEventListener('click', (e) => {
        if (e.target.closest('a[href]')) setOpen(false);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setOpen(false);
    });

    document.getElementById('logout-button')?.addEventListener('click', session.logout);
}

/** Muestra los elementos de menú que corresponden al rol del usuario. */
function applyRoleVisibility() {
    const current = session.role();

    document.querySelectorAll('[data-roles]').forEach((el) => {
        const allowed = el.dataset.roles.split(',');
        el.hidden = !allowed.includes(current);
    });
}

/**
 * Alterna los bloques que sólo tienen sentido con sesión (data-auth-only,
 * como "Cerrar sesión") o sin ella (data-guest-only, como el aviso de modo
 * invitado del sidebar). Ambos arrancan con "hidden" en el HTML para no
 * enseñar el equivocado mientras carga este script.
 */
function applyAuthVisibility() {
    const loggedIn = Boolean(session.email());
    document.querySelectorAll('[data-auth-only]').forEach((el) => { el.hidden = !loggedIn; });
    document.querySelectorAll('[data-guest-only]').forEach((el) => { el.hidden = loggedIn; });
}

/** Rellena nombre y avatar de la barra superior. */
async function fillUserChip() {
    const nameEl = document.getElementById('topbar-user');
    const avatarEl = document.getElementById('topbar-avatar');
    if (!nameEl) return;

    const show = (text, photo) => {
        nameEl.classList.remove('skeleton');
        nameEl.textContent = text;
        if (photo && avatarEl) avatarEl.src = photo;
    };

    // Se pinta primero lo que ya hay en local para evitar el hueco vacío
    const cached = session.name();
    if (cached) show(cached);

    const email = session.email();
    const role = session.role();
    if (!email) {
        // Modo invitado: el chip de perfil lleva data-guest-lock y abre el
        // login al pulsarlo, así que su texto debe anunciar justo eso.
        if (!cached) show('Iniciar sesión');
        return;
    }
    if (role !== 'boxeador' && role !== 'entrenador') {
        if (!cached) show('Mi cuenta');
        return;
    }

    try {
        const data = role === 'boxeador' ? await api.boxeador(email) : await api.entrenador(email);
        const label = data?.nombre || cached || email;
        localStorage.setItem('gloveup_user_name', label);
        show(label, data?.fotoPerfil);
    } catch {
        // Sin conexión se deja lo que ya hubiera; no es un error que mostrar
        if (!cached) show(email);
    }
}
