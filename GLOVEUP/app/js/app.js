/**
 * app.js — Punto de entrada de la SPA.
 *
 * Ordena el arranque: primero el control de sesión (para no enseñar datos a
 * quien no ha entrado), después el chrome persistente —tema, menú lateral,
 * datos del usuario— y por último el router.
 */

import { start } from './router.js';
import { api } from './api.js';
import * as session from './session.js';

const isApp = document.body.dataset.shell === 'app';

boot();

async function boot() {
    // Las vistas con sidebar exigen sesión válida; si no la hay, guard()
    // redirige y no merece la pena montar nada más.
    if (isApp && !(await session.guard())) return;

    setupTheme();
    setupSidebar();

    if (isApp) {
        applyRoleVisibility();
        fillUserChip();
    }

    start({ onRender: setupModals });
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
    if (!email || (role !== 'boxeador' && role !== 'entrenador')) {
        if (!cached) show(email || 'Mi cuenta');
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

/* ── Modales declarativos ──────────────────────────────────────────── */

/**
 * Conecta los modales de la vista activa.
 *
 * Se vuelve a llamar tras cada navegación porque los modales viven dentro
 * de la vista y desaparecen con ella.
 */
function setupModals(scope = document) {
    const modal = scope.querySelector?.('#login-modal');
    if (!modal || modal.dataset.ready) return;
    modal.dataset.ready = '1';

    const open = () => {
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
    };

    const close = () => {
        modal.hidden = true;
        document.body.style.overflow = '';
    };

    scope.querySelectorAll('[data-login-trigger]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            open();
        });
    });

    modal.querySelectorAll('[data-modal-close]').forEach((el) => {
        el.addEventListener('click', close);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) close();
    });
}
