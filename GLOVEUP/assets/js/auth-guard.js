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
    document.addEventListener('DOMContentLoaded', () => {
        const pathParts = window.location.pathname.split('/');
        let assetsPrefix = '';
        if (window.location.pathname.includes('/dashboard/')) assetsPrefix = '../../';
        else if (window.location.pathname.match(/\/(home|gyms|sparring|profile|settings|onboarding|admin|auth)\//)) assetsPrefix = '../';

        // Inyectar CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = assetsPrefix + 'assets/css/toasts.css';
        document.head.appendChild(link);

        // Inyectar JS
        const script = document.createElement('script');
        script.src = assetsPrefix + 'assets/js/toasts.js';
        document.head.appendChild(script);
    });
})();
