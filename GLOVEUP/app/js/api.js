/**
 * api.js — Cliente HTTP de la API de GloveUp.
 *
 * Apache hace de proxy de /api hacia el contenedor de Node, así que en
 * producción las peticiones van al mismo origen y no hay CORS. La variable
 * gloveup_api_base_url sigue permitiendo apuntar a otra API en desarrollo,
 * igual que hacían las páginas antiguas.
 */

const BASE = (localStorage.getItem('gloveup_api_base_url') || '').replace(/\/+$/, '');

/**
 * Lanza una petición y devuelve el JSON de la respuesta.
 *
 * @param {string} path              Ruta que empieza por "/", p. ej. "/api/gimnasios"
 * @param {RequestInit & {body?: any}} [options]
 * @returns {Promise<any>}
 * @throws {Error} Si la respuesta no es 2xx; el mensaje viene del campo `error`
 */
export async function request(path, options = {}) {
    const url = /^https?:\/\//i.test(path) ? path : BASE + path;

    const res = await fetch(url, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        // .status queda disponible para quien necesite distinguir un 401
        // (p. ej. el panel de admin, para saber cuándo volver a pedir login)
        // de otros errores; el resto de llamadas sigue leyendo sólo .message.
        throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status });
    }

    return data;
}

/** Convierte un nombre en la clave que usa el backend (ver routes/gimnasios.js). */
export function gymKey(name) {
    return (name || '')
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export const api = {
    /** @returns {Promise<Array<object>>} Todos los gimnasios */
    gimnasios: () => request('/api/gimnasios'),

    /** @param {string} key @returns {Promise<object|null>} */
    gimnasio: (key) => request(`/api/gimnasios/lookup?key=${encodeURIComponent(key)}`),

    /** @param {string} email */
    me: (email) => request(`/api/auth/me?email=${encodeURIComponent(email)}`),

    /** @param {string} email */
    boxeador: (email) => request(`/api/boxeadores/me?email=${encodeURIComponent(email)}`),

    /** @param {string} email */
    entrenador: (email) => request(`/api/entrenadores/me?email=${encodeURIComponent(email)}`),

    /** @returns {Promise<Array<object>>} Todos los boxeadores, para el listado de sparring */
    boxeadores: () => request('/api/boxeadores'),

    /** @returns {Promise<Array<object>>} Todos los entrenadores, para el selector de retos */
    entrenadores: () => request('/api/entrenadores'),

    /**
     * Envía un reto de sparring.
     * @param {{fromEmail: string, toIdentifier: string, preset: string, note: string,
     *          coachIds: string[], gymName: string, scheduledAt: string}} payload
     */
    sendChallenge: (payload) => request('/api/boxeadores/challenges', { method: 'POST', body: payload }),

    /** @param {string} identifier Email o DNI/licencia @returns {Promise<object>} */
    boxeadorLookup: (identifier) => request(`/api/boxeadores/lookup?identifier=${encodeURIComponent(identifier)}`),

    /** @param {string} email @param {object} payload */
    saveBoxeador: (email, payload) => request(`/api/boxeadores/me?email=${encodeURIComponent(email)}`, { method: 'PUT', body: payload }),

    /** @param {string} email @param {object} payload */
    saveEntrenador: (email, payload) => request(`/api/entrenadores/me?email=${encodeURIComponent(email)}`, { method: 'PUT', body: payload }),

    /** @param {string} email @returns {Promise<{sent: object[], received: object[]}>} */
    challenges: (email) => request(`/api/boxeadores/challenges?email=${encodeURIComponent(email)}`),

    /** @param {string} email @returns {Promise<{sessions: object[]}>} */
    sessions: (email) => request(`/api/boxeadores/sessions?email=${encodeURIComponent(email)}`),

    /**
     * Valora y cierra una sesión de sparring.
     * @param {{email: string, sessionId: string, stars: number, tags: string[], note: string}} payload
     */
    completeSession: (payload) => request('/api/boxeadores/sessions/complete', { method: 'POST', body: payload }),

    /** @param {string} email @returns {Promise<Array<object>>} Retos y sesiones de los boxeadores del entrenador */
    coachChallenges: (email) => request(`/api/entrenadores/me/challenges-for-boxers?email=${encodeURIComponent(email)}`),

    /** @param {string} email @param {string} challengeId @param {'accept'|'decline'} action */
    respondCoachChallenge: (email, challengeId, action) =>
        request(`/api/entrenadores/me/challenges/respond?email=${encodeURIComponent(email)}`, {
            method: 'POST',
            body: { challengeId, action },
        }),

    /**
     * Marca un reto ya aceptado como finalizado y lo valora.
     * @param {string} email @param {{challengeId: string, stars: number, note: string}} payload
     */
    completeCoachChallenge: (email, payload) =>
        request(`/api/entrenadores/me/challenges/complete?email=${encodeURIComponent(email)}`, {
            method: 'POST',
            body: payload,
        }),

    /** @param {string} email @returns {Promise<Array<object>>} Eventos personalizados del calendario */
    calendarEvents: (email) => request(`/api/boxeadores/me/calendar-events?email=${encodeURIComponent(email)}`),

    /**
     * @param {string} email
     * @param {{title: string, start: string, end?: string, allDay?: boolean, color?: string, tipo?: string, notas?: string}} payload
     */
    createCalendarEvent: (email, payload) =>
        request(`/api/boxeadores/me/calendar-events?email=${encodeURIComponent(email)}`, { method: 'POST', body: payload }),

    /** @param {string} email @param {string} eventId @param {object} payload */
    updateCalendarEvent: (email, eventId, payload) =>
        request(`/api/boxeadores/me/calendar-events/${encodeURIComponent(eventId)}?email=${encodeURIComponent(email)}`,
            { method: 'PUT', body: payload }),

    /** @param {string} email @param {string} eventId */
    deleteCalendarEvent: (email, eventId) =>
        request(`/api/boxeadores/me/calendar-events/${encodeURIComponent(eventId)}?email=${encodeURIComponent(email)}`,
            { method: 'DELETE' }),

    /** @param {string} email @returns {Promise<Array<object>>} Boxeadores gestionados por este entrenador */
    coachBoxeadores: (email) => request(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`),

    /** @param {string} nombre @returns {Promise<object|null>} */
    gimnasioByName: (nombre) => request(`/api/gimnasios/lookup?nombre=${encodeURIComponent(nombre)}`),

    /** Crea o actualiza (por creadoPorEmail/nombre) el gimnasio del entrenador. @param {object} payload */
    saveGimnasio: (payload) => request('/api/gimnasios', { method: 'POST', body: payload }),

    /** @param {string} email @param {string} identifier Email o DNI/licencia del boxeador a asignar */
    addCoachBoxeador: (email, identifier) =>
        request(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`,
            { method: 'POST', body: { boxeadorIdentifier: identifier } }),

    /** @param {string} email @param {string} identifier */
    removeCoachBoxeador: (email, identifier) =>
        request(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`,
            { method: 'DELETE', body: { boxeadorIdentifier: identifier } }),

    /** @param {string} email @param {string} boxerId @param {{nombre?: string, dniLicencia?: string, nivel?: string}} payload */
    updateCoachBoxeador: (email, boxerId, payload) =>
        request(`/api/entrenadores/me/boxeadores/${encodeURIComponent(boxerId)}?email=${encodeURIComponent(email)}`,
            { method: 'PUT', body: payload }),

    /** Da de baja PERMANENTEMENTE al boxeador (borra su cuenta). @param {string} email @param {string} boxerId */
    deleteCoachBoxeador: (email, boxerId) =>
        request(`/api/entrenadores/me/boxeadores/${encodeURIComponent(boxerId)}?email=${encodeURIComponent(email)}`,
            { method: 'DELETE' }),

    /** @param {string} email @param {string} boxerId */
    markBoxerPaid: (email, boxerId) =>
        request(`/api/entrenadores/me/boxeadores/${encodeURIComponent(boxerId)}/pago?email=${encodeURIComponent(email)}`,
            { method: 'POST' }),

    /** @param {string} email @param {string} boxerId */
    unmarkBoxerPaid: (email, boxerId) =>
        request(`/api/entrenadores/me/boxeadores/${encodeURIComponent(boxerId)}/pago?email=${encodeURIComponent(email)}`,
            { method: 'DELETE' }),

    /** @param {string} email @returns {Promise<Array<object>>} Eventos personalizados del calendario del entrenador */
    coachCalendarEvents: (email) => request(`/api/entrenadores/me/calendar-events?email=${encodeURIComponent(email)}`),

    /** @param {string} email @param {object} payload */
    createCoachCalendarEvent: (email, payload) =>
        request(`/api/entrenadores/me/calendar-events?email=${encodeURIComponent(email)}`, { method: 'POST', body: payload }),

    /** @param {string} email @param {string} eventId @param {object} payload */
    updateCoachCalendarEvent: (email, eventId, payload) =>
        request(`/api/entrenadores/me/calendar-events/${encodeURIComponent(eventId)}?email=${encodeURIComponent(email)}`,
            { method: 'PUT', body: payload }),

    /** @param {string} email @param {string} eventId */
    deleteCoachCalendarEvent: (email, eventId) =>
        request(`/api/entrenadores/me/calendar-events/${encodeURIComponent(eventId)}?email=${encodeURIComponent(email)}`,
            { method: 'DELETE' }),

    /** @param {string} email @returns {Promise<{gimnasio, precioMensual, boxeadoresActivos, inscripcionesMes, pagosMes, ingresosMes}>} */
    coachMetricas: (email) => request(`/api/entrenadores/me/metricas?email=${encodeURIComponent(email)}`),

    /** @param {string} email @returns {Promise<{total: number, items: object[]}>} */
    coachCobros: (email) => request(`/api/entrenadores/me/cobros?email=${encodeURIComponent(email)}`),

    // ── Administración ───────────────────────────────────────────────
    // No usan el email de sesión: se identifican con el token que devuelve
    // adminLogin(), pasado a mano en cada llamada (ver app/js/pages/admin.js).

    /** @param {string} password @returns {Promise<{token: string}>} */
    adminLogin: (password) => request('/api/admin/login', { method: 'POST', body: { password } }),

    /** @param {string} token */
    adminStats: (token) => request('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),

    /** @param {string} token @returns {Promise<Array<object>>} */
    adminUsuarios: (token) => request('/api/admin/usuarios', { headers: { Authorization: `Bearer ${token}` } }),

    /**
     * @param {string} token
     * @param {{nombre: string, email: string, password: string, rol: 'boxeador'|'entrenador',
     *          dniLicencia: string, gimnasio?: string}} payload
     */
    adminCreateUsuario: (token, payload) =>
        request('/api/admin/usuarios', { method: 'POST', body: payload, headers: { Authorization: `Bearer ${token}` } }),

    /** @param {string} token @param {string} id */
    adminDeleteUsuario: (token, id) =>
        request(`/api/admin/usuarios/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),

    /** @param {string} token @param {string} id */
    adminDeleteGimnasio: (token, id) =>
        request(`/api/admin/gimnasios/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
};
