const defaultGyms = [];

let gyms = defaultGyms.slice();

function slugify(text) {
    return (text || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

function normalizeGymKey(text) {
    const value = (text || '').toString().trim().toLowerCase();
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function requestJson(url, options = {}) {
    const _glv_h = window.location.hostname;
    const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
    const API_BASE_URL = (window.localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');
    const path = String(url || '');
    const fullUrl = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    const res = await fetch(fullUrl, {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message = data && data.error ? data.error : `HTTP ${res.status}`;
        throw new Error(message);
    }
    return data;
}

async function loadGymsFromApi() {
    try {
        const items = await requestJson('/api/gimnasios');
        const apiGyms = Array.isArray(items) ? items : [];
        const mapped = apiGyms.map((g) => ({
            name: g && g.nombre ? String(g.nombre) : '',
            city: g && g.ubicacion ? String(g.ubicacion) : '',
            lat: g && typeof g.lat === 'number' ? g.lat : null,
            lng: g && typeof g.lng === 'number' ? g.lng : null,
            _id: g && g._id ? String(g._id) : '',
            key: g && g.key ? String(g.key) : normalizeGymKey(g && g.nombre ? String(g.nombre) : ''),
            bio: g && typeof g.bio === 'string' ? g.bio : '',
            fotos: Array.isArray(g && g.fotos) ? g.fotos.filter((f) => typeof f === 'string' && f.trim()).slice(0, 12) : [],
            fotoPerfil: g && g.fotoPerfil ? String(g.fotoPerfil) : '',
            correoContacto: g && g.correoContacto ? String(g.correoContacto) : '',
            telefono: g && g.telefono ? String(g.telefono) : '',
            horario: g && g.horario ? String(g.horario) : '',
            nombreEntrenador: g && g.nombreEntrenador ? String(g.nombreEntrenador) : ''
        })).filter((g) => g.name);
        return mapped;
    } catch {
        return [];
    }
}

async function loadCurrentUserGym() {
    const email = (localStorage.getItem('gloveup_user_email') || '').trim().toLowerCase();
    const role = (localStorage.getItem('gloveup_user_role') || '').toLowerCase();
    if (!email || (role !== 'boxeador' && role !== 'entrenador')) return null;
    try {
        let gymName = '';
        if (role === 'boxeador') {
            const data = await requestJson(`/api/boxeadores/me?email=${encodeURIComponent(email)}`);
            gymName = data && data.gimnasio ? String(data.gimnasio) : '';
        } else {
            const data = await requestJson(`/api/entrenadores/me?email=${encodeURIComponent(email)}`);
            gymName = data && data.gimnasio ? String(data.gimnasio) : '';
        }
        return gymName ? { name: gymName, key: normalizeGymKey(gymName), email, role } : null;
    } catch {
        return null;
    }
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:var(--color-bg,#1a1a2e);color:var(--color-text,#f1f5f9);border-radius:14px;padding:28px 24px 22px;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.45);border:1px solid var(--color-border,rgba(255,255,255,.08));';
        modal.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <i class="fas fa-exclamation-triangle" style="color:#f59e0b;font-size:1.4rem;flex-shrink:0;"></i>
                <p style="margin:0;font-size:.95rem;line-height:1.5;">${message}</p>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="glv-confirm-cancel" style="padding:8px 18px;border-radius:8px;border:1px solid var(--color-border,rgba(255,255,255,.15));background:transparent;color:var(--color-text,#f1f5f9);font-size:.875rem;font-weight:600;cursor:pointer;">Cancelar</button>
                <button id="glv-confirm-ok" style="padding:8px 18px;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:.875rem;font-weight:700;cursor:pointer;">Abandonar</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const close = (result) => { overlay.remove(); resolve(result); };
        modal.querySelector('#glv-confirm-ok').addEventListener('click', () => close(true));
        modal.querySelector('#glv-confirm-cancel').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
}

async function leaveGym(email, role) {
    const confirmed = await showConfirm('¿Seguro que quieres abandonar el gimnasio? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
        const endpoint = role === 'boxeador'
            ? `/api/boxeadores/me/leave-gym?email=${encodeURIComponent(email)}`
            : `/api/entrenadores/me/leave-gym?email=${encodeURIComponent(email)}`;
        await requestJson(endpoint, { method: 'POST' });
        window.location.reload();
    } catch (err) {
        if (typeof window.showToast === 'function') {
            window.showToast('Error al abandonar el gimnasio: ' + (err && err.message ? err.message : 'Error desconocido'), 'error');
        }
    }
}

async function loadBoxers() {
    try {
        const items = await requestJson('/api/boxeadores');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

function getFavorites() {
    try {
        const raw = localStorage.getItem('gloveup_gym_favorites') || '[]';
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function setFavorites(favs) {
    localStorage.setItem('gloveup_gym_favorites', JSON.stringify(favs));
}

function toggleFavorite(name) {
    const favs = getFavorites();
    const idx = favs.indexOf(name);
    if (idx >= 0) {
        favs.splice(idx, 1);
    } else {
        favs.push(name);
    }
    setFavorites(favs);
    return favs.includes(name);
}

async function initGymsMap() {
    const mapContainer = document.getElementById('gyms-map');
    if (!mapContainer || !window.L) return;

    const validGyms = gyms.filter((g) => typeof g.lat === 'number' && typeof g.lng === 'number');
    const defaultCenter = validGyms.length > 0
        ? [validGyms[0].lat, validGyms[0].lng]
        : [40.4168, -3.7038];

    const map = L.map(mapContainer).setView(defaultCenter, 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    validGyms.forEach((gym) => {
        const gymKey = gym.key || slugify(gym.name);
        const directionsUrl = `https://www.openstreetmap.org/directions?from=&to=${gym.lat},${gym.lng}`;
        const marker = L.marker([gym.lat, gym.lng]).addTo(map);
        marker.bindPopup(`
            <div style="font-family:sans-serif;min-width:150px;padding:4px 0;">
                <strong style="font-size:.95rem;">${gym.name}</strong><br>
                <span style="color:#666;font-size:.82rem;">${gym.city || ''}</span><br>
                <a href="${directionsUrl}" target="_blank" rel="noopener"
                   style="font-size:.82rem;color:#1a73e8;text-decoration:none;display:inline-block;margin-top:6px;">
                    Cómo llegar ↗
                </a>
                <br>
                <a href="gym.html?key=${encodeURIComponent(gymKey)}"
                   style="font-size:.82rem;color:#1a73e8;text-decoration:none;display:inline-block;margin-top:4px;">
                    Ver gimnasio →
                </a>
            </div>
        `);
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const userLat = pos.coords.latitude;
                const userLng = pos.coords.longitude;
                L.circleMarker([userLat, userLng], {
                    radius: 9,
                    fillColor: '#4285f4',
                    fillOpacity: 1,
                    color: '#fff',
                    weight: 2
                }).addTo(map).bindPopup('Tu ubicación');

                if (validGyms.length > 0) {
                    const allPoints = [[userLat, userLng], ...validGyms.map((g) => [g.lat, g.lng])];
                    map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30] });
                } else {
                    map.setView([userLat, userLng], 13);
                }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }

    // Address search with Nominatim
    const searchInput = document.getElementById('map-search-input');
    const searchBtn = document.getElementById('map-search-btn');
    let searchMarker = null;

    async function searchLocation() {
        const q = searchInput ? searchInput.value.trim() : '';
        if (!q) return;
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
                { headers: { 'Accept-Language': 'es' } }
            );
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                if (searchMarker) searchMarker.remove();
                searchMarker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: '',
                        html: '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.4);"></div>',
                        iconAnchor: [7, 7]
                    })
                }).addTo(map).bindPopup(`<b>${data[0].display_name}</b>`).openPopup();
                map.setView([lat, lon], 14);
            } else {
                if (typeof window.showToast === 'function') {
                    window.showToast('No se encontró la ubicación buscada.', 'error');
                }
            }
        } catch {
            if (typeof window.showToast === 'function') {
                window.showToast('Error al buscar la ubicación.', 'error');
            }
        }
    }

    if (searchBtn) searchBtn.addEventListener('click', searchLocation);
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchLocation();
        });
    }
}

