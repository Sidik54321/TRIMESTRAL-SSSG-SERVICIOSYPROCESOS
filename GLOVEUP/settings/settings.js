/**
 * settings.js — Módulo de configuración de GloveUp (settings/index.html).
 * Gestiona tres secciones accesibles desde un menú principal:
 *   · Notificaciones: toggles por tipo (sparring, mensajes, gimnasio, general)
 *     persistidos en localStorage y leídos por notifications.js.
 *   · Paleta de colores: personalización de fondo, primario y acento con
 *     cálculo automático de hover y sombras. Se aplica en tiempo real.
 *   · Tema oscuro/claro: toggle persistido en localStorage.
 * También incluye el botón de cerrar sesión con limpieza completa del storage.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─── REFERENCIAS A VISTAS Y NAVEGACIÓN ──────────────────────────────────

    const homeView = document.getElementById('settings-home-view');
    const notifsView = document.getElementById('settings-notifications-view');
    const paletteView = document.getElementById('settings-palette-view');
    const btnVolver = document.getElementById('btn-volver');
    const navManageNotifs = document.getElementById('nav-manage-notifications');
    const navManagePalette = document.getElementById('nav-manage-palette');

    // Array con todas las vistas para ocultar/mostrar cómodamente
    const ALL_VIEWS = [homeView, notifsView, paletteView];

    // ─── NAVEGACIÓN ENTRE VISTAS ─────────────────────────────────────────────

    /**
     * Oculta todas las vistas y muestra la indicada.
     * Hace visible el botón "Volver" al entrar en una subvista.
     */
    function showSubView(view) {
        ALL_VIEWS.forEach(v => {
            if (v) v.classList.add('hidden');
        });
        if (view) view.classList.remove('hidden');
        if (btnVolver) btnVolver.style.visibility = 'visible';
    }

    /**
     * Vuelve a la vista principal de ajustes (home).
     * Oculta el botón "Volver" ya que no hay dónde navegar hacia atrás.
     */
    function showHome() {
        ALL_VIEWS.forEach(v => {
            if (v) v.classList.add('hidden');
        });
        if (homeView) homeView.classList.remove('hidden');
        if (btnVolver) btnVolver.style.visibility = 'hidden';
    }

    if (btnVolver) btnVolver.addEventListener('click', showHome);

    // ─── SECCIÓN DE NOTIFICACIONES ───────────────────────────────────────────

    const toggleSparring = document.getElementById('notif-toggle-sparring');
    const toggleMensajes = document.getElementById('notif-toggle-mensajes');
    const toggleGimnasio = document.getElementById('notif-toggle-gimnasio');
    const toggleGeneral = document.getElementById('notif-toggle-general');
    const btnSaveNotifs = document.getElementById('btn-save-notifs');
    // Clave de localStorage compartida con notifications.js
    const NOTIF_PREFS_KEY = 'gloveup_notif_prefs';

    // Al entrar en la sección, cargar las preferencias guardadas
    if (navManageNotifs) {
        navManageNotifs.addEventListener('click', () => {
            showSubView(notifsView);
            loadNotifPreferences();
        });
    }

    /**
     * Lee las preferencias de notificaciones desde localStorage y
     * sincroniza el estado de cada toggle (checkbox).
     * Si no hay preferencias guardadas, todos los toggles quedan activados.
     */
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

    /**
     * Guarda las preferencias de notificaciones en localStorage.
     * Muestra feedback visual en el botón y vuelve al home tras 1 segundo.
     */
    if (btnSaveNotifs) {
        btnSaveNotifs.addEventListener('click', () => {
            const prefs = {
                sparring: toggleSparring.checked,
                mensajes: toggleMensajes.checked,
                gimnasio: toggleGimnasio.checked,
                general: toggleGeneral.checked
            };
            localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
            // Feedback temporal: cambiar el texto y color del botón durante 1 segundo
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

    // ─── SECCIÓN DE PALETA DE COLORES ────────────────────────────────────────

    // Claves de localStorage para cada componente de color personalizado
    const LEGACY_BG_KEY = 'gloveup_bg';           // Claves antiguas a limpiar
    const LEGACY_PALETTE_KEY = 'gloveup_palette';
    const CUSTOM_BG_KEY = 'gloveup_custom_bg';
    const CUSTOM_PRIMARY_KEY = 'gloveup_custom_primary';
    const CUSTOM_ACCENT_KEY = 'gloveup_custom_accent';

    /**
     * Elimina los ajustes de paleta del sistema anterior (presets predefinidos).
     * Garantiza que no haya clases CSS legacy en el body que interfieran
     * con el nuevo sistema de colores personalizados.
     */
    function clearLegacyPresets() {
        localStorage.removeItem(LEGACY_BG_KEY);
        localStorage.removeItem(LEGACY_PALETTE_KEY);
        Array.from(document.body.classList).forEach((cls) => {
            if (cls.startsWith('bg-') && cls !== 'bg-custom') document.body.classList.remove(cls);
            if (cls.startsWith('palette-')) document.body.classList.remove(cls);
        });
    }

    // Limpiar ajustes legacy al cargar la página
    clearLegacyPresets();

    // Al entrar en la sección paleta, limpiar legacies y sincronizar los inputs
    if (navManagePalette) {
        navManagePalette.addEventListener('click', () => {
            showSubView(paletteView);
            clearLegacyPresets();
            refreshCustomUI();
        });
    }

    // Referencias a los inputs de color y sus botones de reset
    const customBgInput = document.getElementById('custom-bg-color');
    const customPrimaryInput = document.getElementById('custom-primary-color');
    const customAccentInput = document.getElementById('custom-accent-color');
    const customBgReset = document.getElementById('custom-bg-reset');
    const customPrimaryReset = document.getElementById('custom-primary-reset');
    const customAccentReset = document.getElementById('custom-accent-reset');

    // ── Utilidades matemáticas de color ─────────────────────────────────────

    /** Limita un número al rango [min, max]. */
    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    /**
     * Convierte un color hexadecimal (#RRGGBB) a objeto { r, g, b }.
     * Devuelve null si el formato no es válido.
     */
    function hexToRgb(hex) {
        if (!hex) return null;
        const cleaned = hex.toString().trim().replace('#', '');
        if (cleaned.length !== 6) return null;
        const r = parseInt(cleaned.slice(0, 2), 16);
        const g = parseInt(cleaned.slice(2, 4), 16);
        const b = parseInt(cleaned.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) return null;
        return { r, g, b };
    }

    /** Convierte un objeto { r, g, b } a string hexadecimal (#RRGGBB). */
    function rgbToHex({ r, g, b }) {
        const toHex = (v) => clamp(v, 0, 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    /**
     * Mezcla dos colores hexadecimales en proporción t (0=hexA, 1=hexB).
     * Usado para calcular automáticamente colores de hover más claros u oscuros.
     */
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

    /** Genera un string rgba() a partir de un hex y un valor de opacidad (0-1). */
    function rgbaString(hex, alpha) {
        const rgb = hexToRgb(hex);
        if (!rgb) return `rgba(0,0,0,${alpha})`;
        const a = clamp(alpha, 0, 1);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
    }

    /**
     * Calcula la luminancia relativa de un color RGB según WCAG 2.1.
     * Usada para decidir si el hover debe aclararse u oscurecerse.
     */
    function relativeLuminance({ r, g, b }) {
        const toLinear = (v) => {
            const s = v / 255;
            // Corrección gamma según la fórmula sRGB de WCAG
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        const R = toLinear(r);
        const G = toLinear(g);
        const B = toLinear(b);
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    }

    /**
     * Genera automáticamente el color de hover de un color dado.
     * Los colores oscuros se aclaran un 12%; los claros se oscurecen un 12%.
     */
    function autoHover(hex) {
        const rgb = hexToRgb(hex);
        if (!rgb) return hex;
        const lum = relativeLuminance(rgb);
        return lum < 0.5 ? mixHex(hex, '#ffffff', 0.12) : mixHex(hex, '#000000', 0.12);
    }

    // ── Funciones de reset de color ──────────────────────────────────────────

    /**
     * Elimina el color de fondo personalizado del storage y del body.
     * Restaura las variables CSS de fondo a sus valores por defecto del tema.
     */
    function clearCustomBg() {
        localStorage.removeItem(CUSTOM_BG_KEY);
        document.body.classList.remove('bg-custom');
        ['--glv-bg-body', '--glv-bg-light', '--glv-bg-card', '--glv-bg-elevated', '--glv-glass-bg'].forEach((v) => {
            document.body.style.removeProperty(v);
        });
    }

    /** Elimina el color primario personalizado y restaura las variables CSS. */
    function clearCustomPrimary() {
        localStorage.removeItem(CUSTOM_PRIMARY_KEY);
        document.body.classList.remove('primary-custom');
        ['--glv-primary', '--glv-primary-hover'].forEach((v) => {
            document.body.style.removeProperty(v);
        });
    }

    /**
     * Elimina el color de acento personalizado y restaura todas sus variables CSS derivadas
     * (hover, soft, glow, sombras).
     */
    function clearCustomAccent() {
        localStorage.removeItem(CUSTOM_ACCENT_KEY);
        document.body.classList.remove('accent-custom');
        ['--glv-accent', '--glv-accent-hover', '--glv-accent-soft', '--glv-accent-glow', '--glv-shadow-accent', '--glv-shadow-accent-lg'].forEach((v) => {
            document.body.style.removeProperty(v);
        });
    }

    // ── Funciones de aplicación de color ────────────────────────────────────

    /**
     * Aplica un color de fondo personalizado.
     * Calcula variantes más claras para los niveles de superficie (card, elevated).
     * Persiste en localStorage y actualiza las variables CSS del body en tiempo real.
     */
    function applyCustomBg(hex) {
        const bgBody = hex;
        const bgLight = mixHex(hex, '#ffffff', 0.6); // Superficie más clara (60% blanco)
        const bgCard = '#ffffff';
        const bgElevated = '#ffffff';
        const glassBg = rgbaString(hex, 0.82); // Fondo translúcido para efectos glass

        const payload = { bgBody, bgLight, bgCard, bgElevated, glassBg };
        localStorage.setItem(CUSTOM_BG_KEY, JSON.stringify(payload));

        document.body.classList.add('bg-custom');
        document.body.style.setProperty('--glv-bg-body', bgBody);
        document.body.style.setProperty('--glv-bg-light', bgLight);
        document.body.style.setProperty('--glv-bg-card', bgCard);
        document.body.style.setProperty('--glv-bg-elevated', bgElevated);
        document.body.style.setProperty('--glv-glass-bg', glassBg);
    }

    /**
     * Aplica un color primario personalizado.
     * Calcula automáticamente el color de hover usando la luminancia.
     */
    function applyCustomPrimary(hex) {
        const primary = hex;
        const primaryHover = autoHover(hex); // Aclarar u oscurecer según luminancia

        const payload = { primary, primaryHover };
        localStorage.setItem(CUSTOM_PRIMARY_KEY, JSON.stringify(payload));

        document.body.classList.add('primary-custom');
        document.body.style.setProperty('--glv-primary', primary);
        document.body.style.setProperty('--glv-primary-hover', primaryHover);
    }

    /**
     * Aplica un color de acento personalizado.
     * Genera automáticamente todas las variantes: hover, soft (10% opacidad),
     * glow (25%), y sombras con y sin desenfoque extendido.
     */
    function applyCustomAccent(hex) {
        const accent = hex;
        const accentHover = mixHex(hex, '#000000', 0.18); // 18% más oscuro para hover
        const accentSoft = rgbaString(hex, 0.1);           // Versión muy translúcida
        const accentGlow = rgbaString(hex, 0.25);          // Para efectos de brillo
        const shadowAccent = `0 8px 24px ${rgbaString(hex, 0.16)}`;
        const shadowAccentLg = `0 16px 40px ${rgbaString(hex, 0.22)}`;

        const payload = { accent, accentHover, accentSoft, accentGlow, shadowAccent, shadowAccentLg };
        localStorage.setItem(CUSTOM_ACCENT_KEY, JSON.stringify(payload));

        document.body.classList.add('accent-custom');
        document.body.style.setProperty('--glv-accent', accent);
        document.body.style.setProperty('--glv-accent-hover', accentHover);
        document.body.style.setProperty('--glv-accent-soft', accentSoft);
        document.body.style.setProperty('--glv-accent-glow', accentGlow);
        document.body.style.setProperty('--glv-shadow-accent', shadowAccent);
        document.body.style.setProperty('--glv-shadow-accent-lg', shadowAccentLg);
    }

    /**
     * Sincroniza los inputs de color con los valores guardados en localStorage.
     * Si no hay valor guardado, usa los colores por defecto del sistema.
     * Llamada al entrar en la sección paleta y después de cada reset.
     */
    function refreshCustomUI() {
        // Valores por defecto del sistema GloveUp
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

        // Actualizar los inputs de tipo color con los valores leídos
        if (customBgInput) customBgInput.value = bgValue;
        if (customPrimaryInput) customPrimaryInput.value = primaryValue;
        if (customAccentInput) customAccentInput.value = accentValue;
    }

    // ── Eventos de los inputs de color (aplicación en tiempo real) ───────────

    // Fondo: aplicar en tiempo real al cambiar el picker (solo si el hex es válido)
    if (customBgInput) {
        customBgInput.addEventListener('input', () => {
            const val = (customBgInput.value || '').toString();
            if (!hexToRgb(val)) return; // Ignorar valores parciales durante la selección
            clearLegacyPresets();
            applyCustomBg(val);
        });
    }

    // Primario: aplicar en tiempo real
    if (customPrimaryInput) {
        customPrimaryInput.addEventListener('input', () => {
            const val = (customPrimaryInput.value || '').toString();
            if (!hexToRgb(val)) return;
            applyCustomPrimary(val);
        });
    }

    // Acento: aplicar en tiempo real (limpiar legacy antes para evitar conflictos)
    if (customAccentInput) {
        customAccentInput.addEventListener('input', () => {
            const val = (customAccentInput.value || '').toString();
            if (!hexToRgb(val)) return;
            clearLegacyPresets();
            applyCustomAccent(val);
        });
    }

    // ── Botones de reset ─────────────────────────────────────────────────────

    if (customBgReset) {
        customBgReset.addEventListener('click', () => {
            clearCustomBg();
            refreshCustomUI(); // Volver a mostrar el valor por defecto en el input
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

    // ─── SECCIÓN DE TEMA OSCURO / CLARO ─────────────────────────────────────

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        const body = document.body;
        const THEME_KEY = 'gloveup_theme';
        // Aplicar el tema guardado al cargar (sin transición inicial)
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme === 'dark') updateThemeIcon(true);

        themeBtn.addEventListener('click', () => {
            body.classList.toggle('theme-dark');
            const isDark = body.classList.contains('theme-dark');
            localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
            updateThemeIcon(isDark);
        });

        /**
         * Actualiza el icono y el texto del botón de tema.
         * Modo oscuro → icono sol + "Tema Claro" (para volver al claro).
         * Modo claro → icono luna + "Tema Oscuro" (para activar el oscuro).
         */
        function updateThemeIcon(isDark) {
            const icon = themeBtn.querySelector('i');
            const text = themeBtn.querySelector('span');
            if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            if (text) text.textContent = isDark ? 'Tema Claro' : 'Tema Oscuro';
        }
    }

    // ─── CERRAR SESIÓN ───────────────────────────────────────────────────────

    /**
     * Limpia todos los datos de sesión de localStorage y sessionStorage
     * antes de redirigir a la página de autenticación.
     */
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // Eliminar todas las claves de sesión del usuario
            ['gloveup_user_name', 'gloveup_user_email', 'gloveup_session_maintained',
                'gloveup_is_registered', 'gloveup_user_role', 'gloveup_user_dni'
            ].forEach(k => localStorage.removeItem(k));
            sessionStorage.removeItem('gloveup_session_maintained');
            sessionStorage.removeItem('gloveup_user_id');
            window.location.href = '../auth/index.html';
        });
    }
});
