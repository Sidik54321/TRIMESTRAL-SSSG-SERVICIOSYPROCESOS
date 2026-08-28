/**
 * sparring.js — Módulo de la página "Buscar Sparring".
 *
 * Reproduce el comportamiento de la versión clásica (sparring/index.html):
 * listado filtrable de boxeadores con paginación y un modal para retar a
 * sparring que exige seleccionar entrenador(es) supervisor(es), gimnasio y
 * fecha. Las reglas de negocio (quién puede retar a quién, qué entrenadores
 * son obligatorios) las sigue validando el backend; aquí sólo se replican
 * las mismas comprobaciones para dar feedback inmediato.
 */

import { api } from '../api.js';
import * as session from '../session.js';
import * as loginModal from '../login-modal.js';
import { createDateTimePicker, formatDisplay } from '../datetime-picker.js';

const PAGE_SIZE = 10;
const STATE_KEY = 'gloveup_sparring_state';

let els = {};
let picker = null;
let abort = null;

let allBoxeadores = [];
let filtered = [];
let currentPage = 1;

// Estado del modal de reto
let targetIdentifier = '';
let coaches = [];
let selectedCoachIds = new Set();
let requiredCoachIds = new Set();
let gyms = [];
let gymsLoaded = false;

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="sparring" */
export function init(root) {
    els = {
        root,
        level: root.querySelector('#sp-level'),
        weight: root.querySelector('#sp-weight'),
        location: root.querySelector('#sp-location'),
        reset: root.querySelector('#sp-reset'),
        count: root.querySelector('#sp-count'),
        skeletons: root.querySelector('#sp-skeletons'),
        list: root.querySelector('#sp-list'),
        empty: root.querySelector('#sp-empty'),
        error: root.querySelector('#sp-error'),
        retry: root.querySelector('#sp-retry'),
        pagination: root.querySelector('#sp-pagination'),

        challengeModal: root.querySelector('#challenge-modal'),
        challengeTitle: root.querySelector('#challenge-title'),
        challengeForm: root.querySelector('#challenge-form'),
        challengePreset: root.querySelector('#challenge-preset'),
        presetGrid: root.querySelector('#preset-grid'),
        coachSearch: root.querySelector('#coach-search'),
        coachChecklist: root.querySelector('#coach-checklist'),
        gymSearch: root.querySelector('#gym-search'),
        gymChecklist: root.querySelector('#gym-checklist'),
        challengeDatetime: root.querySelector('#challenge-datetime'),
        challengeNote: root.querySelector('#challenge-note'),
        challengeCancel: root.querySelector('#challenge-cancel'),
        challengeClose: root.querySelector('#challenge-close'),
        cancelConfirm: root.querySelector('#challenge-cancel-confirm'),
        dtOverlay: root.querySelector('#dt-overlay'),
    };

    currentPage = 1;
    selectedCoachIds = new Set();
    requiredCoachIds = new Set();
    gyms = [];
    gymsLoaded = false;
    coaches = [];

    picker = createDateTimePicker(
        els.dtOverlay,
        (iso) => {
            els.challengeDatetime.dataset.iso = iso;
            els.challengeDatetime.value = formatDisplay(iso);
        },
        (message) => window.showToast?.(message, 'warning'),
    );

    bindFilters();
    bindChallengeModal();

    load();
}

export function destroy() {
    abort?.abort();
    abort = null;
    els = {};
    picker = null;
    allBoxeadores = [];
    filtered = [];
}

/* ── Carga de datos ────────────────────────────────────────────────── */

async function load() {
    abort?.abort();
    const run = new AbortController();
    abort = run;

    toggle(els.skeletons, true);
    toggle(els.list, false);
    toggle(els.empty, false);
    toggle(els.error, false);

    try {
        allBoxeadores = await api.boxeadores();
        if (run.signal.aborted) return;

        allBoxeadores = Array.isArray(allBoxeadores) ? allBoxeadores : [];
        filtered = allBoxeadores.slice();

        fillLocations();
        restoreState();
        applyFilters();
        render(currentPage);
    } catch (err) {
        if (run.signal.aborted) return;
        toggle(els.skeletons, false);
        toggle(els.error, true);
    }
}

