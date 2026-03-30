const React = window.React;
const ReactDOM = window.ReactDOM;
const {
    useEffect,
    useRef,
    useState
} = React;
const h = React.createElement;

const STORED_EMAIL_KEY = 'gloveup_user_email';
const STORED_USER_ROLE_KEY = 'gloveup_user_role';
const API_BASE_URL = (window.localStorage.getItem('gloveup_api_base_url') || 'http://localhost:3000').replace(/\/+$/, '');

const requestJson = (path) => {
    return fetch(`${API_BASE_URL}${path}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || `Error ${res.status} en ${path}`);
        return payload;
    });
};

const inCurrentMonth = (yyyyMmDd) => {
    if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return false;
    const [y, m] = yyyyMmDd.split('-');
    if (!y || !m) return false;
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return y === year && m === month;
};

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
                        backgroundColor: [color || '#111827', 'rgba(0, 0, 0, 0.06)'],
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
    icon,
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
            h('div', { className: 'metric-label-group' },
                icon ? h('i', { className: icon, style: { marginRight: '8px', fontSize: '1rem', opacity: 0.5 } }) : null,
                h('span', { className: 'metric-label' }, label)
            ),
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

function BoxerDashboard() {
    const [sparringsMonth, setSparringsMonth] = useState(0);
    const [minutes, setMinutes] = useState(0);
    const [pending, setPending] = useState(0);

    const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();

    useEffect(() => {
        const role = (localStorage.getItem(STORED_USER_ROLE_KEY) || '').toLowerCase();
        if (role !== 'boxeador') return;
        if (!email) {
            setSparringsMonth(0);
            setMinutes(0);
            setPending(0);
            return;
        }
        requestJson(`/api/boxeadores/me?email=${encodeURIComponent(email)}`)
            .then((profile) => {
                const history = profile && Array.isArray(profile.sparringHistory) ? profile.sparringHistory : [];
                const monthCount = history.filter((x) => inCurrentMonth(x && x.date ? String(x.date) : '')).length;
                setSparringsMonth(monthCount);
                setMinutes(0);
                setPending(0);
            })
            .catch((err) => {
                setSparringsMonth(0);
                setMinutes(0);
                setPending(0);
            });
    }, []);

    return h(
        React.Fragment,
        null,
        h(
            'section', {
                className: 'dashboard-metrics'
            },
            h(MetricCard, {
                label: 'Sparrings este mes',
                pill: String(sparringsMonth),
                icon: 'fas fa-fist-raised',
                sub: 'Registra tus combates para ver actividad aquí.',
                chartProps: {
                    label: 'Sparrings',
                    value: sparringsMonth,
                    max: 10,
                    color: '#111827'
                }
            }),
            h(MetricCard, {
                label: 'Minutos de sparring',
                pill: String(minutes),
                icon: 'fas fa-clock',
                sub: 'Tu tiempo total acumulado en este indicador.',
                chartProps: {
                    label: 'Minutos',
                    value: minutes,
                    max: 300,
                    color: '#6b7280'
                }
            }),
            h(MetricCard, {
                label: 'Sparrings pendientes',
                pill: String(pending),
                icon: 'fas fa-hourglass-half',
                sub: 'Combates que tienes por confirmar.',
                chartProps: {
                    label: 'Pendientes',
                    value: pending,
                    max: 10,
                    color: '#9ca3af'
                }
            })
        ),
        h(
            'section', {
                className: 'dashboard-grid'
            },
            h('div', {
                className: 'dashboard-panel'
            }, h('h2', null, 'Próximos sparrings'), h('p', null, 'Todavía no tienes sparrings programados. Cuando confirmes sesiones aparecerán aquí.')),
            h('div', {
                className: 'dashboard-panel'
            }, h('h2', null, 'Actividad reciente'), h('p', null, 'Verás aquí tus últimos sparrings registrados y cambios en tu perfil.'))
        )
    );
}

const rootEl = document.getElementById('boxer-react-root');
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(h(BoxerDashboard, null));
}
