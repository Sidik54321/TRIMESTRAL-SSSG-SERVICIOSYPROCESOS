const STORED_USERNAME_KEY = 'gloveup_user_name';
const STORED_EMAIL_KEY = 'gloveup_user_email';
const STORED_ROLE_KEY = 'gloveup_user_role';
const SESSION_MAINTAINED_KEY = 'gloveup_session_maintained';
const _glv_h = window.location.hostname;
const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
const API_ORIGIN = (window.localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');
const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';
const DEFAULT_PHOTO = '../assets/images/unnamed-removebg-preview.png';

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

function $(id) {
    return document.getElementById(id);
}

function getEmail() {
    return (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();
}

function getRole() {
    return (localStorage.getItem(STORED_ROLE_KEY) || '').toString().trim().toLowerCase();
}

function isSessionOk() {
    const isSessionMaintained =
        sessionStorage.getItem(SESSION_MAINTAINED_KEY) === 'true' ||
        localStorage.getItem(SESSION_MAINTAINED_KEY) === 'true';
    return Boolean(isSessionMaintained && getEmail());
}

function redirectToAuth() {
    window.location.href = '../auth/index.html?from=profile';
}

function getViewIdentifier() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('view') || '').toString().trim();
}

function getFromParam() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('from') || '').toString().trim().toLowerCase();
}

function getTabParam() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('tab') || '').toString().trim().toLowerCase();
}

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
            el.tabIndex = readonly ? -1 : 0;
        }
    });

    const selects = Array.from(document.querySelectorAll('#weightClass, #stance, #gender, #sparring-freq'));
    selects.forEach((el) => { if (el) el.disabled = readonly; });

    const photoInput = $('photo-input');
    if (photoInput) photoInput.disabled = readonly;
}

async function loadOtherBoxerProfile(identifier) {
    const raw = (identifier || '').toString().trim();
    const normalized = raw.includes('@') ? raw.toLowerCase() : raw.toUpperCase();

    let data;
    try {
        data = await requestJson(`/boxeadores/lookup?identifier=${encodeURIComponent(normalized)}`);
    } catch (err) {
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

    profileState = {
        ...profileState,
        ...data,
        sparringHistory: []
    };

    applyProfileToForm(profileState);
}

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

function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function formatCurrency(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0,00 €';
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    }).format(num);
}

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

function resolvePhotoSrc(photo) {
    const raw = (photo || '').toString().trim();
    if (!raw) return DEFAULT_PHOTO;
    if (raw.startsWith('data:')) return raw;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/')) return `..${raw}`;
    return raw;
}

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

