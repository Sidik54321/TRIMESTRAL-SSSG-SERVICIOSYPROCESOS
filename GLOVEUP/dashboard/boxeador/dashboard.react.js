/**
 * dashboard/boxeador/dashboard.react.js — Dashboard principal del boxeador.
 *
 * Implementado con React sin JSX (usa React.createElement / h()) cargado
 * desde CDN en dashboard.html. No hay paso de compilación (Babel/webpack).
 *
 * Componentes principales:
 *  · MetricDoughnut    — Gráfico de rosca (Chart.js) con valor centrado.
 *  · MetricCard        — Tarjeta de métrica con doughnut y subtexto.
 *  · SparringRow       — Fila de una sesión de sparring en la tabla de historial.
 *  · EmptyState        — Placeholder vacío cuando no hay datos.
 *  · buildBoxerAutoEvents — Genera eventos de calendario automáticos desde
 *                           las sesiones y retos del boxeador.
 *  · BoxerCalendar     — Calendario FullCalendar con CRUD de eventos (API).
 *  · BoxerDashboard    — Raíz: carga datos, renderiza métricas y calendario.
 *
 * Se monta en #boxer-react-root al cargar el DOM.
 */

// React y ReactDOM se cargan como globales desde CDN en el HTML
const React = window.React;
const ReactDOM = window.ReactDOM;
const { useEffect, useRef, useState } = React;
// Alias corto para React.createElement (evita la necesidad de JSX)
const h = React.createElement;

// Claves de localStorage usadas para leer la sesión del usuario
const STORED_EMAIL_KEY = 'gloveup_user_email';
const STORED_USER_ROLE_KEY = 'gloveup_user_role';

// Detección dinámica del host para entornos locales y de producción
const _glv_h = window.location.hostname;
const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
const API_BASE_URL = (localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');

/**
 * Helper HTTP para peticiones JSON a la API REST.
 * Lanza un Error con el mensaje del servidor si la respuesta no es OK.
 *
 * @param {string} path - Ruta relativa a la API (ej: '/api/boxeadores/me?email=...')
 * @param {Object} [options] - Opciones de fetch: method, body, headers.
 * @returns {Promise<any>} Datos deserializados de la respuesta JSON.
 */
const requestJson = (path, options = {}) => {
    const method = options.method || 'GET';
    const config = { method, headers: { 'Content-Type': 'application/json' } };
    if (options.body !== undefined) config.body = JSON.stringify(options.body);
    return fetch(`${API_BASE_URL}${path}`, config).then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || `Error ${res.status}`);
        return payload;
    });
};

/**
 * Convierte una fecha a formato ISO YYYY-MM-DD para el input[type=date].
 * Devuelve '' si el valor no es una fecha válida.
 *
 * @param {string|Date} value - Fecha a convertir.
 * @returns {string} Fecha en formato YYYY-MM-DD o ''.
 */
const toIsoDate = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Comprueba si una fecha en formato 'YYYY-MM-...' pertenece al mes actual.
 * Usado para filtrar sesiones y retos del mes corriente en las métricas.
 *
 * @param {string} str - Fecha en formato ISO ('YYYY-MM-DD...')
 * @returns {boolean}
 */
const inCurrentMonth = (str) => {
    if (!str || typeof str !== 'string') return false;
    const [y, m] = str.split('-');
    if (!y || !m) return false;
    const now = new Date();
    return y === String(now.getFullYear()) && m === String(now.getMonth() + 1).padStart(2, '0');
};

/**
 * Formatea una fecha ISO como cadena localizada en español.
 * Devuelve '—' si la fecha es inválida o vacía.
 *
 * @param {string} str - Fecha en formato ISO.
 * @returns {string} Fecha formateada (ej: "15 ene 2025") o '—'.
 */
const fmtDate = (str) => {
    if (!str) return '—';
    try {
        const d = new Date(str);
        if (isNaN(d)) return str;
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return str; }
};

