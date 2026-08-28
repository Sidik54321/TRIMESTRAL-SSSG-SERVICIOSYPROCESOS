/**
 * dashboard.js — Inicio.
 *
 * Migración de BoxerDashboard y CoachStatsDashboard (los dashboard.react.js
 * de boxeador y entrenador) a JavaScript vano: la SPA no carga React, así
 * que se reescribe
 * el mismo comportamiento directamente sobre el DOM. Ambos roles comparten
 * el mismo modal de evento (#event-modal en dashboard.php) y el mismo
 * patrón de calendario editable; sólo cambian los eventos automáticos que
 * se calculan y contra qué endpoint se guardan los personalizados — eso
 * vive en `calCtx`, la única pieza de estado que cambia entre roles.
 *
 * CoachStatsDashboard, el panel clásico del entrenador, calculaba métricas
 * de gimnasio que nunca llegó a pintar (el JSX sólo devolvía cabecera +
 * calendario pese a tener el estado listo) — aquí sólo se migra lo que de
 * verdad se veía.
 */

import { api } from '../api.js';
import * as session from '../session.js';
import { loadChart, loadFullCalendar } from '../cdn-loader.js';
import { evaluate as evaluateOnboarding, hideNavIfDone } from '../onboarding.js';

const STATUS_LABELS = { pending: 'Pendiente', accepted: 'Aceptado', rejected: 'Rechazado', completed: 'Completado', cancelled: 'Cancelado' };
const STATUS_TONES = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    accepted: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
    completed: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    cancelled: 'bg-sunken text-muted dark:bg-white/10 dark:text-white/60',
};

let els = {};
let charts = {};

/** Estado del calendario activo (boxeador o entrenador); ver bindEventModal(). */
let calCtx = null;

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="dashboard" */
export function init(root) {
    const isCoach = session.role() === 'entrenador';

    root.querySelector('[data-role="boxeador"]').hidden = isCoach;
    root.querySelector('[data-role="entrenador"]').hidden = !isCoach;

    els = {
        root,
        eventModal: root.querySelector('#event-modal'),
        eventForm: root.querySelector('#event-form'),
        eventTitle: root.querySelector('#event-title'),
        eventError: root.querySelector('#event-error'),
        eventClose: root.querySelector('#event-close'),
        eventDelete: root.querySelector('#event-delete'),
        fieldTitle: root.querySelector('#event-field-title'),
        fieldStart: root.querySelector('#event-field-start'),
        fieldEnd: root.querySelector('#event-field-end'),
        fieldType: root.querySelector('#event-field-type'),
        fieldColor: root.querySelector('#event-field-color'),
        fieldNotes: root.querySelector('#event-field-notes'),
        colorButtons: root.querySelector('#event-colors'),
        deleteConfirm: root.querySelector('#event-delete-confirm'),
    };
    charts = {};
    bindEventModal();

    if (isCoach) initCoach(root); else initBoxer(root);
}

export function destroy() {
    Object.values(charts).forEach((c) => c?.destroy());
    charts = {};
    calCtx?.calendar?.destroy();
    calCtx = null;
    els = {};
}

/* ══════════════════════════════════════════════════════════════════
   BOXEADOR
   ══════════════════════════════════════════════════════════════════ */

function initBoxer(root) {
    els.recentSkeleton = root.querySelector('[data-recent-skeleton]');
    els.recentList = root.querySelector('[data-recent-list]');
    els.recentEmpty = root.querySelector('[data-recent-empty]');

    calCtx = makeCalendarContext({
        skeletonEl: root.querySelector('[data-cal-skeleton]'),
        rootEl: root.querySelector('[data-cal-root]'),
        defaultColor: '#f97316',
        list: () => api.calendarEvents(session.email()),
        create: (payload) => api.createCalendarEvent(session.email(), payload),
        update: (id, payload) => api.updateCalendarEvent(session.email(), id, payload),
        remove: (id) => api.deleteCalendarEvent(session.email(), id),
    });

    loadBoxer();
}

