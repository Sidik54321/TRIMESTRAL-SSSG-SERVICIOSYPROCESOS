const React = window.React;
const ReactDOM = window.ReactDOM;
const {
    useEffect,
    useMemo,
    useRef,
    useState
} = React;
const h = React.createElement;

const STORED_EMAIL_KEY = 'gloveup_user_email';
const STORED_USER_ROLE_KEY = 'gloveup_user_role';
const API_BASE_URL = (window.localStorage.getItem('gloveup_api_base_url') || 'http://localhost:3000').replace(/\/+$/, '');

const requestJson = (path, options = {}) => {
    const method = options.method || 'GET';
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 8000;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const config = {
        method,
        headers,
        signal: controller.signal
    };
    if (options.body !== undefined) {
        config.body = JSON.stringify(options.body);
    }
    return fetch(`${API_BASE_URL}${path}`, config)
        .then(async (res) => {
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload.error || `Error ${res.status} en ${path}`);
            }
            return payload;
        })
        .catch((err) => {
            if (err && err.name === 'AbortError') {
                throw new Error(`Tiempo de espera agotado (${timeoutMs}ms) en ${path}`);
            }
            if (err instanceof TypeError) {
                throw new Error(`No se pudo conectar con el servidor (${API_BASE_URL}).`);
            }
            throw err;
        })
        .finally(() => window.clearTimeout(timeoutId));
};

const formatCurrency = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '0€';
    return `${num.toFixed(2)}€`;
};

const cap = (n) => Math.max(0, Math.min(100, n));

const toIsoDate = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const formatDateEs = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-');
    if (!y || !m || !d) return String(iso);
    return `${d}/${m}/${y}`;
};

const getNextMondayIso = () => {
    const now = new Date();
    const day = now.getDay();
    const delta = (8 - day) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + delta);
    return toIsoDate(next);
};

const buildInscriptionRevenueSeries = (boxers, precioMensual) => {
    const price = Number.isFinite(Number(precioMensual)) && Number(precioMensual) >= 0 ? Number(precioMensual) : 0;
    const list = Array.isArray(boxers) ? boxers : [];
    const dates = list
        .map((b) => toIsoDate(b && (b.fechaInscripcion || b.createdAt)))
        .filter(Boolean);

    const today = new Date();
    const maxPast = new Date(today);
    maxPast.setFullYear(today.getFullYear() - 5);

    const earliestIso = dates.sort()[0];
    const earliest = earliestIso ? new Date(`${earliestIso}T00:00:00`) : maxPast;
    const startDate = earliest > maxPast ? earliest : maxPast;

    const byDay = new Map();
    dates.forEach((iso) => {
        byDay.set(iso, (byDay.get(iso) || 0) + 1);
    });

    const points = [];
    let cumulative = 0;
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const iso = toIsoDate(cursor);
        const count = byDay.get(iso) || 0;
        cumulative += count * price;
        points.push({
            x: cursor.getTime(),
            y: cumulative
        });
    }

    return points;
};

function InscriptionRevenueLineChart({
    boxers,
    precioMensual
}) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);
    const points = useMemo(() => buildInscriptionRevenueSeries(boxers, precioMensual), [boxers, precioMensual]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ChartLib = window.Chart;
        if (!canvas || !ChartLib) return;

        const fmt = new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'short'
        });

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
                fill: true
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            normalized: true,
            interaction: {
                mode: 'nearest',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                decimation: {
                    enabled: true,
                    algorithm: 'lttb',
                    samples: 250,
                    threshold: 600
                },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const item = items && items[0];
                            const x = item && item.parsed && Number.isFinite(item.parsed.x) ? item.parsed.x : null;
                            return x ? fmt.format(new Date(x)) : '';
                        },
                        label: (ctx) => ` ${formatCurrency(ctx.parsed && Number.isFinite(ctx.parsed.y) ? ctx.parsed.y : 0)}`
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    ticks: {
                        maxTicksLimit: 8,
                        callback: (value) => {
                            const num = Number(value);
                            if (!Number.isFinite(num)) return '';
                            return fmt.format(new Date(num));
                        }
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value)
                    }
                }
            }
        };

        if (!chartRef.current) {
            chartRef.current = new ChartLib(canvas, {
                type: 'line',
                data,
                options
            });
            return;
        }

        const chart = chartRef.current;
        chart.data.datasets[0].data = points;
        chart.update();
    }, [points]);

    useEffect(() => {
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, []);

    return h('div', {
        className: 'coach-line-chart'
    }, h('canvas', {
        ref: canvasRef
    }));
}

const buildCoachCalendarEvents = (boxers, metricas) => {
    const events = [];
    const list = Array.isArray(boxers) ? boxers : [];

    list.forEach((b) => {
        const boxerName = b && b.nombre ? String(b.nombre) : 'Alumno';
        const insc = toIsoDate(b && (b.fechaInscripcion || b.createdAt));
        if (insc) {
            events.push({
                id: `inscripcion-${b && b._id ? b._id : boxerName}-${insc}`,
                title: `Inscripción: ${boxerName}`,
                start: insc,
                allDay: true,
                classNames: ['gloveup-event--inscripcion'],
                extendedProps: {
                    kind: 'inscripcion',
                    boxer: boxerName,
                    email: b && b.email ? String(b.email) : ''
                }
            });
        }

        const history = b && Array.isArray(b.sparringHistory) ? b.sparringHistory : [];
        history.forEach((s, idx) => {
            const date = toIsoDate(s && s.date);
            if (!date) return;
            const partner = s && s.partner ? String(s.partner) : 'Partner';
            events.push({
                id: `sparring-${b && b._id ? b._id : boxerName}-${idx}-${date}`,
                title: `Sparring: ${boxerName} x ${partner}`,
                start: date,
                allDay: true,
                classNames: ['gloveup-event--sparring'],
                extendedProps: {
                    kind: 'sparring',
                    boxer: boxerName,
                    partner,
                    place: s && s.place ? String(s.place) : '',
                    notes: s && s.notes ? String(s.notes) : ''
                }
            });
        });
    });

    const ingresosMes = metricas && Number.isFinite(Number(metricas.ingresosMes)) ? Number(metricas.ingresosMes) : 0;
    const now = new Date();
    const firstDay = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    if (firstDay) {
        events.push({
            id: `ingresos-${firstDay}`,
            title: `Ingresos estimados: ${formatCurrency(ingresosMes)}`,
            start: firstDay,
            allDay: true,
            classNames: ['gloveup-event--recordatorio'],
            extendedProps: {
                kind: 'recordatorio'
            }
        });
    }

    const nextMonday = getNextMondayIso();
    if (nextMonday) {
        events.push({
            id: `plan-${nextMonday}`,
            title: 'Recordatorio: planificar semana',
            start: nextMonday,
            allDay: true,
            classNames: ['gloveup-event--recordatorio'],
            extendedProps: {
                kind: 'recordatorio'
            }
        });
    }

    return events;
};

