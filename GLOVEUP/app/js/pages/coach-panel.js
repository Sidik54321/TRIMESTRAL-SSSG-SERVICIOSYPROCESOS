/**
 * coach-panel.js — Mi Gimnasio + Gestión de Alumnos.
 *
 * Migración de CoachManagement (dashboard/entrenador/dashboard.react.js).
 * No incluye el mapa de ubicación (Leaflet + geocodificación Nominatim) por
 * el mismo motivo que Gimnasios: es una pieza grande y aislada que puede
 * migrarse después sin bloquear el resto. La dirección y la ciudad se
 * guardan como texto simple.
 *
 * Añade una confirmación al dar de baja a un boxeador que la versión
 * clásica no tenía — ese botón borra la cuenta de forma permanente sin
 * posibilidad de deshacerlo, así que merece un paso más antes de ejecutarlo.
 *
 * La pestaña "Pagos" migra CoachFinance, antes sin ningún enlace propio en
 * el menú. Dos de sus cinco métricas ("Pagos este mes" y "Cobros") siempre
 * mostrarán 0 — no es un fallo de esta migración, ver la nota en
 * coach-panel.php sobre el stub de /me/cobros y el campo "pagos" ausente
 * del esquema de Boxeador.
 */

import { api } from '../api.js';
import * as session from '../session.js';
import { openImageEditor } from '/assets/js/image-editor.js';
import { loadChart } from '../cdn-loader.js';

const DAY_TAGS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_MAP = { L: 0, M: 1, X: 2, J: 3, V: 4, S: 5, D: 6 };

let els = {};
let coach = { gimnasio: '', precioMensual: 0 };
let boxers = [];
let fotos = [];
let fotoPerfil = '';
let selectedDays = [true, true, true, true, true, false, false]; // L-V por defecto
let editingBoxerId = '';
let pendingPay = null; // { id, nombre, isPaid }
let pendingDelete = null; // { id, nombre }
let paymentsLoaded = false;
let charts = {};

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="coach-panel" */
export function init(root) {
    els = {
        root,
        skeleton: root.querySelector('#cp-skeleton'),
        message: root.querySelector('#cp-message'),
        empty: root.querySelector('#cp-empty'),
        startCreate: root.querySelector('#cp-start-create'),
        panel: root.querySelector('#cp-panel'),
        tabs: root.querySelector('#cp-tabs'),
        tabBoxers: root.querySelector('#cp-tab-boxers'),
        tabPayments: root.querySelector('#cp-tab-payments'),
        boxersCountLabel: root.querySelector('#cp-boxers-count-label'),
        gymTab: root.querySelector('#cp-gym-tab'),
        gymHeading: root.querySelector('#cp-gym-heading'),
        boxersTab: root.querySelector('#cp-boxers-tab'),
        paymentsTab: root.querySelector('#cp-payments-tab'),
        paymentsSkeleton: root.querySelector('#cp-payments-skeleton'),
        paymentsContent: root.querySelector('#cp-payments-content'),
        priceInput: root.querySelector('#cp-price-input'),
        savePrice: root.querySelector('#cp-save-price'),
        revenueChart: root.querySelector('#cp-revenue-chart'),

        photoPreview: root.querySelector('#cp-photo-preview'),
        photoPlaceholder: root.querySelector('#cp-photo-placeholder'),
        photoInput: root.querySelector('#cp-photo-input'),
        nombre: root.querySelector('#cp-nombre'),
        correo: root.querySelector('#cp-correo'),
        telefono: root.querySelector('#cp-telefono'),
        instructor: root.querySelector('#cp-instructor'),
        days: root.querySelector('#cp-days'),
        horaApertura: root.querySelector('#cp-hora-apertura'),
        horaCierre: root.querySelector('#cp-hora-cierre'),
        direccion: root.querySelector('#cp-direccion'),
        ciudad: root.querySelector('#cp-ciudad'),
        bio: root.querySelector('#cp-bio'),
        galleryInput: root.querySelector('#cp-gallery-input'),
        gallery: root.querySelector('#cp-gallery'),
        saveGym: root.querySelector('#cp-save-gym'),

        search: root.querySelector('#cp-search'),
        assign: root.querySelector('#cp-assign'),
        assignAdd: root.querySelector('#cp-assign-add'),
        assignRemove: root.querySelector('#cp-assign-remove'),
        boxersMessage: root.querySelector('#cp-boxers-message'),
        boxersList: root.querySelector('#cp-boxers-list'),

        payConfirm: root.querySelector('#cp-pay-confirm'),
        payIcon: root.querySelector('#cp-pay-icon'),
        payTitle: root.querySelector('#cp-pay-title'),
        payText: root.querySelector('#cp-pay-text'),
        deleteConfirm: root.querySelector('#cp-delete-confirm'),
        deleteName: root.querySelector('#cp-delete-name'),
    };

    coach = { gimnasio: '', precioMensual: 0 };
    boxers = [];
    fotos = [];
    fotoPerfil = '';
    selectedDays = [true, true, true, true, true, false, false];
    editingBoxerId = '';
    paymentsLoaded = false;
    charts = {};

    bindGymTab();
    bindBoxersTab();
    bindPaymentsTab();
    bindModals();

    els.tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (btn) showTab(btn.dataset.tab);
    });

    els.startCreate.addEventListener('click', () => {
        els.empty.hidden = true;
        els.panel.hidden = false;
        showTab('gym');
    });

    load();
}