/** Restaura filtros y página al volver desde una ficha de perfil. */
function restoreState() {
    let saved = null;
    try {
        saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    } catch {
        saved = null;
    }
    if (!saved) return;

    if (typeof saved.level === 'string') els.level.value = saved.level;
    if (typeof saved.weight === 'string') els.weight.value = saved.weight;
    if (typeof saved.location === 'string') els.location.value = saved.location;
    if (Number.isFinite(saved.page)) currentPage = saved.page;

    sessionStorage.removeItem(STATE_KEY);
}

function fillLocations() {
    const cities = [...new Set(allBoxeadores.map((b) => b.ubicacion).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'));

    els.location.innerHTML = '<option value="">Todas las ubicaciones</option>'
        + cities.map((c) => `<option>${escapeHtml(c)}</option>`).join('');
}

/* ── Filtros ───────────────────────────────────────────────────────── */

function bindFilters() {
    const onChange = () => { applyFilters(); render(1); };

    els.level.addEventListener('change', onChange);
    els.weight.addEventListener('change', onChange);
    els.location.addEventListener('change', onChange);

    els.reset.addEventListener('click', () => {
        els.level.value = '';
        els.weight.value = '';
        els.location.value = '';
        onChange();
    });
}

function applyFilters() {
    const level = els.level.value;
    const weight = els.weight.value;
    const location = els.location.value;
    // La opción lleva la categoría entre paréntesis: "127 - 135 (Ligero)".
    // Se compara sólo por el rango numérico porque es lo que aparece en
    // el campo libre "peso" de cada boxeador.
    const weightToken = weight ? weight.split('(')[0].trim() : '';

    filtered = allBoxeadores.filter((b) => {
        if (level && b.nivel !== level) return false;
        if (weightToken && !String(b.peso || '').includes(weightToken)) return false;
        if (location && b.ubicacion !== location) return false;
        return true;
    });
}

/* ── Render de la lista ───────────────────────────────────────────── */

function render(page) {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, page), totalPages);

    toggle(els.skeletons, false);
    toggle(els.empty, filtered.length === 0);
    toggle(els.list, filtered.length > 0);

    els.count.textContent = filtered.length === 1 ? '1 sparring' : `${filtered.length} sparrings`;

    const isGuest = !session.email();
    const isCoach = session.role() === 'entrenador';
    const myEmail = session.email();
    const me = !isCoach ? findBoxer(myEmail) : null;
    const myHasGym = Boolean(me?.gimnasio);

    const start = (currentPage - 1) * PAGE_SIZE;
    els.list.innerHTML = filtered
        .slice(start, start + PAGE_SIZE)
        .map((b, i) => rowTemplate(b, start + i + 1, { isGuest, isCoach, myEmail, myHasGym }))
        .join('');

    renderPagination(totalPages);
}

