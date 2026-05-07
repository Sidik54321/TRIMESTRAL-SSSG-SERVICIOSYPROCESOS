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
        ALL_VIEWS.forEach(v => {
            if (v) v.classList.add('hidden');
        });
        if (view) view.classList.remove('hidden');
        if (btnVolver) btnVolver.style.visibility = 'visible';
    }

    function showHome() {
        ALL_VIEWS.forEach(v => {
            if (v) v.classList.add('hidden');
        });
        if (homeView) homeView.classList.remove('hidden');
        if (btnVolver) btnVolver.style.visibility = 'hidden';
    }

    if (btnVolver) btnVolver.addEventListener('click', showHome);

    // ── Notifications ──────────────────────────────
    const toggleSparring = document.getElementById('notif-toggle-sparring');
    const toggleMensajes = document.getElementById('notif-toggle-mensajes');
    const toggleGimnasio = document.getElementById('notif-toggle-gimnasio');
    const toggleGeneral = document.getElementById('notif-toggle-general');
    const btnSaveNotifs = document.getElementById('btn-save-notifs');
    const NOTIF_PREFS_KEY = 'gloveup_notif_prefs';

    if (navManageNotifs) {
        navManageNotifs.addEventListener('click', () => {
            showSubView(notifsView);
            loadNotifPreferences();
        });
    }

    function loadNotifPreferences() {
        let prefs = {
            sparring: true,
            mensajes: true,
            gimnasio: true,
            general: true
        };
        try {
            const raw = localStorage.getItem(NOTIF_PREFS_KEY);
            if (raw) prefs = JSON.parse(raw);
        } catch (_) {}
        if (toggleSparring) toggleSparring.checked = prefs.sparring;
        if (toggleMensajes) toggleMensajes.checked = prefs.mensajes;
        if (toggleGimnasio) toggleGimnasio.checked = prefs.gimnasio;
        if (toggleGeneral) toggleGeneral.checked = prefs.general;
    }

    if (btnSaveNotifs) {
        btnSaveNotifs.addEventListener('click', () => {
            const prefs = {
                sparring: toggleSparring.checked,
                mensajes: toggleMensajes.checked,
                gimnasio: toggleGimnasio.checked,
                general: toggleGeneral.checked
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
    const LEGACY_BG_KEY = 'gloveup_bg';
    const LEGACY_PALETTE_KEY = 'gloveup_palette';
    const CUSTOM_BG_KEY = 'gloveup_custom_bg';
    const CUSTOM_PRIMARY_KEY = 'gloveup_custom_primary';
    const CUSTOM_ACCENT_KEY = 'gloveup_custom_accent';

    function clearLegacyPresets() {
        localStorage.removeItem(LEGACY_BG_KEY);
        localStorage.removeItem(LEGACY_PALETTE_KEY);
        Array.from(document.body.classList).forEach((cls) => {
            if (cls.startsWith('bg-') && cls !== 'bg-custom') document.body.classList.remove(cls);
            if (cls.startsWith('palette-')) document.body.classList.remove(cls);
        });
    }

    clearLegacyPresets();

    if (navManagePalette) {
        navManagePalette.addEventListener('click', () => {
            showSubView(paletteView);
            clearLegacyPresets();
            refreshCustomUI();
        });
    }

    const customBgInput = document.getElementById('custom-bg-color');
    const customPrimaryInput = document.getElementById('custom-primary-color');
    const customAccentInput = document.getElementById('custom-accent-color');
    const customBgReset = document.getElementById('custom-bg-reset');
    const customPrimaryReset = document.getElementById('custom-primary-reset');
    const customAccentReset = document.getElementById('custom-accent-reset');

    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    function hexToRgb(hex) {
        if (!hex) return null;
        const cleaned = hex.toString().trim().replace('#', '');
        if (cleaned.length !== 6) return null;
        const r = parseInt(cleaned.slice(0, 2), 16);
        const g = parseInt(cleaned.slice(2, 4), 16);
        const b = parseInt(cleaned.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) return null;
        return {
            r,
            g,
            b
        };
    }

    function rgbToHex({
        r,
        g,
        b
    }) {
        const toHex = (v) => clamp(v, 0, 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    function mixHex(hexA, hexB, t) {
        const a = hexToRgb(hexA);
        const b = hexToRgb(hexB);
        if (!a || !b) return hexA;
        const tt = clamp(t, 0, 1);
        return rgbToHex({
            r: Math.round(a.r * (1 - tt) + b.r * tt),
            g: Math.round(a.g * (1 - tt) + b.g * tt),
            b: Math.round(a.b * (1 - tt) + b.b * tt)
        });
    }

    function rgbaString(hex, alpha) {
        const rgb = hexToRgb(hex);
        if (!rgb) return `rgba(0,0,0,${alpha})`;
        const a = clamp(alpha, 0, 1);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
    }

    function relativeLuminance({
        r,
        g,
        b
    }) {
        const toLinear = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        const R = toLinear(r);
        const G = toLinear(g);
        const B = toLinear(b);
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    }

    function autoHover(hex) {
        const rgb = hexToRgb(hex);
        if (!rgb) return hex;
        const lum = relativeLuminance(rgb);
        return lum < 0.5 ? mixHex(hex, '#ffffff', 0.12) : mixHex(hex, '#000000', 0.12);
    }

    function clearCustomBg() {
        localStorage.removeItem(CUSTOM_BG_KEY);
        document.body.classList.remove('bg-custom');
        ['--glv-bg-body', '--glv-bg-light', '--glv-bg-card', '--glv-bg-elevated', '--glv-glass-bg'].forEach((v) => {
            document.body.style.removeProperty(v);
        });
    }

    function clearCustomPrimary() {
        localStorage.removeItem(CUSTOM_PRIMARY_KEY);
        document.body.classList.remove('primary-custom');
        ['--glv-primary', '--glv-primary-hover'].forEach((v) => {
            document.body.style.removeProperty(v);
        });
    }

    function clearCustomAccent() {
        localStorage.removeItem(CUSTOM_ACCENT_KEY);
        document.body.classList.remove('accent-custom');
        ['--glv-accent', '--glv-accent-hover', '--glv-accent-soft', '--glv-accent-glow', '--glv-shadow-accent', '--glv-shadow-accent-lg'].forEach((v) => {
            document.body.style.removeProperty(v);
        });
    }

    function applyCustomBg(hex) {
        const bgBody = hex;
        const bgLight = mixHex(hex, '#ffffff', 0.6);
        const bgCard = '#ffffff';
        const bgElevated = '#ffffff';
        const glassBg = rgbaString(hex, 0.82);

        const payload = {
            bgBody,
            bgLight,
            bgCard,
            bgElevated,
            glassBg
        };
        localStorage.setItem(CUSTOM_BG_KEY, JSON.stringify(payload));

        document.body.classList.add('bg-custom');
        document.body.style.setProperty('--glv-bg-body', bgBody);
        document.body.style.setProperty('--glv-bg-light', bgLight);
        document.body.style.setProperty('--glv-bg-card', bgCard);
        document.body.style.setProperty('--glv-bg-elevated', bgElevated);
        document.body.style.setProperty('--glv-glass-bg', glassBg);
    }

    function applyCustomPrimary(hex) {
        const primary = hex;
        const primaryHover = autoHover(hex);

        const payload = {
            primary,
            primaryHover
        };
        localStorage.setItem(CUSTOM_PRIMARY_KEY, JSON.stringify(payload));

        document.body.classList.add('primary-custom');
        document.body.style.setProperty('--glv-primary', primary);
        document.body.style.setProperty('--glv-primary-hover', primaryHover);
    }

    function applyCustomAccent(hex) {
        const accent = hex;
        const accentHover = mixHex(hex, '#000000', 0.18);
        const accentSoft = rgbaString(hex, 0.1);
        const accentGlow = rgbaString(hex, 0.25);
        const shadowAccent = `0 8px 24px ${rgbaString(hex, 0.16)}`;
        const shadowAccentLg = `0 16px 40px ${rgbaString(hex, 0.22)}`;

        const payload = {
            accent,
            accentHover,
            accentSoft,
            accentGlow,
            shadowAccent,
            shadowAccentLg
        };
        localStorage.setItem(CUSTOM_ACCENT_KEY, JSON.stringify(payload));

        document.body.classList.add('accent-custom');
        document.body.style.setProperty('--glv-accent', accent);
        document.body.style.setProperty('--glv-accent-hover', accentHover);
        document.body.style.setProperty('--glv-accent-soft', accentSoft);
        document.body.style.setProperty('--glv-accent-glow', accentGlow);
        document.body.style.setProperty('--glv-shadow-accent', shadowAccent);
        document.body.style.setProperty('--glv-shadow-accent-lg', shadowAccentLg);
    }

    function refreshCustomUI() {
        let bgValue = '#f8fafc';
        let primaryValue = '#0a0a0a';
        let accentValue = '#f97316';

        try {
            const rawBg = localStorage.getItem(CUSTOM_BG_KEY);
            if (rawBg) {
                const parsed = JSON.parse(rawBg);
                if (parsed && typeof parsed.bgBody === 'string') bgValue = parsed.bgBody;
            }
        } catch (_) {}

        try {
            const rawPrimary = localStorage.getItem(CUSTOM_PRIMARY_KEY);
            if (rawPrimary) {
                const parsed = JSON.parse(rawPrimary);
                if (parsed && typeof parsed.primary === 'string') primaryValue = parsed.primary;
            }
        } catch (_) {}

        try {
            const rawAccent = localStorage.getItem(CUSTOM_ACCENT_KEY);
            if (rawAccent) {
                const parsed = JSON.parse(rawAccent);
                if (parsed && typeof parsed.accent === 'string') accentValue = parsed.accent;
            }
        } catch (_) {}

        if (customBgInput) customBgInput.value = bgValue;
        if (customPrimaryInput) customPrimaryInput.value = primaryValue;
        if (customAccentInput) customAccentInput.value = accentValue;
    }

    if (customBgInput) {
        customBgInput.addEventListener('input', () => {
            const val = (customBgInput.value || '').toString();
            if (!hexToRgb(val)) return;
            clearLegacyPresets();
            applyCustomBg(val);
        });
    }

    if (customPrimaryInput) {
        customPrimaryInput.addEventListener('input', () => {
            const val = (customPrimaryInput.value || '').toString();
            if (!hexToRgb(val)) return;
            applyCustomPrimary(val);
        });
    }

    if (customAccentInput) {
        customAccentInput.addEventListener('input', () => {
            const val = (customAccentInput.value || '').toString();
            if (!hexToRgb(val)) return;
            clearLegacyPresets();
            applyCustomAccent(val);
        });
    }

    if (customBgReset) {
        customBgReset.addEventListener('click', () => {
            clearCustomBg();
            refreshCustomUI();
        });
    }

    if (customPrimaryReset) {
        customPrimaryReset.addEventListener('click', () => {
            clearCustomPrimary();
            refreshCustomUI();
        });
    }

    if (customAccentReset) {
        customAccentReset.addEventListener('click', () => {
            clearCustomAccent();
            refreshCustomUI();
        });
    }

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
            ['gloveup_user_name', 'gloveup_user_email', 'gloveup_session_maintained',
                'gloveup_is_registered', 'gloveup_user_role', 'gloveup_user_dni'
            ].forEach(k => localStorage.removeItem(k));
            sessionStorage.removeItem('gloveup_session_maintained');
            sessionStorage.removeItem('gloveup_user_id');
            window.location.href = '../auth/index.html';
        });
    }
});