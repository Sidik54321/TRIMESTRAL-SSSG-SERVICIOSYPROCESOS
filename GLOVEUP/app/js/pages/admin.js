/**
 * admin.js — Panel de administración.
 *
 * Autenticación propia, independiente de session.js: no hay cuenta de
 * boxeador/entrenador de por medio, sólo la contraseña de ADMIN_PASSWORD
 * (ver server/src/routes/admin.js). El token que devuelve el login se
 * guarda en localStorage bajo gloveup_admin_token y se manda a mano en
 * cada llamada — api.js no lo conoce, a diferencia del email de sesión.
 *
 * Cualquier llamada que responda 401 (token caducado o nunca hubo uno) hace
 * volver a la pantalla de contraseña; el resto de errores se muestran en la
 * banda #admin-message sin cerrar la sesión de admin.
 */

import { api } from '../api.js';
import { loadChart } from '../cdn-loader.js';

const TOKEN_KEY = 'gloveup_admin_token';

let els = {};
let token = '';
let usuarios = [];
let gimnasios = [];
let statsLoaded = false;
let usuariosLoaded = false;
let gimnasiosLoaded = false;
let growthChart = null;
let pendingDelete = null; // { kind: 'usuario'|'gimnasio', id, label }

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="admin" */
export function init(root) {
    els = {
        root,
        loginView: root.querySelector('#admin-login'),
        loginForm: root.querySelector('#admin-login-form'),
        password: root.querySelector('#admin-password'),
        loginError: root.querySelector('#admin-login-error'),
        loginSubmit: root.querySelector('#admin-login-submit'),
        logoutBtn: root.querySelector('#admin-logout'),

        panel: root.querySelector('#admin-panel'),
        message: root.querySelector('#admin-message'),
        tabs: [...root.querySelectorAll('[data-tab]')],

        statsSkeleton: root.querySelector('#admin-stats-skeleton'),
        stats: root.querySelector('#admin-stats'),
        growthCanvas: root.querySelector('#admin-growth-chart'),

        usersSearch: root.querySelector('#admin-users-search'),
        usersSkeleton: root.querySelector('#admin-users-skeleton'),
        usersTable: root.querySelector('#admin-users-table'),
        usersBody: root.querySelector('#admin-users-body'),
        usersEmpty: root.querySelector('#admin-users-empty'),
        createUserBtn: root.querySelector('#admin-create-user-btn'),

        gymsSearch: root.querySelector('#admin-gyms-search'),
        gymsSkeleton: root.querySelector('#admin-gyms-skeleton'),
        gymsTable: root.querySelector('#admin-gyms-table'),
        gymsBody: root.querySelector('#admin-gyms-body'),
        gymsEmpty: root.querySelector('#admin-gyms-empty'),

        createModal: root.querySelector('#admin-create-modal'),
        createForm: root.querySelector('#admin-create-form'),
        createError: root.querySelector('#admin-create-error'),
        createRol: root.querySelector('#admin-create-rol'),
        createNombre: root.querySelector('#admin-create-nombre'),
        createEmail: root.querySelector('#admin-create-email'),
        createPassword: root.querySelector('#admin-create-password'),
        createDni: root.querySelector('#admin-create-dni'),
        createGimnasio: root.querySelector('#admin-create-gimnasio'),

        confirmModal: root.querySelector('#admin-confirm-modal'),
        confirmText: root.querySelector('#admin-confirm-text'),
        confirmOk: root.querySelector('#admin-confirm-ok'),
    };

    token = localStorage.getItem(TOKEN_KEY) || '';
    usuarios = [];
    gimnasios = [];
    statsLoaded = false;
    usuariosLoaded = false;
    gimnasiosLoaded = false;
    pendingDelete = null;

    bindLogin();
    bindLogout();
    bindTabs();
    bindSearches();
    bindCreateUser();
    bindTableActions();
    bindConfirmModal();

    if (token) {
        showPanel();
    } else {
        showLogin();
    }
}

export function destroy() {
    growthChart?.destroy();
    growthChart = null;
    els = {};
}

/* ── Login / logout ──────────────────────────────────────────────── */

function bindLogin() {
    els.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        els.loginError.hidden = true;
        els.loginSubmit.disabled = true;
        els.loginSubmit.textContent = 'Entrando…';

        try {
            const { token: newToken } = await api.adminLogin(els.password.value);
            token = newToken;
            localStorage.setItem(TOKEN_KEY, token);
            els.password.value = '';
            showPanel();
        } catch (err) {
            els.loginError.textContent = err.message || 'No se pudo iniciar sesión';
            els.loginError.hidden = false;
        } finally {
            els.loginSubmit.disabled = false;
            els.loginSubmit.textContent = 'Entrar';
        }
    });
}

function bindLogout() {
    els.logoutBtn.addEventListener('click', () => {
        token = '';
        localStorage.removeItem(TOKEN_KEY);
        statsLoaded = usuariosLoaded = gimnasiosLoaded = false;
        showLogin();
    });
}

function showLogin() {
    els.loginView.hidden = false;
    els.panel.hidden = true;
    els.logoutBtn.hidden = true;
    els.password.focus();
}