function rowTemplate(b, rank, { isGuest, isCoach, myEmail, myHasGym }) {
    const identifier = String(b.email || b.dniLicencia || '').trim();
    const isMe = identifier.toLowerCase() === myEmail;
    const canChallenge = !isGuest && !isCoach && identifier && !isMe && myHasGym;
    const challengeLabel = isGuest
        ? 'Inicia sesión'
        : isMe ? 'Tú' : (!isCoach && !myHasGym ? 'Sin gimnasio' : 'Retar');

    const stars = { Profesional: 5, Avanzado: 4, Intermedio: 3, Principiante: 1 }[b.nivel] ?? 2;
    const starsHtml = Array.from({ length: 5 }, (_, i) =>
        `<i class="${i < stars ? 'fas text-accent' : 'far text-faint'} fa-star text-xs"></i>`).join('');

    const avatar = b.foto
        ? `<img src="${escapeAttr(photoSrc(b.foto))}" alt="" class="h-12 w-12 rounded-full object-cover">`
        : `<div class="grid h-12 w-12 place-items-center rounded-full bg-sunken text-lg text-faint dark:bg-white/10">
               <i class="fas fa-user" aria-hidden="true"></i></div>`;

    const profileHref = identifier ? `/perfil/${encodeURIComponent(identifier)}` : '';

    return `
        <article class="card flex flex-wrap items-center gap-4 p-4">
            <span class="w-7 shrink-0 text-center text-sm font-bold text-muted">#${rank}</span>

            ${avatar}

            <div class="min-w-0 flex-1">
                <p class="truncate font-bold">${escapeHtml(b.nombre || 'Sin nombre')}</p>
                <p class="flex items-center gap-1 text-xs text-muted">
                    <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
                    ${escapeHtml(b.ubicacion || 'Ubicación desconocida')}
                </p>
            </div>

            <div class="hidden text-center text-xs sm:block">${starsHtml}</div>
            <div class="hidden w-28 shrink-0 text-center text-sm text-muted md:block">
                ${escapeHtml(b.peso || 'Peso libre')}
            </div>
            <div class="hidden w-20 shrink-0 text-center text-sm font-bold lg:block">
                ${escapeHtml(b.record || '0-0-0')}
            </div>

            <div class="flex shrink-0 gap-2">
                ${profileHref
                    ? `<a href="${escapeAttr(profileHref)}" data-save-state
                          class="btn-ghost px-4 py-2 text-xs">Ver perfil</a>`
                    : `<span class="btn-ghost px-4 py-2 text-xs opacity-40">Sin perfil</span>`}

                <button type="button" data-challenge="${escapeAttr(identifier)}" data-name="${escapeAttr(b.nombre || '')}"
                        ${(canChallenge || isGuest) ? '' : 'disabled'}
                        class="btn-primary px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">
                    ${escapeHtml(challengeLabel)}
                </button>
            </div>
        </article>
    `;
}

function renderPagination(totalPages) {
    els.pagination.innerHTML = '';
    if (totalPages <= 1) return;

    const button = (label, page, { disabled = false, current = false } = {}) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.disabled = disabled;
        b.className = 'grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-semibold '
            + 'transition-colors disabled:opacity-40 '
            + (current
                ? 'bg-accent text-white'
                : 'bg-sunken text-body hover:bg-hairline-strong/20 dark:bg-white/10 dark:text-white');
        if (current) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', () => {
            render(page);
            els.list.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return b;
    };

    els.pagination.appendChild(button('‹', currentPage - 1, { disabled: currentPage === 1 }));
    for (let p = 1; p <= totalPages; p += 1) {
        els.pagination.appendChild(button(String(p), p, { current: p === currentPage }));
    }
    els.pagination.appendChild(button('›', currentPage + 1, { disabled: currentPage === totalPages }));
}

/** Guarda filtros y página, y deja que el navegador siga el enlace a la ficha. */
function bindProfileLinks() {
    els.list.addEventListener('click', (e) => {
        const link = e.target.closest('[data-save-state]');
        if (!link) return;

        // Sin cuenta no hay ficha de perfil que ver: se abre el login en
        // vez de dejar que el enlace navegue.
        if (!session.email()) {
            e.preventDefault();
            loginModal.open();
            return;
        }

        sessionStorage.setItem(STATE_KEY, JSON.stringify({
            page: currentPage,
            level: els.level.value,
            weight: els.weight.value,
            location: els.location.value,
        }));
    });
}

function findBoxer(identifier) {
    const id = String(identifier || '').trim();
    if (!id) return null;
    const isEmail = id.includes('@');
    return allBoxeadores.find((b) => {
        if (isEmail) return String(b.email || '').trim().toLowerCase() === id.toLowerCase();
        return String(b.dniLicencia || '').trim().toUpperCase() === id.toUpperCase();
    }) || null;
}

/* ── Modal: retar a sparring ──────────────────────────────────────── */

