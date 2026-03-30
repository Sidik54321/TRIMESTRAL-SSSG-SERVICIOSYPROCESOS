// Lógica de la página de inicio (home/index.html)

const STORED_USERNAME_KEY = 'gloveup_user_name';
const STORED_EMAIL_KEY = 'gloveup_user_email';
const STORED_USER_ID_KEY = 'gloveup_user_id';
const STORED_USER_ROLE_KEY = 'gloveup_user_role';
const STORED_USER_DNI_KEY = 'gloveup_user_dni';
const SESSION_MAINTAINED_KEY = 'gloveup_session_maintained';
const REGISTERED_KEY = 'gloveup_is_registered';
const API_BASE_URL = (window.localStorage.getItem('gloveup_api_base_url') || 'http://localhost:3000').replace(/\/+$/, '');

const getChartsStore = () => {
    const w = window;
    if (!w.__gloveup_charts_store) {
        w.__gloveup_charts_store = {};
    }
    return w.__gloveup_charts_store;
};

const updateDoughnutChart = (canvas, {
    label,
    value,
    max,
    color
}) => {
    if (!canvas) return;
    const ChartLib = window.Chart;
    if (!ChartLib) return;

    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    const safeMax = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 1;
    const remaining = Math.max(0, safeMax - safeValue);

    const store = getChartsStore();
    const key = canvas.id || label || 'chart';
    const existing = store[key];

    const parentCard = canvas.closest('.metric-card');
    if (parentCard) parentCard.classList.add('has-chart');

    const dataset = [{
        data: [safeValue, remaining],
        backgroundColor: [color || '#111827', 'rgba(0, 0, 0, 0.06)'],
        borderWidth: 0,
        hoverOffset: 2
    }];

    if (existing && existing.data && existing.data.datasets) {
        existing.data.datasets[0].data = dataset[0].data;
        existing.update();
        return;
    }

    store[key] = new ChartLib(canvas, {
        type: 'doughnut',
        data: {
            labels: [label, 'Restante'],
            datasets: dataset
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
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
};

// Función unificada para abrir/cerrar la caja de chat.
export function toggleChatBox() {
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        chatBox.classList.toggle('hidden');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // --- Lógica del Chat ---
    const toggleBtn = document.getElementById('chat-toggle-btn');
    const closeBtn = document.getElementById('chat-close-btn');
    const contactLink = document.getElementById('contacta-link');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleChatBox);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            const chatBox = document.getElementById('chat-box');
            if (chatBox) {
                chatBox.classList.add('hidden');
            }
        });
    }

    if (contactLink) {
        contactLink.addEventListener('click', toggleChatBox);
    }

    // --- Lógica del Menú de Usuario y Sesión ---
    const userIcon = document.getElementById('user-icon');
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    const logoutButton = document.getElementById('logout-button');
    const profileNameSpan = document.getElementById('user-profile-name');
    const storedName = localStorage.getItem(STORED_USERNAME_KEY);

    // 1. Mostrar el nombre del usuario y COMPROBAR SESIÓN
    const isSessionMaintained =
        sessionStorage.getItem(SESSION_MAINTAINED_KEY) === 'true' ||
        localStorage.getItem(SESSION_MAINTAINED_KEY) === 'true';

    if (storedName) {
        const firstName = storedName.split(' ')[0];
        if (profileNameSpan) {
            profileNameSpan.textContent = `¡Hola, ${firstName}!`;
        }
    } else if (profileNameSpan) {
        // Permitir acceso a Home aunque no haya sesión; saludo genérico
        profileNameSpan.textContent = isSessionMaintained ? '¡Hola, Campeón!' : '¡Hola!';
    }

    // 2. Función para alternar el menú
    if (userIcon && userDropdownMenu) {
        userIcon.addEventListener('click', function() {
            userDropdownMenu.classList.toggle('hidden');
        });

        // 3. Cierra el menú si se hace clic fuera de él
        document.addEventListener('click', function(event) {
            if (!userIcon.contains(event.target) && !userDropdownMenu.contains(event.target)) {
                userDropdownMenu.classList.add('hidden');
            }
        });
    }

    // 4. Lógica de cerrar sesión
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            localStorage.removeItem(SESSION_MAINTAINED_KEY);
            sessionStorage.removeItem(SESSION_MAINTAINED_KEY);
            localStorage.removeItem(STORED_USERNAME_KEY);
            localStorage.removeItem(STORED_EMAIL_KEY);
            localStorage.removeItem(REGISTERED_KEY);
            localStorage.removeItem(STORED_USER_ROLE_KEY);
            localStorage.removeItem(STORED_USER_DNI_KEY);
            sessionStorage.removeItem(STORED_USER_ID_KEY);

            alert('Has cerrado sesión correctamente.');
            const authPath = window.location.pathname.includes('/dashboard/') ? '../../auth/index.html' : '../auth/index.html';
            window.location.href = authPath;
        });
    }

    const coachDashboardSection = document.getElementById('coach-dashboard');
    const coachManagementSection = document.getElementById('coach-management');
    const coachGymSection = document.getElementById('coach-gym');
    const coachNavItem = document.getElementById('coach-nav-item');
    const coachGymNavItem = document.getElementById('coach-gym-nav-item');
    const role = (localStorage.getItem(STORED_USER_ROLE_KEY) || 'usuario').toLowerCase();

    if ((coachDashboardSection || coachManagementSection || coachGymSection) && role === 'entrenador') {
        if (coachNavItem) coachNavItem.style.display = '';
        if (coachGymNavItem) coachGymNavItem.style.display = '';

        const updateCoachView = () => {
            const hash = window.location.hash;
            const showManagement = hash === '#coach-management';
            const showGym = hash === '#coach-gym';
            if (coachDashboardSection) coachDashboardSection.style.display = (showManagement || showGym) ? 'none' : '';
            if (coachManagementSection) coachManagementSection.style.display = showManagement ? '' : 'none';
            if (coachGymSection) coachGymSection.style.display = showGym ? '' : 'none';
        };

        updateCoachView();
        window.addEventListener('hashchange', updateCoachView);

        const coachDashboardRoot = document.getElementById('coach-dashboard-root');
        const coachManagementRoot = document.getElementById('coach-management-root');
        if (coachDashboardRoot || coachManagementRoot) return;

        const coachGymInput = document.getElementById('coach-gym');
        const saveGymBtn = document.getElementById('coach-save-gym');
        const coachPriceInput = document.getElementById('coach-price');
        const savePriceBtn = document.getElementById('coach-save-price');
        const boxerEmailInput = document.getElementById('coach-boxer-email');
        const addBoxerBtn = document.getElementById('coach-add-boxer');
        const removeBoxerBtn = document.getElementById('coach-remove-boxer');
        const boxersList = document.getElementById('coach-boxers-list');
        const coachBoxersSearch = document.getElementById('coach-boxers-search');
        const coachBoxersTotal = document.getElementById('coach-boxers-total');
        const coachCreateName = document.getElementById('coach-create-name');
        const coachCreateEmail = document.getElementById('coach-create-email');
        const coachCreateDni = document.getElementById('coach-create-dni');
        const coachCreatePassword = document.getElementById('coach-create-password');
        const coachCreateLevel = document.getElementById('coach-create-level');
        const coachCreateBtn = document.getElementById('coach-create-boxer');
        const coachEditId = document.getElementById('coach-edit-id');
        const coachEditName = document.getElementById('coach-edit-name');
        const coachEditDni = document.getElementById('coach-edit-dni');
        const coachEditLevel = document.getElementById('coach-edit-level');
        const coachSaveBoxerBtn = document.getElementById('coach-save-boxer');
        const coachDeleteBoxerBtn = document.getElementById('coach-delete-boxer');
        const coachTotal = document.getElementById('coach-total');
        const coachGymName = document.getElementById('coach-gym-name');
        const coachBoxersCount = document.getElementById('coach-boxers-count');
        const coachBoxersBar = document.getElementById('coach-boxers-bar');
        const coachInscriptionsMonth = document.getElementById('coach-inscriptions-month');
        const coachInscriptionsBar = document.getElementById('coach-inscriptions-bar');
        const coachPricePill = document.getElementById('coach-price-pill');
        const coachRevenueMonth = document.getElementById('coach-revenue-month');
        const coachRevenueBar = document.getElementById('coach-revenue-bar');
        const coachRevenueSummary = document.getElementById('coach-revenue-summary');
        const coachBoxersChart = document.getElementById('coach-boxers-chart');
        const coachInscriptionsChart = document.getElementById('coach-inscriptions-chart');
        const coachRevenueChart = document.getElementById('coach-revenue-chart');
        const message = document.getElementById('coach-message');
        const coachEmail = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();

        const formatCurrency = (value) => {
            const num = Number(value);
            if (!Number.isFinite(num) || num <= 0) return '0€';
            return `${num.toFixed(2)}€`;
        };

        const showMessage = (text, kind = 'ok') => {
            if (!message) return;
            message.textContent = text;
            message.style.display = 'block';
            message.style.color = kind === 'error' ? '#b91c1c' : '#065f46';
        };

        const requestJson = (path, options = {}) => {
            const method = options.method || 'GET';
            const headers = {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            };
            const config = {
                method,
                headers
            };
            if (options.body !== undefined) {
                config.body = JSON.stringify(options.body);
            }
            return fetch(`${API_BASE_URL}${path}`, config).then(async (res) => {
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(payload.error || `Error ${res.status} en ${path}`);
                }
                return payload;
            });
        };

        const updateCrmMetrics = (metricas) => {
            const precioMensual = metricas && typeof metricas.precioMensual === 'number' ? metricas.precioMensual : 0;
            const boxeadoresActivos = metricas && typeof metricas.boxeadoresActivos === 'number' ? metricas.boxeadoresActivos : 0;
            const inscripcionesMes = metricas && typeof metricas.inscripcionesMes === 'number' ? metricas.inscripcionesMes : 0;
            const ingresosMes = metricas && typeof metricas.ingresosMes === 'number' ? metricas.ingresosMes : 0;

            if (coachGymName) coachGymName.textContent = (metricas && metricas.gimnasio ? metricas.gimnasio : '-') || '-';

            if (coachPriceInput) coachPriceInput.value = precioMensual ? String(precioMensual) : '';
            if (coachPricePill) coachPricePill.textContent = formatCurrency(precioMensual);

            if (coachBoxersCount) coachBoxersCount.textContent = String(boxeadoresActivos);
            if (coachInscriptionsMonth) coachInscriptionsMonth.textContent = String(inscripcionesMes);
            if (coachRevenueMonth) coachRevenueMonth.textContent = formatCurrency(ingresosMes);
            if (coachRevenueSummary) coachRevenueSummary.textContent = formatCurrency(ingresosMes);

            const cap = (n) => Math.max(0, Math.min(100, n));
            const boxerFill = boxeadoresActivos === 0 ? 0 : cap((boxeadoresActivos / 30) * 100);
            const inscFill = inscripcionesMes === 0 ? 0 : cap((inscripcionesMes / 30) * 100);
            const revenueFill = ingresosMes === 0 ? 0 : cap((ingresosMes / (precioMensual * 30 || 1)) * 100);

            if (coachBoxersBar) coachBoxersBar.style.width = `${boxerFill}%`;
            if (coachInscriptionsBar) coachInscriptionsBar.style.width = `${inscFill}%`;
            if (coachRevenueBar) coachRevenueBar.style.width = `${revenueFill}%`;

            updateDoughnutChart(coachBoxersChart, {
                label: 'Boxeadores',
                value: boxeadoresActivos,
                max: 30,
                color: '#111827'
            });
            updateDoughnutChart(coachInscriptionsChart, {
                label: 'Inscripciones',
                value: inscripcionesMes,
                max: 30,
                color: '#6b7280'
            });
            updateDoughnutChart(coachRevenueChart, {
                label: 'Ingresos',
                value: ingresosMes,
                max: Math.max(1, (Number.isFinite(Number(precioMensual)) ? Number(precioMensual) : 0) * 30),
                color: '#9ca3af'
            });
        };

        const fillEditForm = (boxer) => {
            if (!boxer) return;
            if (coachEditId) coachEditId.value = boxer._id || '';
            if (coachEditName) coachEditName.value = boxer.nombre || '';
            if (coachEditDni) coachEditDni.value = boxer.dniLicencia || '';
            if (coachEditLevel) coachEditLevel.value = boxer.nivel || 'Amateur';
        };

        const renderBoxers = (items = []) => {
            if (!boxersList) return;
            boxersList.innerHTML = '';

            const isSparringLayout = boxersList.classList && boxersList.classList.contains('sparring-list');

            if (!Array.isArray(items) || items.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'Todavía no tienes boxeadores asignados.';
                boxersList.appendChild(empty);
                return;
            }
            if (!isSparringLayout) {
                items.forEach((b) => {
                    const card = document.createElement('div');
                    card.className = 'coach-boxer-card';

                    const avatar = document.createElement('div');
                    avatar.className = 'coach-boxer-avatar';
                    avatar.innerHTML = '<i class="fas fa-user-circle"></i>';

                    const main = document.createElement('div');
                    main.className = 'coach-boxer-main';

                    const title = document.createElement('div');
                    title.className = 'coach-boxer-title';

                    const name = document.createElement('div');
                    name.className = 'coach-boxer-name';
                    name.textContent = b.nombre || 'Boxeador';

                    const email = document.createElement('div');
                    email.className = 'coach-boxer-email-text';
                    email.textContent = b.email || '';

                    title.appendChild(name);
                    title.appendChild(email);

                    const meta = document.createElement('div');
                    meta.className = 'coach-boxer-meta';

                    const level = document.createElement('span');
                    level.className = 'coach-boxer-pill';
                    level.textContent = b.nivel || 'Amateur';
                    meta.appendChild(level);

                    if (b.dniLicencia) {
                        const dni = document.createElement('span');
                        dni.className = 'coach-boxer-pill';
                        dni.textContent = b.dniLicencia;
                        meta.appendChild(dni);
                    }

                    if (b.fechaInscripcion) {
                        const date = new Date(b.fechaInscripcion);
                        if (!Number.isNaN(date.getTime())) {
                            const enrolled = document.createElement('span');
                            enrolled.className = 'coach-boxer-pill';
                            enrolled.textContent = date.toLocaleDateString('es-ES');
                            meta.appendChild(enrolled);
                        }
                    }

                    if (b.gimnasio) {
                        const gym = document.createElement('span');
                        gym.className = 'coach-boxer-pill';
                        gym.textContent = b.gimnasio;
                        meta.appendChild(gym);
                    }

                    main.appendChild(title);
                    main.appendChild(meta);

                    const actions = document.createElement('div');
                    actions.style.display = 'flex';
                    actions.style.gap = '10px';
                    actions.style.flexWrap = 'wrap';

                    const editBtn = document.createElement('button');
                    editBtn.type = 'button';
                    editBtn.className = 'btn btn-secondary';
                    editBtn.textContent = 'Editar';
                    editBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        fillEditForm(b);
                        const editField = document.getElementById('coach-edit-name');
                        if (editField) editField.focus();
                    });

                    actions.appendChild(editBtn);

                    card.addEventListener('click', () => {
                        fillEditForm(b);
                    });

                    card.appendChild(avatar);
                    card.appendChild(main);
                    card.appendChild(actions);
                    boxersList.appendChild(card);
                });
                return;
            }

            const levelScore = (nivel = '') => {
                const normalized = String(nivel).toLowerCase();
                if (normalized.includes('principiante')) return 1;
                if (normalized.includes('intermedio')) return 2;
                if (normalized.includes('avanzado')) return 3;
                if (normalized.includes('amateur')) return 4;
                if (normalized.includes('profesional')) return 5;
                return 3;
            };

            const renderStars = (value) => {
                const total = 5;
                const filled = Math.max(0, Math.min(total, Number(value) || 0));
                return new Array(total).fill(0).map((_, idx) => `<i class="${idx < filled ? 'fas' : 'far'} fa-star"></i>`).join('');
            };

            const avatarUrl = new URL('../../assets/images/unnamed-removebg-preview.png', window.location.href).href;

            items.forEach((b, index) => {
                const card = document.createElement('div');
                card.className = 'sparring-card';

                const rank = document.createElement('div');
                rank.className = 'card-rank';
                rank.innerHTML = `<span>#${index + 1}</span>${index === 0 ? '<i class="fas fa-crown"></i>' : ''}`;

                const flag = document.createElement('div');
                flag.className = 'card-flag';
                flag.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;

                const nameBlock = document.createElement('div');
                nameBlock.className = 'card-name';
                nameBlock.innerHTML = `
                    <span class="main-name">${b.nombre || 'Boxeador'}</span>
                    <span class="alias">${b.email || ''}</span>
                `;

                const stars = document.createElement('div');
                stars.className = 'card-stars';
                stars.innerHTML = renderStars(levelScore(b.nivel || ''));

                const division = document.createElement('div');
                division.className = 'card-division';
                division.textContent = b.dniLicencia ? b.dniLicencia : 'DNI no especificado';

                const record = document.createElement('div');
                record.className = 'card-record';
                record.textContent = b.nivel ? String(b.nivel) : 'Nivel -';

                const residence = document.createElement('div');
                residence.className = 'card-residence';
                const date = b.fechaInscripcion ? new Date(b.fechaInscripcion) : null;
                const when = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-ES') : '';
                residence.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${(b.gimnasio || 'Gimnasio -')}${when ? ` · ${when}` : ''}`;

                const action = document.createElement('div');
                action.className = 'card-action';

                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'view-profile-button';
                editBtn.textContent = 'Editar';
                editBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    fillEditForm(b);
                    const editField = document.getElementById('coach-edit-name');
                    if (editField) editField.focus();
                });

                action.appendChild(editBtn);

                card.addEventListener('click', () => {
                    fillEditForm(b);
                });

                card.appendChild(rank);
                card.appendChild(flag);
                card.appendChild(nameBlock);
                card.appendChild(stars);
                card.appendChild(division);
                card.appendChild(record);
                card.appendChild(residence);
                card.appendChild(action);

                boxersList.appendChild(card);
            });
        };

        let coachBoxersCache = [];

        const applyBoxersFilter = () => {
            const query = (coachBoxersSearch ? coachBoxersSearch.value : '').toString().trim().toLowerCase();
            if (!query) {
                if (coachBoxersTotal) coachBoxersTotal.textContent = `${coachBoxersCache.length} Boxeadores`;
                renderBoxers(coachBoxersCache);
                return;
            }
            const filtered = coachBoxersCache.filter((b) => {
                const nombre = (b && b.nombre ? String(b.nombre) : '').toLowerCase();
                const email = (b && b.email ? String(b.email) : '').toLowerCase();
                const dni = (b && b.dniLicencia ? String(b.dniLicencia) : '').toLowerCase();
                return nombre.includes(query) || email.includes(query) || dni.includes(query);
            });
            if (coachBoxersTotal) coachBoxersTotal.textContent = `${filtered.length} Boxeadores`;
            renderBoxers(filtered);
        };

        if (coachBoxersSearch) {
            coachBoxersSearch.addEventListener('input', applyBoxersFilter);
        }

        const loadCoachProfile = async () => {
            if (!coachEmail) return;
            const coach = await requestJson(`/api/entrenadores/me?email=${encodeURIComponent(coachEmail)}`);
            const gym = coach && coach.gimnasio ? String(coach.gimnasio) : '';
            if (coachGymInput) coachGymInput.value = gym;
            if (coachGymName) coachGymName.textContent = gym || '-';
            if (coachPriceInput && coach && typeof coach.precioMensual === 'number') {
                coachPriceInput.value = coach.precioMensual ? String(coach.precioMensual) : '';
            }
        };

        const loadBoxers = async () => {
            if (!coachEmail) return;
            const items = await requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(coachEmail)}`);
            coachBoxersCache = Array.isArray(items) ? items : [];
            applyBoxersFilter();
        };

        const loadCrmMetrics = async () => {
            if (!coachEmail) return;
            const metricas = await requestJson(`/api/entrenadores/me/metricas?email=${encodeURIComponent(coachEmail)}`);
            updateCrmMetrics(metricas);
        };

        const loadCobros = async () => {
            if (!coachEmail || !coachTotal) return;
            const data = await requestJson(`/api/entrenadores/me/cobros?email=${encodeURIComponent(coachEmail)}`);
            coachTotal.textContent = typeof data.total === 'number' ? `${data.total}€` : '0€';
        };

        const refreshAll = async () => {
            try {
                await loadCoachProfile();
                await loadBoxers();
                await loadCrmMetrics();
                await loadCobros();
            } catch (err) {
                showMessage(err.message || 'No se pudo cargar la sección de entrenador.', 'error');
            }
        };

        if (saveGymBtn) {
            saveGymBtn.addEventListener('click', async () => {
                try {
                    const gym = (coachGymInput ? coachGymInput.value || '' : '').trim();
                    await requestJson(`/api/entrenadores/me?email=${encodeURIComponent(coachEmail)}`, {
                        method: 'PUT',
                        body: {
                            gimnasio: gym
                        }
                    });
                    showMessage('Gimnasio guardado.');
                    await loadBoxers();
                } catch (err) {
                    showMessage(err.message || 'No se pudo guardar el gimnasio.', 'error');
                }
            });
        }

        if (savePriceBtn) {
            savePriceBtn.addEventListener('click', async () => {
                try {
                    const raw = coachPriceInput ? coachPriceInput.value : '0';
                    const value = Number(raw);
                    const safe = Number.isFinite(value) && value >= 0 ? value : 0;
                    await requestJson(`/api/entrenadores/me?email=${encodeURIComponent(coachEmail)}`, {
                        method: 'PUT',
                        body: {
                            precioMensual: safe
                        }
                    });
                    if (coachPricePill) coachPricePill.textContent = formatCurrency(safe);
                    showMessage('Precio guardado.');
                    await refreshAll();
                } catch (err) {
                    showMessage(err.message || 'No se pudo guardar el precio.', 'error');
                }
            });
        }

        if (addBoxerBtn) {
            addBoxerBtn.addEventListener('click', async () => {
                try {
                    const boxerIdentifier = (boxerEmailInput ? boxerEmailInput.value || '' : '').trim();
                    if (!boxerIdentifier) {
                        showMessage('Indica el email o DNI/Licencia del boxeador.', 'error');
                        return;
                    }
                    await requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(coachEmail)}`, {
                        method: 'POST',
                        body: {
                            boxeadorIdentifier: boxerIdentifier
                        }
                    });
                    showMessage('Boxeador añadido al gimnasio.');
                    if (boxerEmailInput) boxerEmailInput.value = '';
                    await refreshAll();
                } catch (err) {
                    showMessage(err.message || 'No se pudo añadir el boxeador.', 'error');
                }
            });
        }

        if (removeBoxerBtn) {
            removeBoxerBtn.addEventListener('click', async () => {
                try {
                    const boxerIdentifier = (boxerEmailInput ? boxerEmailInput.value || '' : '').trim();
                    if (!boxerIdentifier) {
                        showMessage('Indica el email o DNI/Licencia del boxeador.', 'error');
                        return;
                    }
                    await requestJson(`/api/entrenadores/me/boxeadores?email=${encodeURIComponent(coachEmail)}`, {
                        method: 'DELETE',
                        body: {
                            boxeadorIdentifier: boxerIdentifier
                        }
                    });
                    showMessage('Boxeador quitado del gimnasio.');
                    if (boxerEmailInput) boxerEmailInput.value = '';
                    await refreshAll();
                } catch (err) {
                    showMessage(err.message || 'No se pudo quitar el boxeador.', 'error');
                }
            });
        }

        if (coachCreateBtn) {
            coachCreateBtn.addEventListener('click', async () => {
                try {
                    const nombre = (coachCreateName ? coachCreateName.value : '').trim();
                    const email = (coachCreateEmail ? coachCreateEmail.value : '').trim().toLowerCase();
                    const dniLicencia = (coachCreateDni ? coachCreateDni.value : '').trim().toUpperCase();
                    const password = (coachCreatePassword ? coachCreatePassword.value : '').trim();
                    const nivel = coachCreateLevel ? coachCreateLevel.value : 'Amateur';

                    if (!nombre || !email || !dniLicencia || !password) {
                        throw new Error('Completa nombre, email, DNI/Licencia y password.');
                    }

                    await requestJson(`/api/entrenadores/me/boxeadores/create?email=${encodeURIComponent(coachEmail)}`, {
                        method: 'POST',
                        body: {
                            nombre,
                            email,
                            dniLicencia,
                            password,
                            nivel,
                            disciplina: 'Boxeo'
                        }
                    });

                    if (coachCreateName) coachCreateName.value = '';
                    if (coachCreateEmail) coachCreateEmail.value = '';
                    if (coachCreateDni) coachCreateDni.value = '';
                    if (coachCreatePassword) coachCreatePassword.value = '';
                    if (coachCreateLevel) coachCreateLevel.value = 'Amateur';

                    showMessage('Boxeador creado.');
                    await refreshAll();
                } catch (err) {
                    showMessage(err.message || 'No se pudo crear el boxeador.', 'error');
                }
            });
        }

        if (coachSaveBoxerBtn) {
            coachSaveBoxerBtn.addEventListener('click', async () => {
                try {
                    const id = (coachEditId ? coachEditId.value : '').trim();
                    if (!id) throw new Error('Selecciona un boxeador para editar.');

                    const nombre = (coachEditName ? coachEditName.value : '').trim();
                    const dniLicencia = (coachEditDni ? coachEditDni.value : '').trim().toUpperCase();
                    const nivel = coachEditLevel ? coachEditLevel.value : undefined;

                    await requestJson(`/api/entrenadores/me/boxeadores/${encodeURIComponent(id)}?email=${encodeURIComponent(coachEmail)}`, {
                        method: 'PUT',
                        body: {
                            nombre,
                            dniLicencia,
                            nivel
                        }
                    });

                    showMessage('Cambios guardados.');
                    await refreshAll();
                } catch (err) {
                    showMessage(err.message || 'No se pudieron guardar los cambios.', 'error');
                }
            });
        }

        if (coachDeleteBoxerBtn) {
            coachDeleteBoxerBtn.addEventListener('click', async () => {
                try {
                    const id = (coachEditId ? coachEditId.value : '').trim();
                    if (!id) throw new Error('Selecciona un boxeador para eliminar.');

                    await requestJson(`/api/entrenadores/me/boxeadores/${encodeURIComponent(id)}?email=${encodeURIComponent(coachEmail)}`, {
                        method: 'DELETE'
                    });

                    if (coachEditId) coachEditId.value = '';
                    if (coachEditName) coachEditName.value = '';
                    if (coachEditDni) coachEditDni.value = '';
                    if (coachEditLevel) coachEditLevel.value = 'Amateur';

                    showMessage('Boxeador eliminado.');
                    await refreshAll();
                } catch (err) {
                    showMessage(err.message || 'No se pudo eliminar el boxeador.', 'error');
                }
            });
        }

        refreshAll();
    }

    const boxerSparringsMonthPill = document.getElementById('boxer-sparrings-month');
    const boxerSparringsMinutesPill = document.getElementById('boxer-sparrings-minutes');
    const boxerSparringsPendingPill = document.getElementById('boxer-sparrings-pending');
    const boxerSparringsChart = document.getElementById('boxer-sparrings-chart');
    const boxerMinutesChart = document.getElementById('boxer-minutes-chart');
    const boxerPendingChart = document.getElementById('boxer-pending-chart');

    if (role === 'boxeador' && (boxerSparringsMonthPill || boxerSparringsChart || boxerMinutesChart || boxerPendingChart)) {
        const email = (localStorage.getItem(STORED_EMAIL_KEY) || '').trim().toLowerCase();
        if (email) {
            const requestJson = (path, options = {}) => {
                const method = options.method || 'GET';
                const headers = {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                };
                const config = {
                    method,
                    headers
                };
                if (options.body !== undefined) {
                    config.body = JSON.stringify(options.body);
                }
                return fetch(`${API_BASE_URL}${path}`, config).then(async (res) => {
                    const payload = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error(payload.error || `Error ${res.status} en ${path}`);
                    }
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

            requestJson(`/api/boxeadores/me?email=${encodeURIComponent(email)}`)
                .then((profile) => {
                    const history = profile && Array.isArray(profile.sparringHistory) ? profile.sparringHistory : [];
                    const sparringsMonth = history.filter((x) => inCurrentMonth(x && x.date ? String(x.date) : '')).length;
                    const minutes = 0;
                    const pending = 0;

                    if (boxerSparringsMonthPill) boxerSparringsMonthPill.textContent = String(sparringsMonth);
                    if (boxerSparringsMinutesPill) boxerSparringsMinutesPill.textContent = String(minutes);
                    if (boxerSparringsPendingPill) boxerSparringsPendingPill.textContent = String(pending);

                    updateDoughnutChart(boxerSparringsChart, {
                        label: 'Sparrings',
                        value: sparringsMonth,
                        max: 10,
                        color: '#111827'
                    });
                    updateDoughnutChart(boxerMinutesChart, {
                        label: 'Minutos',
                        value: minutes,
                        max: 300,
                        color: '#2563eb'
                    });
                    updateDoughnutChart(boxerPendingChart, {
                        label: 'Pendientes',
                        value: pending,
                        max: 10,
                        color: '#b45309'
                    });
                })
                .catch(() => {
                    updateDoughnutChart(boxerSparringsChart, {
                        label: 'Sparrings',
                        value: 0,
                        max: 10,
                        color: '#111827'
                    });
                    updateDoughnutChart(boxerMinutesChart, {
                        label: 'Minutos',
                        value: 0,
                        max: 300,
                        color: '#2563eb'
                    });
                    updateDoughnutChart(boxerPendingChart, {
                        label: 'Pendientes',
                        value: 0,
                        max: 10,
                        color: '#b45309'
                    });
                });
        }
    }
});
