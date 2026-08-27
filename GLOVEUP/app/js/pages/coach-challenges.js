/**
 * coach-challenges.js — Retos y sesiones de los boxeadores del entrenador.
 *
 * Migración de CoachChallenges (dashboard/entrenador/dashboard.react.js).
 * El backend mezcla dos conceptos con el mismo aspecto: el reto original
 * (que llega a "accepted" cuando ambos entrenadores lo confirman) y la
 * sesión que se crea en ese momento con un id propio. Ambos aparecen como
 * tarjetas independientes — así los entrega /me/challenges-for-boxers y así
 * los mostraba también el dashboard clásico, no es un bug de esta migración.
 */

import { api } from '../api.js';
import * as session from '../session.js';

const ARCHIVED_KEY = 'gloveup_trainer_archived';
const PLACEHOLDER = '/assets/images/unnamed-removebg-preview.png';

const TABS = [
    { key: 'pending', label: 'En curso' },
    { key: 'accepted', label: 'Aceptado' },
    { key: 'declined', label: 'Rechazado' },
    { key: 'completed', label: 'Completados' },
    { key: 'history', label: 'Historial' },
];

let els = {};
let challenges = [];
let archivedIds = [];
let filter = 'pending';
let completingId = '';

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="coach-challenges" */
export function init(root) {
    if (session.role() !== 'entrenador') {
        root.innerHTML = `
            <div class="mx-auto max-w-md px-6 py-16 text-center">
                <i class="fas fa-circle-info text-3xl text-faint" aria-hidden="true"></i>
                <p class="mt-4 font-bold">Esta sección es sólo para entrenadores.</p>
            </div>`;
        return;
    }

    els = {
        root,
        heading: root.querySelector('#cc-heading'),
        tabs: root.querySelector('#cc-tabs'),
        message: root.querySelector('#cc-message'),
        skeletons: root.querySelector('#cc-skeletons'),
        list: root.querySelector('#cc-list'),
        empty: root.querySelector('#cc-empty'),
        emptyText: root.querySelector('#cc-empty-text'),

        completeModal: root.querySelector('#complete-modal'),
        completeStars: root.querySelector('#complete-stars'),
        completeRating: root.querySelector('#complete-rating'),
        completeNote: root.querySelector('#complete-note'),
        completeCancel: root.querySelector('#complete-cancel'),
        completeSubmit: root.querySelector('#complete-submit'),
    };

    challenges = [];
    filter = 'pending';
    completingId = '';
    archivedIds = readArchived();

    els.heading.textContent = session.name() || 'Entrenador';

    bindTabs();
    bindList();
    bindCompleteModal();

    load();
}

export function destroy() {
    els = {};
    challenges = [];
}

/* ── Carga ─────────────────────────────────────────────────────────── */

async function load() {
    toggle(els.skeletons, true);
    toggle(els.list, false);
    toggle(els.empty, false);

    try {
        const data = await api.coachChallenges(session.email());
        challenges = Array.isArray(data) ? data : [];
        render();
    } catch (err) {
        showMessage(err.message || 'Error cargando los retos de tus boxeadores.', 'error');
        challenges = [];
        render();
    }
}

/* ── Filtros ───────────────────────────────────────────────────────── */

function bindTabs() {
    els.tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        filter = btn.dataset.tab;
        render();
    });
}

function isPendingStatus(s) {
    return !s || s === 'pending' || s === 'pending_coach_to' || s === 'pending_coach_from';
}

function visibleFor(key) {
    if (key === 'completed') return challenges.filter((c) => c.status === 'completed' && !archivedIds.includes(c.id));
    if (key === 'history') return challenges.filter((c) => archivedIds.includes(c.id));

    const visible = challenges.filter((c) => c.status !== 'completed' && !archivedIds.includes(c.id));
    if (key === 'pending') return visible.filter((c) => isPendingStatus(c.status));
    if (key === 'accepted') return visible.filter((c) => c.status === 'accepted');
    if (key === 'declined') return visible.filter((c) => c.status === 'declined');
    return visible;
}

