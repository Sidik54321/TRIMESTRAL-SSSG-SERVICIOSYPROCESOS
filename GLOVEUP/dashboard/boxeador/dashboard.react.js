const React = window.React;
const ReactDOM = window.ReactDOM;
const { useEffect, useRef, useState } = React;
const h = React.createElement;

const STORED_EMAIL_KEY = 'gloveup_user_email';
const STORED_USER_ROLE_KEY = 'gloveup_user_role';
const _glv_h = window.location.hostname;
const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
const API_BASE_URL = (localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');

const requestJson = (path) => fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
}).then(async (res) => {
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `Error ${res.status}`);
    return payload;
});

const inCurrentMonth = (str) => {
    if (!str || typeof str !== 'string') return false;
    const [y, m] = str.split('-');
    if (!y || !m) return false;
    const now = new Date();
    return y === String(now.getFullYear()) && m === String(now.getMonth() + 1).padStart(2, '0');
};

const fmtDate = (str) => {
    if (!str) return '—';
    try {
        const d = new Date(str);
        if (isNaN(d)) return str;
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return str; }
};

const statusLabel = (s) => {
    const map = { pending: 'Pendiente', accepted: 'Aceptado', rejected: 'Rechazado', completed: 'Completado', cancelled: 'Cancelado' };
    return map[s] || s || '—';
};

const statusClass = (s) => {
    const map = { pending: 'status-pending', accepted: 'status-accepted', completed: 'status-completed', rejected: 'status-rejected', cancelled: 'status-cancelled' };
    return map[s] || 'status-pending';
};

// ——— Doughnut con valor centrado ———
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

// ——— Fila de reto pendiente ———
function ChallengeRow({ challenge, dir }) {
    const rival = dir === 'sent'
        ? (challenge.toNombre || challenge.toEmail || '—')
        : (challenge.fromNombre || challenge.fromEmail || '—');
    const date = challenge.scheduledAt || challenge.createdAt || '';

    return h('li', { className: 'sparring-row' },
        h('div', { className: 'sparring-row-left' },
            h('div', { className: `sparring-avatar ${dir === 'sent' ? 'avatar-sent' : 'avatar-recv'}` },
                h('i', { className: dir === 'sent' ? 'fas fa-paper-plane' : 'fas fa-inbox' })
            ),
            h('div', null,
                h('strong', { className: 'sparring-rival' }, rival),
                h('span', { className: 'sparring-gym' },
                    dir === 'sent' ? 'Reto enviado' : 'Reto recibido'
                )
            )
        ),
        h('div', { className: 'sparring-row-right' },
            h('span', { className: `sparring-status ${statusClass(challenge.status)}` }, statusLabel(challenge.status)),
            h('span', { className: 'sparring-date' }, fmtDate(date))
        )
    );
}

