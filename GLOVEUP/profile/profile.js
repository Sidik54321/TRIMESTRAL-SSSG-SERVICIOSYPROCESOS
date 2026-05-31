/**
 * profile.js — Gestión del perfil de usuario en GloveUp (profile/index.html).
 * Soporta tres modos de uso:
 *   · Edición propia: boxeador o entrenador editando sus propios datos.
 *   · Solo lectura (?view=EMAIL|DNI): visualización del perfil de otro boxeador.
 *   · Tab de sparrings (?tab=sparrings): historial, retos recibidos/enviados y sesiones.
 * Persiste la sesión y redirige a auth si no hay sesión activa.
 */

// ─── CLAVES DE ALMACENAMIENTO LOCAL ─────────────────────────────────────────

const STORED_USERNAME_KEY = 'gloveup_user_name';
const STORED_EMAIL_KEY = 'gloveup_user_email';
const STORED_ROLE_KEY = 'gloveup_user_role';
const SESSION_MAINTAINED_KEY = 'gloveup_session_maintained';

// ─── CONFIGURACIÓN DE LA API ─────────────────────────────────────────────────

// Detección dinámica del host para entornos locales y de producción
const _glv_h = window.location.hostname;
const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
const API_ORIGIN = (window.localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');
const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

// Imagen de perfil por defecto cuando el usuario no ha subido foto
const DEFAULT_PHOTO = '../assets/images/unnamed-removebg-preview.png';

// ─── ESTADO GLOBAL DEL PERFIL ────────────────────────────────────────────────

// Objeto de estado reactivo que mantiene los datos del perfil cargado en memoria
let profileState = {
    nombre: '',
    alias: '',
    disciplina: '',
    peso: '',
    altura: '',
    edad: null,
    ubicacion: '',
    bio: '',
    foto: '',
    sparringHistory: []
};

// ─── PAGINACIÓN DE RETOS ─────────────────────────────────────────────────────

// Tamaño de página para las tablas de retos recibidos y enviados
const CHALLENGES_PAGE_SIZE = 5;
let challengesReceivedPage = 1;
let challengesSentPage = 1;

// ─── UTILIDADES GENERALES ────────────────────────────────────────────────────

/** Alias de document.getElementById para código más conciso. */
function $(id) {
    return document.getElementById(id);
}

/** Muestra una notificación toast si está disponible; silencioso si no. */
function notify(message, type = 'info', duration = 3500) {
    if (typeof window.showToast === 'function') {
        window.showToast(String(message || ''), type, duration);
    }
}

/** Devuelve el email del usuario activo en minúsculas desde localStorage. */
function getEmail() {
    return (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();
}

/** Devuelve el rol del usuario activo en minúsculas desde localStorage. */
function getRole() {
    return (localStorage.getItem(STORED_ROLE_KEY) || '').toString().trim().toLowerCase();
}

/**
 * Comprueba si la sesión actual es válida.
 * Requiere que el flag de sesión esté en storage Y que haya email guardado.
 */
function isSessionOk() {
    const isSessionMaintained =
        sessionStorage.getItem(SESSION_MAINTAINED_KEY) === 'true' ||
        localStorage.getItem(SESSION_MAINTAINED_KEY) === 'true';
    return Boolean(isSessionMaintained && getEmail());
}

/** Redirige a la página de autenticación indicando que viene desde el perfil. */
function redirectToAuth() {
    window.location.href = '../auth/index.html?from=profile';
}

// ─── PARÁMETROS DE LA URL ────────────────────────────────────────────────────

/**
 * Extrae el parámetro ?view= de la URL.
 * Si existe, activa el modo solo lectura mostrando el perfil del boxeador indicado.
 */
function getViewIdentifier() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('view') || '').toString().trim();
}

/** Extrae el parámetro ?from= para saber desde qué sección se navega. */
function getFromParam() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('from') || '').toString().trim().toLowerCase();
}

/** Extrae el parámetro ?tab= para activar una pestaña específica al cargar. */
function getTabParam() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('tab') || '').toString().trim().toLowerCase();
}

// ─── CONTROL DE FORMULARIO ──────────────────────────────────────────────────

/**
 * Pone todos los campos del formulario en modo readonly o editable.
 * Usada al entrar en modo vista (solo lectura) para impedir modificaciones.
 */
function setFormReadonly(readonly) {
    const inputs = Array.from(document.querySelectorAll('#name, #email, #alias, #discipline, #location, #weight, #height, #age, #bio, #coach-gym, #coach-price, #level, #boxer-gym'));
    inputs.forEach((el) => {
        if (!el) return;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'select') {
            el.disabled = readonly;
            return;
        }
        el.readOnly = readonly;
        if (tag === 'input' || tag === 'textarea') {
            el.tabIndex = readonly ? -1 : 0; // Sacar de la navegación por teclado si es readonly
        }
    });

    // Los <select> usan disabled en lugar de readOnly
    const selects = Array.from(document.querySelectorAll('#weightClass, #stance, #gender, #sparring-freq'));
    selects.forEach((el) => {
        if (el) el.disabled = readonly;
    });

    const photoInput = $('photo-input');
    if (photoInput) photoInput.disabled = readonly;
}

// ─── CARGA DE PERFIL AJENO (MODO VISTA) ─────────────────────────────────────

/**
 * Carga el perfil de otro boxeador por email o DNI/Licencia.
 * Primero intenta el endpoint /lookup; si falla, busca en la lista completa.
 * Rellena el formulario en modo readonly con los datos encontrados.
 */
