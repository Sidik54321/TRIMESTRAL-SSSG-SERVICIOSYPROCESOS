/**
 * gyms.js — Módulo de la página de gimnasios.
 *
 * El router llama a init() con la raíz de la vista después de insertarla, y
 * a destroy() al salir. Todo el estado vive en el ámbito del módulo y se
 * reinicia en cada init(), así que volver a la página parte de cero.
 */

import { api, gymKey } from '../api.js';
import * as session from '../session.js';
import * as loginModal from '../login-modal.js';

const PER_PAGE = 9;
const FAVS_KEY = 'gloveup_gym_favorites';

let gyms = [];
let myGym = null;
let page = 1;
let els = {};
let abort = null;

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="gyms" */
export function init(root) {
    els = {
        root,
        search: root.querySelector('#gym-search'),
        searchBtn: root.querySelector('#gym-search-btn'),
        city: root.querySelector('#gym-city'),
        onlyFavs: root.querySelector('#gym-only-favs'),
        onlyLocated: root.querySelector('#gym-only-located'),
        reset: root.querySelector('#gym-reset'),
        count: root.querySelector('#gym-count'),
        grid: root.querySelector('#gym-grid'),
        skeletons: root.querySelector('#gym-skeletons'),
        empty: root.querySelector('#gym-empty'),
        error: root.querySelector('#gym-error'),
        errorMsg: root.querySelector('#gym-error-msg'),
        retry: root.querySelector('#gym-retry'),
        pagination: root.querySelector('#gym-pagination'),
        myGym: root.querySelector('#my-gym'),
        myGymCard: root.querySelector('#my-gym-card'),
    };

    page = 1;

    // La búsqueda filtra según se escribe; el botón existe para quien
    // espera pulsarlo, pero no hace falta.
    els.search?.addEventListener('input', onFilterChange);
    els.searchBtn?.addEventListener('click', onFilterChange);
    els.city?.addEventListener('change', onFilterChange);
    els.onlyFavs?.addEventListener('change', onFilterChange);
    els.onlyLocated?.addEventListener('change', onFilterChange);
    els.reset?.addEventListener('click', clearFilters);
    els.retry?.addEventListener('click', load);

    // Los favoritos se marcan sobre tarjetas creadas dinámicamente,
    // así que se escucha en la rejilla en lugar de en cada botón.
    els.grid?.addEventListener('click', onGridClick);

    load();
}

/** Cancela la carga pendiente al abandonar la página. */
export function destroy() {
    abort?.abort();
    abort = null;
    gyms = [];
    myGym = null;
    els = {};
}

/* ── Datos ─────────────────────────────────────────────────────────── */

async function load() {
    abort?.abort();
    // Se guarda en una constante local: si el usuario sale de la página,
    // destroy() pone abort a null y sin esta referencia no habría forma
    // de saber que esta carga concreta ya no interesa.
    const run = new AbortController();
    abort = run;

    toggle(els.skeletons, true);
    toggle(els.grid, false);
    toggle(els.empty, false);
    toggle(els.error, false);

    try {
        const [items, mine] = await Promise.all([api.gimnasios(), loadMyGym()]);

        if (run.signal.aborted) return;

        gyms = (Array.isArray(items) ? items : [])
            .map(normalize)
            .filter((g) => g.name);
        myGym = mine;

        fillCities();
        renderMyGym();
        render();
    } catch (err) {
        if (run.signal.aborted) return;
        toggle(els.skeletons, false);
        toggle(els.error, true);
        if (els.errorMsg) els.errorMsg.textContent = err.message;
    }
}

/** Adapta la respuesta de la API al modelo que usa la vista. */
function normalize(g) {
    return {
        id: String(g?._id || ''),
        name: String(g?.nombre || ''),
        key: String(g?.key || gymKey(g?.nombre || '')),
        city: String(g?.ubicacion || ''),
        address: String(g?.direccion || ''),
        bio: String(g?.bio || ''),
        photo: String(g?.fotoPerfil || '') || (Array.isArray(g?.fotos) ? g.fotos[0] : '') || '',
        coach: String(g?.nombreEntrenador || ''),
        schedule: String(g?.horario || ''),
        located: typeof g?.lat === 'number' && typeof g?.lng === 'number',
    };
}