// ——— Calendario de retos ———
function ChallengesCalendar({ upcomingChallenges, pendingChallenges, sent }) {
    const now = new Date();
    const [calYear, setCalYear] = useState(now.getFullYear());
    const [calMonth, setCalMonth] = useState(now.getMonth());
    const [selectedDay, setSelectedDay] = useState(null);

    const dayMap = {};
    upcomingChallenges.forEach(c => {
        if (!c.scheduledAt) return;
        const d = new Date(c.scheduledAt);
        if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
            const day = d.getDate();
            if (!dayMap[day]) dayMap[day] = [];
            dayMap[day].push({ ...c, _type: 'confirmed' });
        }
    });
    pendingChallenges.forEach(c => {
        if (!c.scheduledAt) return;
        const d = new Date(c.scheduledAt);
        if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
            const day = d.getDate();
            if (!dayMap[day]) dayMap[day] = [];
            const dir = sent.find(s => s.id === c.id) ? 'sent' : 'recv';
            dayMap[day].push({ ...c, _dir: dir, _type: 'pending' });
        }
    });

    const prevMonth = () => {
        setSelectedDay(null);
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        setSelectedDay(null);
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
    };

    const monthLabel = new Date(calYear, calMonth, 1)
        .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const firstDayOfWeek = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const todayDate = now.getDate();
    const isCurrentMonthYear = calYear === now.getFullYear() && calMonth === now.getMonth();
    const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const selectedEvents = selectedDay ? (dayMap[selectedDay] || []) : [];
    const noDates = pendingChallenges.filter(c => !c.scheduledAt);

    return h('div', { className: 'challenges-calendar' },
        h('div', { className: 'cal-header' },
            h('button', { className: 'cal-nav-btn', onClick: prevMonth },
                h('i', { className: 'fas fa-chevron-left' })
            ),
            h('span', { className: 'cal-month-label' }, monthLabel),
            h('button', { className: 'cal-nav-btn', onClick: nextMonth },
                h('i', { className: 'fas fa-chevron-right' })
            )
        ),
        h('div', { className: 'cal-grid' },
            ...weekDays.map(d => h('div', { key: d, className: 'cal-weekday' }, d)),
            ...cells.map((day, i) => {
                if (!day) return h('div', { key: `e-${i}`, className: 'cal-cell cal-cell-empty' });
                const events = dayMap[day] || [];
                const isToday = isCurrentMonthYear && day === todayDate;
                const isSelected = selectedDay === day;
                const hasConfirmed = events.some(e => e._type === 'confirmed');
                const hasPending = events.some(e => e._type === 'pending');
                let cls = 'cal-cell';
                if (isToday) cls += ' cal-today';
                if (isSelected) cls += ' cal-selected';
                if (events.length) cls += ' cal-has-events';
                return h('div', { key: day, className: cls, onClick: () => setSelectedDay(isSelected ? null : day) },
                    h('span', { className: 'cal-day-num' }, day),
                    events.length > 0 && h('div', { className: 'cal-dots' },
                        hasConfirmed && h('span', { className: 'cal-dot cal-dot-confirmed' }),
                        hasPending && h('span', { className: 'cal-dot cal-dot-pending' })
                    )
                );
            })
        ),
        selectedDay && selectedEvents.length > 0 && h('div', { className: 'cal-day-detail' },
            h('p', { className: 'cal-day-detail-title' },
                h('i', { className: 'fas fa-calendar-day', style: { marginRight: '6px', opacity: 0.6 } }),
                `${selectedDay} de ${monthLabel}`
            ),
            h('ul', { className: 'sparring-list' },
                ...selectedEvents.map((c, i) => h(ChallengeRow, { key: c.id || i, challenge: c, dir: c._dir || 'recv' }))
            )
        ),
        noDates.length > 0 && h('div', { className: 'cal-no-date' },
            h('p', { className: 'challenge-group-label' },
                h('i', { className: 'fas fa-hourglass-half' }),
                ` Sin fecha (${noDates.length})`
            ),
            h('ul', { className: 'sparring-list' },
                ...noDates.map((c, i) => {
                    const dir = sent.find(s => s.id === c.id) ? 'sent' : 'recv';
                    return h(ChallengeRow, { key: c.id || i, challenge: c, dir });
                })
            )
        )
    );
}

function EmptyState({ icon, text }) {
    return h('div', { className: 'empty-state' },
        h('i', { className: icon }),
        h('p', null, text)
    );
}

const CHALLENGE_PAGE_SIZE = 5;

function Pagination({ page, total, pageSize, onPrev, onNext }) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;
    return h('div', { className: 'challenge-pagination' },
        h('button', { className: 'pag-btn', onClick: onPrev, disabled: page === 0 },
            h('i', { className: 'fas fa-chevron-left' })
        ),
        h('span', { className: 'pag-info' }, `${page + 1} / ${totalPages}`),
        h('button', { className: 'pag-btn', onClick: onNext, disabled: page >= totalPages - 1 },
            h('i', { className: 'fas fa-chevron-right' })
        )
    );
}

// ——— Dashboard principal ———
function BoxerDashboard() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();

    useEffect(() => {
        const role = (localStorage.getItem(STORED_USER_ROLE_KEY) || '').toLowerCase();
        if (!email) { setLoading(false); return; }
        if (role !== 'boxeador') { setLoading(false); return; }

        requestJson(`/api/boxeadores/me?email=${encodeURIComponent(email)}`)
            .then((data) => { setProfile(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Datos derivados
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
        .sort((a, b) => {
            const da = new Date(a.scheduledAt || a.completedAt || a.createdAt || 0);
            const db = new Date(b.scheduledAt || b.completedAt || b.createdAt || 0);
            return db - da;
        })
        .slice(0, 5);

    const upcomingChallenges = [
        ...sent.filter(c => c.status === 'accepted').map(c => ({ ...c, _dir: 'sent' })),
        ...received.filter(c => c.status === 'accepted').map(c => ({ ...c, _dir: 'recv' }))
    ].sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0)).slice(0, 5);

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

            // Retos — calendario
            h('div', { className: 'dashboard-panel challenges-panel' },
                h('h2', null,
                    h('i', { className: 'fas fa-calendar-check', style: { marginRight: '8px', opacity: 0.5 } }),
                    'Retos'
                ),
                upcomingChallenges.length === 0 && pendingChallenges.length === 0
                    ? h(EmptyState, { icon: 'fas fa-calendar-alt', text: 'Sin retos activos. Lanza un reto para programar tu próxima sesión.' })
                    : h(ChallengesCalendar, { upcomingChallenges, pendingChallenges, sent })
            )
        )
    );
}

const rootEl = document.getElementById('boxer-react-root');
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(h(BoxerDashboard, null));
}