/* ── Render ────────────────────────────────────────────────────────── */

function render() {
    toggle(els.skeletons, false);

    els.tabs.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.tab === filter));
        const count = els.tabs.querySelector(`[data-count="${btn.dataset.tab}"]`);
        if (count) count.textContent = String(visibleFor(btn.dataset.tab).length);
    });

    const items = visibleFor(filter);

    toggle(els.empty, items.length === 0);
    toggle(els.list, items.length > 0);

    // Se reasigna siempre, incluso vacío: el contenedor oculto seguiría
    // conteniendo las tarjetas del filtro anterior si no se limpia aquí.
    els.list.innerHTML = items.length ? items.map(card).join('') : '';

    if (items.length === 0) {
        els.emptyText.textContent = challenges.length === 0
            ? 'No hay retos para tus boxeadores.'
            : 'No hay retos en esta categoría.';
    }
}

function card(c) {
    const isInbound = c.direction === 'inbound';
    const challenger = { name: isInbound ? c.otherName : c.boxerName, level: isInbound ? c.otherNivel : c.boxerNivel, weight: isInbound ? c.otherPeso : c.boxerPeso, photo: isInbound ? c.otherFoto : c.boxerFoto };
    const challenged = { name: isInbound ? c.boxerName : c.otherName, level: isInbound ? c.boxerNivel : c.otherNivel, weight: isInbound ? c.boxerPeso : c.otherPeso, photo: isInbound ? c.boxerFoto : c.otherFoto };
    const coaches = Array.isArray(c.coachNombres) ? c.coachNombres.filter(Boolean) : [];
    const inHistory = filter === 'history';

    return `
        <article class="card p-6" data-id="${escapeAttr(c.id)}">
            <!-- Cabecera -->
            <div class="flex items-center justify-between border-b border-hairline pb-3 dark:border-white/10">
                <span class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                    <i class="fas fa-shield-alt" aria-hidden="true"></i>
                    ${c.direction === 'outbound' ? 'Reto enviado' : 'Propuesta de sparring'}
                </span>
                <div class="flex items-center gap-2">
                    ${statusPill(c)}
                    <button type="button" data-archive-toggle
                            title="${inHistory ? 'Restaurar' : 'Archivar'}"
                            class="grid h-7 w-7 place-items-center rounded-full text-muted
                                   transition-colors hover:bg-sunken dark:hover:bg-white/10">
                        <i class="fas ${inHistory ? 'fa-undo' : 'fa-trash-alt'}" aria-hidden="true"></i>
                    </button>
                </div>
            </div>

            <!-- Enfrentamiento -->
            <div class="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                ${fighter(challenger, 'text-body dark:text-white')}

                <div class="flex flex-col items-center gap-2 text-center">
                    <span class="grid h-10 w-10 place-items-center rounded-full bg-ink text-xs font-black text-white
                                 ring-4 ring-surface dark:ring-night-soft">VS</span>
                    <p class="text-xs font-bold">${escapeHtml(c.preset || '')}</p>
                    <p class="text-xs text-muted">
                        <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                        ${c.scheduledAt ? escapeHtml(formatDateTime(c.scheduledAt)) : ''}
                    </p>
                </div>

                ${fighter(challenged, 'text-accent')}
            </div>

            <!-- Gimnasio y entrenadores -->
            <div class="mt-4 grid gap-2 rounded-xl bg-sunken p-3 text-xs text-muted dark:bg-white/5 sm:grid-cols-2">
                <p><i class="fas fa-building" aria-hidden="true"></i> <strong>Ubicación:</strong> ${escapeHtml(c.gymName || '—')}</p>
                ${coaches.length ? `<p><i class="fas fa-user-tie" aria-hidden="true"></i> <strong>Supervisión:</strong> ${coaches.map(escapeHtml).join(', ')}</p>` : ''}
            </div>

            ${c.note ? `<p class="mt-3 text-sm italic text-muted">"${escapeHtml(c.note)}"</p>` : ''}

            ${actions(c)}
        </article>
    `;
}