async function loadBoxer() {
    const email = session.email();

    try {
        const profile = await api.boxeador(email);
        const sessions = Array.isArray(profile?.sparringSessions) ? profile.sparringSessions : [];
        const sent = Array.isArray(profile?.sparringChallengesSent) ? profile.sparringChallengesSent : [];
        const received = Array.isArray(profile?.sparringChallengesReceived) ? profile.sparringChallengesReceived : [];

        await renderMetrics(sessions, sent, received);
        renderRecent(sessions, email);

        const upcoming = [
            ...sent.filter((c) => c.status === 'accepted').map((c) => ({ ...c, _dir: 'sent' })),
            ...received.filter((c) => c.status === 'accepted').map((c) => ({ ...c, _dir: 'recv' })),
        ];
        await calCtx.mount(() => buildBoxerAutoEvents(sessions, upcoming, email));
    } catch {
        renderRecent([], email);
        await calCtx.mount(() => []);
    }

    // Igual que la versión clásica: una vez completados todos los pasos de
    // onboarding, "Primeros Pasos" desaparece del menú para no saturarlo.
    const { steps, doneSet } = await evaluateOnboarding(email, session.role());
    hideNavIfDone(doneSet, steps);
}

async function renderMetrics(sessions, sent, received) {
    const inCurrentMonth = (iso) => {
        if (!iso) return false;
        const [y, m] = iso.slice(0, 10).split('-');
        const now = new Date();
        return y === String(now.getFullYear()) && m === String(now.getMonth() + 1).padStart(2, '0');
    };

    const sessionsThisMonth = sessions.filter((s) => inCurrentMonth(s.scheduledAt || s.completedAt || s.createdAt || '')).length;
    const totalSessions = sessions.length;
    const pending = [...sent, ...received].filter((c) => c.status === 'pending').length;

    const specs = [
        { key: 'month', value: sessionsThisMonth, max: 10, color: '#111827', sub: sessionsThisMonth === 0 ? 'Sin sesiones registradas este mes.' : `${sessionsThisMonth} sesión${sessionsThisMonth !== 1 ? 'es' : ''} completada${sessionsThisMonth !== 1 ? 's' : ''}.` },
        { key: 'total', value: totalSessions, max: Math.max(totalSessions, 20), color: '#f97316', sub: totalSessions === 0 ? 'Aún no tienes sesiones registradas.' : `${totalSessions} sesión${totalSessions !== 1 ? 'es' : ''} en total.` },
        { key: 'pending', value: pending, max: Math.max(pending, 5), color: '#f97316', sub: pending === 0 ? 'No tienes retos pendientes.' : `${pending} reto${pending !== 1 ? 's' : ''} esperando respuesta.` },
    ];

    const Chart = await loadChart();

    specs.forEach(({ key, value, max, color, sub }) => {
        const card = els.root.querySelector(`[data-metric="${key}"]`);
        card.querySelector('[data-metric-pill]').textContent = String(value);
        card.querySelector('[data-metric-value]').textContent = String(value);
        card.querySelector('[data-metric-sub]').textContent = sub;

        const canvas = card.querySelector('[data-metric-canvas]');
        const remaining = Math.max(0, max - value);
        const data = { datasets: [{ data: [value || 0.001, remaining || max], backgroundColor: [color, 'rgba(0,0,0,0.06)'], borderWidth: 0 }] };

        if (charts[key]) {
            charts[key].data = data;
            charts[key].update();
        } else {
            charts[key] = new Chart(canvas, {
                type: 'doughnut',
                data,
                options: { responsive: false, cutout: '72%', animation: { duration: 600 }, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
            });
        }
    });
}

function renderRecent(sessions, email) {
    els.recentSkeleton.hidden = true;

    const recent = [...sessions]
        .sort((a, b) => new Date(b.scheduledAt || b.completedAt || b.createdAt || 0) - new Date(a.scheduledAt || a.completedAt || a.createdAt || 0))
        .slice(0, 5);

    els.recentEmpty.hidden = recent.length > 0;
    els.recentList.hidden = recent.length === 0;
    if (!recent.length) return;

    els.recentList.innerHTML = recent.map((s) => {
        const isA = String(s.boxerAEmail || '').toLowerCase() === email;
        const rival = isA ? (s.boxerBNombre || s.boxerBEmail || '—') : (s.boxerANombre || s.boxerAEmail || '—');
        const date = s.scheduledAt || s.completedAt || s.createdAt || '';
        const tone = STATUS_TONES[s.status] || STATUS_TONES.pending;

        return `
            <li class="flex items-center justify-between gap-3 rounded-xl bg-sunken px-4 py-3 dark:bg-white/5">
                <div class="flex min-w-0 items-center gap-3">
                    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-muted
                                 dark:bg-white/10">
                        <i class="fas fa-user" aria-hidden="true"></i>
                    </span>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-bold">${escapeHtml(rival)}</p>
                        <p class="flex items-center gap-1 text-xs text-muted">
                            <i class="fas fa-map-marker-alt text-[0.6rem]" aria-hidden="true"></i>
                            ${escapeHtml(s.gymName || '—')}
                        </p>
                    </div>
                </div>
                <div class="shrink-0 text-right">
                    <span class="rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${tone}">
                        ${STATUS_LABELS[s.status] || s.status || '—'}
                    </span>
                    <p class="mt-1 text-xs text-muted">${escapeHtml(formatDate(date))}</p>
                </div>
            </li>
        `;
    }).join('');
}

function buildBoxerAutoEvents(sessions, upcomingChallenges, email) {
    const auto = [];

    sessions.forEach((s, i) => {
        const date = toIsoDate(s.scheduledAt || s.completedAt || s.createdAt || '');
        if (!date) return;
        const isA = String(s.boxerAEmail || '').toLowerCase() === email;
        const rival = isA ? (s.boxerBNombre || s.boxerBEmail || 'Rival') : (s.boxerANombre || s.boxerAEmail || 'Rival');
        auto.push({
            id: `session-${s.id || i}`,
            title: `Sparring: ${rival}${s.gymName ? ` · ${s.gymName}` : ''}`,
            start: date,
            allDay: true,
            classNames: ['glv-event--sparring'],
        });
    });

    upcomingChallenges.forEach((c, i) => {
        const date = toIsoDate(c.scheduledAt || '');
        if (!date) return;
        const rival = c._dir === 'sent' ? (c.toNombre || c.toEmail || 'Rival') : (c.fromNombre || c.fromEmail || 'Rival');
        auto.push({
            id: `challenge-${c.id || i}`,
            title: `Reto confirmado: ${rival}`,
            start: date,
            allDay: true,
            classNames: ['glv-event--reto'],
        });
    });

    return auto;
}

/* ══════════════════════════════════════════════════════════════════
   ENTRENADOR
   ══════════════════════════════════════════════════════════════════ */

function initCoach(root) {
    els.coachHeading = root.querySelector('#coach-heading');
    els.coachFilters = root.querySelector('#coach-cal-filters');
    els.coachDetails = root.querySelector('#coach-cal-details-text');

    els.coachHeading.textContent = session.name() || 'Entrenador';

    const activeFilters = new Set(['inscripcion', 'pago', 'sparring', 'recordatorio', 'personalizado']);
    els.coachFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        const key = btn.dataset.filter;
        const on = btn.getAttribute('aria-pressed') !== 'true';
        if (on) { btn.setAttribute('aria-pressed', 'true'); activeFilters.add(key); }
        else { btn.removeAttribute('aria-pressed'); activeFilters.delete(key); }
        calCtx.applyFilter((ev) => activeFilters.has(ev.extendedProps?.kind || 'personalizado'));
    });

    calCtx = makeCalendarContext({
        skeletonEl: root.querySelector('#coach-cal-skeleton'),
        rootEl: root.querySelector('#coach-cal-root'),
        defaultColor: '#3b82f6',
        list: () => api.coachCalendarEvents(session.email()),
        create: (payload) => api.createCoachCalendarEvent(session.email(), payload),
        update: (id, payload) => api.updateCoachCalendarEvent(session.email(), id, payload),
        remove: (id) => api.deleteCoachCalendarEvent(session.email(), id),
        onAutoEventClick: (ev) => describeAutoEvent(ev),
    });

    loadCoach();
}