function CoachCalendar({
    events,
    onEventsChange
}) {
    const elRef = useRef(null);
    const calendarRef = useRef(null);
    const [details, setDetails] = useState('Selecciona un evento o haz clic en un dia para crear uno nuevo.');
    const [showModal, setShowModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [formTitle, setFormTitle] = useState('');
    const [formStart, setFormStart] = useState('');
    const [formEnd, setFormEnd] = useState('');
    const [formColor, setFormColor] = useState('#3b82f6');
    const [formTipo, setFormTipo] = useState('personalizado');
    const [formNotas, setFormNotas] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [filters, setFilters] = useState({ sparring: true, inscripcion: true, recordatorio: true, personalizado: true });

    const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

    const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();

    const openCreateModal = (dateStr) => {
        setEditingEvent(null);
        setFormTitle('');
        setFormStart(dateStr || toIsoDate(new Date()));
        setFormEnd('');
        setFormColor('#3b82f6');
        setFormTipo('personalizado');
        setFormNotas('');
        setFormError('');
        setShowModal(true);
    };

    const openEditModal = (ev) => {
        const dbId = ev.extendedProps && ev.extendedProps.dbId ? ev.extendedProps.dbId : null;
        if (!dbId) {
            setDetails('Este evento es automatico y no se puede editar.');
            return;
        }
        setEditingEvent({ id: dbId, fcEvent: ev });
        setFormTitle(ev.title || '');
        setFormStart(ev.startStr ? ev.startStr.slice(0, 10) : '');
        setFormEnd(ev.endStr ? ev.endStr.slice(0, 10) : '');
        setFormColor(ev.backgroundColor || ev.extendedProps.color || '#3b82f6');
        setFormTipo(ev.extendedProps.tipo || 'personalizado');
        setFormNotas(ev.extendedProps.notas || '');
        setFormError('');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingEvent(null);
        setFormError('');
    };

    const saveEvent = async () => {
        if (!formTitle.trim() || !formStart) {
            setFormError('El titulo y la fecha son obligatorios.');
            return;
        }
        setFormLoading(true);
        setFormError('');
        try {
            const body = {
                title: formTitle.trim(),
                start: formStart,
                end: formEnd || '',
                allDay: true,
                color: formColor,
                tipo: formTipo,
                notas: formNotas.trim()
            };
            if (editingEvent) {
                await requestJson(`/api/entrenadores/me/calendar-events/${editingEvent.id}?email=${encodeURIComponent(email)}`, {
                    method: 'PUT',
                    body
                });
            } else {
                await requestJson(`/api/entrenadores/me/calendar-events?email=${encodeURIComponent(email)}`, {
                    method: 'POST',
                    body
                });
            }
            closeModal();
            if (onEventsChange) onEventsChange();
        } catch (err) {
            setFormError(err && err.message ? err.message : 'Error al guardar el evento.');
        } finally {
            setFormLoading(false);
        }
    };

    const deleteEvent = async () => {
        if (!editingEvent) return;
        if (!window.confirm('Eliminar este evento?')) return;
        setFormLoading(true);
        try {
            await requestJson(`/api/entrenadores/me/calendar-events/${editingEvent.id}?email=${encodeURIComponent(email)}`, {
                method: 'DELETE'
            });
            closeModal();
            if (onEventsChange) onEventsChange();
        } catch (err) {
            setFormError(err && err.message ? err.message : 'Error al eliminar.');
        } finally {
            setFormLoading(false);
        }
    };

    useEffect(() => {
        const el = elRef.current;
        const FullCalendarLib = window.FullCalendar;
        if (!el || !FullCalendarLib || !FullCalendarLib.Calendar) {
            setDetails('No se pudo cargar el calendario. Revisa tu conexion o bloqueadores de contenido.');
            return;
        }

        if (!calendarRef.current) {
            calendarRef.current = new FullCalendarLib.Calendar(el, {
                initialView: 'dayGridMonth',
                height: 'auto',
                locale: 'es',
                firstDay: 1,
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,listMonth'
                },
                dateClick: (info) => {
                    openCreateModal(info.dateStr);
                },
                eventClick: (info) => {
                    const ev = info.event;
                    const dbId = ev.extendedProps && ev.extendedProps.dbId;
                    if (dbId) {
                        openEditModal(ev);
                    } else {
                        const kind = ev.extendedProps && ev.extendedProps.kind ? String(ev.extendedProps.kind) : '';
                        const dateText = ev.startStr ? formatDateEs(ev.startStr.slice(0, 10)) : '';
                        const boxer = ev.extendedProps && ev.extendedProps.boxer ? String(ev.extendedProps.boxer) : '';
                        const partner = ev.extendedProps && ev.extendedProps.partner ? String(ev.extendedProps.partner) : '';
                        const place = ev.extendedProps && ev.extendedProps.place ? String(ev.extendedProps.place) : '';
                        const parts = [dateText, ev.title];
                        if (boxer && kind === 'inscripcion') parts.push(`Alumno: ${boxer}`);
                        if (partner) parts.push(`Partner: ${partner}`);
                        if (place) parts.push(`Lugar: ${place}`);
                        if (kind) parts.push(kind);
                        setDetails(parts.filter(Boolean).join(' · '));
                    }
                }
            });
            calendarRef.current.render();
        }

        const filteredEvents = (Array.isArray(events) ? events : []).filter((e) => {
            const kind = e.extendedProps && e.extendedProps.kind ? String(e.extendedProps.kind) : '';
            if (kind === 'sparring') return filters.sparring;
            if (kind === 'inscripcion') return filters.inscripcion;
            if (kind === 'recordatorio') return filters.recordatorio;
            if (kind === 'personalizado') return filters.personalizado;
            return true;
        });

        calendarRef.current.removeAllEvents();
        filteredEvents.forEach((e) => calendarRef.current.addEvent(e));
    }, [events, filters]);

    useEffect(() => {
        return () => {
            if (calendarRef.current) {
                calendarRef.current.destroy();
                calendarRef.current = null;
            }
        };
    }, []);

    const colorOptions = [
        { value: '#3b82f6', label: 'Azul' },
        { value: '#ef4444', label: 'Rojo' },
        { value: '#22c55e', label: 'Verde' },
        { value: '#f59e0b', label: 'Naranja' },
        { value: '#8b5cf6', label: 'Morado' },
        { value: '#111827', label: 'Negro' }
    ];

    const tipoOptions = [
        { value: 'personalizado', label: 'Personalizado' },
        { value: 'entrenamiento', label: 'Entrenamiento' },
        { value: 'competicion', label: 'Competicion' },
        { value: 'reunion', label: 'Reunion' },
        { value: 'descanso', label: 'Descanso' }
    ];

    const modalOverlay = showModal ? h('div', {
        style: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 9999
        },
        onClick: (e) => { if (e.target === e.currentTarget) closeModal(); }
    },
        h('div', {
            style: {
                backgroundColor: '#fff', borderRadius: '20px', padding: '32px',
                maxWidth: 480, width: '90%', boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
                maxHeight: '90vh', overflowY: 'auto'
            }
        },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } },
                h('h3', { style: { margin: 0, fontSize: '1.3rem', fontWeight: 800 } },
                    editingEvent ? 'Editar Evento' : 'Nuevo Evento'),
                h('button', {
                    onClick: closeModal,
                    style: { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280', lineHeight: 1 }
                }, String.fromCharCode(215))
            ),
            formError ? h('div', {
                style: { padding: '10px 14px', borderRadius: 12, backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '.85rem', fontWeight: 600, marginBottom: 16 }
            }, formError) : null,

            // Titulo
            h('label', { style: { display: 'block', fontSize: '.8rem', fontWeight: 700, marginBottom: 6, color: '#374151' } }, 'Titulo *'),
            h('input', {
                type: 'text', value: formTitle, placeholder: 'Ej: Entrenamiento especial',
                onChange: (e) => setFormTitle(e.target.value),
                style: { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: '.9rem', marginBottom: 16, boxSizing: 'border-box' }
            }),

            // Fechas
            h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 } },
                h('div', null,
                    h('label', { style: { display: 'block', fontSize: '.8rem', fontWeight: 700, marginBottom: 6, color: '#374151' } }, 'Fecha inicio *'),
                    h('input', {
                        type: 'date', value: formStart,
                        onChange: (e) => setFormStart(e.target.value),
                        style: { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: '.9rem', boxSizing: 'border-box' }
                    })
                ),
                h('div', null,
                    h('label', { style: { display: 'block', fontSize: '.8rem', fontWeight: 700, marginBottom: 6, color: '#374151' } }, 'Fecha fin'),
                    h('input', {
                        type: 'date', value: formEnd,
                        onChange: (e) => setFormEnd(e.target.value),
                        style: { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: '.9rem', boxSizing: 'border-box' }
                    })
                )
            ),

            // Tipo y Color
            h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 } },
                h('div', null,
                    h('label', { style: { display: 'block', fontSize: '.8rem', fontWeight: 700, marginBottom: 6, color: '#374151' } }, 'Tipo'),
                    h('select', {
                        value: formTipo,
                        onChange: (e) => setFormTipo(e.target.value),
                        style: { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: '.9rem', boxSizing: 'border-box', backgroundColor: '#fff' }
                    }, ...tipoOptions.map(o => h('option', { key: o.value, value: o.value }, o.label)))
                ),
                h('div', null,
                    h('label', { style: { display: 'block', fontSize: '.8rem', fontWeight: 700, marginBottom: 6, color: '#374151' } }, 'Color'),
                    h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                        ...colorOptions.map(c => h('button', {
                            key: c.value,
                            type: 'button',
                            title: c.label,
                            onClick: () => setFormColor(c.value),
                            style: {
                                width: 28, height: 28, borderRadius: '50%',
                                backgroundColor: c.value, border: formColor === c.value ? '3px solid #111827' : '2px solid #e5e7eb',
                                cursor: 'pointer', transition: 'all .15s'
                            }
                        }))
                    )
                )
            ),

            // Notas
            h('label', { style: { display: 'block', fontSize: '.8rem', fontWeight: 700, marginBottom: 6, color: '#374151' } }, 'Notas'),
            h('textarea', {
                value: formNotas, placeholder: 'Notas opcionales...',
                onChange: (e) => setFormNotas(e.target.value),
                rows: 3,
                style: { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: '.9rem', resize: 'vertical', marginBottom: 20, boxSizing: 'border-box', fontFamily: 'inherit' }
            }),

            // Botones de accion
            h('div', { style: { display: 'flex', gap: 10 } },
                h('button', {
                    className: 'btn btn-primary',
                    disabled: formLoading,
                    onClick: saveEvent,
                    style: { flex: 2, padding: '12px', fontSize: '.9rem', fontWeight: 700, borderRadius: 12 }
                },
                    h('i', { className: `fas ${editingEvent ? 'fa-save' : 'fa-plus'}`, style: { marginRight: 6 } }),
                    formLoading ? 'Guardando...' : (editingEvent ? 'Guardar cambios' : 'Crear evento')
                ),
                editingEvent ? h('button', {
                    className: 'btn btn-secondary',
                    disabled: formLoading,
                    onClick: deleteEvent,
                    style: { flex: 1, padding: '12px', fontSize: '.9rem', color: '#ef4444', borderColor: '#ef4444', borderRadius: 12 }
                },
                    h('i', { className: 'fas fa-trash', style: { marginRight: 6 } }),
                    'Eliminar'
                ) : null
            )
        )
    ) : null;

    return h(
        React.Fragment,
        null,
        modalOverlay,
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
            h('div', { className: 'coach-calendar-legend', style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                h('span', { 
                    className: 'coach-calendar-pill coach-calendar-pill--sparring',
                    onClick: () => toggleFilter('sparring'),
                    style: { cursor: 'pointer', opacity: filters.sparring ? 1 : 0.4, transition: 'opacity 0.2s', userSelect: 'none' }
                }, 'Sparring'),
                h('span', { 
                    className: 'coach-calendar-pill coach-calendar-pill--inscripcion',
                    onClick: () => toggleFilter('inscripcion'),
                    style: { cursor: 'pointer', opacity: filters.inscripcion ? 1 : 0.4, transition: 'opacity 0.2s', userSelect: 'none' }
                }, 'Inscripcion'),
                h('span', { 
                    className: 'coach-calendar-pill coach-calendar-pill--recordatorio',
                    onClick: () => toggleFilter('recordatorio'),
                    style: { cursor: 'pointer', opacity: filters.recordatorio ? 1 : 0.4, transition: 'opacity 0.2s', userSelect: 'none' }
                }, 'Recordatorio'),
                h('span', { 
                    className: 'coach-calendar-pill', 
                    onClick: () => toggleFilter('personalizado'),
                    style: { backgroundColor: '#3b82f6', color: '#fff', cursor: 'pointer', opacity: filters.personalizado ? 1 : 0.4, transition: 'opacity 0.2s', userSelect: 'none' } 
                }, 'Personalizado')
            ),
            h('button', {
                className: 'btn btn-primary',
                onClick: () => openCreateModal(''),
                style: { padding: '8px 18px', fontSize: '.85rem', fontWeight: 700, borderRadius: 12 }
            },
                h('i', { className: 'fas fa-plus', style: { marginRight: 6 } }),
                'Nuevo evento'
            )
        ),
        h('div', {
            className: 'gloveup-calendar',
            ref: elRef,
            role: 'application',
            'aria-label': 'Calendario de Gestion'
        }),
        h('div', { className: 'coach-calendar-details' }, details)
    );
}

