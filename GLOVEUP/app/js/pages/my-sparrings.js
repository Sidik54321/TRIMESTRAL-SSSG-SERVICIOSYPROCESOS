/**
 * my-sparrings.js — Retos, sesiones e historial del boxeador.
 */

import { api } from '../api.js';
import * as session from '../session.js';

const PAGE_SIZE = 5;

let els = {};
let received = [];
let sent = [];
let receivedPage = 1;
let sentPage = 1;
let reviewSessionId = '';

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="my-sparrings" */
export function init(root) {
    els = {
        root,
        challengesCount: root.querySelector('#challenges-count'),
        receivedList: root.querySelector('#challenges-received-list'),
        receivedPagination: root.querySelector('#challenges-received-pagination'),
        sentList: root.querySelector('#challenges-sent-list'),
        sentPagination: root.querySelector('#challenges-sent-pagination'),

        sessionsCount: root.querySelector('#sessions-count'),
        sessionsList: root.querySelector('#sessions-list'),

        historyCount: root.querySelector('#history-count'),
        historyEmpty: root.querySelector('#history-empty'),
        historyWrap: root.querySelector('#history-wrap'),
        historyTbody: root.querySelector('#history-tbody'),

        reviewModal: root.querySelector('#review-modal'),
        reviewForm: root.querySelector('#review-form'),
        reviewStars: root.querySelector('#review-stars'),
        reviewRating: root.querySelector('#review-rating'),
        reviewTags: root.querySelector('#review-tags'),
        reviewNote: root.querySelector('#review-note'),
        reviewCancel: root.querySelector('#review-cancel'),
        reviewClose: root.querySelector('#review-close'),
    };

    receivedPage = 1;
    sentPage = 1;

    if (session.role() === 'entrenador') {
        els.root.innerHTML = `
            <div class="mx-auto max-w-md px-6 py-16 text-center">
                <i class="fas fa-circle-info text-3xl text-faint" aria-hidden="true"></i>
                <p class="mt-4 font-bold">Esta sección es sólo para boxeadores.</p>
            </div>`;
        return;
    }

    bindReviewModal();

    refreshChallenges();
    refreshSessions();
}

export function destroy() {
    els = {};
    received = [];
    sent = [];
}

/* ── Retos ─────────────────────────────────────────────────────────── */

async function refreshChallenges() {
    try {
        const data = await api.challenges(session.email());
        received = Array.isArray(data?.received) ? data.received : [];
        sent = Array.isArray(data?.sent) ? data.sent : [];
        els.challengesCount.textContent = String(received.length + sent.length);
        renderReceived();
        renderSent();
    } catch {
        received = [];
        sent = [];
    }
}

function renderReceived() {
    const sorted = received.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    receivedPage = Math.min(receivedPage, pages);
    const page = sorted.slice((receivedPage - 1) * PAGE_SIZE, receivedPage * PAGE_SIZE);

    els.receivedList.innerHTML = page.length
        ? page.map((x) => challengeCard(x, 'from')).join('')
        : emptyRow('No tienes retos recibidos.');

    renderPagination(els.receivedPagination, receivedPage, pages, (p) => { receivedPage = p; renderReceived(); });
}

function renderSent() {
    const sorted = sent.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    sentPage = Math.min(sentPage, pages);
    const page = sorted.slice((sentPage - 1) * PAGE_SIZE, sentPage * PAGE_SIZE);

    els.sentList.innerHTML = page.length
        ? page.map((x) => challengeCard(x, 'to')).join('')
        : emptyRow('No has enviado retos todavía.');

    renderPagination(els.sentPagination, sentPage, pages, (p) => { sentPage = p; renderSent(); });
}

function challengeCard(x, direction) {
    const isReceived = direction === 'from';
    const name = isReceived ? x.fromNombre : x.toNombre;
    const email = isReceived ? x.fromEmail : x.toEmail;
    const coaches = Array.isArray(x.coachNombres) ? x.coachNombres.filter(Boolean) : [];

    return `
        <article class="card flex flex-wrap items-start justify-between gap-4 p-4">
            <div class="min-w-0">
                <p class="font-bold">${escapeHtml(name || 'Sin nombre')}</p>
                <p class="text-xs text-muted">${escapeHtml(email || '')}</p>
                <p class="mt-2 text-sm">${escapeHtml(x.preset || '')}</p>
                <p class="mt-1 text-xs text-muted">
                    ${x.gymName ? `<span>${escapeHtml(x.gymName)}</span> · ` : ''}
                    ${x.scheduledAt ? escapeHtml(formatDateTime(x.scheduledAt)) : ''}
                </p>
                ${x.note ? `<p class="mt-1 text-xs italic text-muted">${escapeHtml(x.note)}</p>` : ''}
                ${coaches.length ? `<p class="mt-1 text-xs text-muted">
                    <i class="fas fa-user-tie" aria-hidden="true"></i> ${coaches.map(escapeHtml).join(', ')}</p>` : ''}
            </div>

            <div class="flex shrink-0 flex-col items-end gap-2">
                ${statusPill(x.status)}
            </div>
        </article>
    `;
}

