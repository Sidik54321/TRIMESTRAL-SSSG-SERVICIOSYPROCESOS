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
    events
}) {
    const elRef = useRef(null);
    const calendarRef = useRef(null);
    const [details, setDetails] = useState('Selecciona un evento para ver detalles.');

    useEffect(() => {
        const el = elRef.current;
        const FullCalendarLib = window.FullCalendar;
        if (!el || !FullCalendarLib || !FullCalendarLib.Calendar) {
            setDetails('No se pudo cargar el calendario. Revisa tu conexión o bloqueadores de contenido.');
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
                eventClick: (info) => {
                    const ev = info.event;
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
            });
            calendarRef.current.render();
        }

        calendarRef.current.removeAllEvents();
        (Array.isArray(events) ? events : []).forEach((e) => calendarRef.current.addEvent(e));
    }, [events]);

    useEffect(() => {
        return () => {
            if (calendarRef.current) {
                calendarRef.current.destroy();
                calendarRef.current = null;
            }
        };
    }, []);

    return h(
        React.Fragment,
        null,
        h(
            'div', {
                className: 'coach-calendar-legend'
            },
            h('span', {
                className: 'coach-calendar-pill coach-calendar-pill--sparring'
            }, 'Sparring'),
            h('span', {
                className: 'coach-calendar-pill coach-calendar-pill--inscripcion'
            }, 'Inscripción'),
            h('span', {
                className: 'coach-calendar-pill coach-calendar-pill--recordatorio'
            }, 'Recordatorio')
        ),
        h('div', {
            className: 'gloveup-calendar',
            ref: elRef,
            role: 'application',
            'aria-label': 'Calendario de gestión'
        }),
        h('div', {
            className: 'coach-calendar-details'
        }, details)
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

        if (!chartRef.current) {
            chartRef.current = new ChartLib(canvas, {
                type: 'doughnut',
                data: {
                    labels: [label, 'Restante'],
                    datasets: [{
                        data: [safeValue, remaining],
                        backgroundColor: [color || '#111827', 'rgba(0, 0, 0, 0.05)'],
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

    const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();

    useEffect(() => {
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
                const [metricsInfo, boxersInfo, coachInfo] = await Promise.all([
                    requestJson(`/api/entrenadores/me/metricas?email=${encodeURIComponent(email)}`),
                    requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`).catch(() => []),
                    requestJson(`/api/entrenadores/me?email=${encodeURIComponent(email)}`).catch(() => ({}))
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
                setMessage(null);
            } catch (err) {
                setMessage({
                    kind: 'error',
                    text: err && err.message ? err.message : 'Error cargando las métricas del entrenador.'
                });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const revenueMax = Math.max(1, (Number.isFinite(Number(metricas.precioMensual)) ? Number(metricas.precioMensual) : 0) * 30);

    return h(
        React.Fragment,
        null,
        h(
            'div', {
                className: 'dashboard-panel'
            },
            h('h2', null, 'Estadísticas'),
            h(
                'div', {
                    className: 'dashboard-metrics',
                    style: {
                        marginTop: 20,
                        marginBottom: 12
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
                        color: '#f97316'
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
                        color: '#f97316'
                    }
                })
            )
        ),
        h(
            'div', {
                className: 'dashboard-panel'
            },
            h('h2', null, 'Inscripciones (ingresos)'),
            h('p', {
                className: 'muted',
                style: {
                    marginTop: 8
                }
            }, 'Evolución acumulada (usa decimation para mejorar rendimiento con muchos puntos).'),
            h(InscriptionRevenueLineChart, {
                boxers,
                precioMensual: metricas.precioMensual
            })
        )
    );
}

function CoachManagement() {
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [coach, setCoach] = useState({
        gimnasio: '',
        precioMensual: 0
    });
    const [metricas, setMetricas] = useState({
        boxeadoresActivos: 0,
        inscripcionesMes: 0,
        ingresosMes: 0
    });
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
            setMessage({
                kind: 'error',
                text: 'No se ha encontrado el email del entrenador en la sesión.'
            });
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
                gimnasio: coachInfo && coachInfo.gimnasio ? String(coachInfo.gimnasio) : '',
                precioMensual: coachInfo && typeof coachInfo.precioMensual === 'number' ? coachInfo.precioMensual : 0
            });
            const gymName = coachInfo && coachInfo.gimnasio ? String(coachInfo.gimnasio) : '';
            setGymInput(gymName);
            setPriceInput(coachInfo && typeof coachInfo.precioMensual === 'number' ? String(coachInfo.precioMensual) : '');
            setMetricas({
                boxeadoresActivos: metricsInfo && typeof metricsInfo.boxeadoresActivos === 'number' ? metricsInfo.boxeadoresActivos : 0,
                inscripcionesMes: metricsInfo && typeof metricsInfo.inscripcionesMes === 'number' ? metricsInfo.inscripcionesMes : 0,
                ingresosMes: metricsInfo && typeof metricsInfo.ingresosMes === 'number' ? metricsInfo.ingresosMes : 0
            });
            setBoxers(Array.isArray(boxersInfo) ? boxersInfo : []);
            setCobrosTotal(cobrosInfo && typeof cobrosInfo.total === 'number' ? cobrosInfo.total : 0);
            if (gymName) {
                const gymInfo = await requestJson(`/api/gimnasios/lookup?nombre=${encodeURIComponent(gymName)}`).catch(() => null);
                setBioInput(gymInfo && typeof gymInfo.bio === 'string' ? gymInfo.bio : '');
                setFotos(Array.isArray(gymInfo && gymInfo.fotos) ? gymInfo.fotos.filter((f) => typeof f === 'string' && f.trim()).slice(0, 12) : []);
            } else {
                setBioInput('');
                setFotos([]);
            }
            setMessage(null);
        } catch (err) {
            setMessage({
                kind: 'error',
                text: err && err.message ? err.message : 'Error cargando el panel del entrenador.'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshAll();
    }, []);

    const filteredBoxers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return boxers;
        return boxers.filter((b) => {
            const nombre = (b && b.nombre ? String(b.nombre) : '').toLowerCase();
            const emailB = (b && b.email ? String(b.email) : '').toLowerCase();
            const dni = (b && b.dniLicencia ? String(b.dniLicencia) : '').toLowerCase();
            return nombre.includes(q) || emailB.includes(q) || dni.includes(q);
        });
    }, [boxers, search]);

    const calendarEvents = useMemo(() => buildCoachCalendarEvents(boxers, metricas), [boxers, metricas]);

    const showMessage = (text, kind = 'ok') => setMessage({
        kind,
        text
    });

    const saveGym = async () => {
        try {
            await requestJson(`/api/entrenadores/me?email=${encodeURIComponent(email)}`, {
                method: 'PUT',
                body: {
                    gimnasio: gymInput
                }
            });
            const gymName = gymInput ? String(gymInput).trim() : '';
            if (gymName) {
                await requestJson('/api/gimnasios', {
                    method: 'POST',
                    body: {
                        nombre: gymName,
                        creadoPorEmail: email,
                        bio: bioInput,
                        fotos
                    }
                });
            }
            showMessage('Gimnasio actualizado correctamente.', 'ok');
            refreshAll();
        } catch (err) {
            showMessage(err && err.message ? err.message : 'No se pudo guardar el gimnasio.', 'error');
        }
    };

    const onPickFotos = async (e) => {
        const input = e && e.target ? e.target : null;
        const fileList = input && input.files ? Array.from(input.files) : [];
        const files = fileList.filter(Boolean).slice(0, 6);
        if (!files.length) return;

        const readFile = (file) => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        });

        const dataUrls = await Promise.all(files.map(readFile));
        const cleaned = dataUrls.filter((u) => typeof u === 'string' && u.trim());
        if (!cleaned.length) return;
        setFotos((prev) => {
            const current = Array.isArray(prev) ? prev : [];
            return [...current, ...cleaned].slice(0, 12);
        });

        if (input) input.value = '';
    };

    const removeFotoAt = (idx) => {
        setFotos((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            return list.filter((_, i) => i !== idx);
        });
    };

    const savePrice = async () => {
        const precioMensual = Number(priceInput);
        try {
            await requestJson(`/api/entrenadores/me?email=${encodeURIComponent(email)}`, {
                method: 'PUT',
                body: {
                    precioMensual: Number.isFinite(precioMensual) ? precioMensual : 0
                }
            });
            showMessage('Precio mensual actualizado correctamente.', 'ok');
            refreshAll();
        } catch (err) {
            showMessage(err && err.message ? err.message : 'No se pudo guardar el precio.', 'error');
        }
    };

    const addBoxer = async () => {
        const boxerIdentifier = assignEmail.trim();
        if (!boxerIdentifier) {
            showMessage('Introduce el email o DNI/Licencia del boxeador.', 'error');
            return;
        }
        try {
            await requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`, {
                method: 'POST',
                body: {
                    boxeadorIdentifier: boxerIdentifier
                }
            });
            setAssignEmail('');
            showMessage('Boxeador añadido correctamente.', 'ok');
            refreshAll();
        } catch (err) {
            showMessage(err && err.message ? err.message : 'No se pudo añadir el boxeador.', 'error');
        }
    };

    const removeBoxer = async () => {
        const boxerIdentifier = assignEmail.trim();
        if (!boxerIdentifier) {
            showMessage('Introduce el email o DNI/Licencia del boxeador.', 'error');
            return;
        }
        try {
            await requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`, {
                method: 'DELETE',
                body: {
                    boxeadorIdentifier: boxerIdentifier
                }
            });
            setAssignEmail('');
            showMessage('Boxeador eliminado de tu lista.', 'ok');
            refreshAll();
        } catch (err) {
            showMessage(err && err.message ? err.message : 'No se pudo quitar el boxeador.', 'error');
        }
    };

    const selectForEdit = (b) => {
        setEditId(b && b._id ? String(b._id) : '');
        setEditName(b && b.nombre ? String(b.nombre) : '');
        setEditDni(b && b.dniLicencia ? String(b.dniLicencia) : '');
        setEditLevel(b && b.nivel ? String(b.nivel) : 'Amateur');
    };

    const saveEdit = async () => {
        if (!editId) {
            showMessage('Selecciona un boxeador para editar.', 'error');
            return;
        }
        try {
            await requestJson(`/api/entrenadores/me/boxeadores/${encodeURIComponent(editId)}?email=${encodeURIComponent(email)}`, {
                method: 'PUT',
                body: {
                    nombre: editName.trim(),
                    dniLicencia: editDni.trim(),
                    nivel: editLevel
                }
            });
            showMessage('Boxeador actualizado correctamente.', 'ok');
            refreshAll();
        } catch (err) {
            showMessage(err && err.message ? err.message : 'No se pudo actualizar el boxeador.', 'error');
        }
    };

    const deleteEdit = async () => {
        if (!editId) {
            showMessage('Selecciona un boxeador para eliminar.', 'error');
            return;
        }
        try {
            await requestJson(`/api/entrenadores/me/boxeadores/${encodeURIComponent(editId)}?email=${encodeURIComponent(email)}`, {
                method: 'DELETE'
            });
            setEditId('');
            setEditName('');
            setEditDni('');
            setEditLevel('Amateur');
            showMessage('Boxeador eliminado correctamente.', 'ok');
            refreshAll();
        } catch (err) {
            showMessage(err && err.message ? err.message : 'No se pudo eliminar el boxeador.', 'error');
        }
    };

    const precioMensual = coach && typeof coach.precioMensual === 'number' ? coach.precioMensual : 0;
    const ingresosMes = metricas && typeof metricas.ingresosMes === 'number' ? metricas.ingresosMes : 0;
    const revenueMax = Math.max(1, (Number.isFinite(Number(precioMensual)) ? Number(precioMensual) : 0) * 30);

    const boxerFill = metricas && typeof metricas.boxeadoresActivos === 'number' ? cap((metricas.boxeadoresActivos / 30) * 100) : 0;
    const inscFill = metricas && typeof metricas.inscripcionesMes === 'number' ? cap((metricas.inscripcionesMes / 30) * 100) : 0;
    const revenueFill = cap((ingresosMes / (revenueMax || 1)) * 100);

    /* return ( <
            >
            <
            div className = "dashboard-panel" >
            <
            h2 > Panel CRM(Entrenador) < /h2> <
            div className = "dashboard-metrics"
            style = {
                {
                    marginTop: 16,
                    marginBottom: 0
                }
            } >
            <
            MetricCard label = "Tu gimnasio"
            pill = {
                coach && coach.gimnasio ? coach.gimnasio : '-'
            }
            sub = "Gestiona tu gimnasio y tus boxeadores."
            chartProps = {
                {
                    label: 'Gimnasio',
                    value: 1,
                    max: 1,
                    color: '#111827'
                }
            }
            /> <
            MetricCard label = "Boxeadores activos"
            pill = {
                String(metricas.boxeadoresActivos || 0)
            }
            sub = "Boxeadores asignados actualmente a tu gimnasio."
            chartProps = {
                {
                    label: 'Boxeadores',
                    value: metricas.boxeadoresActivos || 0,
                    max: 30,
                    color: '#111827'
                }
            }
            /> <
            MetricCard label = "Inscripciones este mes"
            pill = {
                String(metricas.inscripcionesMes || 0)
            }
            sub = "Altas registradas este mes."
            chartProps = {
                {
                    label: 'Inscripciones',
                    value: metricas.inscripcionesMes || 0,
                    max: 30,
                    color: '#6b7280'
                }
            }
            /> <
            MetricCard label = "Precio mensual"
            pill = {
                formatCurrency(precioMensual)
            }
            sub = "Define el precio que cobras en tu gimnasio."
            chartProps = {
                {
                    label: 'Precio',
                    value: boxerFill,
                    max: 100,
                    color: '#111827'
                }
            }
            /> <
            MetricCard label = "Ingresos estimados (mes)"
            pill = {
                formatCurrency(ingresosMes)
            }
            sub = "Precio mensual × inscripciones del mes."
            chartProps = {
                {
                    label: 'Ingresos',
                    value: ingresosMes,
                    max: revenueMax,
                    color: '#9ca3af'
                }
            }
            /> < /
            div > <
            div style = {
                {
                    display: 'grid',
                    gap: 12,
                    marginTop: 18
                }
            } >
            <
            div style = {
                {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 16,
                    alignItems: 'start'
                }
            } >
            <
            div style = {
                {
                    display: 'grid',
                    gap: 10,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid #e5e7eb'
                }
            } >
            <
            div style = {
                {
                    display: 'grid',
                    gap: 8
                }
            } >
            <
            label htmlFor = "coach-gym"
            style = {
                {
                    fontWeight: 600
                }
            } > Gimnasio < /label> <
            input id = "coach-gym"
            value = {
                gymInput
            }
            onChange = {
                (e) => setGymInput(e.target.value)
            }
            type = "text"
            style = {
                {
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #e5e7eb'
                }
            }
            /> < /
            div > <
            button className = "btn btn-secondary"
            type = "button"
            onClick = {
                saveGym
            } > Guardar gimnasio < /button> < /
            div > <
            div style = {
                {
                    display: 'grid',
                    gap: 10,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid #e5e7eb'
                }
            } >
            <
            div style = {
                {
                    display: 'grid',
                    gap: 8
                }
            } >
            <
            label htmlFor = "coach-price"
            style = {
                {
                    fontWeight: 600
                }
            } > Precio mensual(€) < /label> <
            input id = "coach-price"
            value = {
                priceInput
            }
            onChange = {
                (e) => setPriceInput(e.target.value)
            }
            type = "number"
            min = "0"
            step = "0.01"
            style = {
                {
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #e5e7eb'
                }
            }
            /> < /
            div > <
            button className = "btn btn-secondary"
            type = "button"
            onClick = {
                savePrice
            } > Guardar precio < /button> < /
            div > <
            /div> {
            message ? ( <
                div style = {
                    {
                        fontWeight: 600,
                        color: message.kind === 'error' ? '#b91c1c' : '#065f46'
                    }
                } > {
                    message.text
                } <
                /div>
            ) : null
        } <
        /div> < /
        div >

        <
        div className = "dashboard-panel" >
        <
        h2 > Tus boxeadores < /h2> <
    div className = "sparring-search-filters"
    style = {
            {
                marginTop: 12,
                marginBottom: 0,
                padding: 18
            }
        } >
        <
        div className = "filter-row"
    style = {
            {
                marginBottom: 0
            }
        } >
        <
        input value = {
            search
        }
    onChange = {
        (e) => setSearch(e.target.value)
    }
    className = "coach-filter-input"
    type = "text"
    placeholder = "Buscar por nombre, email o DNI..." / >
        <
        input value = {
            assignEmail
        }
    onChange = {
        (e) => setAssignEmail(e.target.value)
    }
    className = "coach-filter-input"
    type = "text"
    placeholder = "Email o DNI/Licencia del boxeador" / >
        <
        button className = "submit-button"
    type = "button"
    onClick = {
        addBoxer
    } > Añadir < /button> <
    button className = "submit-button coach-remove-button"
    type = "button"
    onClick = {
            removeBoxer
        } > Quitar < /button> < /
        div > <
        /div> <
    div className = "results-header"
    style = {
            {
                marginTop: 14,
                marginBottom: 10,
                padding: 0
            }
        } >
        <
        div className = "results-info" >
        <
        span className = "total-results" > {
            filteredBoxers.length
        }
    Boxeadores < /span> < /
        div > <
        /div> <
    div className = "sparring-list" > {
            filteredBoxers.length === 0 ? ( <
                div > Todavía no tienes boxeadores asignados. < /div>
            ) : filteredBoxers.map((b) => ( <
                div key = {
                    b._id || b.email
                }
                className = "sparring-card"
                style = {
                    {
                        cursor: 'pointer'
                    }
                }
                onClick = {
                    () => selectForEdit(b)
                } >
                <
                div className = "sparring-avatar" >
                <
                img src = "../../assets/images/unnamed-removebg-preview.png"
                alt = "Boxeador" / >
                <
                /div> <
                div className = "sparring-details" >
                <
                div className = "sparring-meta" >
                <
                span className = "sparring-tag" > {
                    b && b.nivel ? b.nivel : 'Amateur'
                } < /span> <
                span className = "sparring-date" > {
                    b && b.dniLicencia ? b.dniLicencia : '-'
                } < /span> < /
                div > <
                div className = "sparring-name" > {
                    b && b.nombre ? b.nombre : 'Boxeador'
                } < /div> <
                div className = "sparring-gym" > {
                    b && b.email ? b.email : ''
                } < /div> < /
                div > <
                /div>
            ))
        } <
        /div> <
    div style = {
            {
                marginTop: 18,
                display: 'grid',
                gap: 16
            }
        } >
        <
        div style = {
            {
                display: 'grid',
                gap: 10
            }
        } >
        <
        h3 style = {
            {
                margin: 0
            }
        } > Crear boxeador < /h3> <
    div style = {
            {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10
            }
        } >
        <
        input value = {
            createName
        }
    onChange = {
        (e) => setCreateName(e.target.value)
    }
    type = "text"
    placeholder = "Nombre"
    style = {
        {
            width: '100%',
            padding: 12,
            borderRadius: 12,
            border: '1px solid #e5e7eb'
        }
    }
    /> <
    input value = {
        createEmail
    }
    onChange = {
        (e) => setCreateEmail(e.target.value)
    }
    type = "email"
    placeholder = "Email"
    style = {
        {
            width: '100%',
            padding: 12,
            borderRadius: 12,
            border: '1px solid #e5e7eb'
        }
    }
    /> <
    input value = {
        createDni
    }
    onChange = {
        (e) => setCreateDni(e.target.value)
    }
    type = "text"
    placeholder = "DNI/Licencia"
    style = {
        {
            width: '100%',
            padding: 12,
            borderRadius: 12,
            border: '1px solid #e5e7eb'
        }
    }
    /> <
    input value = {
        createPassword
    }
    onChange = {
        (e) => setCreatePassword(e.target.value)
    }
    type = "password"
    placeholder = "Password"
    style = {
        {
            width: '100%',
            padding: 12,
            borderRadius: 12,
            border: '1px solid #e5e7eb'
        }
    }
    /> <
    select value = {
        createLevel
    }
    onChange = {
        (e) => setCreateLevel(e.target.value)
    }
    style = {
            {
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: '1px solid #e5e7eb'
            }
        } >
        <
        option value = "Principiante" > Principiante < /option> <
    option value = "Intermedio" > Intermedio < /option> <
    option value = "Avanzado" > Avanzado < /option> <
    option value = "Amateur" > Amateur < /option> <
    option value = "Profesional" > Profesional < /option> < /
        select > <
        /div> <
    button className = "btn btn-primary"
    type = "button"
    onClick = {
            createBoxer
        } > Crear boxeador < /button> < /
        div > <
        div style = {
            {
                display: 'grid',
                gap: 10
            }
        } >
        <
        h3 style = {
            {
                margin: 0
            }
        } > Editar boxeador < /h3> <
    input value = {
        editId
    }
    type = "hidden"
    readOnly / >
        <
        div style = {
            {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10
            }
        } >
        <
        input value = {
            editName
        }
    onChange = {
        (e) => setEditName(e.target.value)
    }
    type = "text"
    placeholder = "Nombre"
    style = {
        {
            width: '100%',
            padding: 12,
            borderRadius: 12,
            border: '1px solid #e5e7eb'
        }
    }
    /> <
    input value = {
        editDni
    }
    onChange = {
        (e) => setEditDni(e.target.value)
    }
    type = "text"
    placeholder = "DNI/Licencia"
    style = {
        {
            width: '100%',
            padding: 12,
            borderRadius: 12,
            border: '1px solid #e5e7eb'
        }
    }
    /> <
    select value = {
        editLevel
    }
    onChange = {
        (e) => setEditLevel(e.target.value)
    }
    style = {
            {
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: '1px solid #e5e7eb'
            }
        } >
        <
        option value = "Principiante" > Principiante < /option> <
    option value = "Intermedio" > Intermedio < /option> <
    option value = "Avanzado" > Avanzado < /option> <
    option value = "Amateur" > Amateur < /option> <
    option value = "Profesional" > Profesional < /option> < /
        select > <
        /div> <
    div style = {
            {
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap'
            }
        } >
        <
        button className = "btn btn-secondary"
    type = "button"
    onClick = {
        saveEdit
    } > Guardar cambios < /button> <
    button className = "btn btn-secondary"
    type = "button"
    onClick = {
        deleteEdit
    }
    style = {
            {
                color: '#4b5563',
                borderColor: '#ef4444'
            }
        } > Eliminar boxeador < /button> < /
        div > <
        /div> < /
        div > <
        /div>

        <
        div className = "dashboard-panel" >
        <
        h2 > Resumen < /h2> <
    p style = {
        {
            marginTop: 10
        }
    } > Cobros: < strong > {
        formatCurrency(cobrosTotal)
    } < /strong></p > {
        loading ? < p > Cargando... < /p> : null} < /
        div > <
        />
        ); */

    return h(
        React.Fragment,
        null,
        h(
            'div', {
                className: 'dashboard-panel'
            },
            h('h2', null, 'Mi gimnasio'),
            h(
                'div', {
                    style: {
                        display: 'grid',
                        gap: 12,
                        marginTop: 18
                    }
                },
                h(
                    'div', {
                        style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: 16,
                            alignItems: 'start'
                        }
                    },
                    h(
                        'div', {
                            style: {
                                display: 'grid',
                                gap: 10,
                                padding: 14,
                                borderRadius: 14,
                                border: '1px solid #e5e7eb'
                            }
                        },
                        h(
                            'div', {
                                style: {
                                    display: 'grid',
                                    gap: 8
                                }
                            },
                            h('label', {
                                htmlFor: 'coach-gym',
                                style: {
                                    fontWeight: 600
                                }
                            }, 'Gimnasio'),
                            h('input', {
                                id: 'coach-gym',
                                value: gymInput,
                                onChange: (e) => setGymInput(e.target.value),
                                type: 'text',
                                style: {
                                    width: '100%',
                                    padding: 12,
                                    borderRadius: 12,
                                    border: '1px solid #e5e7eb'
                                }
                            })
                        ),
                        h('button', {
                            className: 'btn btn-secondary',
                            type: 'button',
                            onClick: saveGym
                        }, 'Guardar cambios')
                    ),
                    h(
                        'div', {
                            style: {
                                display: 'grid',
                                gap: 10,
                                padding: 14,
                                borderRadius: 14,
                                border: '1px solid #e5e7eb'
                            }
                        },
                        h(
                            'div', {
                                style: {
                                    display: 'grid',
                                    gap: 8
                                }
                            },
                            h('label', {
                                htmlFor: 'coach-bio',
                                style: {
                                    fontWeight: 600
                                }
                            }, 'Bio'),
                            h('textarea', {
                                id: 'coach-bio',
                                value: bioInput,
                                onChange: (e) => setBioInput(e.target.value),
                                rows: 4,
                                style: {
                                    width: '100%',
                                    padding: 12,
                                    borderRadius: 12,
                                    border: '1px solid #e5e7eb',
                                    resize: 'vertical'
                                }
                            }),
                            h('label', {
                                htmlFor: 'coach-fotos',
                                style: {
                                    fontWeight: 600,
                                    marginTop: 6
                                }
                            }, 'Fotos (máx 12)'),
                            h('input', {
                                id: 'coach-fotos',
                                type: 'file',
                                accept: 'image/*',
                                multiple: true,
                                onChange: onPickFotos
                            }),
                            fotos && fotos.length ? h(
                                'div', {
                                    style: {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                        gap: 10,
                                        marginTop: 6
                                    }
                                },
                                ...fotos.map((src, idx) => h(
                                    'div', {
                                        key: `${idx}-${src}`,
                                        style: {
                                            display: 'grid',
                                            gap: 6
                                        }
                                    },
                                    h('img', {
                                        src,
                                        alt: `Foto ${idx + 1}`,
                                        style: {
                                            width: '100%',
                                            height: 90,
                                            objectFit: 'cover',
                                            borderRadius: 10,
                                            border: '1px solid #e5e7eb'
                                        }
                                    }),
                                    h('button', {
                                        className: 'btn btn-secondary',
                                        type: 'button',
                                        onClick: () => removeFotoAt(idx),
                                        style: {
                                            padding: '8px 10px',
                                            color: '#4b5563',
                                            borderColor: '#ef4444'
                                        }
                                    }, 'Quitar')
                                ))
                            ) : null
                        )
                    )
                ),
                message ? h('div', {
                    style: {
                        fontWeight: 600,
                        color: message.kind === 'error' ? '#b91c1c' : '#065f46'
                    }
                }, message.text) : null
            )
        ),
        h(
            'div', {
                className: 'dashboard-panel'
            },
            h('h2', null, 'Calendario'),
            h(CoachCalendar, {
                events: calendarEvents
            })
        ),
        h(
            'div', {
                className: 'dashboard-panel'
            },
            h('h2', null, 'Tus boxeadores'),
            h(
                'div', {
                    className: 'coach-boxers-toolbar'
                },
                h(
                    React.Fragment,
                    null,
                    h('input', {
                        value: search,
                        onChange: (e) => setSearch(e.target.value),
                        className: 'coach-boxers-search',
                        type: 'text',
                        placeholder: 'Buscar por nombre, email o DNI...'
                    }),
                    h(
                        'div', {
                            className: 'coach-boxers-assign'
                        },
                        h('input', {
                            value: assignEmail,
                            onChange: (e) => setAssignEmail(e.target.value),
                            className: 'coach-boxers-email',
                            type: 'text',
                            placeholder: 'Email o DNI/Licencia del boxeador'
                        }),
                        h(
                            'div', {
                                className: 'coach-boxers-assign-actions'
                            },
                            h(
                                'button', {
                                    className: 'submit-button',
                                    type: 'button',
                                    onClick: addBoxer
                                },
                                'Añadir'
                            ),
                            h(
                                'button', {
                                    className: 'submit-button coach-remove-button',
                                    type: 'button',
                                    onClick: removeBoxer
                                },
                                'Quitar'
                            )
                        )
                    )
                ),
                h(
                'div', {
                    className: 'results-header',
                    style: { marginTop: 14, marginBottom: 10, padding: 0 }
                },
                h('div', { className: 'results-info' },
                    h('span', { className: 'total-results' }, `${filteredBoxers.length} Boxeadores`)
                )
            ),

            // Lista de boxeadores en formato sparring-card
            h(
                'div', { className: 'sparring-list' },
                filteredBoxers.length === 0 ?
                h('div', { style: { padding: '20px', opacity: .5, textAlign: 'center' } }, 'Todavía no tienes boxeadores asignados.') :
                filteredBoxers.map((b, index) => {
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
                    const isEditing = editId === (b._id || '');
                    return h(
                        React.Fragment,
                        { key: b._id || b.email },
                        // Tarjeta estilo sparring
                        h('div', {
                            className: 'sparring-card',
                            style: { cursor: 'default', position: 'relative' }
                        },
                            h('div', { className: 'card-rank' },
                                h('span', null, `#${index + 1}`),
                                index === 0 ? h('i', { className: 'fas fa-crown' }) : null
                            ),
                            h('div', { className: 'card-flag' },
                                h('div', {
                                    style: {
                                        width: 44, height: 44, borderRadius: '50%',
                                        background: 'var(--color-accent, #f97316)',
                                        color: '#fff', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 800, fontSize: '1.1rem'
                                    }
                                }, (b.nombre || 'B').charAt(0).toUpperCase())
                            ),
                            h('div', { className: 'card-name' },
                                h('span', { className: 'main-name' }, b.nombre || 'Boxeador'),
                                h('span', { className: 'alias' }, b.email || '')
                            ),
                            h('div', { className: 'card-stars' }, ...renderStars(levelScore(b.nivel))),
                            h('div', { className: 'card-division' }, b.dniLicencia || 'Sin DNI'),
                            h('div', { className: 'card-record' }, b.nivel || 'Amateur'),
                            h('div', { className: 'card-residence' },
                                h('i', { className: 'fas fa-map-marker-alt' }),
                                ` ${b.gimnasio || 'Sin gimnasio'}`
                            ),
                            // Acciones directas en la tarjeta
                            h('div', { className: 'card-action', style: { display: 'flex', gap: 8 } },
                                h('button', {
                                    className: 'view-profile-button',
                                    type: 'button',
                                    style: { background: 'var(--color-accent, #f97316)', color: '#fff' },
                                    onClick: (e) => { e.stopPropagation(); selectForEdit(b); }
                                }, 'Editar'),
                                h('button', {
                                    className: 'view-profile-button',
                                    type: 'button',
                                    style: { background: '#fff', color: '#ef4444', border: '1.5px solid #ef4444' },
                                    onClick: async (e) => {
                                        e.stopPropagation();
                                        if (!b._id) return;
                                        await selectForEdit(b);
                                        deleteEdit();
                                    }
                                }, 'Eliminar')
                            )
                        ),
                        // Formulario de edición inline (solo visible cuando esta tarjeta está seleccionada)
                        isEditing ? h('div', {
                            style: {
                                margin: '0 0 16px 0',
                                padding: '16px',
                                borderRadius: 14,
                                border: '2px solid var(--color-accent, #f97316)',
                                background: 'var(--color-bg-card, #fff)',
                                display: 'grid',
                                gap: 12
                            }
                        },
                            h('div', { style: { fontWeight: 700, fontSize: '.9rem', color: 'var(--color-accent, #f97316)' } },
                                `✏️ Editando: ${b.nombre || b.email}`
                            ),
                            h('div', {
                                style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }
                            },
                                h('input', {
                                    value: editName,
                                    onChange: (e) => setEditName(e.target.value),
                                    type: 'text',
                                    placeholder: 'Nombre',
                                    style: { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: '.88rem' }
                                }),
                                h('input', {
                                    value: editDni,
                                    onChange: (e) => setEditDni(e.target.value),
                                    type: 'text',
                                    placeholder: 'DNI/Licencia',
                                    style: { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: '.88rem' }
                                }),
                                h('select', {
                                    value: editLevel,
                                    onChange: (e) => setEditLevel(e.target.value),
                                    style: { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: '.88rem' }
                                },
                                    h('option', { value: 'Principiante' }, 'Principiante'),
                                    h('option', { value: 'Intermedio' }, 'Intermedio'),
                                    h('option', { value: 'Avanzado' }, 'Avanzado'),
                                    h('option', { value: 'Amateur' }, 'Amateur'),
                                    h('option', { value: 'Profesional' }, 'Profesional')
                                )
                            ),
                            h('div', { style: { display: 'flex', gap: 10 } },
                                h('button', {
                                    className: 'submit-button',
                                    type: 'button',
                                    onClick: saveEdit
                                }, 'Guardar cambios'),
                                h('button', {
                                    type: 'button',
                                    style: { padding: '10px 18px', borderRadius: 10, border: '1.5px solid #ef4444', background: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer' },
                                    onClick: deleteEdit
                                }, 'Eliminar boxeador'),
                                h('button', {
                                    type: 'button',
                                    style: { padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'none', color: '#6b7280', cursor: 'pointer' },
                                    onClick: () => { setEditId(''); setEditName(''); setEditDni(''); setEditLevel('Amateur'); }
                                }, 'Cancelar')
                            )
                        ) : null
                    );
                })
            )
        ),
        h(
            'div', {
                className: 'dashboard-panel'
            },
            h('h2', null, 'Resumen'),
            h('p', {
                style: {
                    marginTop: 10
                }
            }, 'Cobros: ', h('strong', null, formatCurrency(cobrosTotal)))
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
                text: err && err.message ? err.message : 'Error cargando la gestión económica.'
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

const SESSION_MAINTAINED_KEY = 'gloveup_session_maintained';
const coachDashboardSection = document.getElementById('coach-dashboard');
const coachManagementSection = document.getElementById('coach-management');
const coachGymSection = document.getElementById('coach-gym');
const navHomeItem = document.getElementById('nav-home-item');
const coachNavItem = document.getElementById('coach-nav-item');
const coachGymNavItem = document.getElementById('coach-gym-nav-item');
const logoutButton = document.getElementById('logout-button');
const role = (localStorage.getItem(STORED_USER_ROLE_KEY) || '').toString().trim().toLowerCase();
const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').toString().trim().toLowerCase();
const isSessionMaintained =
    sessionStorage.getItem(SESSION_MAINTAINED_KEY) === 'true' ||
    localStorage.getItem(SESSION_MAINTAINED_KEY) === 'true';

const showCoachSection = () => {
    if (!coachDashboardSection || !coachManagementSection || !coachGymSection) return;
    const hash = String(window.location.hash || '').toLowerCase();
    const inManagement = hash === '#coach-management';
    const inGym = hash === '#coach-gym';
    coachDashboardSection.style.display = inManagement || inGym ? 'none' : 'grid';
    coachManagementSection.style.display = inManagement ? 'grid' : 'none';
    coachGymSection.style.display = inGym ? 'grid' : 'none';

    if (navHomeItem) navHomeItem.classList.toggle('active', !inManagement && !inGym);
    if (coachNavItem) coachNavItem.classList.toggle('active', inManagement);
    if (coachGymNavItem) coachGymNavItem.classList.toggle('active', inGym);
};

if (role !== 'entrenador' || !email || !isSessionMaintained) {
    if (coachDashboardSection) coachDashboardSection.style.display = 'grid';
    if (coachManagementSection) coachManagementSection.style.display = 'none';
    if (coachGymSection) coachGymSection.style.display = 'none';
    if (coachNavItem) coachNavItem.style.display = 'none';
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