export function destroy() {
    Object.values(charts).forEach((c) => c?.destroy());
    charts = {};
    els = {};
}

/* ── Carga ─────────────────────────────────────────────────────────── */

async function load() {
    const email = session.email();

    try {
        const [coachInfo, boxersInfo] = await Promise.all([
            api.entrenador(email),
            api.coachBoxeadores(email).catch(() => []),
        ]);

        coach = { gimnasio: coachInfo?.gimnasio || '', precioMensual: coachInfo?.precioMensual || 0 };
        boxers = Array.isArray(boxersInfo) ? boxersInfo : [];

        if (coach.gimnasio) {
            const gym = await api.gimnasioByName(coach.gimnasio).catch(() => null);
            populateGymForm(gym);
        } else {
            els.instructor.value = session.name();
        }

        els.skeleton.hidden = true;

        if (!coach.gimnasio) {
            els.empty.hidden = false;
            return;
        }

        els.panel.hidden = false;
        els.tabBoxers.hidden = false;
        els.tabPayments.hidden = false;
        updateBoxersCount();
        showTab(els.root.dataset.defaultTab === 'boxers' ? 'boxers' : 'gym');
        renderBoxers();
    } catch (err) {
        els.skeleton.hidden = true;
        showMessage(err.message || 'Error cargando datos.', 'error');
    }
}

function populateGymForm(gym) {
    els.nombre.value = coach.gimnasio;
    fotoPerfil = gym?.fotoPerfil || '';
    fotos = Array.isArray(gym?.fotos) ? gym.fotos.filter(Boolean).slice(0, 12) : [];
    renderPhotoPreview();
    renderGallery();

    els.bio.value = gym?.bio || '';
    els.correo.value = gym?.correoContacto || '';
    els.telefono.value = gym?.telefono || '';
    els.direccion.value = gym?.direccion || '';
    els.ciudad.value = gym?.ubicacion || '';
    els.instructor.value = gym?.nombreEntrenador || '';

    const horario = gym?.horario || '';
    if (horario.includes('|')) {
        const [diasStr, horas] = horario.split('|').map((s) => s.trim());
        const next = [false, false, false, false, false, false, false];
        const upper = diasStr.toUpperCase();

        if (upper.includes('L-V')) [0, 1, 2, 3, 4].forEach((i) => { next[i] = true; });
        else if (upper.includes('L-S')) [0, 1, 2, 3, 4, 5].forEach((i) => { next[i] = true; });
        else if (upper.includes('TODOS')) next.fill(true);
        else diasStr.split(',').forEach((d) => {
            const key = d.trim().toUpperCase()[0];
            if (key in DAY_MAP) next[DAY_MAP[key]] = true;
        });

        selectedDays = next;
        if (horas?.includes('-')) {
            const [ini, fin] = horas.split('-').map((s) => s.trim());
            if (ini) els.horaApertura.value = ini;
            if (fin) els.horaCierre.value = fin;
        }
    }
    renderDays();
}