function bindChallengeModal() {
    bindProfileLinks();

    els.list.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-challenge]');
        if (!btn || btn.disabled) return;

        if (!session.email()) {
            loginModal.open();
            return;
        }

        openChallenge(btn.dataset.challenge, btn.dataset.name);
    });

    els.presetGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.preset-card');
        if (!card) return;
        els.presetGrid.querySelectorAll('.preset-card').forEach((c) => c.removeAttribute('aria-pressed'));
        card.setAttribute('aria-pressed', 'true');
        els.challengePreset.value = card.dataset.preset;
    });

    els.gymSearch.addEventListener('input', () => {
        const term = els.gymSearch.value.toLowerCase();
        renderGymChecklist(gyms.filter((name) => name.toLowerCase().includes(term)));
    });

    els.coachSearch.addEventListener('input', () => {
        const term = els.coachSearch.value.toLowerCase();
        renderCoachChecklist(coaches.filter((c) =>
            requiredCoachIds.has(String(c._id))
            || (c.nombre || '').toLowerCase().includes(term)
            || (c.gimnasio || '').toLowerCase().includes(term)));
    });

    els.challengeDatetime.addEventListener('click', () => picker.open(els.challengeDatetime.dataset.iso));

    els.challengeCancel.addEventListener('click', () => confirmClose());
    els.challengeClose.addEventListener('click', () => confirmClose());
    els.challengeModal.addEventListener('cancel', (e) => { e.preventDefault(); confirmClose(); });

    els.challengeForm.addEventListener('submit', onSubmitChallenge);
}

async function confirmClose() {
    els.cancelConfirm.returnValue = '';
    els.cancelConfirm.showModal();
    els.cancelConfirm.addEventListener('close', () => {
        if (els.cancelConfirm.returnValue === 'confirm') els.challengeModal.close();
    }, { once: true });
}

async function openChallenge(identifier, name) {
    if (!prepareRequiredCoaches(identifier)) return;

    targetIdentifier = identifier;
    const isCoachRole = session.role() === 'entrenador';
    els.challengeTitle.textContent = isCoachRole
        ? (name ? `Retar/Contactar al entrenador de ${name}` : 'Retar entrenador de sparring')
        : (name ? `Retar a ${name}` : 'Retar a sparring');

    els.challengeForm.reset();
    els.challengePreset.value = '';
    els.presetGrid.querySelectorAll('.preset-card').forEach((c) => c.removeAttribute('aria-pressed'));
    delete els.challengeDatetime.dataset.iso;
    els.challengeDatetime.value = '';

    els.gymSearch.value = '';
    els.gymChecklist.innerHTML = loadingHtml();
    els.coachSearch.value = '';
    els.coachChecklist.innerHTML = loadingHtml();

    await Promise.all([loadGymOptions(), loadCoachOptions()]);

    els.challengeModal.showModal();
}

/** Calcula qué entrenadores son obligatorios: el mío y el del destinatario. */
function prepareRequiredCoaches(identifier) {
    const me = findBoxer(session.email());
    const target = findBoxer(identifier);

    if (!me?.gimnasio) {
        window.showToast?.('Debes pertenecer a un gimnasio para poder enviar retos.', 'error');
        return false;
    }
    if (!me.entrenadorId) {
        window.showToast?.('No puedes enviar el reto: tu boxeador no tiene entrenador asignado.', 'error');
        return false;
    }
    if (!target?.entrenadorId) {
        window.showToast?.('No puedes enviar el reto: el boxeador seleccionado no tiene entrenador asignado.', 'error');
        return false;
    }

    requiredCoachIds = new Set([String(me.entrenadorId), String(target.entrenadorId)]);
    return true;
}

async function loadGymOptions() {
    if (!gymsLoaded) {
        try {
            const data = await api.gimnasios();
            gyms = (Array.isArray(data) ? data : [])
                .map((g) => String(g?.nombre || ''))
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, 'es'));
        } catch {
            gyms = [];
        }
        gymsLoaded = true;
    }
    renderGymChecklist(gyms);
}

