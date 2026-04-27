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
    const API_BASE_URL = (window.localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${window.location.hostname}:3000` : '')).replace(/\/+$/, '');
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

function createMap(centerLat, centerLng) {
    const map = L.map('gyms-map').setView([centerLat, centerLng], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const favs = getFavorites();
    gyms.forEach((gym) => {
        if (typeof gym.lat !== 'number' || typeof gym.lng !== 'number') return;
        const isFav = favs.includes(gym.name);
        const marker = L.marker([gym.lat, gym.lng]).addTo(map);
        const slug = slugify(gym.name);
        const directions = `https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lng}`;
        marker.bindPopup(`
            <div>
                <strong>${gym.name}</strong><br>
                ${gym.city}<br>
                <a href="${directions}" target="_blank" rel="noopener">Cómo llegar</a>
                <br>
                <button id="fav-${slug}" style="margin-top:6px;padding:6px 10px;border:1px solid #000;border-radius:8px;background:#fff;cursor:pointer;">
                    ${isFav ? 'Quitar favorito' : 'Guardar favorito'}
                </button>
            </div>
        `);
        marker.on('popupopen', () => {
            const btn = document.getElementById(`fav-${slug}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    const nowFav = toggleFavorite(gym.name);
                    btn.textContent = nowFav ? 'Quitar favorito' : 'Guardar favorito';
                });
            }
        });
    });

    return map;
}