/* ── Pestañas ──────────────────────────────────────────────────────── */

function showTab(name) {
    els.tabs.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.tab === name));
    });
    els.gymTab.hidden = name !== 'gym';
    els.boxersTab.hidden = name !== 'boxers';
    els.paymentsTab.hidden = name !== 'payments';
    if (name === 'gym') els.gymHeading.textContent = coach.gimnasio ? 'Mi gimnasio' : 'Crea tu gimnasio ✨';
    if (name === 'payments' && !paymentsLoaded) loadPayments();
}

/* ── Pestaña: gimnasio ─────────────────────────────────────────────── */

function bindGymTab() {
    els.photoInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const dataUrl = await openImageEditor(file, { circle: false, outputSize: 512 });
        if (dataUrl) { fotoPerfil = dataUrl; renderPhotoPreview(); }
    });

    els.galleryInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []).slice(0, 6);
        e.target.value = '';
        for (const file of files) {
            const dataUrl = await openImageEditor(file, { circle: false, outputSize: 800 });
            if (dataUrl) fotos = [...fotos, dataUrl].slice(0, 12);
        }
        renderGallery();
    });

    els.gallery.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-photo]');
        if (!btn) return;
        fotos = fotos.filter((_, i) => i !== Number(btn.dataset.removePhoto));
        renderGallery();
    });

    els.days.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-day]');
        if (!btn) return;
        const i = Number(btn.dataset.day);
        selectedDays[i] = !selectedDays[i];
        renderDays();
    });

    els.saveGym.addEventListener('click', saveGym);
}

function renderPhotoPreview() {
    els.photoPreview.src = fotoPerfil;
    els.photoPreview.classList.toggle('hidden', !fotoPerfil);
    els.photoPlaceholder.classList.toggle('hidden', Boolean(fotoPerfil));
}

function renderGallery() {
    els.gallery.innerHTML = fotos.map((src, i) => `
        <div class="group relative aspect-square overflow-hidden rounded-xl bg-sunken dark:bg-white/5">
            <img src="${escapeAttr(src)}" alt="" class="h-full w-full object-cover">
            <button type="button" data-remove-photo="${i}"
                    class="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full
                           bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        </div>
    `).join('');
}

function renderDays() {
    els.days.querySelectorAll('[data-day]').forEach((btn) => {
        const on = selectedDays[Number(btn.dataset.day)];
        if (on) btn.setAttribute('aria-pressed', 'true'); else btn.removeAttribute('aria-pressed');
    });
}

function daysSummary() {
    const names = DAY_TAGS.filter((_, i) => selectedDays[i]);
    const isAll = selectedDays.every(Boolean);
    const isLS = selectedDays.every((v, i) => (i < 6 ? v : !v));
    const isLV = selectedDays.every((v, i) => (i < 5 ? v : !v));

    if (isAll) return 'Todos los días';
    if (isLS) return 'L-S';
    if (isLV) return 'L-V';
    return names.length ? names.join(', ') : 'L-V';
}

async function saveGym() {
    const email = session.email();
    const nombre = els.nombre.value.trim();
    if (!nombre) {
        showMessage('El nombre del gimnasio es obligatorio.', 'error');
        return;
    }

    try {
        await api.saveEntrenador(email, { gimnasio: nombre });
        await api.saveGimnasio({
            nombre,
            creadoPorEmail: email,
            bio: els.bio.value.trim(),
            fotos,
            fotoPerfil,
            correoContacto: els.correo.value.trim(),
            telefono: els.telefono.value.trim(),
            direccion: els.direccion.value.trim(),
            ubicacion: els.ciudad.value.trim(),
            horario: `${daysSummary()} | ${els.horaApertura.value} - ${els.horaCierre.value}`,
            nombreEntrenador: els.instructor.value.trim(),
        });

        showMessage(coach.gimnasio ? 'Información del gimnasio guardada correctamente.' : '¡Enhorabuena! Gimnasio creado con éxito.', 'ok');
        await load();
    } catch (err) {
        showMessage(err.message || 'No se pudo guardar el gimnasio.', 'error');
    }
}