function renderPagination(container, current, pages, onPage) {
    container.innerHTML = '';
    if (pages <= 1) return;

    const button = (label, page, { disabled = false, active = false } = {}) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.disabled = disabled;
        b.className = 'grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-semibold '
            + 'transition-colors disabled:opacity-40 '
            + (active ? 'bg-accent text-white' : 'bg-sunken text-body hover:bg-hairline-strong/20 dark:bg-white/10 dark:text-white');
        b.addEventListener('click', () => onPage(page));
        return b;
    };

    container.appendChild(button('‹', current - 1, { disabled: current === 1 }));
    for (let p = 1; p <= pages; p += 1) container.appendChild(button(String(p), p, { active: p === current }));
    container.appendChild(button('›', current + 1, { disabled: current === pages }));
}

/* ── Sesiones ──────────────────────────────────────────────────────── */

async function refreshSessions() {
    try {
        const data = await api.sessions(session.email());
        const all = Array.isArray(data?.sessions) ? data.sessions : [];
        renderSessions(all.filter((s) => (s.status || '').toLowerCase() !== 'completed'));
        renderHistory(all.filter((s) => (s.status || '').toLowerCase() === 'completed'));
    } catch {
        renderSessions([]);
        renderHistory([]);
    }
}

function renderSessions(sessions) {
    els.sessionsCount.textContent = String(sessions.length);

    const email = session.email();
    const rows = sessions
        .slice()
        .sort((a, b) => String(b.scheduledAt || '').localeCompare(String(a.scheduledAt || '')))
        .map((s) => {
            const isMeA = email === String(s.boxerAEmail || '').toLowerCase();
            const partner = isMeA ? s.boxerBNombre : s.boxerANombre;
            const reviewed = Array.isArray(s.reviews) && s.reviews.some((r) => String(r?.byEmail || '').toLowerCase() === email);
            const coaches = Array.isArray(s.coachNombres) ? s.coachNombres.filter(Boolean) : [];

            return `
                <article class="card flex flex-wrap items-center justify-between gap-4 p-4">
                    <div>
                        <p class="font-bold">${escapeHtml(partner || 'Partner')}</p>
                        <p class="text-xs text-muted">${escapeHtml(formatDateTime(s.scheduledAt || ''))}</p>
                        <p class="text-xs text-muted">
                            ${s.gymName ? escapeHtml(s.gymName) : ''}
                            ${coaches.length ? ` · ${coaches.map(escapeHtml).join(', ')}` : ''}
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-3">
                        ${sessionStatusPill(s.status)}
                        ${reviewed
                            ? '<span class="text-xs text-muted">Ya valorada</span>'
                            : `<button type="button" data-review="${escapeAttr(s.id)}" class="btn-primary px-3 py-1.5 text-xs">Valorar</button>`}
                    </div>
                </article>
            `;
        })
        .join('');

    els.sessionsList.innerHTML = rows || emptyRow('Todavía no tienes sesiones programadas.');

    els.sessionsList.querySelectorAll('[data-review]').forEach((btn) => {
        btn.addEventListener('click', () => openReview(btn.dataset.review));
    });
}

function renderHistory(sessions) {
    const email = session.email();
    const sorted = sessions.slice()
        .sort((a, b) => String(b.completedAt || b.scheduledAt || '').localeCompare(String(a.completedAt || a.scheduledAt || '')));

    els.historyCount.textContent = `${sorted.length} registro${sorted.length === 1 ? '' : 's'}`;
    els.historyEmpty.hidden = sorted.length > 0;
    els.historyWrap.hidden = sorted.length === 0;

    els.historyTbody.innerHTML = sorted.map((s) => {
        const isMeA = email === String(s.boxerAEmail || '').toLowerCase();
        const partner = isMeA ? (s.boxerBNombre || s.boxerBEmail) : (s.boxerANombre || s.boxerAEmail);
        const date = formatDate((s.completedAt || s.scheduledAt || '').slice(0, 10));

        return `
            <tr>
                <td class="py-2 pr-4">${escapeHtml(date)}</td>
                <td class="py-2 pr-4 font-semibold">${escapeHtml(partner || '—')}</td>
                <td class="py-2 pr-4">${escapeHtml(s.gymName || '—')}</td>
                <td class="py-2 text-muted">${escapeHtml(s.noteBoxeador || '')}</td>
            </tr>
        `;
    }).join('');
}