function showPanel() {
    els.loginView.hidden = true;
    els.panel.hidden = false;
    els.logoutBtn.hidden = false;
    loadActiveTab();
}

/** Si una llamada responde 401, el token ya no vale: se vuelve al login. */
function isSessionExpired(err) {
    if (err?.status !== 401) return false;
    token = '';
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    els.loginError.textContent = 'Tu sesión de administrador ha caducado. Vuelve a entrar.';
    els.loginError.hidden = false;
    return true;
}

/* ── Pestañas ─────────────────────────────────────────────────────── */

function bindTabs() {
    els.tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
            els.tabs.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
            els.root.querySelectorAll('[id^="admin-"][id$="-tab"]').forEach((section) => {
                section.hidden = section.id !== `admin-${btn.dataset.tab}-tab`;
            });
            loadActiveTab();
        });
    });
}

function activeTab() {
    return els.tabs.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.tab || 'resumen';
}

function loadActiveTab() {
    const tab = activeTab();
    if (tab === 'resumen' && !statsLoaded) loadStats();
    if (tab === 'usuarios' && !usuariosLoaded) loadUsuarios();
    if (tab === 'gimnasios' && !gimnasiosLoaded) loadGimnasios();
}

/* ── Mensajes ─────────────────────────────────────────────────────── */

function showMessage(text, kind = 'error') {
    els.message.textContent = text;
    els.message.hidden = false;
    els.message.className = 'mb-4 rounded-xl px-4 py-3 text-sm font-semibold ' + (
        kind === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300'
            : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
    );
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(() => { els.message.hidden = true; }, 5000);
}

/* ── Resumen ──────────────────────────────────────────────────────── */

async function loadStats() {
    els.statsSkeleton.hidden = false;
    els.stats.hidden = true;

    try {
        const data = await api.adminStats(token);
        statsLoaded = true;

        els.root.querySelectorAll('[data-stat]').forEach((card) => {
            const value = data[card.dataset.stat] ?? 0;
            card.querySelector('[data-stat-value]').textContent = value.toLocaleString('es-ES');
        });

        els.statsSkeleton.hidden = true;
        els.stats.hidden = false;

        await renderGrowthChart(data.registrosPorMes || []);
    } catch (err) {
        if (isSessionExpired(err)) return;
        showMessage(err.message || 'No se pudieron cargar las estadísticas');
    }
}

async function renderGrowthChart(points) {
    const Chart = await loadChart();
    const fmt = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' });

    const labels = points.map((p) => {
        const [y, m] = p.mes.split('-').map(Number);
        return fmt.format(new Date(y, m - 1, 1));
    });
    const values = points.map((p) => p.total);

    const data = {
        labels,
        datasets: [{
            label: 'Altas',
            data: values,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: 3,
        }],
    };
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    };

    if (growthChart) {
        growthChart.data = data;
        growthChart.update();
    } else {
        growthChart = new Chart(els.growthCanvas, { type: 'line', data, options });
    }
}

/* ── Usuarios ─────────────────────────────────────────────────────── */

async function loadUsuarios() {
    els.usersSkeleton.hidden = false;
    els.usersTable.hidden = true;
    els.usersEmpty.hidden = true;

    try {
        usuarios = await api.adminUsuarios(token);
        usuariosLoaded = true;
        els.usersSkeleton.hidden = true;
        renderUsuarios();
    } catch (err) {
        els.usersSkeleton.hidden = true;
        if (isSessionExpired(err)) return;
        showMessage(err.message || 'No se pudieron cargar los usuarios');
    }
}