/**
 * Traduce el estado interno de un reto/sesión a etiqueta en español.
 * Usado para mostrar el estado en la tabla de historial.
 *
 * @param {string} s - Estado interno (ej: 'pending', 'accepted', 'completed').
 * @returns {string} Etiqueta en español.
 */
const statusLabel = (s) => {
    const map = { pending: 'Pendiente', accepted: 'Aceptado', rejected: 'Rechazado', completed: 'Completado', cancelled: 'Cancelado' };
    return map[s] || s || '—';
};

/**
 * Devuelve la clase CSS correspondiente al estado de un reto/sesión.
 * Los estilos de cada clase se definen en dashboard.css.
 *
 * @param {string} s - Estado interno del reto.
 * @returns {string} Nombre de clase CSS.
 */
const statusClass = (s) => {
    const map = { pending: 'status-pending', accepted: 'status-accepted', completed: 'status-completed', rejected: 'status-rejected', cancelled: 'status-cancelled' };
    return map[s] || 'status-pending';
};

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

/**
 * Gráfico de anillo (doughnut) con el valor numérico centrado.
 * Usa Chart.js (window.Chart) para dibujar sobre un <canvas> de 96×96px.
 * El anillo muestra `value` sobre `max`; el arco restante se rellena en gris.
 * El Chart.js se inicializa en el primer useEffect y se actualiza cuando cambian
 * las props. El segundo useEffect destruye la instancia al desmontar el componente
 * para evitar fugas de memoria.
 *
 * @param {object} props
 * @param {string} props.label  - Etiqueta para el dataset (visible en datos internos).
 * @param {number} props.value  - Valor actual a representar.
 * @param {number} props.max    - Valor máximo (100 % del arco).
 * @param {string} props.color  - Color HEX del arco principal.
 */
function MetricDoughnut({ label, value, max, color }) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    const safeMax = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 1;

    useEffect(() => {
        const canvas = canvasRef.current;
        const ChartLib = window.Chart;
        if (!canvas || !ChartLib) return;

        const remaining = Math.max(0, safeMax - safeValue);
        const cfg = {
            type: 'doughnut',
            data: {
                labels: [label, ''],
                datasets: [{
                    data: [safeValue || 0.001, remaining || safeMax],
                    backgroundColor: [color || '#111827', 'rgba(0,0,0,0.06)'],
                    borderWidth: 0,
                    hoverOffset: 0
                }]
            },
            options: {
                responsive: false,
                cutout: '72%',
                animation: { duration: 700 },
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        };

        if (!chartRef.current) {
            chartRef.current = new ChartLib(canvas, cfg);
        } else {
            chartRef.current.data.datasets[0].data = [safeValue || 0.001, remaining || safeMax];
            chartRef.current.data.datasets[0].backgroundColor[0] = color || '#111827';
            chartRef.current.update();
        }
    }, [label, value, max, color]);

    useEffect(() => () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } }, []);

    return h('div', { className: 'donut-wrapper' },
        h('canvas', { ref: canvasRef, width: 96, height: 96 }),
        h('div', { className: 'donut-center' },
            h('span', { className: 'donut-value' }, String(safeValue))
        )
    );
}

/**
 * Tarjeta de métrica con encabezado, doughnut embebido y subtexto descriptivo.
 *
 * @param {object} props
 * @param {string}  props.label       - Título de la métrica (ej: "Sesiones este mes").
 * @param {string}  props.pill        - Valor principal mostrado como píldora (ej: "7").
 * @param {string}  props.sub         - Texto descriptivo bajo el gráfico.
 * @param {string}  [props.icon]      - Clase FontAwesome para el icono del encabezado.
 * @param {object}  props.chartProps  - Props pasadas directamente a MetricDoughnut.
 */
function MetricCard({ label, pill, sub, icon, chartProps }) {
    return h('div', { className: 'metric-card has-chart' },
        h('div', { className: 'metric-header' },
            h('div', { className: 'metric-label-group' },
                icon ? h('i', { className: icon, style: { marginRight: '8px', fontSize: '1rem', opacity: 0.5 } }) : null,
                h('span', { className: 'metric-label' }, label)
            ),
            h('span', { className: 'metric-pill' }, pill)
        ),
        h(MetricDoughnut, chartProps),
        h('p', { className: 'metric-sub' }, sub)
    );
}