/* ── Modal de valoración ───────────────────────────────────────────── */

function bindReviewModal() {
    els.reviewStars.addEventListener('click', (e) => {
        const btn = e.target.closest('.star-btn');
        if (!btn) return;
        setStars(Number(btn.dataset.star));
    });

    els.reviewTags.addEventListener('click', (e) => {
        const btn = e.target.closest('.tag-btn');
        if (!btn) return;
        const pressed = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!pressed));
    });

    els.reviewCancel.addEventListener('click', closeReview);
    els.reviewClose.addEventListener('click', closeReview);
    els.reviewModal.addEventListener('cancel', (e) => { e.preventDefault(); closeReview(); });
    els.reviewForm.addEventListener('submit', onSubmitReview);
}

function openReview(sessionId) {
    reviewSessionId = sessionId;
    setStars(0);
    els.reviewTags.querySelectorAll('.tag-btn').forEach((btn) => btn.removeAttribute('aria-pressed'));
    els.reviewNote.value = '';
    els.reviewModal.showModal();
}

function closeReview() {
    els.reviewModal.close();
    reviewSessionId = '';
}

function setStars(count) {
    els.reviewRating.value = count ? String(count) : '';
    els.reviewStars.querySelectorAll('.star-btn').forEach((btn) => {
        btn.classList.toggle('text-accent', Number(btn.dataset.star) <= count);
        btn.classList.toggle('text-faint', Number(btn.dataset.star) > count);
    });
}

async function onSubmitReview(e) {
    e.preventDefault();
    if (!reviewSessionId) return;

    const stars = Number(els.reviewRating.value || 0);
    if (!stars || stars < 1 || stars > 5) {
        window.showToast?.('Selecciona una valoración (1-5)', 'warning');
        return;
    }

    const tags = [...els.reviewTags.querySelectorAll('.tag-btn[aria-pressed="true"]')].map((btn) => btn.dataset.tag);
    const note = els.reviewNote.value.trim();

    try {
        await api.completeSession({ email: session.email(), sessionId: reviewSessionId, stars, tags, note });
        closeReview();
        window.showToast?.('Valoración enviada.', 'success');
        await refreshSessions();
    } catch (err) {
        window.showToast?.(err.message || 'No se pudo guardar la valoración', 'error');
    }
}

/* ── Utilidades ────────────────────────────────────────────────────── */

/**
 * Un reto lo confirman los entrenadores de ambos boxeadores, no los propios
 * boxeadores: "pending_coach_to" espera al entrenador del retado y
 * "pending_coach_from" al del retador. Aquí sólo se informa del estado;
 * responder es cosa de la sección Retos del entrenador (aún sin migrar).
 */
function statusPill(status) {
    const s = (status || '').toLowerCase();
    const labels = {
        accepted: 'Confirmado',
        declined: 'Rechazado',
        pending_coach_to: 'Esperando al entrenador del retado',
        pending_coach_from: 'Esperando a tu entrenador',
    };
    const label = labels[s] || 'Pendiente';
    const tone = s === 'accepted'
        ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
        : s === 'declined'
            ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400';
    return `<span class="rounded-full px-3 py-1 text-xs font-bold ${tone}">${label}</span>`;
}

function sessionStatusPill(status) {
    const s = (status || '').toLowerCase();
    const label = s === 'completed' ? 'Completado' : s === 'scheduled' ? 'Programado' : (status || '—');
    const tone = s === 'completed'
        ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
        : 'bg-sunken text-muted dark:bg-white/10 dark:text-white/60';
    return `<span class="rounded-full px-3 py-1 text-xs font-bold ${tone}">${escapeHtml(label)}</span>`;
}

function emptyRow(message) {
    return `<p class="p-3 text-center text-sm text-muted">${escapeHtml(message)}</p>`;
}

function formatDateTime(iso) {
    const dt = new Date(iso || '');
    if (Number.isNaN(dt.getTime())) return String(iso || '');
    return dt.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return y && m && d ? `${d}/${m}/${y}` : isoDate;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