async function loadOtherBoxerProfile(identifier) {
    const raw = (identifier || '').toString().trim();
    // Normalizar: email en minúsculas, DNI en mayúsculas
    const normalized = raw.includes('@') ? raw.toLowerCase() : raw.toUpperCase();

    let data;
    try {
        data = await requestJson(`/boxeadores/lookup?identifier=${encodeURIComponent(normalized)}`);
    } catch (err) {
        // Fallback: obtener la lista completa y buscar manualmente
        const list = await requestJson('/boxeadores');
        const items = Array.isArray(list) ? list : [];
        const found = items.find((b) => {
            if (!b) return false;
            const email = (b.email || '').toString().trim().toLowerCase();
            const dni = (b.dniLicencia || '').toString().trim().toUpperCase();
            return normalized.includes('@') ? email === normalized : dni === normalized;
        });
        if (!found) {
            throw new Error(err && err.message ? err.message : 'Perfil no encontrado');
        }
        data = {
            _id: found._id,
            nombre: found.nombre || '',
            alias: found.alias || '',
            disciplina: found.disciplina || '',
            peso: found.peso || '',
            altura: found.altura || '',
            edad: found.edad || null,
            ubicacion: found.ubicacion || '',
            bio: found.bio || '',
            foto: found.foto || '',
            nivel: found.nivel || 'Amateur',
            gimnasio: found.gimnasio || ''
        };
    }

    // Mezclar los datos encontrados en el estado global
    profileState = {
        ...profileState,
        ...data,
        sparringHistory: []
    };

    applyProfileToForm(profileState);
}

// ─── INDICADOR DE SESIÓN ─────────────────────────────────────────────────────

/**
 * Actualiza el pill de estado de sesión en la cabecera del perfil.
 * Verde ("Sesión activa") si ok; rojo ("Sin sesión") si no.
 */
function setSessionPill(ok) {
    const pill = $('session-pill');
    if (!pill) return;
    pill.classList.remove('ok', 'bad');
    if (ok) {
        pill.textContent = 'Sesión activa';
        pill.classList.add('ok');
    } else {
        pill.textContent = 'Sin sesión';
        pill.classList.add('bad');
    }
}

// ─── UTILIDADES DE FORMATO ───────────────────────────────────────────────────

/** Formatea una fecha ISO (YYYY-MM-DD) como DD/MM/YYYY. */
function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

/** Formatea un número como moneda en euros usando Intl (ej: "29,99 €"). */
function formatCurrency(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0,00 €';
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    }).format(num);
}

// ─── HELPER HTTP ─────────────────────────────────────────────────────────────

/**
 * Realiza una petición JSON autenticada a la API REST.
 * Lanza un Error con el mensaje del servidor si la respuesta no es OK.
 */
