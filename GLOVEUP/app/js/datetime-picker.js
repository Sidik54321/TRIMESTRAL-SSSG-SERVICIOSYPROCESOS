/**
 * datetime-picker.js — Selector de fecha y hora sobre un <dialog>.
 *
 * Sustituye al calendario a medida de la versión clásica por uno equivalente
 * en Tailwind. Sólo permite fechas futuras, igual que el original: tiene
 * sentido para programar un sparring, no para uno que ya pasó.
 */

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const pad2 = (n) => String(n).padStart(2, '0');
const sameDay = (a, b) => a && b
    && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** @param {string} iso @returns {string} "dd/mm/aaaa hh:mm", o "" si no es válida */
export function formatDisplay(iso) {
    if (!iso) return '';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '';
    return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

/**
 * Conecta un <dialog> como selector de fecha y hora.
 *
 * @param {HTMLDialogElement} overlay
 * @param {(iso: string) => void} onApply Llamado con la fecha elegida en ISO
 * @param {(message: string) => void} [notify] Aviso al intentar una fecha inválida
 * @returns {{open: (currentIso?: string) => void}}
 */
export function createDateTimePicker(overlay, onApply, notify = () => {}) {
    const title = overlay.querySelector('#dt-title');
    const weekdays = overlay.querySelector('#dt-weekdays');
    const grid = overlay.querySelector('#dt-grid');
    const hourSelect = overlay.querySelector('#dt-hour');
    const minuteSelect = overlay.querySelector('#dt-minute');
    const prevBtn = overlay.querySelector('#dt-prev');
    const nextBtn = overlay.querySelector('#dt-next');
    const todayBtn = overlay.querySelector('#dt-today');
    const cancelBtn = overlay.querySelector('#dt-cancel');
    const applyBtn = overlay.querySelector('#dt-apply');

    let viewYear = 0;
    let viewMonth = 0;
    let selected = null;

    weekdays.innerHTML = WEEKDAYS.map((d) => `<div>${d}</div>`).join('');

    function buildTimeOptions() {
        if (hourSelect.dataset.ready) return;
        hourSelect.innerHTML = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${pad2(h)}</option>`).join('');
        minuteSelect.innerHTML = MINUTE_STEPS.map((m) => `<option value="${m}">${pad2(m)}</option>`).join('');
        hourSelect.dataset.ready = '1';
    }

    function render() {
        title.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

        const first = new Date(viewYear, viewMonth, 1);
        const startDay = (first.getDay() + 6) % 7; // lunes = 0
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const cells = [
            ...Array.from({ length: startDay }, () => null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
        ];
        while (cells.length % 7 !== 0) cells.push(null);

        grid.innerHTML = cells.map((day) => {
            if (!day) return '<span></span>';

            const date = new Date(viewYear, viewMonth, day);
            const isPast = date < todayStart;
            const isToday = sameDay(date, today);
            const isSelected = selected && sameDay(date, selected);

            const classes = ['grid', 'h-9', 'place-items-center', 'rounded-lg', 'text-sm', 'transition-colors'];
            if (isPast) classes.push('cursor-not-allowed', 'text-faint');
            else classes.push('hover:bg-sunken', 'dark:hover:bg-white/10');
            if (isToday && !isSelected) classes.push('font-bold', 'text-accent');
            if (isSelected) classes.push('bg-accent', 'text-white', 'hover:bg-accent');

            return `<button type="button" data-day="${day}" ${isPast ? 'disabled' : ''}
                            class="${classes.join(' ')}">${day}</button>`;
        }).join('');
    }

    function open(currentIso = '') {
        buildTimeOptions();

        const base = currentIso && !Number.isNaN(new Date(currentIso).getTime())
            ? new Date(currentIso)
            : new Date();

        selected = new Date(base.getTime());
        viewYear = selected.getFullYear();
        viewMonth = selected.getMonth();
        hourSelect.value = String(selected.getHours());
        minuteSelect.value = String(Math.floor(selected.getMinutes() / 5) * 5);

        render();
        overlay.showModal();
    }

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-day]');
        if (!btn) return;
        const day = Number(btn.dataset.day);
        const base = selected || new Date();
        selected = new Date(viewYear, viewMonth, day, base.getHours(), base.getMinutes());
        render();
    });

    prevBtn.addEventListener('click', () => {
        const now = new Date();
        const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
        const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
        if (prevYear < now.getFullYear() || (prevYear === now.getFullYear() && prevMonth < now.getMonth())) return;
        viewMonth = prevMonth;
        viewYear = prevYear;
        render();
    });

    nextBtn.addEventListener('click', () => {
        viewMonth += 1;
        if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
        render();
    });

    todayBtn.addEventListener('click', () => {
        const now = new Date();
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        selected = new Date(now.getTime());
        hourSelect.value = String(now.getHours());
        minuteSelect.value = String(Math.floor(now.getMinutes() / 5) * 5);
        render();
    });

    cancelBtn.addEventListener('click', () => overlay.close());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.close(); });

    applyBtn.addEventListener('click', () => {
        if (!selected) {
            notify('Selecciona una fecha');
            return;
        }
        const applied = new Date(
            selected.getFullYear(), selected.getMonth(), selected.getDate(),
            Number(hourSelect.value || 0), Number(minuteSelect.value || 0),
        );
        if (applied <= new Date()) {
            notify('No puedes reservar en una fecha y hora pasada');
            return;
        }
        overlay.close();
        onApply(applied.toISOString());
    });

    return { open };
}
