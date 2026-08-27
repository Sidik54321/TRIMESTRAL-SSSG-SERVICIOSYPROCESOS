/**
 * router.js — Router de la SPA.
 *
 * Intercepta los enlaces internos, pide a PHP el HTML de la vista destino y
 * sustituye únicamente #app-view. El servidor sigue sabiendo renderizar el
 * documento entero, así que recargar, compartir una URL o entrar desde fuera
 * funciona igual: la SPA es una optimización de la navegación, no un
 * requisito para ver la página.
 */

const VIEW = '#app-view';
const CACHE_MAX = 20;

/** Vistas ya descargadas, para que volver atrás sea instantáneo. */
const cache = new Map();

/** Módulo JS de la página activa, para poder desmontarlo al salir. */
let currentModule = null;

/** Cancela la petición en curso si el usuario navega otra vez. */
let inFlight = null;

/** El onRender registrado en start(), reutilizado por quien llame a navigate() sin indicar uno. */
let defaultOnRender = null;

/**
 * Arranca el router.
 *
 * @param {object} handlers
 * @param {(root: HTMLElement) => void} handlers.onRender  Tras insertar una vista
 */
export function start({ onRender }) {
    defaultOnRender = onRender;

    // Estado inicial: la vista que PHP ya ha renderizado
    history.replaceState({ path: location.pathname }, '');
    mountPage(document.querySelector(VIEW), onRender);

    document.addEventListener('click', (event) => {
        const link = resolveLink(event);
        if (!link) return;

        event.preventDefault();
        navigate(link.getAttribute('href'), { onRender });
    });

    window.addEventListener('popstate', (event) => {
        const path = event.state?.path || location.pathname;
        navigate(path, { onRender, push: false });
    });
}

/**
 * Decide si un clic debe gestionarlo la SPA.
 *
 * Se dejan pasar al navegador los enlaces externos, los que abren pestaña
 * nueva, las descargas, los anclas y los marcados con data-external
 * (las páginas clásicas bajo /legacy).
 *
 * @returns {HTMLAnchorElement|null}
 */
function resolveLink(event) {
    if (event.defaultPrevented || event.button !== 0) return null;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

    const link = event.target.closest('a[href]');
    if (!link) return null;

    if (link.target && link.target !== '_self') return null;
    if (link.hasAttribute('download') || link.hasAttribute('data-external')) return null;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return null;
    }

    const url = new URL(href, location.origin);
    if (url.origin !== location.origin) return null;

    // Las páginas clásicas y los ficheros sueltos no pasan por el router
    if (url.pathname.startsWith('/legacy/') || url.pathname.startsWith('/assets/')) return null;

    return link;
}

/**
 * Navega a una ruta interna.
 *
 * Los módulos de página pueden llamarla directamente (p. ej. tras un envío
 * de formulario o una búsqueda) sin pasar `onRender`: se reutiliza el mismo
 * que registró start(), así los modales de la vista destino se conectan
 * igual que en una navegación por clic.
 *
 * @param {string} path
 * @param {{onRender?: Function, push?: boolean}} [options]
 */
export async function navigate(path, { onRender = defaultOnRender, push = true } = {}) {
    const url = new URL(path, location.origin);
    const target = url.pathname + url.search;

    if (push && target === location.pathname + location.search) return;

    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;

    progress(true);

    try {
        const payload = cache.get(target) || (await fetchView(target, controller.signal));

        // Otra navegación ha empezado mientras esperábamos: esta ya no vale
        if (controller.signal.aborted) return;

        remember(target, payload);

        // Una vista con shell distinto (pública ↔ con sidebar) necesita el
        // documento completo: se deja que el navegador la cargue entero.
        if (payload.shell !== document.body.dataset.shell) {
            window.location.href = target;
            return;
        }

        if (push) {
            history.pushState({ path: target }, '', target);
        }

        swap(payload, onRender);
    } catch (err) {
        if (err.name === 'AbortError') return;

        // Si la SPA no puede resolverlo, que lo intente el navegador
        window.location.href = target;
    } finally {
        if (inFlight === controller) {
            inFlight = null;
            progress(false);
        }
    }
}

/**
 * Pide a PHP el HTML de una vista.
 *
 * @returns {Promise<{title: string, nav: string|null, shell: string, html: string}>}
 */
async function fetchView(path, signal) {
    const res = await fetch(path, {
        headers: { 'X-GloveUp-SPA': '1' },
        signal,
    });

    // El 404 también trae vista renderizada, así que sirve igual
    if (!res.ok && res.status !== 404) {
        throw new Error(`HTTP ${res.status}`);
    }

    return res.json();
}

/** Inserta la vista y actualiza el resto de la interfaz. */
function swap(payload, onRender) {
    const view = document.querySelector(VIEW);

    currentModule?.destroy?.();
    currentModule = null;

    view.innerHTML = payload.html;
    document.title = payload.title;

    markActiveNav(payload.nav);

    const heading = document.getElementById('topbar-title');
    if (heading) {
        // El título del documento lleva sufijo "— GloveUp"; la barra no
        heading.textContent = payload.title.split('—')[0].trim();
    }

    // Cada vista empieza arriba y con el foco en el contenido, para que el
    // teclado y los lectores de pantalla sigan la navegación.
    view.scrollTop = 0;
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });

    mountPage(view, onRender);
}

/**
 * Ejecuta el módulo JS asociado a la vista recién insertada.
 *
 * El atributo data-page de la vista nombra el módulo que hay que cargar:
 * data-page="gyms" carga /assets/js/pages/gyms.js. Sólo lo llevan las
 * vistas que tienen módulo; las estáticas (landing, 404, pendientes) lo
 * omiten y aquí no se hace nada.
 */
async function mountPage(view, onRender) {
    onRender?.(view);

    const root = view.querySelector('[data-page]');
    const page = root?.dataset.page;
    if (!page) return;

    try {
        const module = await import(`/assets/js/pages/${page}.js`);
        // El usuario puede haber navegado mientras se descargaba el módulo
        if (!root.isConnected) return;

        currentModule = module;
        module.init?.(root);
    } catch (err) {
        console.error(`No se pudo iniciar la página "${page}"`, err);
    }
}

/** Marca el elemento activo del menú lateral. */
function markActiveNav(nav) {
    document.querySelectorAll('[data-nav]').forEach((el) => {
        if (nav && el.dataset.nav === nav) {
            el.setAttribute('aria-current', 'page');
        } else {
            el.removeAttribute('aria-current');
        }
    });
}

/** Guarda una vista en caché, descartando la más antigua al llenarse. */
function remember(path, payload) {
    cache.set(path, payload);
    if (cache.size > CACHE_MAX) {
        cache.delete(cache.keys().next().value);
    }
}

/** Barra de progreso superior durante la carga de una vista. */
function progress(active) {
    const bar = document.getElementById('spa-progress');
    if (!bar) return;

    if (active) {
        bar.style.opacity = '1';
        bar.style.transform = 'scaleX(0.35)';
        return;
    }

    bar.style.transform = 'scaleX(1)';
    setTimeout(() => {
        bar.style.opacity = '0';
        // Se rebobina ya invisible para que no se vea el retroceso
        setTimeout(() => { bar.style.transform = 'scaleX(0)'; }, 300);
    }, 150);
}