function renderUsuarios() {
    const term = (els.usersSearch.value || '').trim().toLowerCase();
    const rows = usuarios.filter((u) =>
        !term || `${u.nombre} ${u.email}`.toLowerCase().includes(term));

    els.usersTable.hidden = rows.length === 0;
    els.usersEmpty.hidden = rows.length !== 0;

    const fmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

    els.usersBody.innerHTML = rows.map((u) => `
        <tr>
            <td class="py-2.5 pr-3 font-semibold">${escapeHtml(u.nombre)}</td>
            <td class="py-2.5 pr-3 text-muted dark:text-white/60">${escapeHtml(u.email)}</td>
            <td class="py-2.5 pr-3"><span class="chip">${escapeHtml(u.rol)}</span></td>
            <td class="py-2.5 pr-3 text-muted dark:text-white/60">${escapeHtml(u.gimnasio || '—')}</td>
            <td class="py-2.5 pr-3 text-muted dark:text-white/60">${u.createdAt ? fmt.format(new Date(u.createdAt)) : '—'}</td>
            <td class="py-2.5 pr-3 text-right">
                <button type="button" data-delete-user="${escapeAttr(u.id)}" data-label="${escapeAttr(u.nombre)}"
                        class="grid h-8 w-8 place-items-center rounded-lg text-red-600 transition-colors
                               hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" title="Eliminar">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function bindCreateUser() {
    els.createUserBtn.addEventListener('click', () => {
        els.createForm.reset();
        els.createError.hidden = true;
        els.createModal.showModal();
    });

    els.createModal.querySelectorAll('[data-modal-close]').forEach((btn) => {
        btn.addEventListener('click', () => els.createModal.close());
    });

    els.createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        els.createError.hidden = true;

        const payload = {
            rol: els.createRol.value,
            nombre: els.createNombre.value.trim(),
            email: els.createEmail.value.trim(),
            password: els.createPassword.value.trim(),
            dniLicencia: els.createDni.value.trim(),
            gimnasio: els.createGimnasio.value.trim(),
        };

        const submitBtn = document.getElementById('admin-create-submit');
        submitBtn.disabled = true;
        try {
            await api.adminCreateUsuario(token, payload);
            els.createModal.close();
            usuariosLoaded = false;
            statsLoaded = false;
            showMessage(`Usuario "${payload.nombre}" creado`, 'success');
            if (activeTab() === 'usuarios') loadUsuarios();
        } catch (err) {
            if (isSessionExpired(err)) { els.createModal.close(); return; }
            els.createError.textContent = err.message || 'No se pudo crear el usuario';
            els.createError.hidden = false;
        } finally {
            submitBtn.disabled = false;
        }
    });
}

/* ── Gimnasios ────────────────────────────────────────────────────── */

async function loadGimnasios() {
    els.gymsSkeleton.hidden = false;
    els.gymsTable.hidden = true;
    els.gymsEmpty.hidden = true;

    try {
        gimnasios = await api.gimnasios();
        gimnasiosLoaded = true;
        els.gymsSkeleton.hidden = true;
        renderGimnasios();
    } catch (err) {
        els.gymsSkeleton.hidden = true;
        showMessage(err.message || 'No se pudieron cargar los gimnasios');
    }
}

function renderGimnasios() {
    const term = (els.gymsSearch.value || '').trim().toLowerCase();
    const rows = gimnasios.filter((g) =>
        !term || `${g.nombre} ${g.ubicacion || ''}`.toLowerCase().includes(term));

    els.gymsTable.hidden = rows.length === 0;
    els.gymsEmpty.hidden = rows.length !== 0;

    els.gymsBody.innerHTML = rows.map((g) => `
        <tr>
            <td class="py-2.5 pr-3 font-semibold">${escapeHtml(g.nombre)}</td>
            <td class="py-2.5 pr-3 text-muted dark:text-white/60">${escapeHtml(g.ubicacion || '—')}</td>
            <td class="py-2.5 pr-3 text-muted dark:text-white/60">${escapeHtml(g.creadoPorEmail || '—')}</td>
            <td class="py-2.5 pr-3 text-right">
                <button type="button" data-delete-gym="${escapeAttr(g._id)}" data-label="${escapeAttr(g.nombre)}"
                        class="grid h-8 w-8 place-items-center rounded-lg text-red-600 transition-colors
                               hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" title="Eliminar">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/* ── Búsqueda ─────────────────────────────────────────────────────── */

function bindSearches() {
    els.usersSearch.addEventListener('input', renderUsuarios);
    els.gymsSearch.addEventListener('input', renderGimnasios);
}

/* ── Borrado (usuarios y gimnasios comparten el mismo modal) ───────── */

function bindTableActions() {
    els.usersBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete-user]');
        if (!btn) return;
        pendingDelete = { kind: 'usuario', id: btn.dataset.deleteUser, label: btn.dataset.label };
        els.confirmText.textContent = `Se eliminará permanentemente la cuenta de "${btn.dataset.label}" y su perfil deportivo.`;
        els.confirmModal.showModal();
    });

    els.gymsBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete-gym]');
        if (!btn) return;
        pendingDelete = { kind: 'gimnasio', id: btn.dataset.deleteGym, label: btn.dataset.label };
        els.confirmText.textContent = `Se eliminará permanentemente "${btn.dataset.label}". Los boxeadores y entrenadores que lo tenían asignado se quedarán sin gimnasio.`;
        els.confirmModal.showModal();
    });
}

function bindConfirmModal() {
    els.confirmModal.querySelectorAll('[data-modal-close]').forEach((btn) => {
        btn.addEventListener('click', () => { pendingDelete = null; els.confirmModal.close(); });
    });

    els.confirmOk.addEventListener('click', async () => {
        if (!pendingDelete) return;
        const { kind, id, label } = pendingDelete;

        els.confirmOk.disabled = true;
        try {
            if (kind === 'usuario') {
                await api.adminDeleteUsuario(token, id);
                usuariosLoaded = false;
            } else {
                await api.adminDeleteGimnasio(token, id);
                gimnasiosLoaded = false;
                usuariosLoaded = false; // sus gimnasios asignados cambiaron
            }
            statsLoaded = false;
            els.confirmModal.close();
            showMessage(`"${label}" eliminado`, 'success');
            loadActiveTab();
        } catch (err) {
            els.confirmModal.close();
            if (isSessionExpired(err)) return;
            showMessage(err.message || 'No se pudo eliminar', 'error');
        } finally {
            els.confirmOk.disabled = false;
            pendingDelete = null;
        }
    });
}

/* ── Utilidades ───────────────────────────────────────────────────── */

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