function fighter(f, nameClass) {
    return `
        <div class="text-center">
            <img src="${escapeAttr(f.photo || PLACEHOLDER)}" alt=""
                 class="mx-auto h-16 w-16 rounded-full border-4 border-sunken object-cover dark:border-white/10">
            <p class="mt-2 truncate text-sm font-bold ${nameClass}">${escapeHtml(f.name || 'Boxeador')}</p>
            <span class="mt-1 inline-block rounded bg-sunken px-2 py-0.5 text-xs text-muted dark:bg-white/10">
                ${escapeHtml(f.level || 'Amateur')}
            </span>
            ${f.weight ? `<p class="mt-1 text-xs text-faint">Peso: ${escapeHtml(f.weight)}</p>` : ''}
        </div>
    `;
}

function statusPill(c) {
    const s = c.status || 'pending';
    const isToCoach = (c.direction || 'inbound') === 'inbound';
    const myApp = isToCoach ? c.coachToApproval : c.coachFromApproval;
    const otherApp = isToCoach ? c.coachFromApproval : c.coachToApproval;
    const iApproved = isToCoach ? c.coachToApproval === true : c.coachFromApproval === true;

    let label, tone;
    if (s === 'accepted') { label = 'Aceptado'; tone = 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400'; }
    else if (s === 'declined') { label = 'Rechazado'; tone = 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400'; }
    else if (s === 'completed') { label = 'Finalizado'; tone = 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400'; }
    else if (iApproved) { label = 'Esperando al rival'; tone = 'bg-sunken text-muted dark:bg-white/10 dark:text-white/60'; }
    else if (myApp == null && otherApp == null) { label = isToCoach ? 'Tu aprobación necesaria' : 'Debes aprobar tu reto'; tone = 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400'; }
    else if (myApp == null && otherApp != null) { label = '¡Tu aprobación necesaria!'; tone = 'bg-amber-100 text-amber-900 dark:bg-amber-500/25 dark:text-amber-300'; }
    else { label = 'En curso'; tone = 'bg-sunken text-body dark:bg-white/10 dark:text-white'; }

    return `<span class="rounded-full px-3 py-1 text-[0.7rem] font-black uppercase tracking-wide ${tone}">${label}</span>`;
}

function actions(c) {
    const s = c.status || 'pending';
    const isToCoach = (c.direction || 'inbound') === 'inbound';
    const myApproval = isToCoach ? c.coachToApproval : c.coachFromApproval;
    const canAct = s !== 'accepted' && s !== 'declined' && s !== 'completed' && myApproval == null;

    if (canAct) {
        return `
            <div class="mt-4 flex justify-center gap-6">
                <button type="button" data-respond="accept" title="Aprobar sparring"
                        class="grid h-14 w-14 place-items-center rounded-full bg-green-100 text-xl text-green-600
                               shadow-card transition-transform hover:scale-110 hover:bg-green-600 hover:text-white
                               dark:bg-green-500/15 dark:text-green-400">
                    <i class="fas fa-check" aria-hidden="true"></i>
                </button>
                <button type="button" data-respond="decline" title="Rechazar reto"
                        class="grid h-14 w-14 place-items-center rounded-full bg-red-100 text-xl text-red-600
                               shadow-card transition-transform hover:scale-110 hover:bg-red-600 hover:text-white
                               dark:bg-red-500/15 dark:text-red-400">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
        `;
    }

    if (s === 'accepted') {
        return `
            <div class="mt-4 flex justify-center">
                <button type="button" data-complete class="btn-primary">
                    <i class="fas fa-flag-checkered" aria-hidden="true"></i> Finalizar y valorar
                </button>
            </div>
        `;
    }

    if (s === 'completed') {
        const rating = Number(c.rating) || 0;
        if (!rating) {
            return `
                <div class="mt-4 text-center">
                    <button type="button" data-complete class="btn-primary">
                        <i class="fas fa-star" aria-hidden="true"></i> Valorar
                    </button>
                </div>
            `;
        }
        return `
            <div class="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-center
                        dark:border-sky-500/30 dark:bg-sky-500/10">
                <p class="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                    <i class="fas fa-flag-checkered" aria-hidden="true"></i> Sparring finalizado
                </p>
                <div class="mt-2 flex items-center justify-center gap-1">
                    ${Array.from({ length: 5 }, (_, i) =>
                        `<i class="${i < rating ? 'fas' : 'far'} fa-star text-lg ${i < rating ? 'text-amber-400' : 'text-faint'}"></i>`).join('')}
                    <span class="ml-2 font-black">${rating}/5</span>
                </div>
                ${c.completedNote ? `<p class="mt-2 text-sm italic text-muted">"${escapeHtml(c.completedNote)}"</p>` : ''}
            </div>
        `;
    }

    return '';
}

/* ── Interacción con la lista ─────────────────────────────────────── */

function bindList() {
    els.list.addEventListener('click', async (e) => {
        const card = e.target.closest('[data-id]');
        if (!card) return;
        const id = card.dataset.id;

        const respondBtn = e.target.closest('[data-respond]');
        if (respondBtn) {
            await respond(id, respondBtn.dataset.respond);
            return;
        }

        if (e.target.closest('[data-complete]')) {
            openComplete(id);
            return;
        }

        if (e.target.closest('[data-archive-toggle]')) {
            toggleArchive(id);
        }
    });
}

async function respond(challengeId, action) {
    try {
        await api.respondCoachChallenge(session.email(), challengeId, action);
        showMessage(`Reto ${action === 'accept' ? 'aprobado' : 'rechazado'} correctamente.`, 'ok');
        await load();
    } catch (err) {
        showMessage(err.message || 'No se pudo procesar la respuesta.', 'error');
    }
}

function toggleArchive(id) {
    archivedIds = archivedIds.includes(id) ? archivedIds.filter((x) => x !== id) : [...archivedIds, id];
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(archivedIds));
    render();
}

/* ── Modal de finalización ─────────────────────────────────────────── */

function bindCompleteModal() {
    els.completeStars.addEventListener('click', (e) => {
        const btn = e.target.closest('.star-btn');
        if (!btn) return;
        setRating(Number(btn.dataset.star));
    });

    els.completeCancel.addEventListener('click', () => els.completeModal.close());
    els.completeModal.addEventListener('cancel', () => { completingId = ''; });
    els.completeSubmit.addEventListener('click', onCompleteSubmit);
}

function openComplete(challengeId) {
    completingId = challengeId;
    setRating(5);
    els.completeNote.value = '';
    els.completeModal.showModal();
}

function setRating(value) {
    els.completeRating.value = String(value);
    els.completeStars.querySelectorAll('.star-btn').forEach((btn) => {
        btn.classList.toggle('text-accent', Number(btn.dataset.star) <= value);
        btn.classList.toggle('text-faint', Number(btn.dataset.star) > value);
    });
}

async function onCompleteSubmit() {
    if (!completingId) return;

    try {
        await api.completeCoachChallenge(session.email(), {
            challengeId: completingId,
            stars: Number(els.completeRating.value || 5),
            note: els.completeNote.value.trim(),
        });
        els.completeModal.close();
        showMessage('Sparring completado y valorado correctamente.', 'ok');
        filter = 'completed';
        completingId = '';
        await load();
    } catch (err) {
        showMessage(err.message || 'No se pudo completar el sparring.', 'error');
    }
}

/* ── Utilidades ────────────────────────────────────────────────────── */

function readArchived() {
    try {
        const raw = JSON.parse(localStorage.getItem(ARCHIVED_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

function showMessage(text, kind) {
    els.message.hidden = false;
    els.message.textContent = text;
    els.message.className = 'mt-4 rounded-xl px-4 py-3 text-sm font-semibold '
        + (kind === 'error'
            ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400'
            : 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400');
}

function toggle(el, show) { if (el) el.hidden = !show; }

function formatDateTime(iso) {
    const dt = new Date(iso || '');
    if (Number.isNaN(dt.getTime())) return String(iso || '');
    return dt.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