// ——— Fila de sparring reciente ———
/**
 * Fila de historial de sparring dentro de la lista de "Sparrings recientes".
 * Determina quién es el rival comparando `userEmail` con `boxerAEmail`/`boxerBEmail`
 * del objeto de sesión, mostrando siempre el nombre del otro boxeador.
 *
 * @param {object} props
 * @param {object} props.session   - Objeto de sesión de sparring (del array sparringSessions).
 * @param {string} props.userEmail - Email del boxeador logueado (para identificar el lado A/B).
 */
function SparringRow({ session, userEmail }) {
    const isA = (session.boxerAEmail || '').toLowerCase() === (userEmail || '').toLowerCase();
    const rival = isA ? (session.boxerBNombre || session.boxerBEmail || '—') : (session.boxerANombre || session.boxerAEmail || '—');
    const date = session.scheduledAt || session.completedAt || session.createdAt || '';
    const gym = session.gymName || '—';

    return h('li', { className: 'sparring-row' },
        h('div', { className: 'sparring-row-left' },
            h('div', { className: 'sparring-avatar' },
                h('i', { className: 'fas fa-user' })
            ),
            h('div', null,
                h('strong', { className: 'sparring-rival' }, rival),
                h('span', { className: 'sparring-gym' },
                    h('i', { className: 'fas fa-map-marker-alt', style: { marginRight: '4px', opacity: 0.5, fontSize: '0.72rem' } }),
                    gym
                )
            )
        ),
        h('div', { className: 'sparring-row-right' },
            h('span', { className: `sparring-status ${statusClass(session.status)}` }, statusLabel(session.status)),
            h('span', { className: 'sparring-date' }, fmtDate(date))
        )
    );
}

/**
 * Placeholder visual para listas o secciones sin datos.
 *
 * @param {object} props
 * @param {string} props.icon - Clase FontAwesome del icono (ej: 'fas fa-fist-raised').
 * @param {string} props.text - Mensaje explicativo para el usuario.
 */
function EmptyState({ icon, text }) {
    return h('div', { className: 'empty-state' },
        h('i', { className: icon }),
        h('p', null, text)
    );
}

// ─── FUNCIONES DE CALENDARIO ──────────────────────────────────────────────────

/**
 * Construye el array de eventos FullCalendar a partir de los datos de la API.
 * Combina dos tipos de eventos automáticos:
 *  - Sesiones de sparring pasadas/programadas → clase 'gloveup-event--sparring'
 *  - Retos confirmados (status 'accepted') con fecha → clase 'gloveup-event--reto'
 *
 * Los eventos automáticos se distinguen de los eventos personalizados del usuario
 * porque NO tienen extendedProps.dbId; por eso, al hacer clic en ellos el
 * modal de edición no se abre (ver openEditModal en BoxerCalendar).
 *
 * @param {Array} sessions          - Sesiones de sparring del boxeador (del API).
 * @param {Array} upcomingChallenges - Retos aceptados, ya enriquecidos con _dir ('sent'|'recv').
 * @param {string} email            - Email del boxeador para resolver quién es rival A/B.
 * @returns {Array} Array de objetos de evento compatibles con FullCalendar v5+.
 */