function applyCoachProfileToForm(profile) {
    $('name').value = profile.nombre || localStorage.getItem(STORED_USERNAME_KEY) || '';
    if ($('email')) $('email').value = profile.email || localStorage.getItem(STORED_EMAIL_KEY) || '';
    if ($('gender')) $('gender').value = profile.genero || '';
    $('alias').value = '';
    $('discipline').value = profile.especialidad || 'Boxeo';
    $('location').value = profile.ubicacion || '';
    const gymInput = $('coach-gym');
    const priceInput = $('coach-price');
    if (gymInput) gymInput.value = profile.gimnasio || '';
    if (priceInput) priceInput.value = profile.precioMensual === undefined || profile.precioMensual === null ? '' : String(profile.precioMensual);
    $('profile-photo').src = resolvePhotoSrc(profile.foto);
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function statusLabel(status) {
    const s = (status || '').toString().toLowerCase();
    if (s === 'accepted') return 'Aceptado';
    if (s === 'declined') return 'Rechazado';
    return 'Pendiente';
}

function statusPillClass(status) {
    const s = (status || '').toString().toLowerCase();
    if (s === 'accepted') return 'ok';
    return 'bad';
}

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

async function loadChallenges(email) {
    return requestJson(`/boxeadores/challenges?email=${encodeURIComponent(email)}`);
}

function renderChallenges(data) {
    const card = $('sparring-challenges-card');
    const countEl = $('challenges-count');
    const receivedTbody = $('challenges-received-tbody');
    const sentTbody = $('challenges-sent-tbody');
    if (!card || !countEl || !receivedTbody || !sentTbody) return;

    const received = Array.isArray(data && data.received) ? data.received : [];
    const sent = Array.isArray(data && data.sent) ? data.sent : [];
    countEl.textContent = String(received.length + sent.length);

    receivedTbody.innerHTML = received
        .slice()
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .map((x) => {
            const who = `<strong>${escapeHtml(x.fromNombre || '')}</strong><div class="muted">${escapeHtml(x.fromEmail || '')}</div>`;
            const desc = escapeHtml(x.preset || '');
            const gym = x.gymName ? `<div class="muted">${escapeHtml(x.gymName)}</div>` : '';
            const when = x.scheduledAt ? `<div class="muted">${escapeHtml(formatDateTime(x.scheduledAt))}</div>` : '';
            const pill = `<span class="pill ${statusPillClass(x.status)}">${statusLabel(x.status)}</span>`;
            const coaches = Array.isArray(x.coachNombres) ? x.coachNombres.filter(Boolean) : [];
            const coachesCell = coaches.length ? coaches.map(escapeHtml).join('<br>') : '<span class="muted">—</span>';
            const actions = String(x.status || '').toLowerCase() === 'pending' ? `
                <div class="row-actions">
                    <button class="btn btn-primary" type="button" data-challenge-action="accept" data-challenge-id="${escapeHtml(x.id)}">Aceptar</button>
                    <button class="btn btn-secondary" type="button" data-challenge-action="decline" data-challenge-id="${escapeHtml(x.id)}">Rechazar</button>
                </div>
            ` : '';
            return `
                <tr>
                    <td>${who}</td>
                    <td>${desc}${gym}${when}${x.note ? `<div class="muted">${escapeHtml(x.note)}</div>` : ''}</td>
                    <td>${coachesCell}</td>
                    <td>${pill}</td>
                    <td>${actions}</td>
                </tr>
            `;
        })
        .join('') || `<tr><td colspan="5" class="muted">No tienes retos recibidos.</td></tr>`;

    sentTbody.innerHTML = sent
        .slice()
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .map((x) => {
            const who = `<strong>${escapeHtml(x.toNombre || '')}</strong><div class="muted">${escapeHtml(x.toEmail || '')}</div>`;
            const desc = escapeHtml(x.preset || '');
            const gym = x.gymName ? `<div class="muted">${escapeHtml(x.gymName)}</div>` : '';
            const when = x.scheduledAt ? `<div class="muted">${escapeHtml(formatDateTime(x.scheduledAt))}</div>` : '';
            const pill = `<span class="pill ${statusPillClass(x.status)}">${statusLabel(x.status)}</span>`;
            const coaches = Array.isArray(x.coachNombres) ? x.coachNombres.filter(Boolean) : [];
            const coachesCell = coaches.length ? coaches.map(escapeHtml).join('<br>') : '<span class="muted">—</span>';
            return `
                <tr>
                    <td>${who}</td>
                    <td>${desc}${gym}${when}${x.note ? `<div class="muted">${escapeHtml(x.note)}</div>` : ''}</td>
                    <td>${coachesCell}</td>
                    <td>${pill}</td>
                </tr>
            `;
        })
        .join('') || `<tr><td colspan="4" class="muted">No has enviado retos todavía.</td></tr>`;
}

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

async function loadSessions(email) {
    return requestJson(`/boxeadores/sessions?email=${encodeURIComponent(email)}`);
}

function sessionStatusLabel(status) {
    const s = (status || '').toString().toLowerCase();
    if (s === 'completed') return 'Completado';
    if (s === 'scheduled') return 'Programado';
    return s ? s : '—';
}

function sessionPillClass(status) {
    const s = (status || '').toString().toLowerCase();
    if (s === 'completed') return 'ok';
    return 'bad';
}

function renderSessions(data) {
    const card = $('sparring-sessions-card');
    const countEl = $('sessions-count');
    const tbody = $('sessions-tbody');
    if (!card || !countEl || !tbody) return;

    const email = getEmail();
    const sessions = Array.isArray(data && data.sessions) ? data.sessions : [];
    countEl.textContent = String(sessions.length);

    const rows = sessions
        .slice()
        .sort((a, b) => String(b.scheduledAt || '').localeCompare(String(a.scheduledAt || '')))
        .map((s) => {
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
            const status = `<span class="pill ${sessionPillClass(s.status)}">${escapeHtml(sessionStatusLabel(s.status))}</span>`;
            const reviews = Array.isArray(s.reviews) ? s.reviews : [];
            const alreadyReviewed = email ? reviews.some((r) => r && String(r.byEmail || '').toLowerCase() === email) : false;
            const canReview = !alreadyReviewed;
            const action = canReview ? `
                <button class="btn btn-primary" type="button" data-session-review="${escapeHtml(s.id)}">${String(s.status || '').toLowerCase() === 'completed' ? 'Valorar' : 'Marcar completado'}</button>
            ` : '<span class="muted">—</span>';
            return `
                <tr>
                    <td>${when}</td>
                    <td>${partnerCell}</td>
                    <td>${gym}</td>
                    <td>${coachesCell}</td>
                    <td>${status}</td>
                    <td>${action}</td>
                </tr>
            `;
        })
        .join('');

    tbody.innerHTML = rows || `<tr><td colspan="6" class="muted">Todavía no tienes sesiones programadas.</td></tr>`;
}

async function refreshSessions() {
    const email = getEmail();
    const card = $('sparring-sessions-card');
    if (!card) return;
    try {
        const data = await loadSessions(email);
        card.style.display = '';
        renderSessions(data);
    } catch (err) {
        card.style.display = 'none';
    }
}

function renderHistory() {
    const tbody = $('sparring-tbody');
    const empty = $('empty-state');
    const tableWrap = $('table-wrap');
    const count = $('sparring-count');
    const history = Array.isArray(profileState.sparringHistory) ? profileState.sparringHistory : [];

    count.textContent = `${history.length} registro${history.length === 1 ? '' : 's'}`;

    if (history.length === 0) {
        empty.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        tbody.innerHTML = '';
        return;
    }

    empty.classList.add('hidden');
    tableWrap.classList.remove('hidden');

    tbody.innerHTML = history
        .slice()
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map((item) => {
            const safeNotes = (item.notes || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
            return `
                <tr>
                    <td>${formatDate(item.date)}</td>
                    <td><strong>${item.partner || ''}</strong></td>
                    <td>${item.place || ''}</td>
                    <td class="muted">${safeNotes}</td>
                    <td>
                        <div class="row-actions">
                            <button class="link-danger" type="button" data-delete-id="${item.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');

    tbody.querySelectorAll('[data-delete-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-delete-id');
            profileState.sparringHistory = history.filter((x) => x.id !== id);
            await saveProfileForm(false);
            renderHistory();
        });
    });
}

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

    profileState = {
        ...profileState,
        ...data,
        sparringHistory: Array.isArray(data.sparringHistory) ? data.sparringHistory : []
    };
    applyProfileToForm(profileState);
    renderHistory();
}

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
        if (saved && saved.email && saved.email !== email) {
            localStorage.setItem(STORED_EMAIL_KEY, saved.email);
            if (sessionStorage.getItem(SESSION_MAINTAINED_KEY)) {
                sessionStorage.setItem(STORED_EMAIL_KEY, saved.email);
            }
        }
        applyCoachProfileToForm(saved || {});
        if (showAlert) {
            alert('Perfil guardado en MongoDB.');
        }
        return;
    }

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
        alert('Perfil guardado en MongoDB.');
    }
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function onPhotoSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    profileState.foto = dataUrl;
    $('profile-photo').src = dataUrl;
    await saveProfileForm(false);
    e.target.value = '';
}

async function removePhoto() {
    profileState.foto = '';
    $('profile-photo').src = DEFAULT_PHOTO;
    await saveProfileForm(false);
}

function openSparringModal() {
    const modal = $('sparring-modal');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    $('sp-date').value = `${yyyy}-${mm}-${dd}`;
    $('sp-partner').value = '';
    $('sp-place').value = '';
    $('sp-notes').value = '';

    modal.showModal();
}

function closeSparringModal() {
    $('sparring-modal').close();
}

async function addSparringFromForm(e) {
    e.preventDefault();

    const item = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        date: $('sp-date').value,
        partner: $('sp-partner').value.trim(),
        place: $('sp-place').value.trim(),
        notes: $('sp-notes').value.trim()
    };

    profileState.sparringHistory = Array.isArray(profileState.sparringHistory) ? profileState.sparringHistory : [];
    profileState.sparringHistory.push(item);
    await saveProfileForm(false);
    renderHistory();
    closeSparringModal();
}

document.addEventListener('DOMContentLoaded', async () => {
    const ok = isSessionOk();
    setSessionPill(ok);
    if (!ok) {
        redirectToAuth();
        return;
    }

    const isCoach = getRole() === 'entrenador';
    const viewIdentifier = getViewIdentifier();
    const isViewMode = Boolean(viewIdentifier);
    const isCoachProfile = isCoach && !isViewMode;
    const fromParam = getFromParam();
    const tab = getTabParam();
    const isSparringsTab = tab === 'sparrings';

    const roleTitle = $('profile-role-title');
    if (roleTitle) roleTitle.textContent = isCoachProfile ? 'Entrenador' : 'Boxeador';
    const subtitle = $('profile-subtitle');
    if (subtitle) {
        if (isViewMode) subtitle.textContent = 'Estás viendo un perfil en modo solo lectura.';
        else if (isSparringsTab && !isCoachProfile) subtitle.textContent = 'Tu historial y tus retos de sparring.';
        else subtitle.textContent = isCoachProfile ? 'Tus datos como entrenador.' : 'Tus datos de perfil.';
    }
    const disciplineLabel = $('discipline-label');
    if (disciplineLabel) disciplineLabel.textContent = isCoachProfile ? 'Especialidad' : 'Disciplina';

    const pageTitle = $('profile-title');
    const backSparringBtn = $('btn-back-sparring');
    const saveBtn = $('btn-save-profile');
    const addSparringBtn = $('btn-add-sparring');
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

    if (lookupCard) lookupCard.style.display = !isCoachProfile && !isViewMode && !isSparringsTab ? '' : 'none';

    if (isViewMode) {
        if (pageTitle) pageTitle.textContent = 'Perfil de Boxeador';
        if (backSparringBtn) backSparringBtn.style.display = fromParam === 'sparring' ? '' : 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (addSparringBtn) addSparringBtn.style.display = 'none';
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
        if (backSparringBtn) backSparringBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = isSparringsTab && !isCoachProfile ? 'none' : '';
        if (lookupBanner) lookupBanner.style.display = 'none';
        if (boxerOnlyLevel) boxerOnlyLevel.style.display = 'none';
        if (boxerOnlyGym) boxerOnlyGym.style.display = 'none';
        if (profileCard) profileCard.style.display = isSparringsTab && !isCoachProfile ? 'none' : '';
        setFormReadonly(false);
    }

    if (backSparringBtn) {
        backSparringBtn.addEventListener('click', () => {
            window.location.href = '../sparring/index.html';
        });
    }

    const coachGymField = $('coach-gym-field');
    const coachPriceField = $('coach-price-field');
    if (coachGymField) coachGymField.style.display = isCoachProfile ? '' : 'none';
    if (coachPriceField) coachPriceField.style.display = isCoachProfile ? '' : 'none';

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

    const showMySparrings = !isCoachProfile && !isViewMode && isSparringsTab;
    if (historyCard) historyCard.style.display = showMySparrings ? '' : 'none';
    if (challengesCard) challengesCard.style.display = showMySparrings ? '' : 'none';
    if (sessionsCard) sessionsCard.style.display = showMySparrings ? '' : 'none';
    if (addSparringBtn) addSparringBtn.style.display = showMySparrings ? '' : 'none';
    if (pageTitle && showMySparrings) pageTitle.textContent = 'Mis Sparrings';

    try {
        if (isViewMode) {
            await loadOtherBoxerProfile(viewIdentifier);
            const safeName = ($('name') && $('name').value ? $('name').value : '').trim();
            if (pageTitle) pageTitle.textContent = safeName ? `Perfil de ${safeName}` : 'Perfil de Boxeador';
            if (subtitle) {
                const parts = [];
                if (profileState && profileState.nivel) parts.push(`Nivel: ${profileState.nivel}`);
                if (profileState && profileState.gimnasio) parts.push(`Gimnasio: ${profileState.gimnasio}`);
                subtitle.textContent = parts.length ? parts.join(' · ') : 'Estás viendo un perfil en modo solo lectura.';
            }
        } else {
            await loadProfileFromApi();
            if (!isCoachProfile && showMySparrings) {
                await refreshChallenges();
                await refreshSessions();

                const reviewModal = $('session-review-modal');
                const reviewForm = $('session-review-form');
                const reviewCancel = $('btn-review-cancel');
                const reviewTags = $('review-tags');
                const reviewNote = $('review-note');
                let reviewSessionId = '';

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

                if (reviewCancel && reviewModal) {
                    reviewCancel.addEventListener('click', (e) => {
                        e.preventDefault();
                        resetReview();
                        reviewModal.close();
                    });
                }

                if (reviewTags) {
                    reviewTags.addEventListener('click', (e) => {
                        const chip = e.target && e.target.closest ? e.target.closest('.chip') : null;
                        if (!chip) return;
                        chip.classList.toggle('active');
                    });
                }

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

                if (reviewForm) {
                    reviewForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        if (!reviewSessionId) return;
                        const checked = document.querySelector('input[name="review-stars"]:checked');
                        const stars = checked ? Number(checked.value) : 0;
                        const tags = reviewTags ? Array.from(reviewTags.querySelectorAll('.chip.active')).map((c) => String(c.getAttribute('data-tag') || '').trim()).filter(Boolean) : [];
                        const note = reviewNote ? String(reviewNote.value || '').trim() : '';
                        if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
                            alert('Selecciona una valoración (1-5)');
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
                            await refreshSessions();
                        } catch (err) {
                            alert(err.message || 'No se pudo guardar la valoración');
                        }
                    });
                }

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
                                    action
                                }
                            });
                            await refreshChallenges();
                            await refreshSessions();
                        } catch (err) {
                            alert(err.message || 'No se pudo responder al reto');
                        }
                    });
                }
            }
        }
    } catch (err) {
        alert(err.message || 'No se pudo cargar el perfil');
        if (isViewMode) {
            window.location.href = 'index.html';
        }
    }

    const saveProfileBtn = $('btn-save-profile');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            try {
                await saveProfileForm(true);
            } catch (err) {
                alert(err.message || 'No se pudo guardar el perfil');
            }
        });
    }

    const photoInput = $('photo-input');
    if (photoInput) {
        photoInput.addEventListener('change', async (event) => {
            try {
                if (isViewMode) return;
                await onPhotoSelected(event);
            } catch (err) {
                alert(err.message || 'No se pudo guardar la foto');
            }
        });
    }

    const removePhotoButton = $('btn-remove-photo');
    if (removePhotoButton) {
        removePhotoButton.addEventListener('click', async () => {
            try {
                if (isViewMode) return;
                await removePhoto();
            } catch (err) {
                alert(err.message || 'No se pudo quitar la foto');
            }
        });
    }

    if (!isCoachProfile && !isViewMode) {
        const addSparringButton = $('btn-add-sparring');
        if (addSparringButton) addSparringButton.addEventListener('click', openSparringModal);
        const addFirstBtn = $('btn-add-first');
        if (addFirstBtn) addFirstBtn.addEventListener('click', openSparringModal);
        const cancelBtn = $('btn-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', closeSparringModal);
        const sparringForm = $('sparring-form');
        if (sparringForm) sparringForm.addEventListener('submit', addSparringFromForm);
    }

    if (!isCoachProfile) {
        const viewInput = $('other-boxer-identifier');
        const viewBtn = $('btn-view-boxer');
        const go = () => {
            const val = (viewInput ? viewInput.value : '').toString().trim();
            if (!val) return;
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

    const logoutBtn = $('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
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