/* ── Pestaña: pagos ────────────────────────────────────────────────── */

function bindPaymentsTab() {
    els.savePrice.addEventListener('click', savePrice);
}

async function loadPayments() {
    const email = session.email();

    try {
        const [metricas, cobros, boxersInfo] = await Promise.all([
            api.coachMetricas(email),
            api.coachCobros(email).catch(() => ({ total: 0 })),
            api.coachBoxeadores(email).catch(() => []),
        ]);

        paymentsLoaded = true;
        els.paymentsSkeleton.hidden = true;
        els.paymentsContent.hidden = false;

        els.priceInput.value = metricas?.precioMensual ?? '';
        await renderPaymentMetrics(metricas || {}, cobros?.total || 0);
        await renderRevenueChart(Array.isArray(boxersInfo) ? boxersInfo : [], metricas?.precioMensual || 0);
    } catch (err) {
        showMessage(err.message || 'No se pudo cargar la Gestión económica.', 'error');
    }
}

async function renderPaymentMetrics(metricas, cobrosTotal) {
    const revenueMax = Math.max(1, (Number(metricas.precioMensual) || 0) * 30);
    const cobrosMax = Math.max(1, Number(cobrosTotal) || 0, revenueMax);
    const boxeadoresActivos = metricas.boxeadoresActivos || 0;
    const pagosMes = metricas.pagosMes || 0;

    const specs = [
        { key: 'gimnasio', value: 1, max: 1, color: '#111827', text: metricas.gimnasio || '—', sub: 'Resumen del gimnasio.' },
        { key: 'boxeadores', value: boxeadoresActivos, max: 30, color: '#111827', text: String(boxeadoresActivos), sub: 'Boxeadores asignados actualmente.' },
        { key: 'pagos', value: pagosMes, max: Math.max(1, boxeadoresActivos), color: '#10b981', text: `${pagosMes} / ${boxeadoresActivos}`, sub: `${pagosMes} de ${boxeadoresActivos} boxeadores han pagado este mes.` },
        { key: 'ingresos', value: metricas.ingresosMes || 0, max: revenueMax, color: '#9ca3af', text: formatCurrency(metricas.ingresosMes || 0), sub: 'Precio mensual × pagos registrados este mes.' },
        { key: 'cobros', value: Number(cobrosTotal) || 0, max: cobrosMax, color: '#9ca3af', text: formatCurrency(cobrosTotal), sub: 'Total registrado.' },
    ];

    const Chart = await loadChart();

    specs.forEach(({ key, value, max, color, text, sub }) => {
        const card = els.root.querySelector(`[data-pmetric="${key}"]`);
        card.querySelector('[data-pmetric-value]').textContent = text;
        card.querySelector('[data-pmetric-sub]').textContent = sub;

        const canvas = card.querySelector('[data-pmetric-canvas]');
        const remaining = Math.max(0, max - value);
        const data = { datasets: [{ data: [value || 0.001, remaining || max], backgroundColor: [color, 'rgba(0,0,0,0.06)'], borderWidth: 0 }] };

        if (charts[key]) {
            charts[key].data = data;
            charts[key].update();
        } else {
            charts[key] = new Chart(canvas, {
                type: 'doughnut',
                data,
                options: { responsive: false, cutout: '72%', animation: { duration: 500 }, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
            });
        }
    });
}

async function renderRevenueChart(boxersForChart, precioMensual) {
    const Chart = await loadChart();
    const points = buildInscriptionRevenueSeries(boxersForChart, precioMensual);
    const fmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' });

    const data = {
        datasets: [{
            label: 'Ingresos acumulados por inscripciones',
            data: points,
            parsing: false,
            borderColor: '#111827',
            backgroundColor: 'rgba(17, 24, 39, 0.12)',
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 12,
            tension: 0.25,
            fill: true,
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
            legend: { display: false },
            decimation: { enabled: true, algorithm: 'lttb', samples: 250, threshold: 600 },
            tooltip: {
                callbacks: {
                    title: (items) => {
                        const x = items?.[0]?.parsed?.x;
                        return Number.isFinite(x) ? fmt.format(new Date(x)) : '';
                    },
                    label: (ctx) => ` ${formatCurrency(Number.isFinite(ctx.parsed?.y) ? ctx.parsed.y : 0)}`,
                },
            },
        },
        scales: {
            x: { type: 'linear', ticks: { maxTicksLimit: 8, callback: (v) => (Number.isFinite(Number(v)) ? fmt.format(new Date(Number(v))) : '') }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(v) } },
        },
    };

    if (charts.revenue) {
        charts.revenue.data.datasets[0].data = points;
        charts.revenue.update();
    } else {
        charts.revenue = new Chart(els.revenueChart, { type: 'line', data, options });
    }
}

/** Serie de ingresos acumulados por inscripción, día a día desde la primera alta (máx. 5 años). */
function buildInscriptionRevenueSeries(boxersForChart, precioMensual) {
    const price = Number.isFinite(Number(precioMensual)) && Number(precioMensual) >= 0 ? Number(precioMensual) : 0;
    const dates = boxersForChart.map((b) => toIsoDate(b.fechaInscripcion || b.createdAt)).filter(Boolean);

    const today = new Date();
    const maxPast = new Date(today);
    maxPast.setFullYear(today.getFullYear() - 5);

    const earliestIso = dates.sort()[0];
    const earliest = earliestIso ? new Date(`${earliestIso}T00:00:00`) : maxPast;
    const startDate = earliest > maxPast ? earliest : maxPast;

    const byDay = new Map();
    dates.forEach((iso) => byDay.set(iso, (byDay.get(iso) || 0) + 1));

    const points = [];
    let cumulative = 0;
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const iso = toIsoDate(cursor);
        cumulative += (byDay.get(iso) || 0) * price;
        points.push({ x: cursor.getTime(), y: cumulative });
    }

    return points;
}