async function loadCoach() {
    const email = session.email();

    try {
        const boxers = await api.coachBoxeadores(email);
        await calCtx.mount(() => buildCoachAutoEvents(Array.isArray(boxers) ? boxers : []));
    } catch {
        await calCtx.mount(() => []);
    }
}

/**
 * Réplica de buildCoachCalendarEvents (dashboard.react.js): altas de
 * boxeadores, pagos registrados, sparrings de su historial, y dos
 * recordatorios fijos (ingresos del mes, planificación semanal).
 */
function buildCoachAutoEvents(boxers) {
    const events = [];

    boxers.forEach((b) => {
        const name = b.nombre || 'Alumno';
        const insc = toIsoDate(b.fechaInscripcion || b.createdAt || '');
        if (insc) {
            events.push({
                id: `inscripcion-${b._id || name}-${insc}`,
                title: `Inscripción: ${name}`,
                start: insc,
                allDay: true,
                classNames: ['glv-event--custom'],
                backgroundColor: '#8b5cf6',
                borderColor: '#8b5cf6',
                extendedProps: { kind: 'inscripcion', boxer: name },
            });
        }

        (Array.isArray(b.pagos) ? b.pagos : []).forEach((p) => {
            if (!p?.mes) return;
            events.push({
                id: `pago-${b._id || name}-${p.mes}`,
                title: `Pago: ${name}`,
                start: p.fecha ? new Date(p.fecha).toISOString().slice(0, 10) : `${p.mes}-01`,
                allDay: true,
                backgroundColor: '#16a34a',
                borderColor: '#16a34a',
                extendedProps: { kind: 'pago', boxer: name, mes: p.mes, monto: p.monto || 0 },
            });
        });

        (Array.isArray(b.sparringHistory) ? b.sparringHistory : []).forEach((s, i) => {
            const date = toIsoDate(s?.date || '');
            if (!date) return;
            const partner = s.partner || 'Partner';
            events.push({
                id: `sparring-${b._id || name}-${i}-${date}`,
                title: `Sparring: ${name} x ${partner}`,
                start: date,
                allDay: true,
                classNames: ['glv-event--sparring'],
                extendedProps: { kind: 'sparring', boxer: name, partner, place: s.place || '' },
            });
        });
    });

    const now = new Date();
    const firstDay = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    events.push({
        id: `recordatorio-mes-${firstDay}`,
        title: 'Repasa los ingresos del mes',
        start: firstDay,
        allDay: true,
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b',
        extendedProps: { kind: 'recordatorio' },
    });

    const nextMonday = getNextMondayIso();
    events.push({
        id: `recordatorio-semana-${nextMonday}`,
        title: 'Recordatorio: planificar semana',
        start: nextMonday,
        allDay: true,
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b',
        extendedProps: { kind: 'recordatorio' },
    });

    return events;
}

