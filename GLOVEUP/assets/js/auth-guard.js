(function() {
    // Definimos las páginas que están exentas de protección (auth y assets)
    const isAuthPage = window.location.pathname.includes('/auth/');
    const isAsset = window.location.pathname.includes('/assets/');
    
    const userEmail = localStorage.getItem('gloveup_user_email');

    if (!userEmail && !isAuthPage && !isAsset) {
        // Determinamos la ruta de redirección basándonos en la profundidad actual
        const depth = (window.location.pathname.split('/').length - 1);
        let prefix = '';
        
        // Si estamos en una subcarpeta (ej: /home/, /gyms/, /dashboard/entrenador/)
        // necesitamos volver al root antes de entrar a /auth/
        if (window.location.pathname.includes('/dashboard/entrenador/') || 
            window.location.pathname.includes('/dashboard/boxeador/')) {
            prefix = '../../';
        } else if (window.location.pathname.includes('/home/') || 
                   window.location.pathname.includes('/gyms/') || 
                   window.location.pathname.includes('/sparring/') ||
                   window.location.pathname.includes('/profile/') ||
                   window.location.pathname.includes('/settings/') ||
                   window.location.pathname.includes('/onboarding/') ||
                   window.location.pathname.includes('/admin/')) {
            prefix = '../';
        }

        window.location.href = prefix + 'auth/index.html';
    }

    // Inyectar sistema de notificaciones GloveUp (Toasts)
    (function injectToasts() {
        if (typeof window.showToast === 'function') return;
        const pathParts = window.location.pathname.split('/');
        let assetsPrefix = '';
        if (window.location.pathname.includes('/dashboard/')) assetsPrefix = '../../';
        else if (window.location.pathname.match(/\/(home|gyms|sparring|profile|settings|onboarding|admin|auth)\//)) assetsPrefix = '../';

        const cssHref = assetsPrefix + 'assets/css/toasts.css';
        const jsSrc = assetsPrefix + 'assets/js/toasts.js';

        const hasCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l => (l.getAttribute('href') || '') === cssHref);
        if (!hasCss) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssHref;
            document.head.appendChild(link);
        }

        const hasJs = Array.from(document.querySelectorAll('script')).some(s => (s.getAttribute('src') || '') === jsSrc);
        if (!hasJs) {
            const script = document.createElement('script');
            script.src = jsSrc;
            script.async = false;
            document.head.appendChild(script);
        }
    })();
})();
