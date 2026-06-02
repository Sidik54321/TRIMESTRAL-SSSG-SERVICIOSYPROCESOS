(function() {
    const isAuthPage = window.location.pathname.includes('/auth/');
    const isAsset = window.location.pathname.includes('/assets/');

    if (isAuthPage || isAsset) {
        injectToasts();
        return;
    }

    const userEmail = localStorage.getItem('gloveup_user_email');

    // Sin sesión → redirigir inmediatamente
    if (!userEmail) {
        redirectToAuth();
        return;
    }

    // Ocultar el body hasta que el servidor confirme la sesión
    document.documentElement.style.visibility = 'hidden';

    const _h = window.location.hostname;
    const _apiHost = (_h === '127.0.0.1' || _h === 'localhost' || _h === '') ? 'localhost' : _h;
    const apiBase = (window.localStorage.getItem('gloveup_api_base_url') ||
        (window.location.protocol === 'file:' || window.location.port !== '8080'
            ? 'http://' + _apiHost + ':3000' : '')).replace(/\/+$/, '');

    fetch(apiBase + '/api/auth/me?email=' + encodeURIComponent(userEmail))
        .then(function(res) {
            if (!res.ok) {
                localStorage.clear();
                sessionStorage.clear();
                redirectToAuth();
            } else {
                // Sesión válida → mostrar la página
                document.documentElement.style.visibility = '';
            }
        })
        .catch(function() {
            // Servidor no disponible → mostrar la página de todos modos
            document.documentElement.style.visibility = '';
        });

    function redirectToAuth() {
        document.documentElement.style.visibility = '';
        const path = window.location.pathname;
        let prefix = '';
        if (path.includes('/dashboard/entrenador/') || path.includes('/dashboard/boxeador/')) {
            prefix = '../../';
        } else if (path.includes('/home/') || path.includes('/gyms/') ||
                   path.includes('/sparring/') || path.includes('/profile/') ||
                   path.includes('/settings/') || path.includes('/onboarding/') ||
                   path.includes('/admin/')) {
            prefix = '../';
        }
        window.location.replace(prefix + 'auth/index.html');
    }

    function injectToasts() {
        if (typeof window.showToast === 'function') return;
        const path = window.location.pathname;
        let assetsPrefix = '';
        if (path.includes('/dashboard/')) assetsPrefix = '../../';
        else if (path.match(/\/(home|gyms|sparring|profile|settings|onboarding|admin|auth)\//)) assetsPrefix = '../';

        const cssHref = assetsPrefix + 'assets/css/toasts.css';
        const jsSrc = assetsPrefix + 'assets/js/toasts.js';

        if (!Array.from(document.querySelectorAll('link')).some(function(l) { return l.getAttribute('href') === cssHref; })) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssHref;
            document.head.appendChild(link);
        }
        if (!Array.from(document.querySelectorAll('script')).some(function(s) { return s.getAttribute('src') === jsSrc; })) {
            const script = document.createElement('script');
            script.src = jsSrc;
            script.async = false;
            document.head.appendChild(script);
        }
    }

    injectToasts();
})();