function describeAutoEvent(ev) {
    const kind = ev.extendedProps?.kind || '';
    const date = ev.startStr ? formatDate(ev.startStr.slice(0, 10)) : '';
    const parts = [date, ev.title];
    if (ev.extendedProps?.partner) parts.push(`Partner: ${ev.extendedProps.partner}`);
    if (ev.extendedProps?.place) parts.push(`Lugar: ${ev.extendedProps.place}`);
    els.coachDetails.textContent = parts.filter(Boolean).join(' · ');
}

function getNextMondayIso() {
    const now = new Date();
    const delta = (8 - now.getDay()) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + delta);
    return toIsoDate(next);
}

/* ══════════════════════════════════════════════════════════════════
   CALENDARIO (compartido): montaje, eventos personalizados y modal
   ══════════════════════════════════════════════════════════════════ */

/**
 * Crea el controlador de un calendario FullCalendar con eventos propios
 * en MongoDB. `crud` son las cuatro llamadas a la API (list/create/update/
 * remove) del dueño de este calendario — el boxeador o el entrenador.
 */
function makeCalendarContext({ skeletonEl, rootEl, defaultColor, list, create, update, remove, onAutoEventClick }) {
    const ctx = {
        calendar: null,
        customEvents: [],
        autoEvents: [],
        editingEventId: '',
        defaultColor,
        crud: { list, create, update, remove },

        async mount(buildAutoEvents) {
            try {
                ctx.customEvents = await list();
                if (!Array.isArray(ctx.customEvents)) ctx.customEvents = [];
            } catch {
                ctx.customEvents = [];
            }

            const FC = await loadFullCalendar();
            skeletonEl.hidden = true;
            rootEl.hidden = false;
            ctx.autoEvents = buildAutoEvents();

            ctx.calendar = new FC.Calendar(rootEl, {
                initialView: 'dayGridMonth',
                height: 'auto',
                locale: 'es',
                firstDay: 1,
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
                events: [...ctx.autoEvents, ...customToFcEvents(ctx.customEvents)],
                dateClick: (info) => openEventModal(ctx, { start: info.dateStr }),
                eventClick: (info) => {
                    const dbId = info.event.extendedProps?.dbId;
                    if (dbId) openEventModal(ctx, { event: info.event, id: dbId });
                    else onAutoEventClick?.(info.event);
                },
            });
            ctx.calendar.render();
        },

        applyFilter(predicate) {
            ctx.calendar.getEvents().forEach((ev) => {
                if (ev.extendedProps?.dbId) return; // los personalizados no se filtran
                ev.setProp('display', predicate(ev) ? 'auto' : 'none');
            });
        },

        async refresh() {
            try {
                ctx.customEvents = await list();
                if (!Array.isArray(ctx.customEvents)) ctx.customEvents = [];
            } catch {
                ctx.customEvents = [];
            }
            ctx.calendar.getEvents().forEach((ev) => { if (ev.extendedProps?.dbId) ev.remove(); });
            customToFcEvents(ctx.customEvents).forEach((ev) => ctx.calendar.addEvent(ev));
        },
    };

    return ctx;
}