function buildGymCard(gym, userGym) {
    const isMyGym = userGym && userGym.key === gym.key;

    const card = document.createElement('div');
    card.className = 'gym-card';
    card.dataset.name = gym.name;
    card.dataset.city = gym.city || '';
    if (isMyGym) {
        card.style.border = '2px solid var(--color-accent, #f59e0b)';
        card.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.15)';
    }

    const image = document.createElement('div');
    image.className = 'gym-image';
    const fallbackImage = "../assets/images/Sparring_Club_Collection-Link-Image.jpg";
    const mainFoto = gym.fotoPerfil || (Array.isArray(gym.fotos) && gym.fotos.length ? gym.fotos[0] : '');
    image.style.backgroundImage = `url('${mainFoto || fallbackImage}')`;
    image.style.backgroundSize = 'cover';
    image.style.backgroundPosition = 'center';

    if (isMyGym) {
        const myBadge = document.createElement('div');
        myBadge.style.cssText = 'position:absolute;top:10px;left:10px;background:#f59e0b;color:#fff;font-size:.7rem;font-weight:800;text-transform:uppercase;padding:4px 10px;border-radius:20px;letter-spacing:.05em;display:flex;align-items:center;gap:5px;box-shadow:0 2px 6px rgba(0,0,0,.2);';
        myBadge.innerHTML = '<i class="fas fa-map-marker-alt"></i> Mi Gimnasio';
        image.style.position = 'relative';
        image.appendChild(myBadge);
    }

    const favBtn = document.createElement('button');
    favBtn.className = 'fav-btn';
    const favIcon = document.createElement('i');
    favIcon.className = 'far fa-heart';
    favBtn.appendChild(favIcon);
    image.appendChild(favBtn);

    const info = document.createElement('div');
    info.className = 'gym-info';

    const header = document.createElement('div');
    header.className = 'gym-header';

    const nameEl = document.createElement('h2');
    nameEl.className = 'gym-name';
    nameEl.textContent = gym.name;

    const rating = document.createElement('div');
    rating.className = 'gym-rating';
    rating.innerHTML = '<i class="fas fa-star"></i> - <span>(0 reseñas)</span>';

    header.appendChild(nameEl);
    header.appendChild(rating);

    const location = document.createElement('p');
    location.className = 'gym-location';
    const locIcon = document.createElement('i');
    locIcon.className = 'fas fa-map-marker-alt';
    location.appendChild(locIcon);
    location.appendChild(document.createTextNode(` ${gym.city || 'Ubicación no indicada'}`));
    
    // Gym Meta Tags (Trainer & Hours)
    const metaTags = document.createElement('div');
    metaTags.style.display = 'flex';
    metaTags.style.flexWrap = 'wrap';
    metaTags.style.gap = '12px';
    metaTags.style.marginTop = '8px';
    metaTags.style.marginBottom = '8px';
    metaTags.style.fontSize = '0.8rem';
    metaTags.style.color = 'var(--color-text-lighter)';

    if (gym.nombreEntrenador) {
        const tag = document.createElement('span');
        tag.innerHTML = `<i class="fas fa-user-tie" style="color:var(--color-accent);margin-right:4px;"></i> ${gym.nombreEntrenador}`;
        metaTags.appendChild(tag);
    }
    if (gym.horario) {
        const tag = document.createElement('span');
        tag.innerHTML = `<i class="fas fa-clock" style="color:var(--color-accent);margin-right:4px;"></i> ${gym.horario}`;
        metaTags.appendChild(tag);
    }
    const details = document.createElement('p');
    details.className = 'gym-details';
    const bio = gym && typeof gym.bio === 'string' ? gym.bio.trim() : '';
    let bioShort = bio;
    const MAX_BIO = 100;
    if (bioShort.length > MAX_BIO) {
        bioShort = bioShort.substring(0, MAX_BIO) + '...';
    }
    details.textContent = bioShort || '';

    const footer = document.createElement('div');
    footer.className = 'gym-footer';

    const price = document.createElement('span');
    price.className = 'gym-price';
    price.innerHTML = 'Desde <strong>-</strong>/mes';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'view-gym-button';
    viewBtn.type = 'button';
    viewBtn.textContent = 'Ver gimnasio';

    footer.appendChild(price);
    footer.appendChild(viewBtn);

    if (isMyGym) {
        const leaveBtn = document.createElement('button');
        leaveBtn.type = 'button';
        leaveBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Abandonar';
        leaveBtn.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:.8rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s;';
        leaveBtn.addEventListener('mouseenter', () => { leaveBtn.style.background = '#ef4444'; leaveBtn.style.color = '#fff'; });
        leaveBtn.addEventListener('mouseleave', () => { leaveBtn.style.background = 'transparent'; leaveBtn.style.color = '#ef4444'; });
        leaveBtn.addEventListener('click', (e) => { e.stopPropagation(); leaveGym(userGym.email, userGym.role); });
        footer.appendChild(leaveBtn);
    }

    info.appendChild(header);
    info.appendChild(location);
    if (metaTags.hasChildNodes()) info.appendChild(metaTags);
    if (bioShort) info.appendChild(details);
    info.appendChild(footer);

    card.appendChild(image);
    card.appendChild(info);

    viewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = gym.key || normalizeGymKey(gym.name);
        window.location.href = 'gym.html?key=' + encodeURIComponent(key);
    });

    favBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleFavorite(gym.name);
        const favs = getFavorites();
        const isFav = favs.includes(gym.name);
        favIcon.classList.toggle('fas', isFav);
        favIcon.classList.toggle('far', !isFav);
    });

    return card;
}