function buildBoxerAutoEvents(sessions, upcomingChallenges, email) {
    const events = [];
    const myEmail = (email || '').toLowerCase();

    sessions.forEach((s, idx) => {
        const date = toIsoDate(s.scheduledAt || s.completedAt || s.createdAt || '');
        if (!date) return;
        const isA = (s.boxerAEmail || '').toLowerCase() === myEmail;
        const rival = isA ? (s.boxerBNombre || s.boxerBEmail || 'Rival') : (s.boxerANombre || s.boxerAEmail || 'Rival');
        const gym = s.gymName || '';
        events.push({
            id: `session-${s.id || idx}`,
            title: `Sparring: ${rival}${gym ? ` · ${gym}` : ''}`,
            start: date,
            allDay: true,
            classNames: ['gloveup-event--sparring'],
            extendedProps: { kind: 'sparring', rival, gym, status: s.status }
        });
    });

    upcomingChallenges.forEach((c, idx) => {
        const date = toIsoDate(c.scheduledAt || '');
        if (!date) return;
        const rival = c._dir === 'sent'
            ? (c.toNombre || c.toEmail || 'Rival')
            : (c.fromNombre || c.fromEmail || 'Rival');
        events.push({
            id: `challenge-${c.id || idx}`,
            title: `Reto confirmado: ${rival}`,
            start: date,
            allDay: true,
            classNames: ['gloveup-event--reto'],
            extendedProps: { kind: 'reto', rival, dir: c._dir }
        });
    });

    return events;
}

/**
 * Calendario interactivo del boxeador basado en FullCalendar (window.FullCalendar).
 *
 * Combina dos capas de eventos en el mismo calendario:
 *  1. Eventos automáticos: sesiones y retos aceptados construidos por buildBoxerAutoEvents().
 *     No tienen dbId → el clic muestra detalles en el texto informativo pero no abre modal.
 *  2. Eventos personalizados: guardados en MongoDB vía /api/boxeadores/me/calendar-events.
 *     Tienen extendedProps.dbId → el clic abre el modal de edición/eliminación.
 *
 * Flujo de vida del componente:
 *  - useEffect #1 inicializa FullCalendar en el primer render y lo destruye al desmontar.
 *  - useEffect #2 sincroniza los eventos del calendario cuando cambian sessions, upcomingChallenges
 *    o customEvents (recargados desde la API por loadCustomEvents).
 *  - El modal de creación/edición y el diálogo de confirmación de borrado se renderizan
 *    como portales React dentro del mismo árbol usando h() (sin JSX).
 *
 * @param {object}   props
 * @param {Array}    props.sessions            - Sesiones de sparring del boxeador.
 * @param {Array}    props.upcomingChallenges  - Retos aceptados con _dir adjunto.
 * @param {string}   props.email              - Email del boxeador para las llamadas a la API.
 * @param {number}   props.refreshKey         - Clave numérica; cambiarla fuerza recarga de eventos.
 */