function customToFcEvents(customEvents) {
    return customEvents.map((ev) => ({
        id: `db-${ev._id}`,
        title: ev.title,
        start: ev.start,
        end: ev.end || undefined,
        allDay: ev.allDay !== false,
        backgroundColor: ev.color || '#f97316',
        borderColor: ev.color || '#f97316',
        classNames: ['glv-event--custom'],
        extendedProps: { dbId: ev._id },
    }));
}

/* ── Modal de evento (compartido) ─────────────────────────────────── */

function bindEventModal() {
    els.colorButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.color-btn');
        if (!btn) return;
        els.colorButtons.querySelectorAll('.color-btn').forEach((b) => b.removeAttribute('aria-pressed'));
        btn.setAttribute('aria-pressed', 'true');
        els.fieldColor.value = btn.dataset.color;
    });

    els.eventClose.addEventListener('click', () => els.eventModal.close());
    els.eventModal.addEventListener('cancel', () => hideError());
    els.eventForm.addEventListener('submit', onSaveEvent);

    els.eventDelete.addEventListener('click', () => {
        els.deleteConfirm.returnValue = '';
        els.deleteConfirm.showModal();
        els.deleteConfirm.addEventListener('close', async () => {
            if (els.deleteConfirm.returnValue === 'confirm') await onDeleteEvent();
        }, { once: true });
    });
}

function openEventModal(ctx, { start = '', event = null, id = '' } = {}) {
    hideError();
    calCtx = ctx; // el modal siempre actúa sobre el calendario que lo abrió
    ctx.editingEventId = id;

    els.eventTitle.textContent = id ? 'Editar evento' : 'Nuevo evento';
    els.eventDelete.hidden = !id;

    if (event) {
        els.fieldTitle.value = event.title || '';
        els.fieldStart.value = event.startStr ? event.startStr.slice(0, 10) : '';
        els.fieldEnd.value = event.endStr ? event.endStr.slice(0, 10) : '';
        els.fieldType.value = event.extendedProps?.tipo || 'personalizado';
        els.fieldNotes.value = event.extendedProps?.notas || '';
        setColor(event.backgroundColor || ctx.defaultColor);
    } else {
        els.fieldTitle.value = '';
        els.fieldStart.value = start || new Date().toISOString().slice(0, 10);
        els.fieldEnd.value = '';
        els.fieldType.value = 'personalizado';
        els.fieldNotes.value = '';
        setColor(ctx.defaultColor);
    }

    els.eventModal.showModal();
}

function setColor(color) {
    els.fieldColor.value = color;
    els.colorButtons.querySelectorAll('.color-btn').forEach((b) => {
        // aria-pressed:* de Tailwind sólo casa con el valor "true" literal;
        // toggleAttribute pondría una cadena vacía y no aplicaría el estilo.
        if (b.dataset.color === color) b.setAttribute('aria-pressed', 'true');
        else b.removeAttribute('aria-pressed');
    });
}

function showError(message) {
    els.eventError.hidden = false;
    els.eventError.textContent = message;
}

function hideError() {
    els.eventError.hidden = true;
}

async function onSaveEvent(e) {
    e.preventDefault();

    const title = els.fieldTitle.value.trim();
    const start = els.fieldStart.value;
    if (!title || !start) {
        showError('El título y la fecha son obligatorios.');
        return;
    }

    const payload = {
        title,
        start,
        end: els.fieldEnd.value || '',
        allDay: true,
        color: els.fieldColor.value,
        tipo: els.fieldType.value,
        notas: els.fieldNotes.value.trim(),
    };

    try {
        if (calCtx.editingEventId) await calCtx.crud.update(calCtx.editingEventId, payload);
        else await calCtx.crud.create(payload);
        els.eventModal.close();
        await calCtx.refresh();
    } catch (err) {
        showError(err.message || 'Error al guardar.');
    }
}

async function onDeleteEvent() {
    if (!calCtx.editingEventId) return;
    try {
        await calCtx.crud.remove(calCtx.editingEventId);
        els.eventModal.close();
        await calCtx.refresh();
    } catch (err) {
        showError(err.message || 'Error al eliminar.');
    }
}

/* ── Utilidades ────────────────────────────────────────────────────── */

function toIsoDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}