async function savePrice() {
    const email = session.email();
    const precioMensual = Number(els.priceInput.value);

    try {
        await api.saveEntrenador(email, { precioMensual: Number.isFinite(precioMensual) ? precioMensual : 0 });
        showMessage('Precio mensual actualizado correctamente.', 'ok');
        paymentsLoaded = false;
        await loadPayments();
    } catch (err) {
        showMessage(err.message || 'No se pudo guardar el precio.', 'error');
    }
}

function toIsoDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function formatCurrency(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '0€';
    return `${num.toFixed(2)}€`;
}

/* ── Pestaña: boxeadores ───────────────────────────────────────────── */

function bindBoxersTab() {
    els.search.addEventListener('input', renderBoxers);

    els.assignAdd.addEventListener('click', async () => {
        const identifier = els.assign.value.trim();
        if (!identifier) return;
        try {
            await api.addCoachBoxeador(session.email(), identifier);
            els.assign.value = '';
            await load();
        } catch (err) {
            showBoxersMessage(err.message || 'No se pudo añadir al boxeador.', 'error');
        }
    });

    els.assignRemove.addEventListener('click', async () => {
        const identifier = els.assign.value.trim();
        if (!identifier) return;
        try {
            await api.removeCoachBoxeador(session.email(), identifier);
            els.assign.value = '';
            await load();
        } catch (err) {
            showBoxersMessage(err.message || 'No se pudo quitar al boxeador.', 'error');
        }
    });

    els.boxersList.addEventListener('click', (e) => {
        const payBtn = e.target.closest('[data-pay]');
        if (payBtn) return openPayConfirm(payBtn.dataset.pay, payBtn.dataset.name, payBtn.dataset.paid === 'true');

        const editBtn = e.target.closest('[data-edit]');
        if (editBtn) return toggleEdit(editBtn.dataset.edit);

        const saveBtn = e.target.closest('[data-save-edit]');
        if (saveBtn) return saveEditBoxer(saveBtn.dataset.saveEdit);

        const cancelBtn = e.target.closest('[data-cancel-edit]');
        if (cancelBtn) { editingBoxerId = ''; renderBoxers(); return; }

        const deleteBtn = e.target.closest('[data-delete]');
        if (deleteBtn) openDeleteConfirm(deleteBtn.dataset.delete, deleteBtn.dataset.name);
    });
}

