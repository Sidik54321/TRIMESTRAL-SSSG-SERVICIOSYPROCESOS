/**
 * gyms.js — Módulo de gestión de gimnasios de GloveUp (gyms/index.html).
 * Funcionalidades principales:
 *   · Carga y renderiza tarjetas de gimnasios desde la API REST.
 *   · Mapa interactivo con Leaflet.js (cargado de forma lazy desde CDN).
 *   · Fallback a iframe OSM si Leaflet no carga en 3,5 segundos.
 *   · Búsqueda de ubicaciones con Nominatim (geocodificador de OpenStreetMap).
 *   · Favoritos persistidos en localStorage.
 *   · Paginación y filtros de búsqueda en la lista de gimnasios.
 *   · Permite al usuario abandonar su gimnasio actual con confirmación.
 */

// ─── ESTADO GLOBAL ───────────────────────────────────────────────────────────

// Lista de gimnasios por defecto (vacía; se rellena desde la API)
const defaultGyms = [];
let gyms = defaultGyms.slice();

// ─── UTILIDADES DE TEXTO ─────────────────────────────────────────────────────

/**
 * Convierte un texto en slug URL-friendly (solo letras, números y guiones).
 * Ej: "Box Club Madrid" → "box-club-madrid"
 */
function slugify(text) {
    return (text || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

/**
 * Normaliza un nombre de gimnasio a clave única: minúsculas, sin acentos,
 * espacios como guiones y sin caracteres especiales.
 * Usada para comparar gimnasios de distintas fuentes (API vs localStorage).
 */
function normalizeGymKey(text) {
    const value = (text || '').toString().trim().toLowerCase();
    return value
        .normalize('NFD')                          // Descompone caracteres acentuados
        .replace(/[̀-ͯ]/g, '')           // Elimina los diacríticos
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// ─── HELPER HTTP ─────────────────────────────────────────────────────────────

/**
 * Realiza una petición JSON a la API o a una URL absoluta.
 * Detecta dinámicamente la URL base para entornos locales y de producción.
 * Lanza un Error con el mensaje del servidor si la respuesta no es OK.
 */
async function requestJson(url, options = {}) {
    const _glv_h = window.location.hostname;
    const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
    const API_BASE_URL = (window.localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');
    const path = String(url || '');
    // Si la URL ya es absoluta, usarla directamente; si no, prefijar con la base
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

// ─── CARGA DE DATOS DESDE LA API ─────────────────────────────────────────────

/**
 * Obtiene la lista de gimnasios de la API y los mapea al formato interno.
 * Filtra entradas sin nombre y limita las fotos a 12 por gimnasio.
 * Devuelve [] si la API falla para no romper la UI.
 */
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
        })).filter((g) => g.name); // Descartar gimnasios sin nombre
        return mapped;
    } catch {
        return [];
    }
}

/**
 * Obtiene el gimnasio al que pertenece el usuario activo (boxeador o entrenador).
 * Devuelve { name, key, email, role } si tiene gimnasio, o null si no tiene.
 */
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
        return gymName ? {
            name: gymName,
            key: normalizeGymKey(gymName),
            email,
            role
        } : null;
    } catch {
        return null;
    }
}

// ─── DIÁLOGO DE CONFIRMACIÓN ─────────────────────────────────────────────────

/**
 * Muestra un modal de confirmación personalizado (sin usar window.confirm).
 * Devuelve una Promise<boolean>: true si el usuario confirma, false si cancela.
 * Se adapta al tema del sistema mediante variables CSS de GloveUp.
 */
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

        const close = (result) => {
            overlay.remove();
            resolve(result);
        };
        modal.querySelector('#glv-confirm-ok').addEventListener('click', () => close(true));
        modal.querySelector('#glv-confirm-cancel').addEventListener('click', () => close(false));
        // Cerrar también al hacer clic en el fondo oscuro
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
    });
}

// ─── ABANDONAR GIMNASIO ──────────────────────────────────────────────────────

/**
 * Solicita confirmación y llama a la API para desvincular al usuario de su gimnasio.
 * Recarga la página para reflejar el cambio.
 */