function renderGymChecklist(list) {
    if (!list.length) {
        els.gymChecklist.innerHTML = emptyHtml('No se encontraron gimnasios');
        return;
    }

    els.gymChecklist.innerHTML = list.map((name) => `
        <label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm
                      hover:bg-sunken dark:hover:bg-white/10">
            <input type="radio" name="selected-gym" value="${escapeAttr(name)}" class="accent-accent">
            ${escapeHtml(name)}
        </label>
    `).join('');
}

async function loadCoachOptions() {
    if (!coaches.length) {
        try {
            coaches = await api.entrenadores();
            coaches = (Array.isArray(coaches) ? coaches : [])
                .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
        } catch {
            coaches = [];
        }
    }
    selectedCoachIds = new Set(requiredCoachIds);
    renderCoachChecklist(coaches);
}

function renderCoachChecklist(list) {
    if (!list.length) {
        els.coachChecklist.innerHTML = emptyHtml('No se encontraron entrenadores');
        return;
    }

    const sorted = list.slice().sort((a, b) => {
        const aReq = requiredCoachIds.has(String(a._id));
        const bReq = requiredCoachIds.has(String(b._id));
        if (aReq !== bReq) return aReq ? -1 : 1;
        return String(a.nombre || '').localeCompare(String(b.nombre || ''));
    });

    els.coachChecklist.innerHTML = sorted.map((c) => {
        const id = String(c._id || '');
        const required = requiredCoachIds.has(id);
        const checked = required || selectedCoachIds.has(id);
        if (checked) selectedCoachIds.add(id);

        return `
            <label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm
                          hover:bg-sunken dark:hover:bg-white/10 ${required ? 'opacity-90' : ''}">
                <input type="checkbox" value="${escapeAttr(id)}" class="coach-cb accent-accent"
                       ${checked ? 'checked' : ''} ${required ? 'disabled' : ''}>
                <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold">
                        ${escapeHtml(c.nombre || 'Entrenador')}${required ? ' <span class="font-normal text-muted">(obligatorio)</span>' : ''}
                    </span>
                    <span class="block truncate text-xs text-muted">${escapeHtml(c.gimnasio || 'Sin gimnasio')}</span>
                </span>
            </label>
        `;
    }).join('');
}

async function onSubmitChallenge(e) {
    e.preventDefault();
    if (!targetIdentifier) return;

    const fromEmail = session.email();
    const preset = els.challengePreset.value.trim();
    const note = els.challengeNote.value.trim();
    const gymName = els.gymChecklist.querySelector('input:checked')?.value || '';
    const scheduledAt = els.challengeDatetime.dataset.iso || '';
    const coachIds = [...els.coachChecklist.querySelectorAll('.coach-cb:checked')].map((cb) => cb.value);

    if (!preset) return window.showToast?.('Selecciona una descripción', 'warning');
    if (!coachIds.length) return window.showToast?.('Selecciona al menos un entrenador', 'warning');
    if (!gymName) return window.showToast?.('Selecciona un gimnasio', 'warning');
    if (!scheduledAt) return window.showToast?.('Selecciona una fecha y hora', 'warning');

    try {
        await api.sendChallenge({ fromEmail, toIdentifier: targetIdentifier, preset, note, coachIds, gymName, scheduledAt });
        els.challengeModal.close();
        window.showToast?.('Reto enviado.', 'success');
    } catch (err) {
        window.showToast?.(err.message || 'No se pudo enviar el reto', 'error');
    }
}

/* ── Utilidades ────────────────────────────────────────────────────── */

function toggle(el, show) { if (el) el.hidden = !show; }

function loadingHtml() {
    return '<p class="p-3 text-center text-xs text-muted">Cargando…</p>';
}

function emptyHtml(message) {
    return `<p class="p-3 text-center text-xs text-muted">${escapeHtml(message)}</p>`;
}

/** Las fotos guardadas como ruta relativa vienen pensadas para /legacy. */
function photoSrc(foto) {
    return foto.startsWith('/') ? `/legacy${foto}` : foto;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