function updateBoxersCount() {
    els.boxersCountLabel.textContent = boxers.length ? `Mis Boxeadores (${boxers.length})` : 'Mis Boxeadores';
}

function filteredBoxers() {
    const q = els.search.value.trim().toLowerCase();
    if (!q) return boxers;
    return boxers.filter((b) =>
        (b.nombre || '').toLowerCase().includes(q)
        || (b.email || '').toLowerCase().includes(q)
        || (b.dniLicencia || '').toLowerCase().includes(q));
}

function levelScore(nivel = '') {
    const n = nivel.toLowerCase();
    if (n.includes('principiante')) return 1;
    if (n.includes('intermedio')) return 2;
    if (n.includes('avanzado')) return 3;
    if (n.includes('amateur')) return 4;
    if (n.includes('profesional')) return 5;
    return 3;
}

function starsHtml(score) {
    return Array.from({ length: 5 }, (_, i) =>
        `<i class="${i < score ? 'fas' : 'far'} fa-star text-xs ${i < score ? 'text-accent' : 'text-faint'}"></i>`).join('');
}

function renderBoxers() {
    updateBoxersCount();
    const list = filteredBoxers();

    if (!list.length) {
        els.boxersList.innerHTML = `<p class="p-6 text-center text-sm text-muted">No hay boxeadores.</p>`;
        return;
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    els.boxersList.innerHTML = list.map((b, i) => {
        const id = String(b._id || '');
        const isPaid = Array.isArray(b.pagos) && b.pagos.some((p) => p.mes === currentMonth);
        const isEditing = editingBoxerId === id;
        const name = b.nombre || b.email || 'Boxeador';

        return `
            <article class="card p-4">
                <div class="flex flex-wrap items-center gap-4">
                    <span class="w-7 shrink-0 text-center text-sm font-bold text-muted">#${i + 1}</span>
                    <div class="min-w-0 flex-1">
                        <p class="truncate font-bold">${escapeHtml(name)}</p>
                        <p class="truncate text-xs text-muted">${escapeHtml(b.email || '')}</p>
                    </div>
                    <div class="hidden sm:block">${starsHtml(levelScore(b.nivel))}</div>
                    <div class="flex shrink-0 items-center gap-2">
                        <button type="button" data-pay="${escapeAttr(id)}" data-name="${escapeAttr(name)}" data-paid="${isPaid}"
                                class="rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition-colors
                                       ${isPaid
                                           ? 'border-green-600 bg-green-100 text-green-700 dark:border-green-500 dark:bg-green-500/15 dark:text-green-400'
                                           : 'border-red-600 bg-red-100 text-red-700 dark:border-red-500 dark:bg-red-500/15 dark:text-red-400'}">
                            <i class="fas ${isPaid ? 'fa-check-circle' : 'fa-times-circle'}" aria-hidden="true"></i>
                            ${isPaid ? 'Mes pagado' : 'Pendiente de pagar'}
                        </button>
                        <button type="button" data-edit="${escapeAttr(id)}" class="btn-ghost px-3 py-1.5 text-xs">Editar</button>
                    </div>
                </div>

                ${isEditing ? `
                    <div class="mt-4 grid gap-3 border-t border-hairline pt-4 dark:border-white/10 sm:grid-cols-3">
                        <input data-edit-name value="${escapeAttr(b.nombre || '')}" class="field" placeholder="Nombre del boxeador">
                        <input data-edit-dni value="${escapeAttr(b.dniLicencia || '')}" class="field" placeholder="DNI o licencia">
                        <select data-edit-level class="field">
                            ${['Principiante', 'Intermedio', 'Avanzado', 'Amateur', 'Profesional']
                                .map((lvl) => `<option ${b.nivel === lvl ? 'selected' : ''}>${lvl}</option>`).join('')}
                        </select>
                        <div class="flex gap-2 sm:col-span-3">
                            <button type="button" data-save-edit="${escapeAttr(id)}" class="btn-primary px-4 py-2 text-xs">Guardar cambios</button>
                            <button type="button" data-delete="${escapeAttr(id)}" data-name="${escapeAttr(name)}"
                                    class="rounded-full border border-red-300 px-4 py-2 text-xs font-bold text-red-600
                                           transition-colors hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10">
                                Dar de baja
                            </button>
                            <button type="button" data-cancel-edit class="btn-ghost ml-auto px-4 py-2 text-xs">Cancelar</button>
                        </div>
                    </div>
                ` : ''}
            </article>
        `;
    }).join('');
}

function toggleEdit(id) {
    editingBoxerId = editingBoxerId === id ? '' : id;
    renderBoxers();
}

async function saveEditBoxer(id) {
    const card = els.boxersList.querySelector(`[data-save-edit="${CSS.escape(id)}"]`)?.closest('article');
    if (!card) return;

    const payload = {
        nombre: card.querySelector('[data-edit-name]').value.trim(),
        dniLicencia: card.querySelector('[data-edit-dni]').value.trim(),
        nivel: card.querySelector('[data-edit-level]').value,
    };

    try {
        await api.updateCoachBoxeador(session.email(), id, payload);
        editingBoxerId = '';
        await load();
    } catch (err) {
        showBoxersMessage(err.message || 'No se pudieron guardar los cambios.', 'error');
    }
}

/* ── Modales ───────────────────────────────────────────────────────── */

function bindModals() {
    els.payConfirm.addEventListener('close', async () => {
        if (els.payConfirm.returnValue === 'confirm' && pendingPay) await togglePaid(pendingPay);
        pendingPay = null;
    });

    els.deleteConfirm.addEventListener('close', async () => {
        if (els.deleteConfirm.returnValue === 'confirm' && pendingDelete) await deleteBoxer(pendingDelete.id);
        pendingDelete = null;
    });
}

function openPayConfirm(id, nombre, isPaid) {
    pendingPay = { id, nombre, isPaid };
    els.payIcon.className = `fas ${isPaid ? 'fa-undo-alt' : 'fa-money-bill-wave'} text-4xl ${isPaid ? 'text-accent' : 'text-green-600'}`;
    els.payTitle.textContent = isPaid ? 'Deshacer pago' : 'Confirmar pago';
    els.payText.textContent = isPaid
        ? `¿Deshacer el pago de ${nombre} para este mes?`
        : `¿Marcar a ${nombre} como pagado este mes?`;
    els.payConfirm.returnValue = '';
    els.payConfirm.showModal();
}

async function togglePaid({ id, isPaid }) {
    try {
        if (isPaid) await api.unmarkBoxerPaid(session.email(), id);
        else await api.markBoxerPaid(session.email(), id);
        await load();
    } catch (err) {
        showBoxersMessage(err.message || 'Error al registrar el pago.', 'error');
    }
}

function openDeleteConfirm(id, nombre) {
    pendingDelete = { id, nombre };
    els.deleteName.textContent = nombre;
    els.deleteConfirm.returnValue = '';
    els.deleteConfirm.showModal();
}

async function deleteBoxer(id) {
    try {
        await api.deleteCoachBoxeador(session.email(), id);
        editingBoxerId = '';
        await load();
    } catch (err) {
        showBoxersMessage(err.message || 'No se pudo dar de baja al boxeador.', 'error');
    }
}

/* ── Utilidades ────────────────────────────────────────────────────── */

function showMessage(text, kind) {
    els.message.hidden = false;
    els.message.textContent = text;
    els.message.className = 'mb-4 rounded-xl px-4 py-3 text-sm font-semibold '
        + (kind === 'error'
            ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400'
            : 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400');
}

function showBoxersMessage(text, kind) {
    els.boxersMessage.hidden = false;
    els.boxersMessage.textContent = text;
    els.boxersMessage.className = 'mt-4 rounded-xl px-4 py-3 text-sm font-semibold '
        + (kind === 'error'
            ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400'
            : 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400');
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
