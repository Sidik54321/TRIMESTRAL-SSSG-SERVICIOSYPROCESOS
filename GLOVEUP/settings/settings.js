// c:\Users\syu02\GLOVEUP\GLOVEUP\settings\settings.js

document.addEventListener('DOMContentLoaded', () => {
    const homeView = document.getElementById('settings-home-view');
    const notifsView = document.getElementById('settings-notifications-view');
    const paletteView = document.getElementById('settings-palette-view');
    const btnVolver = document.getElementById('btn-volver');
    const navManageNotifs = document.getElementById('nav-manage-notifications');
    const navManagePalette = document.getElementById('nav-manage-palette');

    const ALL_VIEWS = [homeView, notifsView, paletteView];

    function showSubView(view) {
        ALL_VIEWS.forEach(v => { if (v) v.classList.add('hidden'); });
        if (view) view.classList.remove('hidden');
        if (btnVolver) btnVolver.style.visibility = 'visible';
    }

    function showHome() {
        ALL_VIEWS.forEach(v => { if (v) v.classList.add('hidden'); });
        if (homeView) homeView.classList.remove('hidden');
        if (btnVolver) btnVolver.style.visibility = 'hidden';
    }

    if (btnVolver) btnVolver.addEventListener('click', showHome);

    // ── Notifications ──────────────────────────────
    const toggleSparring = document.getElementById('notif-toggle-sparring');
    const toggleMensajes = document.getElementById('notif-toggle-mensajes');
    const toggleGimnasio = document.getElementById('notif-toggle-gimnasio');
    const toggleGeneral  = document.getElementById('notif-toggle-general');
    const btnSaveNotifs  = document.getElementById('btn-save-notifs');
    const NOTIF_PREFS_KEY = 'gloveup_notif_prefs';

    if (navManageNotifs) {
        navManageNotifs.addEventListener('click', () => {
            showSubView(notifsView);
            loadNotifPreferences();
        });
    }

    function loadNotifPreferences() {
        let prefs = { sparring: true, mensajes: true, gimnasio: true, general: true };
        try { const raw = localStorage.getItem(NOTIF_PREFS_KEY); if (raw) prefs = JSON.parse(raw); } catch (_) {}
        if (toggleSparring) toggleSparring.checked = prefs.sparring;
        if (toggleMensajes) toggleMensajes.checked = prefs.mensajes;
        if (toggleGimnasio) toggleGimnasio.checked = prefs.gimnasio;
        if (toggleGeneral)  toggleGeneral.checked  = prefs.general;
    }

    if (btnSaveNotifs) {
        btnSaveNotifs.addEventListener('click', () => {
            const prefs = {
                sparring: toggleSparring.checked,
                mensajes: toggleMensajes.checked,
                gimnasio: toggleGimnasio.checked,
                general:  toggleGeneral.checked
            };
            localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
            const orig = btnSaveNotifs.textContent;
            btnSaveNotifs.textContent = '¡Guardado!';
            btnSaveNotifs.style.backgroundColor = '#10b981';
            btnSaveNotifs.style.borderColor = '#10b981';
            setTimeout(() => {
                btnSaveNotifs.textContent = orig;
                btnSaveNotifs.style.backgroundColor = '';
                btnSaveNotifs.style.borderColor = '';
                showHome();
            }, 1000);
        });
    }

    // ── Palette ────────────────────────────────────
    const PALETTE_KEY = 'gloveup_palette';
    const ALL_PALETTE_CLASSES = ['palette-naranja', 'palette-azul', 'palette-verde', 'palette-morado', 'palette-rojo'];

    if (navManagePalette) {
        navManagePalette.addEventListener('click', () => {
            showSubView(paletteView);
            refreshPaletteUI();
        });
    }

    function refreshPaletteUI() {
        const current = localStorage.getItem(PALETTE_KEY) || '';
        document.querySelectorAll('.palette-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.palette === current);
        });
    }

    function applyPalette(palette) {
        ALL_PALETTE_CLASSES.forEach(cls => document.body.classList.remove(cls));
        if (palette) document.body.classList.add('palette-' + palette);
        localStorage.setItem(PALETTE_KEY, palette);
        refreshPaletteUI();
    }

    document.querySelectorAll('.palette-option').forEach(opt => {
        opt.addEventListener('click', () => applyPalette(opt.dataset.palette));
    });

    // ── Theme toggle ───────────────────────────────
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        const body = document.body;
        const THEME_KEY = 'gloveup_theme';
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme === 'dark') updateThemeIcon(true);

        themeBtn.addEventListener('click', () => {
            body.classList.toggle('theme-dark');
            const isDark = body.classList.contains('theme-dark');
            localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
            updateThemeIcon(isDark);
        });

        function updateThemeIcon(isDark) {
            const icon = themeBtn.querySelector('i');
            const text = themeBtn.querySelector('span');
            if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            if (text) text.textContent = isDark ? 'Tema Claro' : 'Tema Oscuro';
        }
    }

    // ── Logout ─────────────────────────────────────
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            ['gloveup_user_name','gloveup_user_email','gloveup_session_maintained',
             'gloveup_is_registered','gloveup_user_role','gloveup_user_dni'].forEach(k => localStorage.removeItem(k));
            sessionStorage.removeItem('gloveup_session_maintained');
            sessionStorage.removeItem('gloveup_user_id');
            window.location.href = '../auth/index.html';
        });
    }
});