async function initGymsUi() {
    const listEl = document.getElementById('gym-list') || document.querySelector('.gym-list');
    const paginationEl = document.getElementById('gyms-pagination');
    if (!listEl || !paginationEl) return;

    const [apiGyms, userGym] = await Promise.all([loadGymsFromApi(), loadCurrentUserGym()]);
    const merged = [];
    const seen = new Set();
    apiGyms.forEach((g) => {
        const key = g.key || normalizeGymKey(g.name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push({ ...g, key });
    });
    defaultGyms.forEach((g) => {
        const key = normalizeGymKey(g.name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push({ ...g, key });
    });

    // Pin the user's gym first
    if (userGym) {
        merged.sort((a, b) => {
            const aIsMine = a.key === userGym.key ? -1 : 0;
            const bIsMine = b.key === userGym.key ? 1 : 0;
            return aIsMine + bIsMine;
        });
    }

    gyms = merged.slice();

    const myGymSection = document.getElementById('my-gym-section');
    const myGymContainer = document.getElementById('my-gym-card-container');

    listEl.innerHTML = '';
    if (myGymContainer) myGymContainer.innerHTML = '';

    gyms.forEach((g) => {
        const isMyGym = userGym && userGym.key === g.key;
        if (isMyGym && myGymContainer) {
            myGymContainer.appendChild(buildGymCard(g, userGym));
        } else {
            listEl.appendChild(buildGymCard(g, userGym));
        }
    });

    if (myGymSection && myGymContainer && myGymContainer.hasChildNodes()) {
        myGymSection.style.display = '';
    }

    const allCards = Array.from(listEl.querySelectorAll('.gym-card'));
    const pageSize = 10;
    let currentPage = 1;
    let filteredCards = allCards.slice();

    const resultsTitle = document.querySelector('.results-header h2');
    const mapSection = document.querySelector('.map-section-container');

    const mainSearchInput = document.querySelector('.main-search-bar .search-input');
    const mainSearchButton = document.querySelector('.main-search-bar .search-button');

    const sidebarLocationInput = document.querySelector('.filter-sidebar .search-input-wrapper input');
    const typeCheckboxes = Array.from(document.querySelectorAll('.filter-sidebar .checkbox-container input[type="checkbox"]'));
    const ratingRadios = Array.from(document.querySelectorAll('.filter-sidebar input[type="radio"][name="rating"]'));
    const applyFiltersBtn = document.querySelector('.filter-sidebar .apply-filters');

    const viewButtons = Array.from(document.querySelectorAll('.results-header .view-options .view-btn'));
    const listSection = document.querySelector('.results-container');

    const getCardName = (card) => {
        const el = card.querySelector('.gym-name');
        return (el ? el.textContent : '') || '';
    };

    const getCardLocation = (card) => {
        const el = card.querySelector('.gym-location');
        return (el ? el.textContent : '') || '';
    };

    const renderPagination = (page, totalPages) => {
        paginationEl.innerHTML = '';
        if (totalPages <= 1) return;

        const addPage = (p, label = null, active = false, disabled = false) => {
            if (active || disabled) {
                const el = document.createElement('span');
                el.className = active ? 'page-number active' : 'page-number';
                el.textContent = label || String(p);
                if (disabled) el.style.opacity = '0.4';
                paginationEl.appendChild(el);
                return;
            }
            const el = document.createElement('a');
            el.href = '#';
            el.className = 'page-number';
            el.dataset.page = String(p);
            el.textContent = label || String(p);
            paginationEl.appendChild(el);
        };

        const addEllipsis = () => {
            const el = document.createElement('span');
            el.textContent = '...';
            paginationEl.appendChild(el);
        };

        const prev = Math.max(1, page - 1);
        const next = Math.min(totalPages, page + 1);
        addPage(prev, '<', false, page === 1);

        if (totalPages <= 7) {
            for (let p = 1; p <= totalPages; p += 1) {
                addPage(p, null, p === page);
            }
        } else {
            addPage(1, null, page === 1);
            const left = Math.max(2, page - 1);
            const right = Math.min(totalPages - 1, page + 1);
            if (left > 2) addEllipsis();
            for (let p = left; p <= right; p += 1) {
                addPage(p, null, p === page);
            }
            if (right < totalPages - 1) addEllipsis();
            addPage(totalPages, null, page === totalPages);
        }

        addPage(next, '>', false, page === totalPages);
    };

    const computeFiltered = () => {
        const q = (mainSearchInput ? mainSearchInput.value : '').toString().trim().toLowerCase();
        const loc = (sidebarLocationInput ? sidebarLocationInput.value : '').toString().trim().toLowerCase();

        filteredCards = allCards.filter((card) => {
            const name = getCardName(card).toLowerCase();
            const locationText = getCardLocation(card).toLowerCase();

            if (q && !name.includes(q) && !locationText.includes(q)) return false;
            if (loc && !locationText.includes(loc)) return false;
            return true;
        });
    };

    const render = () => {
        computeFiltered();
        const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
        const safePage = Math.min(Math.max(1, currentPage), totalPages);
        currentPage = safePage;

        const start = (safePage - 1) * pageSize;
        const end = start + pageSize;

        allCards.forEach((card) => {
            card.style.display = 'none';
        });
        filteredCards.slice(start, end).forEach((card) => {
            card.style.display = '';
        });

        if (resultsTitle) {
            resultsTitle.textContent = `Gimnasios Destacados (${filteredCards.length})`;
        }

        renderPagination(safePage, totalPages);
    };

    paginationEl.addEventListener('click', (e) => {
        const target = e.target;
        if (!target || !target.classList || !target.classList.contains('page-number')) return;
        const pageStr = target.dataset && target.dataset.page ? String(target.dataset.page) : '';
        if (!pageStr) return;
        e.preventDefault();
        const nextPage = Number(pageStr);
        if (!Number.isFinite(nextPage)) return;
        currentPage = nextPage;
        render();
    });

    const runSearch = (e) => {
        if (e) e.preventDefault();
        currentPage = 1;
        render();
    };

    if (mainSearchButton) mainSearchButton.addEventListener('click', runSearch);
    if (mainSearchInput) {
        mainSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runSearch(e);
        });
    }

    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', runSearch);

    const favs = getFavorites();
    allCards.forEach((card) => {
        const name = getCardName(card).trim();
        const icon = card.querySelector('.fav-btn i');
        if (!icon || !name) return;
        const isFav = favs.includes(name);
        icon.classList.toggle('fas', isFav);
        icon.classList.toggle('far', !isFav);
    });

    if (viewButtons.length >= 2) {
        const listBtn = viewButtons[0];
        const mapBtn = viewButtons[1];

        listBtn.addEventListener('click', (e) => {
            e.preventDefault();
            viewButtons.forEach((b) => b.classList.remove('active'));
            listBtn.classList.add('active');
            if (listSection) listSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });

        mapBtn.addEventListener('click', (e) => {
            e.preventDefault();
            viewButtons.forEach((b) => b.classList.remove('active'));
            mapBtn.classList.add('active');
            if (mapSection) mapSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    }

    render();
}

document.addEventListener('DOMContentLoaded', () => {
    initGymsUi().then(() => initGymsMap());
});