async function requestJson(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method || 'GET',
        headers: options.body ? {
            'Content-Type': 'application/json'
        } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error HTTP ${res.status}`);
    }
    return res.json();
}

// ─── CONSTRUCCIÓN DEL PAYLOAD ─────────────────────────────────────────────────

/**
 * Lee los valores del formulario de perfil de boxeador y los devuelve como objeto.
 * Usado al guardar el perfil para construir el cuerpo de la petición PUT.
 */
function getProfilePayload() {
    return {
        nombre: $('name').value.trim(),
        nuevoEmail: $('email').value.trim(),
        alias: $('alias').value.trim(),
        disciplina: $('discipline').value.trim(),
        peso: $('weight').value ? String($('weight').value) : '',
        categoriaPeso: $('weightClass') && $('weightClass').value ? $('weightClass').value : '',
        genero: $('gender') && $('gender').value ? $('gender').value : '',
        guardia: $('stance') && $('stance').value ? $('stance').value : '',
        frecuenciaSparring: $('sparring-freq') && $('sparring-freq').value ? $('sparring-freq').value : '',
        altura: $('height').value ? String($('height').value) : '',
        edad: $('age').value ? Number($('age').value) : null,
        ubicacion: $('location').value.trim(),
        bio: $('bio').value.trim(),
        foto: profileState.foto || '',
        sparringHistory: Array.isArray(profileState.sparringHistory) ? profileState.sparringHistory : []
    };
}

// ─── RESOLUCIÓN DE FOTOS ─────────────────────────────────────────────────────

/**
 * Normaliza la URL/ruta de una foto de perfil.
 * Soporta: data URLs (base64), URLs absolutas (http/https), rutas relativas desde /api.
 */
function resolvePhotoSrc(photo) {
    const raw = (photo || '').toString().trim();
    if (!raw) return DEFAULT_PHOTO;
    if (raw.startsWith('data:')) return raw;              // Foto en base64
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw; // URL externa
    if (raw.startsWith('/')) return `..${raw}`;           // Ruta absoluta del servidor
    return raw;
}

// ─── APLICAR DATOS AL FORMULARIO ─────────────────────────────────────────────

/**
 * Rellena el formulario con los datos del perfil de boxeador.
 * Aplica valores del estado global y, como fallback, los de localStorage.
 */
function applyProfileToForm(profile) {
    $('name').value = profile.nombre || localStorage.getItem(STORED_USERNAME_KEY) || '';
    if ($('email')) $('email').value = profile.email || localStorage.getItem(STORED_EMAIL_KEY) || '';
    $('alias').value = profile.alias || '';
    $('discipline').value = profile.disciplina || '';
    $('weight').value = profile.peso || '';
    if ($('weightClass')) $('weightClass').value = profile.categoriaPeso || '';
    if ($('gender')) $('gender').value = profile.genero || '';
    if ($('stance')) $('stance').value = profile.guardia || '';
    if ($('sparring-freq')) $('sparring-freq').value = profile.frecuenciaSparring || '';
    $('height').value = profile.altura || '';
    $('age').value = profile.edad || '';
    $('location').value = profile.ubicacion || '';
    $('bio').value = profile.bio || '';
    const levelInput = $('level');
    if (levelInput) levelInput.value = profile.nivel || '';
    const boxerGymInput = $('boxer-gym');
    if (boxerGymInput) boxerGymInput.value = profile.gimnasio || '';
    $('profile-photo').src = resolvePhotoSrc(profile.foto);
}

/**
 * Rellena el formulario con los datos específicos del perfil de entrenador.
 * Los campos exclusivos de boxeador (alias, stats, etc.) no se tocan aquí.
 */
function applyCoachProfileToForm(profile) {
    $('name').value = profile.nombre || localStorage.getItem(STORED_USERNAME_KEY) || '';
    if ($('email')) $('email').value = profile.email || localStorage.getItem(STORED_EMAIL_KEY) || '';
    if ($('gender')) $('gender').value = profile.genero || '';
    $('alias').value = ''; // Entrenadores no tienen alias
    $('discipline').value = profile.especialidad || 'Boxeo';
    $('location').value = profile.ubicacion || '';
    const gymInput = $('coach-gym');
    const priceInput = $('coach-price');
    if (gymInput) gymInput.value = profile.gimnasio || '';
    // Mostrar vacío si el precio es 0 o null para que el placeholder sea visible
    if (priceInput) priceInput.value = profile.precioMensual === undefined || profile.precioMensual === null ? '' : String(profile.precioMensual);
    $('profile-photo').src = resolvePhotoSrc(profile.foto);
}

// ─── UTILIDADES DE ESCAPE HTML ───────────────────────────────────────────────

/**
 * Escapa caracteres especiales HTML para prevenir XSS al insertar datos
 * del servidor en innerHTML de las tablas de retos y sesiones.
 */
function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// ─── HELPERS DE ESTADO DE RETOS ──────────────────────────────────────────────

/** Convierte el estado inglés del reto a texto en español legible. */
function statusLabel(status) {
    const s = (status || '').toString().toLowerCase();
    if (s === 'accepted') return 'Aceptado';
    if (s === 'declined') return 'Rechazado';
    return 'Pendiente';
}

/** Devuelve la clase CSS del pill de estado (ok=verde, bad=rojo). */
function statusPillClass(status) {
    const s = (status || '').toString().toLowerCase();
    if (s === 'accepted') return 'ok';
    return 'bad';
}

/** Formatea una fecha ISO como datetime localizado en español (DD/MM/YYYY HH:MM). */
function formatDateTime(iso) {
    const raw = (iso || '').toString().trim();
    if (!raw) return '';
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return raw;
    return dt.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ─── CARGA DE RETOS ──────────────────────────────────────────────────────────

/** Obtiene de la API los retos recibidos y enviados del boxeador. */
async function loadChallenges(email) {
    return requestJson(`/boxeadores/challenges?email=${encodeURIComponent(email)}`);
}

// ─── PAGINACIÓN DE RETOS ─────────────────────────────────────────────────────

/**
 * Renderiza los controles de paginación para una tabla de retos.
 * Genera botones de página con soporte para elipsis en conjuntos grandes.
 * @param {string} containerId - ID del elemento contenedor de la paginación.
 * @param {number} currentPage - Página actualmente activa.
 * @param {number} totalPages - Número total de páginas.
 * @param {Function} onPageChange - Callback que recibe el número de página al hacer clic.
 */
function renderChallengePagination(containerId, currentPage, totalPages, onPageChange) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const addBtn = (page, label, active, disabled) => {
        // Los botones activos o deshabilitados se renderizan como <span> (no clicables)
        const el = document.createElement(active || disabled ? 'span' : 'button');
        el.className = 'challenge-page-btn' + (active ? ' active' : '');
        el.textContent = label;
        if (disabled) el.style.opacity = '0.4';
        if (!active && !disabled) {
            el.type = 'button';
            el.addEventListener('click', () => onPageChange(page));
        }
        container.appendChild(el);
    };

    addBtn(Math.max(1, currentPage - 1), '<', false, currentPage === 1);
    if (totalPages <= 7) {
        // Sin elipsis si hay 7 páginas o menos
        for (let p = 1; p <= totalPages; p++) addBtn(p, String(p), p === currentPage, false);
    } else {
        // Con elipsis para conjuntos grandes: 1 ... X-1 X X+1 ... N
        addBtn(1, '1', currentPage === 1, false);
        const left = Math.max(2, currentPage - 1);
        const right = Math.min(totalPages - 1, currentPage + 1);
        if (left > 2) { const e = document.createElement('span'); e.textContent = '...'; container.appendChild(e); }
        for (let p = left; p <= right; p++) addBtn(p, String(p), p === currentPage, false);
        if (right < totalPages - 1) { const e = document.createElement('span'); e.textContent = '...'; container.appendChild(e); }
        addBtn(totalPages, String(totalPages), currentPage === totalPages, false);
    }
    addBtn(Math.min(totalPages, currentPage + 1), '>', false, currentPage === totalPages);
}

// ─── RENDER DE RETOS ─────────────────────────────────────────────────────────

/**
 * Renderiza las tablas de retos recibidos y enviados con paginación.
 * Los retos pendientes incluyen botones de Aceptar/Rechazar.
 * Usa escapeHtml para prevenir XSS en todos los datos del servidor.
 */
function renderChallenges(data) {
    const card = $('sparring-challenges-card');
    const countEl = $('challenges-count');
    const receivedTbody = $('challenges-received-tbody');
    const sentTbody = $('challenges-sent-tbody');
    if (!card || !countEl || !receivedTbody || !sentTbody) return;

    const received = Array.isArray(data && data.received) ? data.received : [];
    const sent = Array.isArray(data && data.sent) ? data.sent : [];
    // El contador total combina recibidos + enviados
    countEl.textContent = String(received.length + sent.length);

    // ── Retos recibidos ──────────────────────────────────────────────────────

    // Ordenar por fecha descendente (más recientes primero)
    const sortedReceived = received.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const totalPagesReceived = Math.max(1, Math.ceil(sortedReceived.length / CHALLENGES_PAGE_SIZE));
    challengesReceivedPage = Math.min(challengesReceivedPage, totalPagesReceived);
    const pageReceived = sortedReceived.slice((challengesReceivedPage - 1) * CHALLENGES_PAGE_SIZE, challengesReceivedPage * CHALLENGES_PAGE_SIZE);

    receivedTbody.innerHTML = pageReceived
        .map((x) => {
            const who = `<strong>${escapeHtml(x.fromNombre || '')}</strong><div class="muted">${escapeHtml(x.fromEmail || '')}</div>`;
            const desc = escapeHtml(x.preset || '');
            const gym = x.gymName ? `<div class="muted">${escapeHtml(x.gymName)}</div>` : '';
            const when = x.scheduledAt ? `<div class="muted">${escapeHtml(formatDateTime(x.scheduledAt))}</div>` : '';
            const pill = `<span class="pill ${statusPillClass(x.status)}">${statusLabel(x.status)}</span>`;
            const coaches = Array.isArray(x.coachNombres) ? x.coachNombres.filter(Boolean) : [];
            const coachesCell = coaches.length ? coaches.map(escapeHtml).join('<br>') : '<span class="muted">—</span>';
            // Mostrar botones de acción solo si el reto sigue pendiente
            const actions = String(x.status || '').toLowerCase() === 'pending' ? `
                <div class="row-actions">
                    <button class="btn btn-primary" type="button" data-challenge-action="accept" data-challenge-id="${escapeHtml(x.id)}">Aceptar</button>
                    <button class="btn btn-secondary" type="button" data-challenge-action="decline" data-challenge-id="${escapeHtml(x.id)}">Rechazar</button>
                </div>
            ` : '';
            return `
                <tr>
                    <td data-label="De">${who}</td>
                    <td data-label="Detalles">${desc}${gym}${when}${x.note ? `<div class="muted">${escapeHtml(x.note)}</div>` : ''}</td>
                    <td data-label="Entrenadores">${coachesCell}</td>
                    <td data-label="Estado">${pill}</td>
                    <td>${actions}</td>
                </tr>
            `;
        })
        .join('') || `<tr><td colspan="5" class="muted">No tienes retos recibidos.</td></tr>`;

    renderChallengePagination('challenges-received-pagination', challengesReceivedPage, totalPagesReceived, (p) => {
        challengesReceivedPage = p;
        renderChallenges(data); // Re-renderizar con la nueva página
    });

    // ── Retos enviados ───────────────────────────────────────────────────────

    const sortedSent = sent.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const totalPagesSent = Math.max(1, Math.ceil(sortedSent.length / CHALLENGES_PAGE_SIZE));
    challengesSentPage = Math.min(challengesSentPage, totalPagesSent);
    const pageSent = sortedSent.slice((challengesSentPage - 1) * CHALLENGES_PAGE_SIZE, challengesSentPage * CHALLENGES_PAGE_SIZE);

    sentTbody.innerHTML = pageSent
        .map((x) => {
            const who = `<strong>${escapeHtml(x.toNombre || '')}</strong><div class="muted">${escapeHtml(x.toEmail || '')}</div>`;
            const desc = escapeHtml(x.preset || '');
            const gym = x.gymName ? `<div class="muted">${escapeHtml(x.gymName)}</div>` : '';
            const when = x.scheduledAt ? `<div class="muted">${escapeHtml(formatDateTime(x.scheduledAt))}</div>` : '';
            const pill = `<span class="pill ${statusPillClass(x.status)}">${statusLabel(x.status)}</span>`;
            const coaches = Array.isArray(x.coachNombres) ? x.coachNombres.filter(Boolean) : [];
            const coachesCell = coaches.length ? coaches.map(escapeHtml).join('<br>') : '<span class="muted">—</span>';
            // Los retos enviados no tienen botones de acción (solo se puede responder a los recibidos)
            return `
                <tr>
                    <td data-label="Para">${who}</td>
                    <td data-label="Detalles">${desc}${gym}${when}${x.note ? `<div class="muted">${escapeHtml(x.note)}</div>` : ''}</td>
                    <td data-label="Entrenadores">${coachesCell}</td>
                    <td data-label="Estado">${pill}</td>
                </tr>
            `;
        })
        .join('') || `<tr><td colspan="4" class="muted">No has enviado retos todavía.</td></tr>`;

    renderChallengePagination('challenges-sent-pagination', challengesSentPage, totalPagesSent, (p) => {
        challengesSentPage = p;
        renderChallenges(data);
    });
}

/**
 * Recarga los retos desde la API y re-renderiza la tabla.
 * Oculta la tarjeta si hay error de carga.
 */
async function refreshChallenges() {
    const email = getEmail();
    const card = $('sparring-challenges-card');
    if (!card) return;
    try {
        const data = await loadChallenges(email);
        card.style.display = '';
        renderChallenges(data);
    } catch (err) {
        card.style.display = 'none';
    }
}

// ─── SESIONES DE SPARRING ────────────────────────────────────────────────────

/** Obtiene de la API las sesiones de sparring del boxeador (programadas y completadas). */
async function loadSessions(email) {
    return requestJson(`/boxeadores/sessions?email=${encodeURIComponent(email)}`);
}

/** Convierte el estado inglés de una sesión a texto en español. */
function sessionStatusLabel(status) {
    const s = (status || '').toString().toLowerCase();
    if (s === 'completed') return 'Completado';
    if (s === 'scheduled') return 'Programado';
    return s ? s : '—';
}

/** Devuelve la clase CSS del pill de estado de sesión. */
function sessionPillClass(status) {
    const s = (status || '').toString().toLowerCase();
    if (s === 'completed') return 'ok';
    return 'bad';
}

/**
 * Formatea un valor de valoración (1-5 estrellas) como "N/5" o "—" si no válido.
 */
function formatRatingCell(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 5) return '<span class="muted">—</span>';
    return `<strong>${n}/5</strong>`;
}

/**
 * Renderiza la tabla de sesiones de sparring programadas (estado != completado).
 * Muestra compañero, gimnasio, entrenadores, valoraciones y botón de marcar completo.
 */
function renderSessions(data) {
    const card = $('sparring-sessions-card');
    const countEl = $('sessions-count');
    const tbody = $('sessions-tbody');
    if (!card || !countEl || !tbody) return;

    const email = getEmail();
    // Filtrar solo sesiones no completadas (el historial completado va en renderHistory)
    const sessions = Array.isArray(data && data.sessions)
        ? data.sessions.filter(s => (s.status || '').toLowerCase() !== 'completed')
        : [];
    countEl.textContent = String(sessions.length);

    const rows = sessions
        .slice()
        .sort((a, b) => String(b.scheduledAt || '').localeCompare(String(a.scheduledAt || '')))
        .map((s) => {
            // Determinar quién es el compañero en función de si el usuario es boxer A o B
            const aEmail = (s && s.boxerAEmail ? String(s.boxerAEmail) : '').toLowerCase();
            const bEmail = (s && s.boxerBEmail ? String(s.boxerBEmail) : '').toLowerCase();
            const isMeA = email && email === aEmail;
            const partnerName = isMeA ? (s.boxerBNombre || '') : (s.boxerANombre || '');
            const partnerEmail = isMeA ? bEmail : aEmail;
            const partnerCell = `<strong>${escapeHtml(partnerName)}</strong>${partnerEmail ? `<div class="muted">${escapeHtml(partnerEmail)}</div>` : ''}`;
            const when = escapeHtml(formatDateTime(s.scheduledAt || ''));
            const gym = escapeHtml(s.gymName || '');
            const coaches = Array.isArray(s.coachNombres) ? s.coachNombres.filter(Boolean) : [];
            const coachesCell = coaches.length ? coaches.map(escapeHtml).join('<br>') : '<span class="muted">—</span>';
            const coachRating = formatRatingCell(s.ratingEntrenador);
            const boxerRating = formatRatingCell(s.ratingBoxeador);
            const status = `<span class="pill ${sessionPillClass(s.status)}">${escapeHtml(sessionStatusLabel(s.status))}</span>`;
            const reviews = Array.isArray(s.reviews) ? s.reviews : [];
            // Verificar si el usuario ya ha dejado reseña en esta sesión
            const alreadyReviewed = email ? reviews.some((r) => r && String(r.byEmail || '').toLowerCase() === email) : false;
            const canReview = !alreadyReviewed;
            // Botón contextual: "Valorar" si completado, "Marcar completado" si programado
            const action = canReview ? `
                <button class="btn btn-primary" type="button" data-session-review="${escapeHtml(s.id)}">${String(s.status || '').toLowerCase() === 'completed' ? 'Valorar' : 'Marcar completado'}</button>
            ` : '<span class="muted">—</span>';
            return `
                <tr>
                    <td data-label="Fecha">${when}</td>
                    <td data-label="Partner">${partnerCell}</td>
                    <td data-label="Gimnasio">${gym}</td>
                    <td data-label="Entrenadores">${coachesCell}</td>
                    <td data-label="Val. entrenador">${coachRating}</td>
                    <td data-label="Val. boxeador">${boxerRating}</td>
                    <td data-label="Estado">${status}</td>
                    <td>${action}</td>
                </tr>
            `;
        })
        .join('');

    tbody.innerHTML = rows || `<tr><td colspan="8" class="muted">Todavía no tienes sesiones programadas.</td></tr>`;
}

/**
 * Recarga las sesiones desde la API y actualiza tanto la tabla de sesiones
 * activas como el historial de sparrings completados.
 */
async function refreshSessions() {
    const email = getEmail();
    const card = $('sparring-sessions-card');
    if (!card) return;
    try {
        const data = await loadSessions(email);
        card.style.display = '';
        renderSessions(data);
        renderHistory(Array.isArray(data && data.sessions) ? data.sessions : []);
    } catch (err) {
        card.style.display = 'none';
        renderHistory([]);
    }
}

// ─── HISTORIAL DE SPARRINGS COMPLETADOS ──────────────────────────────────────

/**
 * Renderiza la tabla de historial de sparrings completados.
 * Filtra las sesiones con status === 'completed' y las ordena por fecha descendente.
 * Muestra el estado vacío o la tabla según si hay registros.
 */
function renderHistory(sessions) {
    const tbody = $('sparring-tbody');
    const empty = $('empty-state');
    const tableWrap = $('table-wrap');
    const count = $('sparring-count');
    const email = getEmail();

    const completed = Array.isArray(sessions) ? sessions.filter(s => (s.status || '').toLowerCase() === 'completed') : [];
    completed.sort((a, b) => String(b.completedAt || b.scheduledAt || '').localeCompare(String(a.completedAt || a.scheduledAt || '')));

    count.textContent = `${completed.length} registro${completed.length === 1 ? '' : 's'}`;

    if (completed.length === 0) {
        empty.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        tbody.innerHTML = '';
        return;
    }

    empty.classList.add('hidden');
    tableWrap.classList.remove('hidden');

    tbody.innerHTML = completed.map((s) => {
        const aEmail = (s.boxerAEmail || '').toLowerCase();
        const isMeA = email && email === aEmail;
        // Determinar nombre del compañero según si el usuario es boxer A o B
        const partnerName = escapeHtml(isMeA ? (s.boxerBNombre || s.boxerBEmail || '—') : (s.boxerANombre || s.boxerAEmail || '—'));
        const date = escapeHtml(formatDate((s.completedAt || s.scheduledAt || '').slice(0, 10)));
        const gym = escapeHtml(s.gymName || '—');
        const note = escapeHtml(isMeA ? (s.noteBoxeador || '') : (s.noteBoxeador || ''));
        return `
            <tr>
                <td data-label="Fecha">${date}</td>
                <td data-label="Partner"><strong>${partnerName}</strong></td>
                <td data-label="Gimnasio">${gym}</td>
                <td data-label="Notas" class="muted">${note}</td>
            </tr>
        `;
    }).join('');
}

// ─── CARGA DEL PERFIL PROPIO ─────────────────────────────────────────────────

/**
 * Carga el perfil del usuario activo desde la API (boxeador o entrenador).
 * Actualiza el estado global y rellena el formulario correspondiente.
 */
async function loadProfileFromApi() {
    const email = getEmail();
    const isCoach = getRole() === 'entrenador';
    const endpoint = isCoach ? 'entrenadores' : 'boxeadores';
    const data = await requestJson(`/${endpoint}/me?email=${encodeURIComponent(email)}`).catch(() => {
        throw new Error('No se pudo cargar el perfil desde MongoDB');
    });
    if (isCoach) {
        profileState = {
            ...profileState,
            nombre: data.nombre || '',
            ubicacion: data.ubicacion || '',
            foto: data.foto || '',
            sparringHistory: []
        };
        applyCoachProfileToForm(data || {});
        return;
    }

    // Mezclar datos de la API en el estado global, preservando el historial
    profileState = {
        ...profileState,
        ...data,
        sparringHistory: Array.isArray(data.sparringHistory) ? data.sparringHistory : []
    };
    applyProfileToForm(profileState);
}

// ─── PAYLOAD DEL ENTRENADOR ──────────────────────────────────────────────────

/**
 * Lee los valores del formulario específico del entrenador y los devuelve como objeto.
 * Valida que el precio sea un número positivo finito.
 */
function getCoachPayload() {
    const gymInput = $('coach-gym');
    const priceInput = $('coach-price');
    const rawPrice = priceInput && priceInput.value !== '' ? Number(priceInput.value) : 0;
    const safePrice = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
    return {
        nombre: $('name').value.trim(),
        nuevoEmail: $('email') ? $('email').value.trim() : null,
        especialidad: $('discipline').value.trim() || 'Boxeo',
        gimnasio: gymInput ? gymInput.value.trim() : '',
        genero: $('gender') && $('gender').value ? $('gender').value : '',
        precioMensual: safePrice,
        ubicacion: $('location').value.trim(),
        foto: profileState.foto || ''
    };
}

// ─── GUARDAR PERFIL ──────────────────────────────────────────────────────────

/**
 * Lee el formulario, construye el payload y envía el PUT a la API.
 * Si el email cambia, actualiza el localStorage para mantener la coherencia.
 * @param {boolean} showAlert - Si true, muestra toast de confirmación.
 */
async function saveProfileForm(showAlert = true) {
    const email = getEmail();
    if (!email) {
        redirectToAuth();
        return;
    }

    const isCoach = getRole() === 'entrenador';
    const endpoint = isCoach ? 'entrenadores' : 'boxeadores';
    const payload = isCoach ? getCoachPayload() : getProfilePayload();
    const saved = await requestJson(`/${endpoint}/me?email=${encodeURIComponent(email)}`, {
        method: 'PUT',
        body: payload
    }).catch((err) => {
        throw new Error(err && err.message ? err.message : 'No se pudo guardar el perfil');
    });
    if (isCoach) {
        localStorage.setItem(STORED_USERNAME_KEY, saved && saved.nombre ? saved.nombre : '');
        // Si el email cambió, actualizar todas las referencias en storage
        if (saved && saved.email && saved.email !== email) {
            localStorage.setItem(STORED_EMAIL_KEY, saved.email);
            if (sessionStorage.getItem(SESSION_MAINTAINED_KEY)) {
                sessionStorage.setItem(STORED_EMAIL_KEY, saved.email);
            }
        }
        applyCoachProfileToForm(saved || {});
        if (showAlert) {
            notify('Perfil guardado en MongoDB.', 'success');
        }
        return;
    }

    // Para boxeador: mezclar los datos guardados en el estado global
    profileState = {
        ...profileState,
        ...saved,
        sparringHistory: Array.isArray(saved.sparringHistory) ? saved.sparringHistory : []
    };
    localStorage.setItem(STORED_USERNAME_KEY, profileState.nombre || '');
    if (saved && saved.email && saved.email !== email) {
        localStorage.setItem(STORED_EMAIL_KEY, saved.email);
        if (sessionStorage.getItem(SESSION_MAINTAINED_KEY)) {
            sessionStorage.setItem(STORED_EMAIL_KEY, saved.email);
        }
    }
    applyProfileToForm(profileState);
    if (showAlert) {
        notify('Perfil guardado en MongoDB.', 'success');
    }
}

// ─── GESTIÓN DE FOTO DE PERFIL ───────────────────────────────────────────────

/**
 * Convierte un File a data URL (base64) usando FileReader.
 * Devuelve una Promise para uso con async/await.
 */
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Manejador del cambio en el input de foto.
 * Convierte la imagen a base64, actualiza el estado y guarda en la API.
 * Guarda en silencio (sin toast) para mejor UX.
 */
async function onPhotoSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    profileState.foto = dataUrl;
    $('profile-photo').src = dataUrl; // Previsualización inmediata
    await saveProfileForm(false);    // Guardar sin toast (foto se guarda en silencio)
    e.target.value = ''; // Limpiar el input para permitir seleccionar la misma foto de nuevo
}

/** Elimina la foto de perfil volviendo a la imagen por defecto y guardando en la API. */
async function removePhoto() {
    profileState.foto = '';
    $('profile-photo').src = DEFAULT_PHOTO;
    await saveProfileForm(false);
}


// ─── INICIALIZACIÓN AL CARGAR EL DOM ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sesión y redirigir si no es válida
    const ok = isSessionOk();
    setSessionPill(ok);
    if (!ok) {
        redirectToAuth();
        return;
    }

    // ── Determinar el modo de visualización ─────────────────────────────────

    const isCoach = getRole() === 'entrenador';
    const viewIdentifier = getViewIdentifier();      // ?view=EMAIL|DNI
    const isViewMode = Boolean(viewIdentifier);      // true = modo solo lectura
    const isCoachProfile = isCoach && !isViewMode;   // Entrenador viendo su propio perfil
    const tab = getTabParam();                       // ?tab=sparrings
    const isSparringsTab = tab === 'sparrings';
    const fromParam = getFromParam();                // ?from=settings

    // ── Actualizar textos dinámicos según el modo ────────────────────────────

    const roleTitle = $('profile-role-title');
    if (roleTitle) roleTitle.textContent = isCoachProfile ? 'Entrenador' : 'Boxeador';
    const subtitle = $('profile-subtitle');
    if (subtitle) {
        if (isViewMode) subtitle.textContent = 'Estás viendo un perfil en modo solo lectura.';
        else if (isSparringsTab && !isCoachProfile) subtitle.textContent = 'Tu historial y tus retos de sparring.';
        else subtitle.textContent = isCoachProfile ? 'Tus datos como entrenador.' : 'Tus datos de perfil.';
    }
    // La etiqueta del campo disciplina cambia según el rol
    const disciplineLabel = $('discipline-label');
    if (disciplineLabel) disciplineLabel.textContent = isCoachProfile ? 'Especialidad' : 'Disciplina';

    // ── Referencias a elementos de la UI ────────────────────────────────────

    const pageTitle = $('profile-title');
    const backSparringBtn = $('btn-back-sparring');
    const saveBtn = $('btn-save-profile');
    const photoUploadLabel = $('photo-upload-label');
    const removePhotoBtn = $('btn-remove-photo');
    const profileCard = $('profile-card');
    const historyCard = $('sparring-history-card');
    const challengesCard = $('sparring-challenges-card');
    const sessionsCard = $('sparring-sessions-card');
    const lookupCard = $('boxer-profile-lookup-card');
    const lookupBanner = $('view-mode-banner');
    const boxerOnlyLevel = $('boxer-only-level');
    const boxerOnlyGym = $('boxer-only-gym');

    // El buscador de perfiles ajenos solo se muestra al boxeador en su propio perfil
    if (lookupCard) lookupCard.style.display = !isCoachProfile && !isViewMode && !isSparringsTab ? '' : 'none';

    // ── Configurar visibilidad según el modo ─────────────────────────────────

    if (isViewMode) {
        // Modo solo lectura: ocultar controles de edición, mostrar datos del otro boxeador
        if (pageTitle) pageTitle.textContent = 'Perfil de Boxeador';
        if (backSparringBtn) backSparringBtn.style.display = '';
        if (saveBtn) saveBtn.style.display = 'none';
        if (photoUploadLabel) photoUploadLabel.style.display = 'none';
        if (removePhotoBtn) removePhotoBtn.style.display = 'none';
        if (profileCard) profileCard.style.display = '';
        if (historyCard) historyCard.style.display = 'none';
        if (challengesCard) challengesCard.style.display = 'none';
        if (sessionsCard) sessionsCard.style.display = 'none';
        if (lookupBanner) lookupBanner.style.display = 'none';
        if (boxerOnlyLevel) boxerOnlyLevel.style.display = '';
        if (boxerOnlyGym) boxerOnlyGym.style.display = '';
        setFormReadonly(true);
    } else {
        // Modo edición: mostrar botón atrás solo en contextos concretos
        if (backSparringBtn) backSparringBtn.style.display = (isSparringsTab && !isCoachProfile) || fromParam === 'settings' ? '' : 'none';
        if (saveBtn) saveBtn.style.display = isSparringsTab && !isCoachProfile ? 'none' : '';
        if (lookupBanner) lookupBanner.style.display = 'none';
        if (boxerOnlyLevel) boxerOnlyLevel.style.display = 'none';
        if (boxerOnlyGym) boxerOnlyGym.style.display = 'none';
        if (profileCard) profileCard.style.display = isSparringsTab && !isCoachProfile ? 'none' : '';
        setFormReadonly(false);
    }

    // Botón "volver" con lógica de navegación contextual
    if (backSparringBtn) {
        backSparringBtn.addEventListener('click', () => {
            if (fromParam === 'settings') {
                window.location.href = '../settings/index.html';
            } else if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '../home/dashboard.html';
            }
        });
    }

    // ── Campos exclusivos por rol ────────────────────────────────────────────

    // Mostrar campos de gimnasio y precio solo para entrenadores
    const coachGymField = $('coach-gym-field');
    const coachPriceField = $('coach-price-field');
    if (coachGymField) coachGymField.style.display = isCoachProfile ? '' : 'none';
    if (coachPriceField) coachPriceField.style.display = isCoachProfile ? '' : 'none';

    // Ocultar bloques exclusivos de boxeador cuando es entrenador
    const boxerOnlyStats = $('boxer-only-stats');
    const boxerOnlyWeight = $('boxer-only-weightclass');
    const boxerOnlyBio = $('boxer-only-bio');
    const boxerOnlyAlias = $('boxer-only-alias');
    const boxerOnlyStance = $('boxer-only-stance');
    const boxerOnlyGender = $('boxer-only-gender');
    const boxerOnlyFreq = $('boxer-only-freq');

    if (boxerOnlyStats) boxerOnlyStats.style.display = isCoachProfile ? 'none' : '';
    if (boxerOnlyWeight) boxerOnlyWeight.style.display = isCoachProfile ? 'none' : '';
    if (boxerOnlyBio) boxerOnlyBio.style.display = isCoachProfile ? 'none' : '';
    if (boxerOnlyAlias) boxerOnlyAlias.style.display = isCoachProfile ? 'none' : '';
    if (boxerOnlyStance) boxerOnlyStance.style.display = isCoachProfile ? 'none' : '';
    if (boxerOnlyGender) boxerOnlyGender.style.display = isCoachProfile ? 'none' : '';
    if (boxerOnlyFreq) boxerOnlyFreq.style.display = isCoachProfile ? 'none' : '';

    // ── Tarjetas de sparring ─────────────────────────────────────────────────

    const showMySparrings = !isCoachProfile && !isViewMode && isSparringsTab;
    if (historyCard) historyCard.style.display = showMySparrings ? '' : 'none';
    if (challengesCard) challengesCard.style.display = showMySparrings ? '' : 'none';
    if (sessionsCard) sessionsCard.style.display = showMySparrings ? '' : 'none';
    if (pageTitle && showMySparrings) pageTitle.textContent = 'Mis Sparrings';

    // ── Carga de datos según el modo ─────────────────────────────────────────

    try {
        if (isViewMode) {
            // Modo vista: cargar perfil del boxeador indicado en ?view=
            await loadOtherBoxerProfile(viewIdentifier);
            const safeName = ($('name') && $('name').value ? $('name').value : '').trim();
            if (pageTitle) pageTitle.textContent = safeName ? `Perfil de ${safeName}` : 'Perfil de Boxeador';
            if (subtitle) {
                // Subtítulo con nivel y gimnasio del boxeador visto
                const parts = [];
                if (profileState && profileState.nivel) parts.push(`Nivel: ${profileState.nivel}`);
                if (profileState && profileState.gimnasio) parts.push(`Gimnasio: ${profileState.gimnasio}`);
                subtitle.textContent = parts.length ? parts.join(' · ') : 'Estás viendo un perfil en modo solo lectura.';
            }
        } else {
            // Modo propio: cargar el perfil del usuario activo
            await loadProfileFromApi();
            if (!isCoachProfile && showMySparrings) {
                // Cargar retos y sesiones para el tab de sparrings
                await refreshChallenges();
                await refreshSessions();

                // ── Modal de valoración de sesión ────────────────────────────

                const reviewModal = $('session-review-modal');
                const reviewForm = $('session-review-form');
                const reviewCancel = $('btn-review-cancel');
                const reviewTags = $('review-tags');
                const reviewNote = $('review-note');
                let reviewSessionId = '';

                /** Limpia el formulario del modal de valoración (estrellas, chips y notas). */
                const resetReview = () => {
                    reviewSessionId = '';
                    document.querySelectorAll('input[name="review-stars"]').forEach((x) => {
                        x.checked = false;
                    });
                    if (reviewNote) reviewNote.value = '';
                    if (reviewTags) {
                        reviewTags.querySelectorAll('.chip.active').forEach((c) => c.classList.remove('active'));
                    }
                };

                // Botón cancelar del modal → cerrar y limpiar
                if (reviewCancel && reviewModal) {
                    reviewCancel.addEventListener('click', (e) => {
                        e.preventDefault();
                        resetReview();
                        reviewModal.close();
                    });
                }

                // Chips de etiquetas (positivo, agresivo, técnico…) → toggle activo
                if (reviewTags) {
                    reviewTags.addEventListener('click', (e) => {
                        const chip = e.target && e.target.closest ? e.target.closest('.chip') : null;
                        if (!chip) return;
                        chip.classList.toggle('active');
                    });
                }

                // Clic en botón de sesión → abrir modal de valoración con el ID de sesión
                if (sessionsCard) {
                    sessionsCard.addEventListener('click', (e) => {
                        const btn = e.target && e.target.closest ? e.target.closest('[data-session-review]') : null;
                        if (!btn || !reviewModal) return;
                        const id = String(btn.getAttribute('data-session-review') || '').trim();
                        if (!id) return;
                        resetReview();
                        reviewSessionId = id;
                        reviewModal.showModal();
                    });
                }

                // Envío del formulario de valoración
                if (reviewForm) {
                    reviewForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        if (!reviewSessionId) return;
                        const checked = document.querySelector('input[name="review-stars"]:checked');
                        const stars = checked ? Number(checked.value) : 0;
                        // Recoger las etiquetas (chips) activas
                        const tags = reviewTags ? Array.from(reviewTags.querySelectorAll('.chip.active')).map((c) => String(c.getAttribute('data-tag') || '').trim()).filter(Boolean) : [];
                        const note = reviewNote ? String(reviewNote.value || '').trim() : '';
                        if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
                            notify('Selecciona una valoración (1-5)', 'warning');
                            return;
                        }
                        try {
                            await requestJson('/boxeadores/sessions/complete', {
                                method: 'POST',
                                body: {
                                    email: getEmail(),
                                    sessionId: reviewSessionId,
                                    stars,
                                    tags,
                                    note
                                }
                            });
                            if (reviewModal) reviewModal.close();
                            resetReview();
                            await refreshSessions(); // Recargar para reflejar el cambio de estado
                        } catch (err) {
                            notify(err.message || 'No se pudo guardar la valoración', 'error');
                        }
                    });
                }

                // Delegación de eventos para Aceptar/Rechazar retos en la tabla
                const receivedTbody = $('challenges-received-tbody');
                if (challengesCard && receivedTbody) {
                    challengesCard.addEventListener('click', async (e) => {
                        const btn = e.target && e.target.closest ? e.target.closest('[data-challenge-action]') : null;
                        if (!btn) return;
                        const action = String(btn.getAttribute('data-challenge-action') || '').toLowerCase();
                        const challengeId = String(btn.getAttribute('data-challenge-id') || '');
                        if (!challengeId) return;
                        try {
                            await requestJson('/boxeadores/challenges/respond', {
                                method: 'POST',
                                body: {
                                    email: getEmail(),
                                    challengeId,
                                    action // 'accept' o 'decline'
                                }
                            });
                            // Recargar retos y sesiones pues aceptar crea una nueva sesión
                            await refreshChallenges();
                            await refreshSessions();
                        } catch (err) {
                            notify(err.message || 'No se pudo responder al reto', 'error');
                        }
                    });
                }
            }
        }
    } catch (err) {
        notify(err.message || 'No se pudo cargar el perfil', 'error');
        if (isViewMode) {
            window.location.href = 'index.html'; // En modo vista, volver al perfil propio
        }
    }

    // ── Botón guardar perfil ────────────────────────────────────────────────

    const saveProfileBtn = $('btn-save-profile');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            try {
                await saveProfileForm(true);
            } catch (err) {
                notify(err.message || 'No se pudo guardar el perfil', 'error');
            }
        });
    }

    // ── Input de foto ───────────────────────────────────────────────────────

    const photoInput = $('photo-input');
    if (photoInput) {
        photoInput.addEventListener('change', async (event) => {
            try {
                if (isViewMode) return; // Bloquear cambios en modo solo lectura
                await onPhotoSelected(event);
            } catch (err) {
                notify(err.message || 'No se pudo guardar la foto', 'error');
            }
        });
    }

    // ── Botón eliminar foto ─────────────────────────────────────────────────

    const removePhotoButton = $('btn-remove-photo');
    if (removePhotoButton) {
        removePhotoButton.addEventListener('click', async () => {
            try {
                if (isViewMode) return;
                await removePhoto();
            } catch (err) {
                notify(err.message || 'No se pudo quitar la foto', 'error');
            }
        });
    }

    // ── Buscador de perfiles ajenos (solo boxeadores en su propio perfil) ───

    if (!isCoachProfile) {
        const viewInput = $('other-boxer-identifier');
        const viewBtn = $('btn-view-boxer');
        /** Navega al perfil del boxeador buscado por email o DNI. */
        const go = () => {
            const val = (viewInput ? viewInput.value : '').toString().trim();
            if (!val) return;
            // Si se busca a sí mismo, limpiar el ?view para volver al perfil propio
            if (val.toLowerCase() === getEmail()) {
                window.location.href = 'index.html';
                return;
            }
            window.location.href = `index.html?view=${encodeURIComponent(val)}`;
        };
        if (viewBtn) viewBtn.addEventListener('click', go);
        if (viewInput) {
            viewInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    go();
                }
            });
        }
    }

    // ── Botón de cerrar sesión ──────────────────────────────────────────────

    const logoutBtn = $('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // Limpiar todos los datos de sesión antes de redirigir
            localStorage.removeItem(STORED_USERNAME_KEY);
            localStorage.removeItem(STORED_EMAIL_KEY);
            localStorage.removeItem(SESSION_MAINTAINED_KEY);
            localStorage.removeItem('gloveup_is_registered');
            localStorage.removeItem('gloveup_user_role');
            localStorage.removeItem('gloveup_user_dni');
            sessionStorage.removeItem(SESSION_MAINTAINED_KEY);
            sessionStorage.removeItem('gloveup_user_id');
            window.location.href = '../auth/index.html';
        });
    }
});