function sortGymsByDistance(lat, lng) {
    return gyms
        .filter((g) => typeof g.lat === 'number' && typeof g.lng === 'number')
        .map((gym) => {
            const dLat = ((gym.lat - lat) * Math.PI) / 180;
            const dLng = ((gym.lng - lng) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((lat * Math.PI) / 180) *
                Math.cos((gym.lat * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = 6371 * c;
            return {
                ...gym,
                distance
            };
        })
        .sort((a, b) => a.distance - b.distance);
}

function initGymsMap() {
    const mapContainer = document.getElementById('gyms-map');
    if (!mapContainer) return;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const sorted = sortGymsByDistance(lat, lng);
                const nearest = sorted[0];
                const map = createMap(nearest ? nearest.lat : lat, nearest ? nearest.lng : lng);

                const userIcon = L.icon({
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                    shadowSize: [41, 41]
                });

                const userMarker = L.marker([lat, lng], {
                    icon: userIcon
                }).addTo(map);
                userMarker.bindPopup('Tu ubicación aproximada').openPopup();
            },
            () => {
                const fallbackGym = gyms.find((g) => typeof g.lat === 'number' && typeof g.lng === 'number') || defaultGyms[0];
                createMap(fallbackGym.lat, fallbackGym.lng);
            }, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    } else {
        const fallbackGym = gyms.find((g) => typeof g.lat === 'number' && typeof g.lng === 'number') || defaultGyms[0];
        createMap(fallbackGym.lat, fallbackGym.lng);
    }
}

function buildGymCard(gym, boxers) {
    const isCoach = (localStorage.getItem('gloveup_user_role') || '').toLowerCase() === 'entrenador';
    const card = document.createElement('div');
    card.className = 'gym-card';
    card.dataset.name = gym.name;
    card.dataset.city = gym.city || '';

    const image = document.createElement('div');
    image.className = 'gym-image';
    const fallbackImage = "../assets/images/Sparring_Club_Collection-Link-Image.jpg";
    const mainFoto = gym.fotoPerfil || (Array.isArray(gym.fotos) && gym.fotos.length ? gym.fotos[0] : '');
    image.style.backgroundImage = `url('${mainFoto || fallbackImage}')`;
    image.style.backgroundSize = 'cover';
    image.style.backgroundPosition = 'center';

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
    if (metaTags.hasChildNodes()) {
        info.appendChild(metaTags);
    }

    const details = document.createElement('p');
    details.className = 'gym-details';
    const boxerCount = Array.isArray(boxers) ? boxers.length : 0;
    const bio = gym && typeof gym.bio === 'string' ? gym.bio.trim() : '';
    let bioShort = bio;
    const MAX_BIO = 140;
    if (bioShort.length > MAX_BIO) {
        bioShort = bioShort.substring(0, MAX_BIO) + '...';
    }
    details.textContent = bioShort || (boxerCount ? `${boxerCount} boxeador(es) registrado(s) en este gimnasio.` : 'Sin boxeadores registrados todavía.');

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

    const boxersWrap = document.createElement('div');
    boxersWrap.className = 'gym-boxers';
    boxersWrap.style.display = 'none';

    const boxersTitle = document.createElement('div');
    boxersTitle.className = 'gym-boxers-title';
    boxersTitle.textContent = 'Boxeadores';
    boxersWrap.appendChild(boxersTitle);

    const cardsList = document.createElement('div');
    cardsList.className = 'gym-boxers-list';
    if (boxerCount) {
        boxers.forEach((boxeador, index) => {
            const card = document.createElement('div');
            card.className = 'sparring-card';
            
            let starsHtml = '';
            let starCount = 2;
            if (boxeador.nivel === 'Profesional') starCount = 5;
            else if (boxeador.nivel === 'Avanzado') starCount = 4;
            else if (boxeador.nivel === 'Intermedio') starCount = 3;
            else if (boxeador.nivel === 'Principiante') starCount = 1;

            for (let i = 0; i < 5; i++) {
                if (i < starCount) starsHtml += '<i class="fas fa-star filled"></i>';
                else starsHtml += '<i class="far fa-star"></i>';
            }

            let imgHtml = `<i class="fas fa-user-circle" style="font-size: 2em; color: #ccc;"></i>`;
            if (boxeador.foto) {
                const imgSrc = boxeador.foto.startsWith('/') ? '..' + boxeador.foto : boxeador.foto;
                imgHtml = `<img src="${imgSrc}" alt="${boxeador.nombre}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
            }

            const identifierRaw = (boxeador && (boxeador.email || boxeador.dniLicencia) ? (boxeador.email || boxeador.dniLicencia) : '').toString().trim();
            const identifierEnc = identifierRaw ? encodeURIComponent(identifierRaw) : '';
            const canViewProfile = Boolean(identifierRaw);
            const nameEnc = boxeador && boxeador.nombre ? encodeURIComponent(String(boxeador.nombre)) : '';
            
            card.innerHTML = `
                <div class="card-flag">${imgHtml}</div>
                <div class="card-name">
                    <span class="main-name">${boxeador.nombre}</span>
                    <span class="alias">${boxeador.alias ? '@' + boxeador.alias.replace(/\\s+/g, '').toLowerCase() : ''}</span>
                </div>
                <div class="card-stars">
                    ${starsHtml}
                </div>
                <div class="card-division">${boxeador.peso || 'Peso no especificado'}</div>
                <div class="card-action">
                    <button class="view-profile-button" ${canViewProfile ? `data-identifier-enc="${identifierEnc}"` : 'disabled'}>${canViewProfile ? 'Ver Perfil' : 'Sin perfil'}</button>
                    <!-- Al pulsar Retar, enviamos al usuario a la vista de sparring para que use el modal completo, pre-configurado -->
                    <button class="challenge-button gyms-challenge-btn" ${canViewProfile && !isCoach ? `data-identifier-enc="${identifierEnc}" data-name-enc="${nameEnc}"` : 'disabled'}>Retar</button>
                </div>
            `;
            
            cardsList.appendChild(card);
        });
    } else {
        const emptyState = document.createElement('div');
        emptyState.style.padding = '10px 0';
        emptyState.textContent = 'No hay boxeadores asociados todavía.';
        cardsList.appendChild(emptyState);
    }
    boxersWrap.appendChild(cardsList);

    // List event delegation for Buttons
    cardsList.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-profile-button');
        const challengeBtn = e.target.closest('.challenge-button');
        
        if (viewBtn) {
            const identifierEnc = viewBtn.dataset.identifierEnc;
            if (identifierEnc) {
                window.location.href = '../profile/index.html?view=' + identifierEnc + '&from=gyms';
            }
        }
        
        if (challengeBtn) {
            const identifierEnc = challengeBtn.dataset.identifierEnc;
            const nameEnc = challengeBtn.dataset.nameEnc;
            if (identifierEnc) {
                // Redirigir a Sparring con parámetros para abrir el modal automáticamente
                window.location.href = '../sparring/index.html?action=challenge&id=' + identifierEnc + '&name=' + nameEnc;
            }
        }
    });

    info.appendChild(header);
    info.appendChild(location);
    info.appendChild(details);
    info.appendChild(footer);
    info.appendChild(boxersWrap);

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

    const [apiGyms, boxersRaw] = await Promise.all([loadGymsFromApi(), loadBoxers()]);
    const merged = [];
    const seen = new Set();
    apiGyms.forEach((g) => {
        const key = g.key || normalizeGymKey(g.name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push({
            ...g,
            key
        });
    });
    defaultGyms.forEach((g) => {
        const key = normalizeGymKey(g.name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push({
            ...g,
            key
        });
    });
    gyms = merged.slice();

    const boxersByGym = new Map();
    (Array.isArray(boxersRaw) ? boxersRaw : []).forEach((b) => {
        const gymName = b && b.gimnasio ? String(b.gimnasio) : '';
        const key = normalizeGymKey(gymName);
        if (!key) return;
        const list = boxersByGym.get(key) || [];
        list.push(b);
        boxersByGym.set(key, list);
    });

    listEl.innerHTML = '';
    gyms.forEach((g) => {
        const key = g.key || normalizeGymKey(g.name);
        const b = boxersByGym.get(key) || [];
        listEl.appendChild(buildGymCard(g, b));
    });

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