function MetricDoughnut({
    label,
    value,
    max,
    color
}) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ChartLib = window.Chart;
        if (!canvas || !ChartLib) return;

        const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
        const safeMax = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 1;
        const remaining = Math.max(0, safeMax - safeValue);
        let accentColor = color || '';
        if (!accentColor || accentColor.trim().startsWith('var(')) {
            const bodyStyles = window.getComputedStyle(document.body);
            accentColor = bodyStyles.getPropertyValue('--color-accent').trim() || '#111827';
        }
        if (!accentColor) accentColor = '#111827';

        if (!chartRef.current) {
            chartRef.current = new ChartLib(canvas, {
                type: 'doughnut',
                data: {
                    labels: [label, 'Restante'],
                    datasets: [{
                        data: [safeValue, remaining],
                        backgroundColor: [accentColor, 'rgba(0, 0, 0, 0.05)'],
                        borderWidth: 0,
                        hoverOffset: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '68%',
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: true
                        }
                    }
                }
            });
        } else {
            const chart = chartRef.current;
            chart.data.datasets[0].data = [safeValue, remaining];
            chart.update();
        }
    }, [label, value, max, color]);

    useEffect(() => {
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, []);

    return h('div', {
        className: 'metric-chart'
    }, h('canvas', {
        ref: canvasRef
    }));
}

function MetricCard({
    label,
    pill,
    sub,
    chartProps
}) {
    return h(
        'div', {
        className: 'metric-card has-chart'
    },
        h(
            'div', {
            className: 'metric-header'
        },
            h('span', {
                className: 'metric-label'
            }, label),
            h('span', {
                className: 'metric-pill'
            }, pill)
        ),
        h(MetricDoughnut, chartProps),
        h('p', {
            className: 'metric-sub'
        }, sub)
    );
}