async function leaveGym(email, role) {
    const confirmed = await showConfirm('¿Seguro que quieres abandonar el gimnasio? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
        // El endpoint varía según el rol del usuario
        const endpoint = role === 'boxeador' ?
            `/api/boxeadores/me/leave-gym?email=${encodeURIComponent(email)}` :
            `/api/entrenadores/me/leave-gym?email=${encodeURIComponent(email)}`;
        await requestJson(endpoint, {
            method: 'POST'
        });
        window.location.reload();
    } catch (err) {
        if (typeof window.showToast === 'function') {
            window.showToast('Error al abandonar el gimnasio: ' + (err && err.message ? err.message : 'Error desconocido'), 'error');
        }
    }
}

// ─── CARGA DE BOXEADORES ─────────────────────────────────────────────────────

/** Obtiene la lista completa de boxeadores de la API (usada en futuros filtros). */
async function loadBoxers() {
    try {
        const items = await requestJson('/api/boxeadores');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

// ─── FAVORITOS ───────────────────────────────────────────────────────────────

/** Lee la lista de nombres de gimnasios favoritos desde localStorage. */
function getFavorites() {
    try {
        const raw = localStorage.getItem('gloveup_gym_favorites') || '[]';
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/** Persiste la lista de favoritos en localStorage. */
function setFavorites(favs) {
    localStorage.setItem('gloveup_gym_favorites', JSON.stringify(favs));
}

/**
 * Alterna el estado de favorito de un gimnasio por nombre.
 * Devuelve true si queda como favorito tras el toggle, false si se elimina.
 */
function toggleFavorite(name) {
    const favs = getFavorites();
    const idx = favs.indexOf(name);
    if (idx >= 0) {
        favs.splice(idx, 1); // Quitar de favoritos
    } else {
        favs.push(name); // Añadir a favoritos
    }
    setFavorites(favs);
    return favs.includes(name);
}

// ─── MAPA LEAFLET ────────────────────────────────────────────────────────────

// Mapa de gymKey → marcador Leaflet para poder abrir popups desde las tarjetas
const gymMarkersMap = {};

/**
 * Hace scroll hasta el mapa y abre el popup del marcador del gimnasio indicado.
 * Se expone como window.glvFocusGymOnMap para ser llamada desde las tarjetas.
 */
function focusGymOnMap(gymKey) {
    const marker = gymMarkersMap[gymKey];
    const mapSection = document.querySelector('.map-section-container');
    if (mapSection) mapSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
    // Esperar a que el scroll termine antes de abrir el popup
    if (marker) setTimeout(() => marker.openPopup(), 400);
}

window.glvFocusGymOnMap = focusGymOnMap;

// ─── CARGA LAZY DE LEAFLET ───────────────────────────────────────────────────

// Promise compartida para evitar múltiples cargas paralelas de Leaflet
let leafletLoadPromise = null;

/**
 * Garantiza que Leaflet.js esté disponible antes de usarlo.
 * Si ya está cargado en window.L, resuelve inmediatamente.
 * Si no, inyecta el script y la hoja de estilos desde CDN y espera a window.L.
 * Devuelve Promise<boolean>: true si Leaflet está listo, false si falló la carga.
 */
function ensureLeafletLoaded() {
    if (window.L) return Promise.resolve(true);
    if (leafletLoadPromise) return leafletLoadPromise;

    leafletLoadPromise = new Promise((resolve) => {
        // Comprobar si ya hay un tag <script> de Leaflet en la página
        const existing = Array.from(document.querySelectorAll('script[src]'))
            .some((s) => String(s.getAttribute('src') || '').includes('leaflet'));
        const hasCss = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
            .some((l) => String(l.getAttribute('href') || '').includes('leaflet'));

        // Inyectar el CSS de Leaflet si no está ya cargado
        if (!hasCss) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        /**
         * Polling activo que verifica cada 60ms si window.L está disponible.
         * Se detiene tras el timeout indicado en ms.
         */
        const waitForLeaflet = (ms) => {
            const startedAt = Date.now();
            return new Promise((r) => {
                const tick = () => {
                    if (window.L) return r(true);
                    if (Date.now() - startedAt >= ms) return r(false);
                    setTimeout(tick, 60);
                };
                tick();
            });
        };

        waitForLeaflet(existing ? 1200 : 0).then((ok) => {
            if (ok || window.L) return resolve(true);
            // Si el script ya está en el DOM pero aún no cargó, esperar más
            if (document.getElementById('glv-leaflet-js')) return waitForLeaflet(1200).then((ok2) => resolve(Boolean(ok2 && window.L)));

            // Inyectar el script de Leaflet dinámicamente
            const script = document.createElement('script');
            script.id = 'glv-leaflet-js';
            script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = () => resolve(Boolean(window.L));
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
    });

    return leafletLoadPromise;
}

// ─── FALLBACK DE MAPA (IFRAME OSM) ───────────────────────────────────────────

/**
 * Renderiza un iframe de OpenStreetMap como alternativa si Leaflet no carga.
 * El bbox se calcula con un delta de 0,06° alrededor del punto central.
 */
function renderOsmIframeMap(mapContainer, lat, lng) {
    if (!mapContainer) return;
    const safeLat = Number(lat);
    const safeLng = Number(lng);
    if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return;

    const delta = 0.06;
    // Construir el bounding box para el embed de OSM
    const bbox = `${(safeLng - delta).toFixed(6)},${(safeLat - delta).toFixed(6)},${(safeLng + delta).toFixed(6)},${(safeLat + delta).toFixed(6)}`;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${safeLat},${safeLng}`;
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;border-radius:inherit;';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'Mapa de gimnasios');
    mapContainer.innerHTML = '';
    mapContainer.appendChild(iframe);
}

// ─── INICIALIZACIÓN DEL MAPA PRINCIPAL ───────────────────────────────────────

/**
 * Inicializa el mapa de gimnasios con Leaflet en el contenedor #gyms-map.
 * Añade marcadores para cada gimnasio con coordenadas y geolocalización del usuario.
 * Incluye buscador de direcciones con Nominatim y fallback a iframe si Leaflet falla.
 * Si el mapa ya estaba inicializado, solo invalida su tamaño (útil tras resize).
 */
async function initGymsMap() {
    const mapContainer = document.getElementById('gyms-map');
    if (!mapContainer) return;

    // Si el mapa ya existe y está bien, solo recalcular tamaño
    if (window._glvGymsMap && typeof window._glvGymsMap.invalidateSize === 'function') {
        if (mapContainer.dataset.glvMapBroken === '1') {
            // El mapa anterior estaba roto; destruirlo para recrearlo
            try {
                window._glvGymsMap.remove();
            } catch {}
            window._glvGymsMap = null;
        } else {
            setTimeout(() => window._glvGymsMap.invalidateSize(), 60);
            return;
        }
    }

    await ensureLeafletLoaded();
    if (!window.L) {
        // Leaflet no disponible: usar el fallback de iframe
        if (typeof window.showToast === 'function') {
            window.showToast('No se pudo cargar el mapa. Revisa tu conexión a internet.', 'error');
        }
        const fallbackCenter = [40.4168, -3.7038]; // Madrid como centro por defecto
        renderOsmIframeMap(mapContainer, fallbackCenter[0], fallbackCenter[1]);
        return;
    }

    // Usar el primer gimnasio con coordenadas como centro; Madrid como fallback
    const validGyms = gyms.filter((g) => typeof g.lat === 'number' && typeof g.lng === 'number');
    const defaultCenter = validGyms.length > 0 ? [validGyms[0].lat, validGyms[0].lng] : [40.4168, -3.7038];

    const map = L.map(mapContainer).setView(defaultCenter, validGyms.length > 0 ? 11 : 6);
    window._glvGymsMap = map;
    mapContainer.dataset.glvMapBroken = '0';
    map.whenReady(() => {
        map.invalidateSize(); // Asegurar dimensiones correctas al inicio
    });

    // Capa de tiles de OpenStreetMap
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Monitorizar carga de tiles para detectar fallos de conectividad
    let hasLoadedTile = false;
    let tileErrors = 0;
    tiles.on('tileload', () => {
        hasLoadedTile = true;
    });
    tiles.on('tileerror', () => {
        tileErrors += 1;
    });

    // Timeout de 3,5 s: si no se carga ningún tile, activar el fallback iframe
    setTimeout(() => {
        const anyLoadedTile = Boolean(mapContainer.querySelector('.leaflet-tile-loaded'));
        if (hasLoadedTile || anyLoadedTile) return;
        mapContainer.dataset.glvMapBroken = '1';
        try {
            map.remove();
        } catch {}
        window._glvGymsMap = null;
        if (typeof window.showToast === 'function') {
            window.showToast(
                tileErrors > 0 ?
                'No se pudieron cargar los tiles del mapa. Mostrando vista alternativa.' :
                'El mapa no se pudo renderizar. Mostrando vista alternativa.',
                'error'
            );
        }
        renderOsmIframeMap(mapContainer, defaultCenter[0], defaultCenter[1]);
    }, 3500);

    // Icono personalizado para los marcadores de gimnasio (círculo ámbar)
    const gymIcon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:50%;background:#f59e0b;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);"></div>',
        iconAnchor: [9, 9],
        popupAnchor: [0, -12]
    });

    // Añadir un marcador por cada gimnasio con coordenadas válidas
    validGyms.forEach((gym) => {
        const gymKey = gym.key || slugify(gym.name);
        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lng}`;
        const marker = L.marker([gym.lat, gym.lng], {
            icon: gymIcon
        }).addTo(map);
        gymMarkersMap[gymKey] = marker; // Registrar para poder abrir el popup desde las tarjetas
        // Popup enriquecido con nombre, ciudad, botón de ruta y enlace al detalle
        marker.bindPopup(`
            <div style="min-width:230px;background:var(--color-bg-card,#ffffff);color:var(--color-text-main,#0f172a);border-radius:16px;box-shadow:0 18px 40px rgba(0,0,0,.18);padding:12px 12px 10px;border:1px solid var(--color-border,rgba(15,23,42,.12));font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
                <div style="display:flex;flex-direction:column;gap:6px;padding-bottom:10px;border-bottom:1px solid var(--color-border,rgba(15,23,42,.12));">
                    <div style="font-weight:900;font-size:.95rem;line-height:1.15;letter-spacing:.01em;">${gym.name}</div>
                    <div style="display:flex;align-items:center;gap:7px;font-size:.82rem;color:var(--color-text-light,#64748b);">
                        <i class="fas fa-map-marker-alt" style="color:var(--color-accent,#f59e0b);"></i>
                        <span>${gym.city || 'Ubicación no indicada'}</span>
                    </div>
                </div>
                <div style="display:flex;gap:10px;padding-top:10px;">
                    <a href="${directionsUrl}" target="_blank" rel="noopener"
                       style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 10px;border-radius:12px;background:linear-gradient(135deg,var(--color-accent,#f59e0b),#374151);color:#fff;font-weight:800;font-size:.82rem;text-decoration:none;border:1px solid transparent;">
                        <i class="fas fa-route" style="font-size:.9rem;"></i><span>Cómo llegar</span>
                    </a>
                    <a href="gym.html?key=${encodeURIComponent(gymKey)}"
                       style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 10px;border-radius:12px;background:transparent;color:var(--color-text-main,#0f172a);font-weight:800;font-size:.82rem;text-decoration:none;border:1px solid var(--color-border-hover,rgba(148,163,184,.35));">
                        <i class="fas fa-dumbbell" style="font-size:.9rem;"></i><span>Ver gimnasio</span>
                    </a>
                </div>
            </div>
        `);
    });

    // ── Geolocalización del usuario ──────────────────────────────────────────

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const userLat = pos.coords.latitude;
                const userLng = pos.coords.longitude;
                // Marcador azul para la posición del usuario
                L.circleMarker([userLat, userLng], {
                    radius: 9,
                    fillColor: '#4285f4',
                    fillOpacity: 1,
                    color: '#fff',
                    weight: 2
                }).addTo(map).bindPopup('Tu ubicación');

                // Ajustar el viewport para mostrar al usuario y todos los gimnasios
                if (validGyms.length > 0) {
                    const allPoints = [
                        [userLat, userLng], ...validGyms.map((g) => [g.lat, g.lng])
                    ];
                    map.fitBounds(L.latLngBounds(allPoints), {
                        padding: [30, 30]
                    });
                } else {
                    map.setView([userLat, userLng], 13);
                }
            },
            () => {}, // Silenciar el error de geolocalización (el usuario puede denegarlo)
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }

    // ── Buscador de direcciones con Nominatim ────────────────────────────────

    // Nominatim es el geocodificador gratuito de OSM (sin necesidad de API key)
    const searchInput = document.getElementById('map-search-input');
    const searchBtn = document.getElementById('map-search-btn');
    let searchMarker = null; // Marcador de la última búsqueda (rojo)

    /** Geocodifica la dirección introducida y centra el mapa en el resultado. */
    async function searchLocation() {
        const q = searchInput ? searchInput.value.trim() : '';
        if (!q) return;
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
                    headers: {
                        'Accept-Language': 'es' // Resultados en español
                    }
                }
            );
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                // Eliminar el marcador de búsqueda anterior si existía
                if (searchMarker) searchMarker.remove();
                // Añadir marcador rojo en la ubicación buscada
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

// ─── CONSTRUCCIÓN DE TARJETAS DE GIMNASIO ────────────────────────────────────

/**
 * Crea y devuelve el elemento DOM de una tarjeta de gimnasio.
 * Si el gimnasio es el del usuario actual, añade borde dorado y badge "Mi Gimnasio".
 * Incluye botón de favorito, botón de ver en mapa y botón de abandonar (solo si es el suyo).
 * @param {Object} gym - Datos del gimnasio.
 * @param {Object|null} userGym - Gimnasio del usuario activo (null si no tiene).
 */
function buildGymCard(gym, userGym) {
    const isMyGym = userGym && userGym.key === gym.key;

    const card = document.createElement('div');
    card.className = 'gym-card';
    card.dataset.name = gym.name;
    card.dataset.city = gym.city || '';
    // Resaltar el gimnasio del usuario con borde ámbar
    if (isMyGym) {
        card.style.border = '2px solid var(--color-accent, #f59e0b)';
        card.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.15)';
    }

    // ── Imagen / cabecera de la tarjeta ──────────────────────────────────────
    const image = document.createElement('div');
    image.className = 'gym-image';
    const fallbackImage = "../assets/images/Sparring_Club_Collection-Link-Image.jpg";
    // Preferir fotoPerfil; si no hay, usar la primera de las fotos generales
    const mainFoto = gym.fotoPerfil || (Array.isArray(gym.fotos) && gym.fotos.length ? gym.fotos[0] : '');
    image.style.backgroundImage = `url('${mainFoto || fallbackImage}')`;
    image.style.backgroundSize = 'cover';
    image.style.backgroundPosition = 'center';

    // Badge "Mi Gimnasio" superpuesto en la imagen
    if (isMyGym) {
        const myBadge = document.createElement('div');
        myBadge.style.cssText = 'position:absolute;top:10px;left:10px;background:#f59e0b;color:#fff;font-size:.7rem;font-weight:800;text-transform:uppercase;padding:4px 10px;border-radius:20px;letter-spacing:.05em;display:flex;align-items:center;gap:5px;box-shadow:0 2px 6px rgba(0,0,0,.2);';
        myBadge.innerHTML = '<i class="fas fa-map-marker-alt"></i> Mi Gimnasio';
        image.style.position = 'relative';
        image.appendChild(myBadge);
    }

    // Botón de favorito (corazón) superpuesto en la imagen
    const favBtn = document.createElement('button');
    favBtn.className = 'fav-btn';
    const favIcon = document.createElement('i');
    favIcon.className = 'far fa-heart';
    favBtn.appendChild(favIcon);
    image.appendChild(favBtn);

    // ── Información del gimnasio ──────────────────────────────────────────────
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
    const hasCoords = typeof gym.lat === 'number' && typeof gym.lng === 'number';
    locIcon.className = 'fas fa-map-marker-alt';
    // El icono se colorea en ámbar si el gimnasio tiene coordenadas en el mapa
    if (hasCoords) locIcon.style.color = '#f59e0b';
    location.appendChild(locIcon);
    location.appendChild(document.createTextNode(` ${gym.city || 'Ubicación no indicada'}`));
    // Badge "En el mapa" si tiene coordenadas
    if (hasCoords) {
        const locBadge = document.createElement('span');
        locBadge.style.cssText = 'margin-left:8px;font-size:.7rem;font-weight:700;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:20px;padding:2px 8px;vertical-align:middle;white-space:nowrap;';
        locBadge.innerHTML = '<i class="fas fa-map-pin" style="margin-right:3px;font-size:.65rem;"></i>En el mapa';
        location.appendChild(locBadge);
    };

    // Meta-etiquetas: entrenador responsable y horario del gimnasio
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

    // Descripción truncada a 100 caracteres para mantener la tarjeta compacta
    const details = document.createElement('p');
    details.className = 'gym-details';
    const bio = gym && typeof gym.bio === 'string' ? gym.bio.trim() : '';
    let bioShort = bio;
    const MAX_BIO = 100;
    if (bioShort.length > MAX_BIO) {
        bioShort = bioShort.substring(0, MAX_BIO) + '...';
    }
    details.textContent = bioShort || '';

    // ── Pie de tarjeta con acciones ──────────────────────────────────────────
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

    // Botón "Ver en mapa" solo si el gimnasio tiene coordenadas
    if (hasCoords) {
        const mapBtn = document.createElement('button');
        mapBtn.type = 'button';
        mapBtn.innerHTML = '<i class="fas fa-map-marked-alt"></i> Ver en mapa';
        mapBtn.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid #f59e0b;background:transparent;color:#f59e0b;font-size:.8rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s;';
        // Efecto hover manual (sin CSS externo)
        mapBtn.addEventListener('mouseenter', () => {
            mapBtn.style.background = '#f59e0b';
            mapBtn.style.color = '#fff';
        });
        mapBtn.addEventListener('mouseleave', () => {
            mapBtn.style.background = 'transparent';
            mapBtn.style.color = '#f59e0b';
        });
        mapBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = gym.key || normalizeGymKey(gym.name);
            if (typeof window.glvFocusGymOnMap === 'function') window.glvFocusGymOnMap(key);
        });
        footer.appendChild(mapBtn);
    }

    // Botón "Abandonar" solo si este es el gimnasio del usuario activo
    if (isMyGym) {
        const leaveBtn = document.createElement('button');
        leaveBtn.type = 'button';
        leaveBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Abandonar';
        leaveBtn.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:.8rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s;';
        leaveBtn.addEventListener('mouseenter', () => {
            leaveBtn.style.background = '#ef4444';
            leaveBtn.style.color = '#fff';
        });
        leaveBtn.addEventListener('mouseleave', () => {
            leaveBtn.style.background = 'transparent';
            leaveBtn.style.color = '#ef4444';
        });
        leaveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            leaveGym(userGym.email, userGym.role);
        });
        footer.appendChild(leaveBtn);
    }

    // Montar la estructura de la tarjeta
    info.appendChild(header);
    info.appendChild(location);
    if (metaTags.hasChildNodes()) info.appendChild(metaTags);
    if (bioShort) info.appendChild(details);
    info.appendChild(footer);

    card.appendChild(image);
    card.appendChild(info);

    // Navegar al detalle del gimnasio al pulsar "Ver gimnasio"
    viewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = gym.key || normalizeGymKey(gym.name);
        window.location.href = 'gym.html?key=' + encodeURIComponent(key);
    });

    // Toggle de favorito con cambio de icono inmediato
    favBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleFavorite(gym.name);
        const favs = getFavorites();
        const isFav = favs.includes(gym.name);
        favIcon.classList.toggle('fas', isFav);   // Corazón relleno si favorito
        favIcon.classList.toggle('far', !isFav);  // Corazón vacío si no favorito
    });

    return card;
}