function BoxerCalendar({ sessions, upcomingChallenges, email, refreshKey }) {
    const elRef = useRef(null);
    const calRef = useRef(null);
    const [customEvents, setCustomEvents] = useState([]);
    const [details, setDetails] = useState('Haz clic en un día para añadir un evento o en uno existente para verlo.');
    const [showModal, setShowModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [formTitle, setFormTitle] = useState('');
    const [formStart, setFormStart] = useState('');
    const [formEnd, setFormEnd] = useState('');
    const [formColor, setFormColor] = useState('#f97316');
    const [formTipo, setFormTipo] = useState('personalizado');
    const [formNotas, setFormNotas] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const loadCustomEvents = () => {
        requestJson(`/api/boxeadores/me/calendar-events?email=${encodeURIComponent(email)}`)
            .then(data => setCustomEvents(Array.isArray(data) ? data : []))
            .catch(() => {});
    };

    useEffect(() => { if (email) loadCustomEvents(); }, [email, refreshKey]);

    const openCreateModal = (dateStr) => {
        setEditingEvent(null);
        setFormTitle('');
        setFormStart(dateStr || toIsoDate(new Date()));
        setFormEnd('');
        setFormColor('#f97316');
        setFormTipo('personalizado');
        setFormNotas('');
        setFormError('');
        setShowModal(true);
    };

    const openEditModal = (ev) => {
        const dbId = ev.extendedProps && ev.extendedProps.dbId;
        if (!dbId) {
            const rival = ev.extendedProps && ev.extendedProps.rival || '';
            const gym = ev.extendedProps && ev.extendedProps.gym || '';
            const parts = [ev.startStr ? fmtDate(ev.startStr.slice(0, 10)) : '', ev.title];
            if (rival) parts.push(`Rival: ${rival}`);
            if (gym) parts.push(`Gym: ${gym}`);
            setDetails(parts.filter(Boolean).join(' · '));
            return;
        }
        setEditingEvent({ id: dbId, fcEvent: ev });
        setFormTitle(ev.title || '');
        setFormStart(ev.startStr ? ev.startStr.slice(0, 10) : '');
        setFormEnd(ev.endStr ? ev.endStr.slice(0, 10) : '');
        setFormColor(ev.backgroundColor || (ev.extendedProps && ev.extendedProps.color) || '#f97316');
        setFormTipo((ev.extendedProps && ev.extendedProps.tipo) || 'personalizado');
        setFormNotas((ev.extendedProps && ev.extendedProps.notas) || '');
        setFormError('');
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditingEvent(null); setFormError(''); setShowDeleteConfirm(false); };

    const saveEvent = async () => {
        if (!formTitle.trim() || !formStart) { setFormError('El título y la fecha son obligatorios.'); return; }
        setFormLoading(true); setFormError('');
        try {
            const body = { title: formTitle.trim(), start: formStart, end: formEnd || '', allDay: true, color: formColor, tipo: formTipo, notas: formNotas.trim() };
            if (editingEvent) {
                await requestJson(`/api/boxeadores/me/calendar-events/${editingEvent.id}?email=${encodeURIComponent(email)}`, { method: 'PUT', body });
            } else {
                await requestJson(`/api/boxeadores/me/calendar-events?email=${encodeURIComponent(email)}`, { method: 'POST', body });
            }
            closeModal();
            loadCustomEvents();
        } catch (err) {
            setFormError(err && err.message ? err.message : 'Error al guardar.');
        } finally { setFormLoading(false); }
    };

    const deleteEvent = async () => {
        if (!editingEvent) return;
        setFormLoading(true);
        try {
            await requestJson(`/api/boxeadores/me/calendar-events/${editingEvent.id}?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
            closeModal();
            loadCustomEvents();
        } catch (err) {
            setFormError(err && err.message ? err.message : 'Error al eliminar.');
        } finally { setFormLoading(false); }
    };

    // Inicializar FullCalendar
    useEffect(() => {
        const el = elRef.current;
        const FC = window.FullCalendar;
        if (!el || !FC || !FC.Calendar) return;
        if (!calRef.current) {
            calRef.current = new FC.Calendar(el, {
                initialView: 'dayGridMonth',
                height: 'auto',
                locale: 'es',
                firstDay: 1,
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
                dateClick: (info) => openCreateModal(info.dateStr),
                eventClick: (info) => openEditModal(info.event)
            });
            calRef.current.render();
        }
        return () => {
            if (calRef.current) { calRef.current.destroy(); calRef.current = null; }
        };
    }, []);

    // Sincronizar eventos en el calendario
    useEffect(() => {
        if (!calRef.current) return;
        const autoEvents = buildBoxerAutoEvents(sessions, upcomingChallenges, email);
        const dbEvents = customEvents.map(ev => ({
            id: `db-${ev._id}`,
            title: ev.title,
            start: ev.start,
            end: ev.end || undefined,
            allDay: ev.allDay !== false,
            backgroundColor: ev.color || '#f97316',
            borderColor: ev.color || '#f97316',
            classNames: ['gloveup-event--personalizado'],
            extendedProps: { dbId: ev._id, kind: 'personalizado', tipo: ev.tipo, notas: ev.notas, color: ev.color }
        }));
        calRef.current.removeAllEvents();
        [...autoEvents, ...dbEvents].forEach(e => calRef.current.addEvent(e));
    }, [sessions, upcomingChallenges, customEvents, email]);

    const colorOptions = [
        { value: '#f97316', label: 'Naranja' },
        { value: '#3b82f6', label: 'Azul' },
        { value: '#22c55e', label: 'Verde' },
        { value: '#ef4444', label: 'Rojo' },
        { value: '#8b5cf6', label: 'Morado' },
        { value: '#111827', label: 'Negro' }
    ];

    const tipoOptions = [
        { value: 'personalizado', label: 'Personalizado' },
        { value: 'entrenamiento', label: 'Entrenamiento' },
        { value: 'competicion', label: 'Competición' },
        { value: 'descanso', label: 'Descanso' }
    ];

    const fieldStyle = { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: '.9rem', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '.8rem', fontWeight: 700, marginBottom: 6, color: '#374151' };

    const modal = showModal ? h('div', {
            style: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
            onClick: (e) => { if (e.target === e.currentTarget) closeModal(); }
        },
        h('div', { style: { backgroundColor: '#fff', borderRadius: 20, padding: 32, maxWidth: 480, width: '90%', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } },
                h('h3', { style: { margin: 0, fontSize: '1.2rem', fontWeight: 800 } }, editingEvent ? 'Editar evento' : 'Nuevo evento'),
                h('button', { onClick: closeModal, style: { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' } }, '\xd7')
            ),
            formError ? h('div', { style: { padding: '10px 14px', borderRadius: 12, backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '.85rem', fontWeight: 600, marginBottom: 16 } }, formError) : null,
            h('label', { style: labelStyle }, 'Título *'),
            h('input', { type: 'text', value: formTitle, placeholder: 'Ej: Entrenamiento especial', onChange: (e) => setFormTitle(e.target.value), style: { ...fieldStyle, marginBottom: 16 } }),
            h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 } },
                h('div', null,
                    h('label', { style: labelStyle }, 'Fecha inicio *'),
                    h('input', { type: 'date', value: formStart, onChange: (e) => setFormStart(e.target.value), style: fieldStyle })
                ),
                h('div', null,
                    h('label', { style: labelStyle }, 'Fecha fin'),
                    h('input', { type: 'date', value: formEnd, onChange: (e) => setFormEnd(e.target.value), style: fieldStyle })
                )
            ),
            h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 } },
                h('div', null,
                    h('label', { style: labelStyle }, 'Tipo'),
                    h('select', { value: formTipo, onChange: (e) => setFormTipo(e.target.value), style: { ...fieldStyle, backgroundColor: '#fff' } },
                        ...tipoOptions.map(o => h('option', { key: o.value, value: o.value }, o.label))
                    )
                ),
                h('div', null,
                    h('label', { style: labelStyle }, 'Color'),
                    h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 } },
                        ...colorOptions.map(c => h('button', {
                            key: c.value, type: 'button', title: c.label,
                            onClick: () => setFormColor(c.value),
                            style: { width: 28, height: 28, borderRadius: '50%', backgroundColor: c.value, border: formColor === c.value ? '3px solid #111827' : '2px solid #e5e7eb', cursor: 'pointer', transition: 'all .15s' }
                        }))
                    )
                )
            ),
            h('label', { style: labelStyle }, 'Notas'),
            h('textarea', { value: formNotas, placeholder: 'Notas opcionales...', onChange: (e) => setFormNotas(e.target.value), rows: 3, style: { ...fieldStyle, resize: 'vertical', marginBottom: 20, fontFamily: 'inherit' } }),
            h('div', { style: { display: 'flex', gap: 10 } },
                h('button', { className: 'btn btn-primary', disabled: formLoading, onClick: saveEvent, style: { flex: 2, padding: '12px', fontSize: '.9rem', fontWeight: 700, borderRadius: 12 } },
                    h('i', { className: `fas ${editingEvent ? 'fa-save' : 'fa-plus'}`, style: { marginRight: 6 } }),
                    formLoading ? 'Guardando...' : (editingEvent ? 'Guardar cambios' : 'Crear evento')
                ),
                editingEvent ? h('button', { className: 'btn btn-secondary', disabled: formLoading, onClick: () => { setFormError(''); setShowDeleteConfirm(true); }, style: { flex: 1, padding: '12px', fontSize: '.9rem', color: '#ef4444', borderColor: '#ef4444', borderRadius: 12 } },
                    h('i', { className: 'fas fa-trash', style: { marginRight: 6 } }),
                    'Eliminar'
                ) : null
            )
        )
    ) : null;

    const deleteConfirm = showDeleteConfirm ? h('div', {
            style: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
            onClick: (e) => { if (!formLoading && e.target === e.currentTarget) setShowDeleteConfirm(false); }
        },
        h('div', { style: { backgroundColor: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '90%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' } },
            h('i', { className: 'fas fa-exclamation-triangle', style: { fontSize: '3rem', color: '#ef4444', marginBottom: 16, display: 'block' } }),
            h('h3', { style: { margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 800 } }, '¿Eliminar este evento?'),
            h('p', { style: { margin: '0 0 24px', fontSize: '.95rem', color: '#6b7280' } }, 'Esta acción no se puede deshacer.'),
            formError ? h('div', { style: { padding: '10px', borderRadius: 12, backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '.85rem', fontWeight: 600, marginBottom: 16 } }, formError) : null,
            h('div', { style: { display: 'flex', gap: 10 } },
                h('button', { className: 'btn btn-secondary', disabled: formLoading, onClick: () => setShowDeleteConfirm(false), style: { flex: 1, padding: '12px', borderRadius: 12 } }, 'Cancelar'),
                h('button', { className: 'btn btn-primary', disabled: formLoading, onClick: deleteEvent, style: { flex: 1, padding: '12px', backgroundColor: '#ef4444', borderColor: '#ef4444', borderRadius: 12 } },
                    formLoading ? 'Eliminando...' : 'Sí, eliminar'
                )
            )
        )
    ) : null;

    return h(React.Fragment, null,
        h('p', { className: 'cal-fc-hint' },
            h('i', { className: 'fas fa-info-circle', style: { marginRight: 5, opacity: 0.5 } }),
            details
        ),
        h('div', { ref: elRef, className: 'boxer-fullcalendar' }),
        modal,
        deleteConfirm
    );
}

// ─── COMPONENTE RAÍZ ──────────────────────────────────────────────────────────

/**
 * Componente raíz del dashboard del boxeador. Orquesta toda la UI de la página.
 *
 * Flujo de inicialización:
 *  1. Lee email y rol desde localStorage (la fuente de verdad de sesión de GloveUp).
 *  2. Si no hay email o el rol no es 'boxeador', muestra el spinner y para.
 *  3. Llama a /api/boxeadores/me?email=... para obtener el perfil completo.
 *  4. Deriva métricas (sesiones del mes, retos pendientes, sesiones recientes) del perfil.
 *  5. Renderiza: sección de métricas (3 MetricCards) + grid inferior (lista + calendario).
 *
 * Estado:
 *  - profile: datos completos del boxeador (null mientras carga o si falla).
 *  - loading: controla el spinner de carga inicial.
 *  - calRefreshKey: integer para forzar recarga del calendario desde fuera (no usado hoy,
 *    preparado para acciones que crean eventos desde otros componentes).
 *
 * No recibe props: lee el email directamente de localStorage porque es el componente raíz
 * que se monta en un div estático del HTML (#boxer-react-root).
 */
function BoxerDashboard() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [calRefreshKey] = useState(0);

    const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();

    useEffect(() => {
        const role = (localStorage.getItem(STORED_USER_ROLE_KEY) || '').toLowerCase();
        if (!email) { setLoading(false); return; }
        if (role !== 'boxeador') { setLoading(false); return; }

        requestJson(`/api/boxeadores/me?email=${encodeURIComponent(email)}`)
            .then((data) => { setProfile(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const sessions = profile && Array.isArray(profile.sparringSessions) ? profile.sparringSessions : [];
    const sent = profile && Array.isArray(profile.sparringChallengesSent) ? profile.sparringChallengesSent : [];
    const received = profile && Array.isArray(profile.sparringChallengesReceived) ? profile.sparringChallengesReceived : [];

    const sessionsThisMonth = sessions.filter(s => {
        const d = s.scheduledAt || s.completedAt || s.createdAt || '';
        return inCurrentMonth(d.slice(0, 10));
    }).length;

    const pendingChallenges = [
        ...sent.filter(c => c.status === 'pending'),
        ...received.filter(c => c.status === 'pending')
    ];

    const recentSessions = [...sessions]
        .sort((a, b) => new Date(b.scheduledAt || b.completedAt || b.createdAt || 0) - new Date(a.scheduledAt || a.completedAt || a.createdAt || 0))
        .slice(0, 5);

    const upcomingChallenges = [
        ...sent.filter(c => c.status === 'accepted').map(c => ({ ...c, _dir: 'sent' })),
        ...received.filter(c => c.status === 'accepted').map(c => ({ ...c, _dir: 'recv' }))
    ].sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));

    if (loading) {
        return h('div', { className: 'dashboard-loading' },
            h('div', { className: 'spinner' }),
            h('p', null, 'Cargando tu panel…')
        );
    }

    return h(React.Fragment, null,
        // ——— Métricas ———
        h('section', { className: 'dashboard-metrics' },
            h(MetricCard, {
                label: 'Sesiones este mes',
                pill: String(sessionsThisMonth),
                icon: 'fas fa-fist-raised',
                sub: sessionsThisMonth === 0 ? 'Sin sesiones registradas este mes.' : `${sessionsThisMonth} sesión${sessionsThisMonth !== 1 ? 'es' : ''} completada${sessionsThisMonth !== 1 ? 's' : ''}.`,
                chartProps: { label: 'Sesiones', value: sessionsThisMonth, max: 10, color: '#111827' }
            }),
            h(MetricCard, {
                label: 'Total sesiones',
                pill: String(sessions.length),
                icon: 'fas fa-history',
                sub: sessions.length === 0 ? 'Aún no tienes sesiones registradas.' : `${sessions.length} sesión${sessions.length !== 1 ? 'es' : ''} en total.`,
                chartProps: { label: 'Total', value: sessions.length, max: Math.max(sessions.length, 20), color: '#f97316' }
            }),
            h(MetricCard, {
                label: 'Retos pendientes',
                pill: String(pendingChallenges.length),
                icon: 'fas fa-hourglass-half',
                sub: pendingChallenges.length === 0 ? 'No tienes retos pendientes.' : `${pendingChallenges.length} reto${pendingChallenges.length !== 1 ? 's' : ''} esperando respuesta.`,
                chartProps: { label: 'Pendientes', value: pendingChallenges.length, max: Math.max(pendingChallenges.length, 5), color: '#f97316' }
            })
        ),

        // ——— Grid inferior ———
        h('div', { className: 'dashboard-grid' },
            // Sparrings recientes
            h('div', { className: 'dashboard-panel' },
                h('h2', null,
                    h('i', { className: 'fas fa-clock', style: { marginRight: '8px', opacity: 0.5 } }),
                    'Sparrings recientes'
                ),
                recentSessions.length === 0
                    ? h(EmptyState, { icon: 'fas fa-fist-raised', text: 'Todavía no tienes sesiones registradas. ¡Busca un sparring para empezar!' })
                    : h('ul', { className: 'sparring-list' },
                        ...recentSessions.map((s, i) => h(SparringRow, { key: s.id || i, session: s, userEmail: email }))
                    )
            ),

            // Calendario de retos y eventos
            h('div', { className: 'dashboard-panel challenges-panel' },
                h('h2', null,
                    h('i', { className: 'fas fa-calendar-check', style: { marginRight: '8px', opacity: 0.5 } }),
                    'Mi calendario'
                ),
                email
                    ? h(BoxerCalendar, { sessions, upcomingChallenges, email, refreshKey: calRefreshKey })
                    : h(EmptyState, { icon: 'fas fa-calendar-alt', text: 'No se pudo cargar el calendario.' })
            )
        )
    );
}

const rootEl = document.getElementById('boxer-react-root');
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(h(BoxerDashboard, null));
}