function CoachStatsDashboard() {
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [metricas, setMetricas] = useState({
        boxeadoresActivos: 0,
        inscripcionesMes: 0,
        ingresosMes: 0,
        precioMensual: 0,
        gimnasio: ''
    });
    const [boxers, setBoxers] = useState([]);
    const [customEvents, setCustomEvents] = useState([]);

    const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();
    const coachName = (localStorage.getItem('gloveup_user_name') || '').trim();

    const load = async () => {
        if (!email) {
            setMessage({
                kind: 'error',
                text: 'No se ha encontrado el email del entrenador en la sesion.'
            });
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [metricsInfo, boxersInfo, coachInfo, calEventsInfo] = await Promise.all([
                requestJson(`/api/entrenadores/me/metricas?email=${encodeURIComponent(email)}`),
                requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`).catch(() => []),
                requestJson(`/api/entrenadores/me?email=${encodeURIComponent(email)}`).catch(() => ({})),
                requestJson(`/api/entrenadores/me/calendar-events?email=${encodeURIComponent(email)}`).catch(() => [])
            ]);
            
            const precioMensual = metricsInfo && typeof metricsInfo.precioMensual === 'number' ?
                metricsInfo.precioMensual :
                (coachInfo && typeof coachInfo.precioMensual === 'number' ? coachInfo.precioMensual : 0);
            const gimnasio = metricsInfo && metricsInfo.gimnasio ? String(metricsInfo.gimnasio) :
                (coachInfo && coachInfo.gimnasio ? String(coachInfo.gimnasio) : '');
            
            setMetricas({
                boxeadoresActivos: metricsInfo && typeof metricsInfo.boxeadoresActivos === 'number' ? metricsInfo.boxeadoresActivos : 0,
                inscripcionesMes: metricsInfo && typeof metricsInfo.inscripcionesMes === 'number' ? metricsInfo.inscripcionesMes : 0,
                ingresosMes: metricsInfo && typeof metricsInfo.ingresosMes === 'number' ? metricsInfo.ingresosMes : 0,
                precioMensual,
                gimnasio
            });
            setBoxers(Array.isArray(boxersInfo) ? boxersInfo : []);
            setCustomEvents(Array.isArray(calEventsInfo) ? calEventsInfo : []);
            setMessage(null);
        } catch (err) {
            setMessage({
                kind: 'error',
                text: err && err.message ? err.message : 'Error cargando las metricas del entrenador.'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const calendarEvents = useMemo(() => {
        const autoEvents = buildCoachCalendarEvents(boxers, metricas);
        const custom = (Array.isArray(customEvents) ? customEvents : []).map(ev => ({
            id: `custom-${ev._id}`,
            title: ev.title || 'Evento',
            start: ev.start,
            end: ev.end || undefined,
            allDay: ev.allDay !== false,
            backgroundColor: ev.color || '#3b82f6',
            borderColor: ev.color || '#3b82f6',
            extendedProps: {
                dbId: ev._id,
                kind: 'personalizado',
                tipo: ev.tipo || 'personalizado',
                notas: ev.notas || '',
                color: ev.color || '#3b82f6'
            }
        }));
        return [...autoEvents, ...custom];
    }, [boxers, metricas, customEvents]);

    if (loading && boxers.length === 0) {
        return h('div', { style: { padding: 40, textAlign: 'center', opacity: 0.5 } }, 'Cargando panel...');
    }

    return h(
        React.Fragment,
        null,
        h('header', { 
            className: 'dashboard-header',
            style: { marginBottom: 24 }
        },
            h('div', { className: 'dashboard-title-block' },
                h('h1', { style: { fontSize: '2rem', fontWeight: 900 } }, coachName || 'Entrenador'),
                h('p', { style: { opacity: 0.8 } }, 'Resumen de actividad y gestion de boxeadores.')
            )
        ),
        
        message ? h('div', {
            style: {
                fontWeight: 600,
                marginBottom: 20,
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: message.kind === 'error' ? '#fee2e2' : '#dcfce7',
                color: message.kind === 'error' ? '#b91c1c' : '#166534'
            }
        }, message.text) : null,

        h(
            'div', {
            className: 'dashboard-panel',
            style: { marginBottom: 24 }
        },
            h('h2', { style: { marginBottom: 16 } }, 'Calendario de Actividades'),
            h(CoachCalendar, { events: calendarEvents, onEventsChange: load })
        )
    );
}

function CoachManagement() {
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [coach, setCoach] = useState({ gimnasio: '', precioMensual: 0 });
    const [metricas, setMetricas] = useState({ boxeadoresActivos: 0, inscripcionesMes: 0, ingresosMes: 0 });
    const [cobrosTotal, setCobrosTotal] = useState(0);
    const [boxers, setBoxers] = useState([]);

    const [gymInput, setGymInput] = useState('');
    const [priceInput, setPriceInput] = useState('');
    const [bioInput, setBioInput] = useState('');
    const [fotos, setFotos] = useState([]);
    const [search, setSearch] = useState('');
    const [assignEmail, setAssignEmail] = useState('');

    const [editId, setEditId] = useState('');
    const [editName, setEditName] = useState('');
    const [editDni, setEditDni] = useState('');
    const [editLevel, setEditLevel] = useState('Amateur');

    const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();

    const refreshAll = async () => {
        if (!email) {
            setMessage({ kind: 'error', text: 'No se ha encontrado el email.' });
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [coachInfo, metricsInfo, boxersInfo, cobrosInfo] = await Promise.all([
                requestJson(`/api/entrenadores/me?email=${encodeURIComponent(email)}`),
                requestJson(`/api/entrenadores/me/metricas?email=${encodeURIComponent(email)}`),
                requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`),
                requestJson(`/api/entrenadores/me/cobros?email=${encodeURIComponent(email)}`)
            ]);
            setCoach({
                gimnasio: coachInfo?.gimnasio || '',
                precioMensual: coachInfo?.precioMensual || 0
            });
            setGymInput(coachInfo?.gimnasio || '');
            setPriceInput(String(coachInfo?.precioMensual || ''));
            setMetricas({
                boxeadoresActivos: metricsInfo?.boxeadoresActivos || 0,
                inscripcionesMes: metricsInfo?.inscripcionesMes || 0,
                ingresosMes: metricsInfo?.ingresosMes || 0
            });
            setBoxers(Array.isArray(boxersInfo) ? boxersInfo : []);
            setCobrosTotal(cobrosInfo?.total || 0);

            if (coachInfo?.gimnasio) {
                const gymInfo = await requestJson(`/api/gimnasios/lookup?nombre=${encodeURIComponent(coachInfo.gimnasio)}`).catch(() => null);
                setBioInput(gymInfo?.bio || '');
                setFotos(Array.isArray(gymInfo?.fotos) ? gymInfo.fotos.filter(f => f).slice(0, 12) : []);
            }
            setMessage(null);
        } catch (err) {
            setMessage({ kind: 'error', text: err.message || 'Error cargando datos.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refreshAll(); }, []);

    const filteredBoxers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return boxers;
        return boxers.filter(b => 
            (b.nombre || '').toLowerCase().includes(q) || 
            (b.email || '').toLowerCase().includes(q) || 
            (b.dniLicencia || '').toLowerCase().includes(q)
        );
    }, [boxers, search]);



    const saveGym = async () => {
        try {
            await requestJson(`/api/entrenadores/me?email=${encodeURIComponent(email)}`, {
                method: 'PUT',
                body: { gimnasio: gymInput }
            });
            if (gymInput.trim()) {
                await requestJson('/api/gimnasios', {
                    method: 'POST',
                    body: { nombre: gymInput, creadoPorEmail: email, bio: bioInput, fotos }
                });
            }
            setMessage({ kind: 'ok', text: 'Gimnasio actualizado.' });
            refreshAll();
        } catch (err) {
            setMessage({ kind: 'error', text: err.message });
        }
    };

    const onPickFotos = async (e) => {
        const files = Array.from(e.target.files || []).slice(0, 6);
        const dataUrls = await Promise.all(files.map(file => new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        })));
        setFotos(prev => [...prev, ...dataUrls].slice(0, 12));
        e.target.value = '';
    };

    const addBoxer = async () => {
        if (!assignEmail.trim()) return;
        try {
            await requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`, {
                method: 'POST',
                body: { boxeadorIdentifier: assignEmail.trim() }
            });
            setAssignEmail('');
            refreshAll();
        } catch (err) { setMessage({ kind: 'error', text: err.message }); }
    };

    const removeBoxer = async () => {
        if (!assignEmail.trim()) return;
        try {
            await requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`, {
                method: 'DELETE',
                body: { boxeadorIdentifier: assignEmail.trim() }
            });
            setAssignEmail('');
            refreshAll();
        } catch (err) { setMessage({ kind: 'error', text: err.message }); }
    };

    const selectForEdit = (b) => {
        setEditId(b._id || b.email || '');
        setEditName(b.nombre || '');
        setEditDni(b.dniLicencia || '');
        setEditLevel(b.nivel || 'Amateur');
    };

    const saveEdit = async () => {
        try {
            await requestJson(`/api/entrenadores/me/boxeadores/${encodeURIComponent(editId)}?email=${encodeURIComponent(email)}`, {
                method: 'PUT',
                body: { nombre: editName, dniLicencia: editDni, nivel: editLevel }
            });
            setEditId('');
            refreshAll();
        } catch (err) { setMessage({ kind: 'error', text: err.message }); }
    };

    const deleteEdit = async () => {
        try {
            await requestJson(`/api/entrenadores/me/boxeadores/${encodeURIComponent(editId)}?email=${encodeURIComponent(email)}`, {
                method: 'DELETE'
            });
            setEditId('');
            refreshAll();
        } catch (err) { setMessage({ kind: 'error', text: err.message }); }
    };

    const levelScore = (nivel = '') => {
        const n = String(nivel).toLowerCase();
        if (n.includes('principiante')) return 1;
        if (n.includes('intermedio')) return 2;
        if (n.includes('avanzado')) return 3;
        if (n.includes('amateur')) return 4;
        if (n.includes('profesional')) return 5;
        return 3;
    };

    const renderStars = (v) => {
        const filled = Math.max(0, Math.min(5, Number(v) || 0));
        return Array.from({ length: 5 }, (_, i) =>
            h('i', { key: i, className: i < filled ? 'fas fa-star' : 'far fa-star', style: { color: i < filled ? '#f97316' : '#d1d5db', fontSize: '0.75rem' } })
        );
    };

    return h(React.Fragment, null,
        h('div', { className: 'dashboard-panel' },
            h('h2', null, 'Mi gimnasio'),
            h('div', { style: { display: 'grid', gap: 12, marginTop: 18 } },
                h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 } },
                    h('div', { style: { padding: 14, borderRadius: 14, border: '1px solid #e5e7eb' } },
                        h('label', null, 'Gimnasio'),
                        h('input', { value: gymInput, onChange: (e) => setGymInput(e.target.value), style: { width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e5e7eb' } }),
                        h('button', { className: 'btn btn-secondary', onClick: saveGym, style: { marginTop: 10 } }, 'Guardar')
                    ),
                    h('div', { style: { padding: 14, borderRadius: 14, border: '1px solid #e5e7eb' } },
                        h('label', null, 'Bio'),
                        h('textarea', { value: bioInput, onChange: (e) => setBioInput(e.target.value), rows: 4, style: { width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e5e7eb' } }),
                        h('input', { type: 'file', multiple: true, onChange: onPickFotos, style: { marginTop: 10 } }),
                        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8, marginTop: 10 } },
                            fotos.map((src, idx) => h('div', { key: idx, style: { position: 'relative' } },
                                h('img', { src, style: { width: '100%', height: 60, objectFit: 'cover', borderRadius: 8 } }),
                                h('button', { onClick: () => setFotos(prev => prev.filter((_, i) => i !== idx)), style: { position: 'absolute', top: 0, right: 0, background: 'red', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer' } }, '×')
                            ))
                        )
                    )
                ),
                message && h('div', { style: { color: message.kind === 'error' ? 'red' : 'green' } }, message.text)
            )
        ),

        h('div', { className: 'dashboard-panel' },
            h('h2', null, 'Tus boxeadores'),
            h('div', { className: 'coach-boxers-toolbar' },
                h('input', { value: search, onChange: (e) => setSearch(e.target.value), placeholder: 'Buscar...' }),
                h('div', { className: 'coach-boxers-assign' },
                    h('input', { value: assignEmail, onChange: (e) => setAssignEmail(e.target.value), placeholder: 'Email o DNI' }),
                    h('button', { className: 'submit-button', onClick: addBoxer }, 'Añadir'),
                    h('button', { className: 'submit-button coach-remove-button', onClick: removeBoxer }, 'Quitar')
                )
            ),
            h('div', { className: 'sparring-list', style: { marginTop: 15 } },
                filteredBoxers.length === 0 ? h('p', null, 'No hay boxeadores.') :
                filteredBoxers.map((b, i) => h(React.Fragment, { key: b._id || b.email },
                    h('div', { className: 'sparring-card' },
                        h('div', { className: 'card-rank' }, h('span', null, `#${i + 1}`)),
                        h('div', { className: 'card-name' }, h('span', { className: 'main-name' }, b.nombre), h('span', null, b.email)),
                        h('div', { className: 'card-stars' }, ...renderStars(levelScore(b.nivel))),
                        h('div', { className: 'card-action' }, h('button', { className: 'view-profile-button', onClick: () => selectForEdit(b) }, 'Editar'))
                    ),
                    editId === (b._id || b.email) && h('div', { style: { padding: 15, border: '1px solid #f97316', borderRadius: 10, marginTop: 10 } },
                        h('input', { value: editName, onChange: (e) => setEditName(e.target.value), placeholder: 'Nombre' }),
                        h('input', { value: editDni, onChange: (e) => setEditDni(e.target.value), placeholder: 'DNI' }),
                        h('select', { value: editLevel, onChange: (e) => setEditLevel(e.target.value) },
                            h('option', { value: 'Principiante' }, 'Principiante'), h('option', { value: 'Intermedio' }, 'Intermedio'), h('option', { value: 'Avanzado' }, 'Avanzado'), h('option', { value: 'Amateur' }, 'Amateur'), h('option', { value: 'Profesional' }, 'Profesional')
                        ),
                        h('div', { style: { marginTop: 10, display: 'flex', gap: 10 } },
                            h('button', { className: 'submit-button', onClick: saveEdit }, 'Guardar'),
                            h('button', { className: 'submit-button', style: { background: 'red' }, onClick: deleteEdit }, 'Eliminar'),
                            h('button', { onClick: () => setEditId('') }, 'Cancelar')
                        )
                    )
                ))
            )
        ),
        h('div', { className: 'dashboard-panel' },
            h('h2', null, 'Resumen'),
            h('p', null, 'Cobros registrados: ', h('strong', null, formatCurrency(cobrosTotal)))
        )
    );
}

function CoachFinance() {
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [metricas, setMetricas] = useState({
        boxeadoresActivos: 0,
        inscripcionesMes: 0,
        ingresosMes: 0,
        precioMensual: 0,
        gimnasio: ''
    });
    const [cobrosTotal, setCobrosTotal] = useState(0);
    const [boxers, setBoxers] = useState([]);
    const [priceInput, setPriceInput] = useState('');

    const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();

    const load = async () => {
        if (!email) {
            setMessage({
                kind: 'error',
                text: 'No se ha encontrado el email del entrenador en la sesión.'
            });
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [metricsInfo, boxersInfo, coachInfo, cobrosInfo] = await Promise.all([
                requestJson(`/api/entrenadores/me/metricas?email=${encodeURIComponent(email)}`),
                requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`).catch(() => []),
                requestJson(`/api/entrenadores/me?email=${encodeURIComponent(email)}`).catch(() => ({})),
                requestJson(`/api/entrenadores/me/cobros?email=${encodeURIComponent(email)}`).catch(() => ({
                    total: 0
                }))
            ]);
            const precioMensual = metricsInfo && typeof metricsInfo.precioMensual === 'number' ?
                metricsInfo.precioMensual :
                (coachInfo && typeof coachInfo.precioMensual === 'number' ? coachInfo.precioMensual : 0);
            const gimnasio = metricsInfo && metricsInfo.gimnasio ? String(metricsInfo.gimnasio) :
                (coachInfo && coachInfo.gimnasio ? String(coachInfo.gimnasio) : '');
            setMetricas({
                boxeadoresActivos: metricsInfo && typeof metricsInfo.boxeadoresActivos === 'number' ? metricsInfo.boxeadoresActivos : 0,
                inscripcionesMes: metricsInfo && typeof metricsInfo.inscripcionesMes === 'number' ? metricsInfo.inscripcionesMes : 0,
                ingresosMes: metricsInfo && typeof metricsInfo.ingresosMes === 'number' ? metricsInfo.ingresosMes : 0,
                precioMensual,
                gimnasio
            });
            setCobrosTotal(cobrosInfo && typeof cobrosInfo.total === 'number' ? cobrosInfo.total : 0);
            setPriceInput(Number.isFinite(Number(precioMensual)) ? String(precioMensual) : '');
            setBoxers(Array.isArray(boxersInfo) ? boxersInfo : []);
            setMessage(null);
        } catch (err) {
            setMessage({
                kind: 'error',
                text: err && err.message ? err.message : 'Error cargando la Gestión económica.'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const savePrice = async () => {
        const precioMensual = Number(priceInput);
        try {
            await requestJson(`/api/entrenadores/me?email=${encodeURIComponent(email)}`, {
                method: 'PUT',
                body: {
                    precioMensual: Number.isFinite(precioMensual) ? precioMensual : 0
                }
            });
            setMessage({
                kind: 'ok',
                text: 'Precio mensual actualizado correctamente.'
            });
            load();
        } catch (err) {
            setMessage({
                kind: 'error',
                text: err && err.message ? err.message : 'No se pudo guardar el precio.'
            });
        }
    };

    const revenueMax = Math.max(1, (Number.isFinite(Number(metricas.precioMensual)) ? Number(metricas.precioMensual) : 0) * 30);
    const cobrosMax = Math.max(1, Number(cobrosTotal) || 0, revenueMax);

    return h(
        React.Fragment,
        null,
        h(
            'div', {
            className: 'dashboard-panel'
        },
            h('h2', null, 'Gestión'),
            message ? h('div', {
                style: {
                    fontWeight: 600,
                    marginTop: 10,
                    color: message.kind === 'error' ? '#b91c1c' : '#065f46'
                }
            }, message.text) : null,
            loading ? h('p', {
                className: 'muted',
                style: {
                    marginTop: 10
                }
            }, 'Cargando...') : null,
            h(
                'div', {
                className: 'dashboard-metrics',
                style: {
                    marginTop: 16,
                    marginBottom: 0
                }
            },
                h(MetricCard, {
                    label: 'Tu gimnasio',
                    pill: metricas.gimnasio || '-',
                    sub: 'Resumen del gimnasio.',
                    chartProps: {
                        label: 'Gimnasio',
                        value: 1,
                        max: 1,
                        color: '#111827'
                    }
                }),
                h(MetricCard, {
                    label: 'Boxeadores activos',
                    pill: String(metricas.boxeadoresActivos || 0),
                    sub: 'Boxeadores asignados actualmente.',
                    chartProps: {
                        label: 'Boxeadores',
                        value: metricas.boxeadoresActivos || 0,
                        max: 30,
                        color: '#111827'
                    }
                }),
                h(MetricCard, {
                    label: 'Inscripciones este mes',
                    pill: String(metricas.inscripcionesMes || 0),
                    sub: 'Altas registradas este mes.',
                    chartProps: {
                        label: 'Inscripciones',
                        value: metricas.inscripcionesMes || 0,
                        max: 30,
                        color: '#6b7280'
                    }
                }),
                h(MetricCard, {
                    label: 'Ingresos estimados (mes)',
                    pill: formatCurrency(metricas.ingresosMes || 0),
                    sub: 'Precio mensual × inscripciones del mes.',
                    chartProps: {
                        label: 'Ingresos',
                        value: metricas.ingresosMes || 0,
                        max: revenueMax,
                        color: '#9ca3af'
                    }
                }),
                h(MetricCard, {
                    label: 'Cobros',
                    pill: formatCurrency(cobrosTotal || 0),
                    sub: 'Total registrado.',
                    chartProps: {
                        label: 'Cobros',
                        value: Number(cobrosTotal) || 0,
                        max: cobrosMax,
                        color: '#9ca3af'
                    }
                })
            )
        ),
        h(
            'div', {
            className: 'dashboard-panel'
        },
            h('h2', null, 'Precio mensual'),
            h(
                'div', {
                style: {
                    display: 'grid',
                    gap: 10,
                    marginTop: 12,
                    maxWidth: 420
                }
            },
                h('input', {
                    value: priceInput,
                    onChange: (e) => setPriceInput(e.target.value),
                    type: 'number',
                    min: 0,
                    step: '0.01',
                    style: {
                        width: '100%',
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid #e5e7eb'
                    }
                }),
                h('button', {
                    className: 'btn btn-secondary',
                    type: 'button',
                    onClick: savePrice
                }, 'Guardar precio')
            )
        ),
        h(
            'div', {
            className: 'dashboard-panel'
        },
            h('h2', null, 'Inscripciones (ingresos)'),
            h(InscriptionRevenueLineChart, {
                boxers,
                precioMensual: metricas.precioMensual
            })
        )
    );
}

function CoachChallenges() {
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [challenges, setChallenges] = useState([]);
    const [filter, setFilter] = useState('all');

    const isPendingStatus = (s) => !s || s === 'pending' || s === 'pending_coach_to' || s === 'pending_coach_from';

    const filteredChallenges = useMemo(() => {
        if (filter === 'all') return challenges;
        if (filter === 'pending') return challenges.filter(c => isPendingStatus(c.status));
        if (filter === 'accepted') return challenges.filter(c => c.status === 'accepted');
        if (filter === 'declined') return challenges.filter(c => c.status === 'declined');
        return challenges;
    }, [challenges, filter]);


    const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();
    const coachName = (localStorage.getItem('gloveup_user_name') || '').trim();

    const load = async () => {
        if (!email) {
            setMessage({
                kind: 'error',
                text: 'No se ha encontrado el email del entrenador en la sesión.'
            });
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await requestJson(`/api/entrenadores/me/challenges-for-boxers?email=${encodeURIComponent(email)}`);
            setChallenges(Array.isArray(data) ? data : []);
            setMessage(null);
        } catch (err) {
            setMessage({
                kind: 'error',
                text: err && err.message ? err.message : 'Error cargando los retos de tus boxeadores.'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const respond = async (challengeId, action) => {
        try {
            await requestJson(`/api/entrenadores/me/challenges/respond?email=${encodeURIComponent(email)}`, {
                method: 'POST',
                body: { challengeId, action }
            });
            setMessage({
                kind: 'ok',
                text: `Reto ${action === 'accept' ? 'aprobado' : 'rechazado'} correctamente.`
            });
            load();
        } catch (err) {
            setMessage({
                kind: 'error',
                text: err && err.message ? err.message : 'No se pudo procesar la respuesta.'
            });
        }
    };

    return h(
        React.Fragment,
        null,
        h(
            'div', {
            style: {
                padding: '20px 0'
            }
        },
            h('h2', {
                style: {
                    fontSize: '1.8rem',
                    fontWeight: 900,
                    marginBottom: 4,
                    color: '#111827'
                }
            }, coachName || 'Entrenador'),
            h('p', {
                className: 'muted',
                style: { marginBottom: 16, fontSize: '1rem' }
            }, 'Peticiones de sparring externas para tus boxeadores.'),

            // Barra de filtros
            h('div', {
                style: {
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 20,
                    padding: '14px 16px',
                    backgroundColor: 'var(--color-secondary, #f9fafb)',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border, #e5e7eb)'
                }
            },
                [
                    { key: 'all',      label: 'Todos',       icon: 'fa-list' },
                    { key: 'pending',  label: 'Pendientes',  icon: 'fa-clock' },
                    { key: 'accepted', label: 'Aceptados',   icon: 'fa-check-circle' },
                    { key: 'declined', label: 'Rechazados',  icon: 'fa-times-circle' }
                ].map(tab => {
                    const count = tab.key === 'all' ? challenges.length
                        : tab.key === 'pending' ? challenges.filter(c => isPendingStatus(c.status)).length
                        : challenges.filter(c => c.status === tab.key).length;
                    const isActive = filter === tab.key;
                    return h('button', {
                        key: tab.key,
                        onClick: () => setFilter(tab.key),
                        style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 16px',
                            borderRadius: '999px',
                            border: isActive ? '2px solid #111827' : '1px solid #e5e7eb',
                            backgroundColor: isActive ? '#111827' : '#fff',
                            color: isActive ? '#fff' : '#374151',
                            fontWeight: 700,
                            fontSize: '.8rem',
                            cursor: 'pointer',
                            transition: 'all .18s'
                        }
                    },
                        h('i', { className: `fas ${tab.icon}`, style: { fontSize: '.75rem' } }),
                        ' ', tab.label,
                        h('span', {
                            style: {
                                marginLeft: 4,
                                padding: '1px 7px',
                                borderRadius: '999px',
                                backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : '#f3f4f6',
                                color: isActive ? '#fff' : '#6b7280',
                                fontSize: '.75rem',
                                fontWeight: 800
                            }
                        }, count)
                    );
                })
            ),

            message ? h('div', {
                style: {
                    fontWeight: 600,
                    marginTop: 10,
                    marginBottom: 12,
                    padding: '10px 16px',
                    borderRadius: '12px',
                    backgroundColor: message.kind === 'error' ? '#fee2e2' : '#dcfce7',
                    color: message.kind === 'error' ? '#b91c1c' : '#065f46'
                }
            }, message.text) : null,
            loading ? h('p', { style: { marginTop: 20, textAlign: 'center', opacity: 0.6 } }, 'Cargando retos...') :
                filteredChallenges.length === 0 ? h('p', {
                    style: { padding: '40px 20px', textAlign: 'center', opacity: 0.5 }
                }, challenges.length === 0 ? 'No hay retos para tus boxeadores.' : 'No hay retos en esta categoria.') :
                    h('div', {
                        style: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }
                    },
                        ...filteredChallenges.map((c) => {
                            const avatarPlaceholder = '../../assets/images/unnamed-removebg-preview.png';

                            return h(
                                'div', {
                                key: c.id,
                                style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 16,
                                    padding: '24px',
                                    backgroundColor: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '16px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    marginBottom: 12
                                }
                            },
                                // Header: Status Badge
                                h('div', {
                                    style: {
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        borderBottom: '1px solid #f3f4f6',
                                        paddingBottom: 12
                                    }
                                },
                                    h('div', {
                                        style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            fontSize: '.75rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            color: '#6b7280'
                                        }
                                    },
                                        h('i', { className: 'fas fa-shield-alt' }),
                                        c.direction === 'outbound' ? 'Reto Enviado' : 'Propuesta de Sparring'
                                    ),
                                    (() => {
                                        const s = c.status || 'pending';
                                        const dir = c.direction || 'inbound';
                                        let label, bg, color;
                                        if (s === 'accepted') { label = 'Confirmado'; bg = '#dcfce7'; color = '#166534'; }
                                        else if (s === 'declined') { label = 'Rechazado'; bg = '#fee2e2'; color = '#991b1b'; }
                                        else if (s === 'pending_coach_to') {
                                            label = dir === 'inbound' ? 'Tu aprobacion necesaria' : 'Esperando al entrenador rival';
                                            bg = '#fef3c7'; color = '#92400e';
                                        } else if (s === 'pending_coach_from') {
                                            label = dir === 'outbound' ? 'Tu aprobacion necesaria' : 'Esperando al entrenador rival';
                                            bg = '#fef3c7'; color = '#92400e';
                                        } else { label = 'Pendiente'; bg = '#f3f4f6'; color = '#374151'; }
                                        return h('div', { style: { padding: '4px 12px', borderRadius: 20, fontSize: '.7rem', fontWeight: 800, textTransform: 'uppercase', backgroundColor: bg, color } }, label);
                                    })()
                                ),

                                // Main Matchup Area
                                h('div', {
                                    style: {
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto 1fr',
                                        alignItems: 'center',
                                        gap: 20
                                    }
                                },
                                    // Boxer A (Challenger)
                                    h('div', { style: { textAlign: 'center' } },
                                        h('img', {
                                            src: c.fromFoto || avatarPlaceholder,
                                            style: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f3f4f6', marginBottom: 10 }
                                        }),
                                        h('div', { style: { fontWeight: 800, fontSize: '.95rem', color: '#111827' } }, c.fromNombre),
                                        h('div', { style: { fontSize: '.75rem', color: '#6b7280', marginTop: 4 } },
                                            h('span', { className: 'badge', style: { backgroundColor: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 4 } }, c.fromNivel || 'Amateur')
                                        ),
                                        c.fromPeso ? h('div', { style: { fontSize: '.7rem', color: '#9ca3af', marginTop: 4 } }, `Peso: ${c.fromPeso}`) : null
                                    ),

                                    // Middle: VS & Details
                                    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 } },
                                        h('div', {
                                            style: {
                                                width: 40,
                                                height: 40,
                                                borderRadius: '50%',
                                                backgroundColor: '#111827',
                                                color: '#fff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 900,
                                                fontSize: '.8rem',
                                                boxShadow: '0 0 0 4px #fff, 0 0 0 5px #f3f4f6'
                                            }
                                        }, 'VS'),
                                        h('div', { style: { textAlign: 'center', marginTop: 10 } },
                                            h('div', { style: { fontWeight: 700, fontSize: '.75rem', color: '#111827' } }, c.preset),
                                            h('div', { style: { fontSize: '.7rem', color: '#6b7280', marginTop: 2 } },
                                                h('i', { className: 'fas fa-calendar-alt', style: { marginRight: 4 } }),
                                                `${formatDateEs(c.scheduledAt.slice(0, 10))} • ${c.scheduledAt.slice(11, 16)}`
                                            )
                                        )
                                    ),

                                    // Boxer B (My Boxer)
                                    h('div', { style: { textAlign: 'center' } },
                                        h('img', {
                                            src: c.boxerFoto || avatarPlaceholder,
                                            style: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f3f4f6', marginBottom: 10 }
                                        }),
                                        h('div', { style: { fontWeight: 800, fontSize: '.95rem', color: 'var(--color-accent, #f97316)' } }, c.boxerName),
                                        h('div', { style: { fontSize: '.75rem', color: '#6b7280', marginTop: 4 } },
                                            h('span', { className: 'badge', style: { backgroundColor: '#fff7ed', color: '#9a3412', padding: '2px 8px', borderRadius: 4 } }, c.boxerNivel || 'Amateur')
                                        ),
                                        c.boxerPeso ? h('div', { style: { fontSize: '.7rem', color: '#9ca3af', marginTop: 4 } }, `Peso: ${c.boxerPeso}`) : null
                                    )
                                ),

                                // Info Row: Gym and Coaches
                                h('div', {
                                    style: {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: 12,
                                        padding: '12px 16px',
                                        backgroundColor: '#f9fafb',
                                        borderRadius: '12px',
                                        border: '1px solid #f3f4f6'
                                    }
                                },
                                    h('div', { style: { fontSize: '.8rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: 8 } },
                                        h('i', { className: 'fas fa-building', style: { color: '#9ca3af' } }),
                                        h('span', { style: { fontWeight: 600 } }, 'Ubicacion:'),
                                        c.gymName
                                    ),
                                    Array.isArray(c.coachNombres) && c.coachNombres.length > 0 ? h('div', { style: { fontSize: '.8rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: 8 } },
                                        h('i', { className: 'fas fa-user-tie', style: { color: '#9ca3af' } }),
                                        h('span', { style: { fontWeight: 600 } }, 'Supervision:'),
                                        c.coachNombres.join(', ')
                                    ) : null
                                ),

                                // Note Section
                                c.note ? h('div', {
                                    style: {
                                        fontSize: '.85rem',
                                        color: '#6b7280',
                                        fontStyle: 'italic',
                                        padding: '0 8px'
                                    }
                                }, `"${c.note}"`) : null,

                                // Action Buttons - shown only when it's THIS coach's turn
                                (() => {
                                    const s = c.status || 'pending';
                                    const dir = c.direction || 'inbound';
                                    const canAct =
                                        (s === 'pending_coach_to' && dir === 'inbound') ||
                                        (s === 'pending_coach_from' && dir === 'outbound') ||
                                        s === 'pending'; // legacy support
                                    if (!canAct) return null;
                                    return h('div', { style: { display: 'flex', gap: 12, marginTop: 8 } },
                                        h('button', {
                                            className: 'btn btn-primary',
                                            style: { flex: 2, padding: '12px', fontSize: '.9rem', fontWeight: 700 },
                                            onClick: () => respond(c.id, 'accept')
                                        },
                                            h('i', { className: 'fas fa-check', style: { marginRight: 6 } }),
                                            'Aprobar Sparring'
                                        ),
                                        h('button', {
                                            className: 'btn btn-secondary',
                                            style: { flex: 1, padding: '12px', fontSize: '.9rem', color: '#ef4444', borderColor: '#ef4444' },
                                            onClick: () => respond(c.id, 'decline')
                                        },
                                            h('i', { className: 'fas fa-times', style: { marginRight: 6 } }),
                                            'Rechazar'
                                        )
                                    );
                                })()
                            );
                        })
                    )
        )
    );
}

const dashboardRoot = document.getElementById('coach-dashboard-root');
if (dashboardRoot) {
    ReactDOM.createRoot(dashboardRoot).render(h(CoachStatsDashboard, null));
}

const managementRoot = document.getElementById('coach-management-root');
if (managementRoot) {
    ReactDOM.createRoot(managementRoot).render(h(CoachFinance, null));
}

const gymRoot = document.getElementById('coach-gym-root');
if (gymRoot) {
    ReactDOM.createRoot(gymRoot).render(h(CoachManagement, null));
}

const challengesRoot = document.getElementById('coach-challenges-root');
if (challengesRoot) {
    ReactDOM.createRoot(challengesRoot).render(h(CoachChallenges, null));
}

const SESSION_MAINTAINED_KEY = 'gloveup_session_maintained';
const coachDashboardSection = document.getElementById('coach-dashboard');
const coachManagementSection = document.getElementById('coach-management');
const coachChallengesSection = document.getElementById('coach-challenges');
const coachGymSection = document.getElementById('coach-gym');
const navHomeItem = document.getElementById('nav-item-inicio');
const coachNavItem = document.getElementById('coach-nav-item');
const coachChallengesNavItem = document.getElementById('coach-challenges-nav-item');
const coachGymNavItem = document.getElementById('coach-gym-nav-item');
const logoutButton = document.getElementById('logout-button');
const role = (localStorage.getItem(STORED_USER_ROLE_KEY) || '').toString().trim().toLowerCase();
const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').toString().trim().toLowerCase();
const isSessionMaintained =
    sessionStorage.getItem(SESSION_MAINTAINED_KEY) === 'true' ||
    localStorage.getItem(SESSION_MAINTAINED_KEY) === 'true';

const showCoachSection = () => {
    if (!coachDashboardSection || !coachManagementSection || !coachChallengesSection || !coachGymSection) return;
    const hash = String(window.location.hash || '').toLowerCase();
    const isHome = !hash || hash === '#';
    const inManagement = hash === '#coach-management';
    const inChallenges = hash === '#coach-challenges';
    const inGym = hash === '#coach-gym';

    // Ocultar el header estático del dashboard si no estamos en 'Inicio'
    const staticHeader = document.querySelector('.dashboard-header');
    if (staticHeader) {
        staticHeader.style.display = isHome ? 'block' : 'none';
    }

    // Show/hide sections. When hiding, also set height:0 and overflow:hidden to contain FullCalendar
    const setVisible = (el, visible) => {
        if (!el) return;
        el.style.display = visible ? 'grid' : 'none';
        el.style.height = visible ? '' : '0';
        el.style.overflow = visible ? '' : 'hidden';
        el.style.position = visible ? '' : 'absolute';
        el.style.pointerEvents = visible ? '' : 'none';
    };

    setVisible(coachDashboardSection, isHome);
    setVisible(coachManagementSection, inManagement);
    setVisible(coachChallengesSection, inChallenges);
    setVisible(coachGymSection, inGym);

    if (navHomeItem) navHomeItem.classList.toggle('active', isHome);
    if (coachNavItem) coachNavItem.classList.toggle('active', inManagement);
    if (coachChallengesNavItem) coachChallengesNavItem.classList.toggle('active', inChallenges);
    if (coachGymNavItem) coachGymNavItem.classList.toggle('active', inGym);
};

if (role !== 'entrenador' || !email || !isSessionMaintained) {
    if (coachDashboardSection) coachDashboardSection.style.display = 'grid';
    if (coachManagementSection) coachManagementSection.style.display = 'none';
    if (coachChallengesSection) coachChallengesSection.style.display = 'none';
    if (coachGymSection) coachGymSection.style.display = 'none';
    if (coachNavItem) coachNavItem.style.display = 'none';
    if (coachChallengesNavItem) coachChallengesNavItem.style.display = 'none';
    if (coachGymNavItem) coachGymNavItem.style.display = 'none';
    if (dashboardRoot) {
        ReactDOM.createRoot(dashboardRoot).render(
            h(
                'div', {
                className: 'dashboard-panel'
            },
                h('h2', null, 'Necesitas iniciar sesión'),
                h('p', null, 'Inicia sesión como entrenador para acceder al panel.'),
                h('a', {
                    className: 'btn btn-primary',
                    href: '../../auth/index.html'
                }, 'Ir a login')
            )
        );
    }
} else {
    if (coachNavItem) coachNavItem.style.display = '';
    if (coachChallengesNavItem) coachChallengesNavItem.style.display = '';
    if (coachGymNavItem) coachGymNavItem.style.display = '';
    showCoachSection();
    window.addEventListener('hashchange', showCoachSection);
}

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem(SESSION_MAINTAINED_KEY);
        sessionStorage.removeItem(SESSION_MAINTAINED_KEY);
        localStorage.removeItem('gloveup_is_registered');
        localStorage.removeItem(STORED_EMAIL_KEY);
        localStorage.removeItem('gloveup_user_name');
        localStorage.removeItem(STORED_USER_ROLE_KEY);
        localStorage.removeItem('gloveup_user_dni');
        sessionStorage.removeItem('gloveup_user_id');
        window.location.href = '../../auth/index.html';
    });
}