// ─── INICIALIZACIÓN DE LA UI DE GIMNASIOS ────────────────────────────────────

/**
 * Orquesta toda la inicialización de la página de gimnasios:
 * carga datos, construye tarjetas, configura paginación y filtros.
 * Separa el gimnasio del usuario en una sección destacada al inicio.
 */
async function initGymsUi() {
    const listEl = document.getElementById('gym-list') || document.querySelector('.gym-list');
    const paginationEl = document.getElementById('gyms-pagination');
    if (!listEl || !paginationEl) return;

    // Cargar gimnasios de la API y el gimnasio del usuario en paralelo
    const [apiGyms, userGym] = await Promise.all([loadGymsFromApi(), loadCurrentUserGym()]);

    // Combinar los gimnasios de la API con los estáticos evitando duplicados por key
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

    // Pin the user's gym first (el gimnasio del usuario aparece primero en la lista)
    if (userGym) {
        merged.sort((a, b) => {
            const aIsMine = a.key === userGym.key ? -1 : 0;
            const bIsMine = b.key === userGym.key ? 1 : 0;
            return aIsMine + bIsMine;
        });
    }

    gyms = merged.slice(); // Actualizar el estado global de gimnasios

    const myGymSection = document.getElementById('my-gym-section');
    const myGymContainer = document.getElementById('my-gym-card-container');

    listEl.innerHTML = '';
    if (myGymContainer) myGymContainer.innerHTML = '';

    // Separar el gimnasio propio en su sección destacada; el resto a la lista general
    gyms.forEach((g) => {
        const isMyGym = userGym && userGym.key === g.key;
        if (isMyGym && myGymContainer) {
            myGymContainer.appendChild(buildGymCard(g, userGym));
        } else {
            listEl.appendChild(buildGymCard(g, userGym));
        }
    });

    // Mostrar la sección "Mi Gimnasio" solo si hay contenido en ella
    if (myGymSection && myGymContainer && myGymContainer.hasChildNodes()) {
        myGymSection.style.display = '';
    }

    // ── Paginación y filtros ─────────────────────────────────────────────────

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

    /** Extrae el texto del nombre de una tarjeta de gimnasio. */
    const getCardName = (card) => {
        const el = card.querySelector('.gym-name');
        return (el ? el.textContent : '') || '';
    };

    /** Extrae el texto de la ubicación de una tarjeta de gimnasio. */
    const getCardLocation = (card) => {
        const el = card.querySelector('.gym-location');
        return (el ? el.textContent : '') || '';
    };

    /**
     * Construye los controles de paginación con soporte para elipsis.
     * Los elementos activos o deshabilitados se renderizan como <span>.
     */
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

    /**
     * Aplica los filtros activos (búsqueda por nombre y ubicación) y
     * actualiza la lista filteredCards que usa render().
     */
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

    /**
     * Renderiza la página actual de la lista filtrada.
     * Oculta todas las tarjetas y muestra solo las de la página activa.
     */
    const render = () => {
        computeFiltered();
        const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
        const safePage = Math.min(Math.max(1, currentPage), totalPages);
        currentPage = safePage;

        const start = (safePage - 1) * pageSize;
        const end = start + pageSize;

        // Ocultar todas y mostrar solo las de la página actual
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

    // Delegación de eventos en el contenedor de paginación
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
        currentPage = 1; // Volver a la primera página al buscar
        render();
    };

    if (mainSearchButton) mainSearchButton.addEventListener('click', runSearch);
    if (mainSearchInput) {
        mainSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runSearch(e);
        });
    }

    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', runSearch);

    // ── Inicializar estado de favoritos en las tarjetas ──────────────────────

    const favs = getFavorites();
    allCards.forEach((card) => {
        const name = getCardName(card).trim();
        const icon = card.querySelector('.fav-btn i');
        if (!icon || !name) return;
        const isFav = favs.includes(name);
        // Sincronizar el icono del corazón con el estado de favorito persistido
        icon.classList.toggle('fas', isFav);
        icon.classList.toggle('far', !isFav);
    });

    // ── Botones de vista (lista / mapa) ──────────────────────────────────────

    if (viewButtons.length >= 2) {
        const listBtn = viewButtons[0];
        const mapBtn = viewButtons[1];

        // Vista lista → scroll a la lista de resultados
        listBtn.addEventListener('click', (e) => {
            e.preventDefault();
            viewButtons.forEach((b) => b.classList.remove('active'));
            listBtn.classList.add('active');
            if (listSection) listSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });

        // Vista mapa → scroll al mapa e inicializar Leaflet si no está listo
        mapBtn.addEventListener('click', (e) => {
            e.preventDefault();
            viewButtons.forEach((b) => b.classList.remove('active'));
            mapBtn.classList.add('active');
            if (mapSection) mapSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            initGymsMap(); // Carga lazy del mapa al hacer clic
        });
    }

    render(); // Renderizado inicial
}

// ─── ARRANQUE ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar la UI y el mapa en paralelo (el mapa puede tardar más)
    initGymsUi().then(() => initGymsMap());
});
