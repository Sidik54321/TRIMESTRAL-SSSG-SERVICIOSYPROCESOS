/**
 * auth-guard.js — Protección de rutas en el cliente (frontend).
 *
 * Este script se incluye en el <head> de todas las páginas protegidas.
 * Su función es doble:
 *  1. Redirigir al usuario a la página de login si no hay sesión activa
 *     (verificada por la presencia de gloveup_user_email en localStorage).
 *  2. Inyectar dinámicamente el sistema de toasts (CSS + JS) en cualquier
 *     página que aún no lo tenga cargado.
 *
 * La lógica de prefijo de rutas permite que el script funcione desde cualquier
 * nivel de profundidad del árbol de carpetas del frontend.
 *
 * NOTA: Esta protección es solo UI. La seguridad real se aplica en el servidor.
 */

(function() {
    // ── Detección de tipo de página ──────────────────────────────────────────
    // Las páginas de auth y los assets no necesitan protección; se omiten.
    const isAuthPage = window.location.pathname.includes('/auth/');
    const isAsset = window.location.pathname.includes('/assets/');

    // El email del usuario se guarda en localStorage tras el login exitoso
    const userEmail = localStorage.getItem('gloveup_user_email');

    if (!userEmail && !isAuthPage && !isAsset) {
        // ── Cálculo del prefijo de redirección ───────────────────────────────
        // Según la carpeta en la que esté la página actual, necesitamos
        // retroceder un número diferente de niveles para llegar al directorio
        // raíz donde se encuentra auth/index.html.
        let prefix = '';

        if (window.location.pathname.includes('/dashboard/entrenador/') ||
            window.location.pathname.includes('/dashboard/boxeador/')) {
            // Páginas en /dashboard/<rol>/ → subir 2 niveles (../../)
            prefix = '../../';
        } else if (window.location.pathname.includes('/home/') ||
                   window.location.pathname.includes('/gyms/') ||
                   window.location.pathname.includes('/sparring/') ||
                   window.location.pathname.includes('/profile/') ||
                   window.location.pathname.includes('/settings/') ||
                   window.location.pathname.includes('/onboarding/') ||
                   window.location.pathname.includes('/admin/')) {
            // Páginas de primer nivel (un nivel de profundidad) → subir 1 nivel (../)
            prefix = '../';
        }

        // Redirigir a la página de login
        window.location.href = prefix + 'auth/index.html';
    }

    // ── Inyección dinámica del sistema de toasts ─────────────────────────────
    /**
     * Inyecta el CSS y el JS de toasts.js si aún no están cargados en la página.
     * La detección se hace comprobando si window.showToast ya existe (evita
     * cargar el script dos veces si auth-guard.js se incluye varias veces).
     * El prefijo de ruta se calcula igual que para la redirección anterior.
     */
    (function injectToasts() {
        // Si showToast ya existe, el script ya fue inyectado anteriormente
        if (typeof window.showToast === 'function') return;

        // Calcular el prefijo de ruta hacia /assets/ desde la página actual
        let assetsPrefix = '';
        if (window.location.pathname.includes('/dashboard/')) {
            assetsPrefix = '../../';
        } else if (window.location.pathname.match(/\/(home|gyms|sparring|profile|settings|onboarding|admin|auth)\//)) {
            assetsPrefix = '../';
        }

        const cssHref = assetsPrefix + 'assets/css/toasts.css';
        const jsSrc  = assetsPrefix + 'assets/js/toasts.js';

        // Inyectar la hoja de estilos solo si aún no está en el <head>
        const hasCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .some(l => (l.getAttribute('href') || '') === cssHref);
        if (!hasCss) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssHref;
            document.head.appendChild(link);
        }

        // Inyectar el script solo si aún no está en el documento
        const hasJs = Array.from(document.querySelectorAll('script'))
            .some(s => (s.getAttribute('src') || '') === jsSrc);
        if (!hasJs) {
            const script = document.createElement('script');
            script.src = jsSrc;
            // async:false garantiza que el script se ejecuta en orden con los demás
            script.async = false;
            document.head.appendChild(script);
        }
    })();
})();