/** Averigua a qué gimnasio pertenece el usuario, si pertenece a alguno. */
async function loadMyGym() {
    const email = session.email();
    const role = session.role();
    if (!email || (role !== 'boxeador' && role !== 'entrenador')) return null;

    try {
        const data = role === 'boxeador' ? await api.boxeador(email) : await api.entrenador(email);
        const name = data?.gimnasio ? String(data.gimnasio) : '';
        return name ? gymKey(name) : null;
    } catch {
        // No poder resolverlo sólo significa no destacar ninguna tarjeta
        return null;
    }
}

/* ── Filtrado y render ─────────────────────────────────────────────── */

function visible() {
    const term = (els.search?.value || '').trim().toLowerCase();
    const city = els.city?.value || '';
    const favs = favorites();

    return gyms.filter((g) => {
        if (term && !`${g.name} ${g.city} ${g.address}`.toLowerCase().includes(term)) return false;
        if (city && g.city !== city) return false;
        if (els.onlyFavs?.checked && !favs.includes(g.name)) return false;
        if (els.onlyLocated?.checked && !g.located) return false;
        return true;
    });
}

function render() {
    const list = visible();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    page = Math.min(page, pages);

    toggle(els.skeletons, false);
    toggle(els.empty, list.length === 0);
    toggle(els.grid, list.length > 0);

    if (els.count) {
        els.count.textContent = list.length === 1
            ? '1 gimnasio'
            : `${list.length} gimnasios`;
    }

    els.grid.innerHTML = '';
    list
        .slice((page - 1) * PER_PAGE, page * PER_PAGE)
        .forEach((g) => els.grid.appendChild(card(g)));

    renderPagination(pages);
}

function renderMyGym() {
    if (!myGym || !els.myGym) return;

    const mine = gyms.find((g) => g.key === myGym);
    if (!mine) return;

    els.myGymCard.innerHTML = '';
    els.myGymCard.appendChild(card(mine, true));
    els.myGym.hidden = false;
}

/**
 * Construye la tarjeta de un gimnasio.
 *
 * @param {object}  gym
 * @param {boolean} [highlight] Marca visualmente el gimnasio del usuario
 * @returns {HTMLElement}
 */
function card(gym, highlight = false) {
    const isFav = favorites().includes(gym.name);

    const el = document.createElement('article');
    el.className = 'card-interactive overflow-hidden'
        + (highlight ? ' ring-2 ring-accent' : '');

    el.innerHTML = `
        <div class="relative h-40 bg-sunken dark:bg-white/5">
            <img src="${gym.photo || '/assets/images/Sparring_Club_Collection-Link-Image.jpg'}"
                 alt="" loading="lazy" class="h-full w-full object-cover">

            <button type="button" data-fav="${escapeAttr(gym.name)}"
                    aria-label="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
                    aria-pressed="${isFav}"
                    class="absolute right-3 top-3 grid h-9 w-9 place-items-center
                           rounded-full bg-white/90 text-sm shadow-card backdrop-blur
                           transition-transform hover:scale-110">
                <i class="${isFav ? 'fas' : 'far'} fa-heart ${isFav ? 'text-accent' : 'text-muted'}"></i>
            </button>

            ${highlight ? `
                <span class="absolute left-3 top-3 rounded-full bg-accent px-3 py-1
                             text-xs font-bold text-white shadow-card">
                    <i class="fas fa-map-marker-alt"></i> Mi gimnasio
                </span>` : ''}
        </div>

        <div class="p-5">
            <h4 class="clamp-2 text-base font-bold">${escapeHtml(gym.name)}</h4>

            <p class="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <i class="fas fa-location-dot text-xs text-accent"></i>
                ${escapeHtml(gym.city || 'Ubicación no indicada')}
            </p>

            ${gym.bio ? `<p class="clamp-2 mt-3 text-sm text-muted dark:text-white/60">
                ${escapeHtml(gym.bio)}</p>` : ''}

            <div class="mt-4 flex flex-wrap gap-2">
                ${gym.coach ? `<span class="chip"><i class="fas fa-user-tie text-accent"></i>
                    ${escapeHtml(gym.coach)}</span>` : ''}
                ${gym.schedule ? `<span class="chip"><i class="fas fa-clock text-accent"></i>
                    ${escapeHtml(gym.schedule)}</span>` : ''}
                ${gym.located ? `<span class="chip"><i class="fas fa-map-pin text-accent"></i>
                    En el mapa</span>` : ''}
            </div>

            <a href="/gimnasios/${encodeURIComponent(gym.key)}"
               class="btn-ghost mt-5 w-full">Ver gimnasio</a>
        </div>
    `;

    return el;
}

function renderPagination(pages) {
    els.pagination.innerHTML = '';
    if (pages <= 1) return;

    const button = (label, target, { disabled = false, current = false } = {}) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.disabled = disabled;
        b.className = 'grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm '
            + 'font-semibold transition-colors disabled:opacity-40 '
            + (current
                ? 'bg-accent text-white'
                : 'bg-sunken text-body hover:bg-hairline-strong/20 dark:bg-white/10 dark:text-white');
        if (current) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', () => {
            page = target;
            render();
            els.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return b;
    };

    els.pagination.appendChild(button('‹', page - 1, { disabled: page === 1 }));
    for (let i = 1; i <= pages; i += 1) {
        els.pagination.appendChild(button(String(i), i, { current: i === page }));
    }
    els.pagination.appendChild(button('›', page + 1, { disabled: page === pages }));
}

/* ── Interacción ───────────────────────────────────────────────────── */

function onFilterChange() {
    page = 1;
    render();
}

function clearFilters() {
    if (els.search) els.search.value = '';
    if (els.city) els.city.value = '';
    if (els.onlyFavs) els.onlyFavs.checked = false;
    if (els.onlyLocated) els.onlyLocated.checked = false;
    onFilterChange();
}

function onGridClick(event) {
    const btn = event.target.closest('[data-fav]');
    const viewLink = event.target.closest('a[href^="/gimnasios/"]');
    if (!btn && !viewLink) return;

    // Explorando sin cuenta: ni el favorito ni la ficha del gimnasio están
    // disponibles, así que cualquiera de los dos abre el login en vez de
    // ejecutarse o navegar.
    if (!session.email()) {
        event.preventDefault();
        loginModal.open();
        return;
    }

    if (!btn) return; // el enlace "Ver gimnasio" sigue su curso normal

    event.preventDefault();
    const name = btn.dataset.fav;
    const isFav = toggleFavorite(name);

    btn.setAttribute('aria-pressed', String(isFav));
    btn.setAttribute('aria-label', isFav ? 'Quitar de favoritos' : 'Añadir a favoritos');
    btn.querySelector('i').className =
        `${isFav ? 'fas' : 'far'} fa-heart ${isFav ? 'text-accent' : 'text-muted'}`;

    // Con el filtro de favoritos activo, la tarjeta debe desaparecer al quitarlo
    if (els.onlyFavs?.checked) render();

    window.showToast?.(isFav ? 'Añadido a favoritos' : 'Quitado de favoritos', 'success');
}

/** Rellena el desplegable con las ciudades presentes en los datos. */
function fillCities() {
    if (!els.city) return;

    const cities = [...new Set(gyms.map((g) => g.city).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'));

    els.city.innerHTML = '<option value="">Todas las ciudades</option>';
    cities.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        els.city.appendChild(opt);
    });
}

/* ── Favoritos ─────────────────────────────────────────────────────── */

function favorites() {
    try {
        const raw = JSON.parse(localStorage.getItem(FAVS_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

function toggleFavorite(name) {
    const favs = favorites();
    const idx = favs.indexOf(name);

    if (idx >= 0) {
        favs.splice(idx, 1);
    } else {
        favs.push(name);
    }

    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    return idx < 0;
}

/* ── Utilidades ────────────────────────────────────────────────────── */

function toggle(el, show) {
    if (el) el.hidden = !show;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
