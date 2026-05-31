/**
 * settings.js — Módulo de configuración de GloveUp (settings/index.html).
 *
 * Este archivo gestiona toda la lógica interactiva de la página de ajustes.
 * La página se divide en tres secciones accesibles desde un menú principal:
 *
 *   · Notificaciones: permite activar/desactivar las notificaciones por tipo
 *     (sparring, mensajes, gimnasio, general). Las preferencias se persisten en
 *     localStorage bajo la clave 'gloveup_notif_prefs' y son leídas por
 *     notifications.js en el resto de la app.
 *
 *   · Paleta de colores: permite personalizar el color de fondo, el color primario
 *     y el color de acento de la interfaz. Los colores se aplican en tiempo real
 *     mediante variables CSS en el body. El sistema calcula automáticamente colores
 *     derivados (hover, soft, glow, sombras) para mantener coherencia visual.
 *     Los valores se persisten en localStorage por separado para cada componente.
 *
 *   · Tema oscuro/claro: toggle que añade/quita la clase CSS 'theme-dark' en el
 *     body. El estado se persiste en localStorage.
 *
 * También se incluye el botón de cerrar sesión, que elimina todas las claves
 * de sesión del usuario y redirige a la pantalla de autenticación.
 *
 * Dependencias:
 *   - El HTML debe tener los IDs indicados en cada sección del código.
 *   - notifications.js lee 'gloveup_notif_prefs' para filtrar notificaciones.
 *   - Las variables CSS (--glv-*) deben estar declaradas en el CSS global.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─── REFERENCIAS A VISTAS Y NAVEGACIÓN ──────────────────────────────────
    // Cada "vista" es un bloque HTML que se muestra u oculta mediante la clase
    // CSS 'hidden'. Sólo una vista puede estar visible a la vez.

    const homeView = document.getElementById('settings-home-view');        // Menú principal de ajustes
    const notifsView = document.getElementById('settings-notifications-view'); // Subvista de notificaciones
    const paletteView = document.getElementById('settings-palette-view');  // Subvista de paleta de colores
    const btnVolver = document.getElementById('btn-volver');               // Botón "← Volver" a homeView
    const navManageNotifs = document.getElementById('nav-manage-notifications');  // Enlace a la subvista de notificaciones
    const navManagePalette = document.getElementById('nav-manage-palette');       // Enlace a la subvista de paleta

    // Array que agrupa todas las vistas para poder ocultarlas todas de una sola vez
    // antes de mostrar la vista destino. Facilita escalar si se añaden más secciones.
    const ALL_VIEWS = [homeView, notifsView, paletteView];

    // ─── NAVEGACIÓN ENTRE VISTAS ─────────────────────────────────────────────

    /**
     * Oculta todas las vistas del array ALL_VIEWS y muestra únicamente la
     * vista pasada como argumento. Además hace visible el botón "Volver"
     * porque el usuario ha entrado en una subvista y puede querer regresar.
     *
     * @param {HTMLElement} view - El elemento DOM de la vista a mostrar.
     */
    function showSubView(view) {
        // Añadir 'hidden' a todas las vistas para asegurar que solo una esté visible
        ALL_VIEWS.forEach(v => {
            if (v) v.classList.add('hidden');
        });
        // Quitar 'hidden' solo de la vista destino
        if (view) view.classList.remove('hidden');
        // Mostrar el botón "Volver" ya que ahora hay una pantalla anterior a la que volver
        if (btnVolver) btnVolver.style.visibility = 'visible';
    }

    /**
     * Vuelve a la vista principal (homeView). Oculta todas las subvistas y
     * oculta también el botón "Volver" porque desde el home no hay adónde retroceder.
     */
    function showHome() {
        // Ocultar todas las vistas primero
        ALL_VIEWS.forEach(v => {
            if (v) v.classList.add('hidden');
        });
        // Mostrar solo el home
        if (homeView) homeView.classList.remove('hidden');
        // Ocultar el botón "Volver" porque desde el home no se puede navegar atrás
        if (btnVolver) btnVolver.style.visibility = 'hidden';
    }

    // Asignar el comportamiento de retroceso al botón "Volver"
    if (btnVolver) btnVolver.addEventListener('click', showHome);

    // ─── SECCIÓN DE NOTIFICACIONES ───────────────────────────────────────────
    // Los toggles son checkboxes HTML (<input type="checkbox">). El estado de
    // cada uno representa si ese tipo de notificación está activado o no.

    const toggleSparring = document.getElementById('notif-toggle-sparring'); // Toggle para notificaciones de sparring
    const toggleMensajes = document.getElementById('notif-toggle-mensajes'); // Toggle para mensajes directos
    const toggleGimnasio = document.getElementById('notif-toggle-gimnasio'); // Toggle para avisos del gimnasio
    const toggleGeneral = document.getElementById('notif-toggle-general');   // Toggle para notificaciones generales
    const btnSaveNotifs = document.getElementById('btn-save-notifs');        // Botón para guardar las preferencias

    // Clave de localStorage compartida con notifications.js. Cambiar esta clave
    // aquí también requiere actualizarla en notifications.js para mantener la sincronía.
    const NOTIF_PREFS_KEY = 'gloveup_notif_prefs';

    // Al hacer clic en el enlace de navegación, primero mostrar la subvista
    // y después cargar las preferencias guardadas para que los toggles
    // reflejen el estado actual del usuario.
    if (navManageNotifs) {
        navManageNotifs.addEventListener('click', () => {
            showSubView(notifsView);
            loadNotifPreferences(); // Sincronizar los checkboxes con lo guardado
        });
    }

    /**
     * Lee las preferencias de notificaciones desde localStorage y las aplica
     * a los checkboxes de la UI. Se llama al entrar en la sección de notificaciones.
     *
     * Flujo:
     *  1. Define valores por defecto (todos activados).
     *  2. Intenta leer y parsear el JSON de localStorage.
     *  3. Si la lectura falla (JSON corrupto, clave inexistente), usa los defaults.
     *  4. Asigna el valor booleano a la propiedad `.checked` de cada toggle.
     *
     * El try/catch silencia cualquier error de parseo para no romper la UI
     * si localStorage contiene datos corruptos de una versión anterior.
     */
    function loadNotifPreferences() {
        // Valores por defecto: todas las notificaciones activadas
        let prefs = {
            sparring: true,
            mensajes: true,
            gimnasio: true,
            general: true
        };
        try {
            const raw = localStorage.getItem(NOTIF_PREFS_KEY);
            if (raw) prefs = JSON.parse(raw); // Sobrescribir defaults si hay datos guardados
        } catch (_) {
            // Si el JSON está corrupto, se usan los valores por defecto (todos true)
        }
        // Aplicar cada preferencia al checkbox correspondiente
        if (toggleSparring) toggleSparring.checked = prefs.sparring;
        if (toggleMensajes) toggleMensajes.checked = prefs.mensajes;
        if (toggleGimnasio) toggleGimnasio.checked = prefs.gimnasio;
        if (toggleGeneral) toggleGeneral.checked = prefs.general;
    }

    /**
     * Guarda las preferencias de notificaciones actuales en localStorage y
     * proporciona feedback visual al usuario antes de volver al home.
     *
     * Flujo:
     *  1. Lee el estado actual de cada toggle (.checked).
     *  2. Serializa el objeto a JSON y lo guarda en localStorage.
     *  3. Cambia temporalmente el texto y color del botón a "¡Guardado!" (verde).
     *  4. Tras 1 segundo restaura el botón y navega de vuelta al home.
     *
     * El feedback visual evita que el usuario quede con la duda de si se guardó.
     */
    if (btnSaveNotifs) {
        btnSaveNotifs.addEventListener('click', () => {
            // Construir el objeto de preferencias leyendo el estado actual de los toggles
            const prefs = {
                sparring: toggleSparring.checked,
                mensajes: toggleMensajes.checked,
                gimnasio: toggleGimnasio.checked,
                general: toggleGeneral.checked
            };
            // Persistir en localStorage para que notifications.js lo lea
            localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));

            // Feedback visual: cambiar el texto y color del botón durante 1 segundo
            const orig = btnSaveNotifs.textContent; // Guardar texto original para restaurarlo
            btnSaveNotifs.textContent = '¡Guardado!';
            btnSaveNotifs.style.backgroundColor = '#10b981'; // Verde de confirmación
            btnSaveNotifs.style.borderColor = '#10b981';
            setTimeout(() => {
                // Restaurar el botón a su estado original tras el feedback
                btnSaveNotifs.textContent = orig;
                btnSaveNotifs.style.backgroundColor = '';
                btnSaveNotifs.style.borderColor = '';
                showHome(); // Volver al menú principal después del guardado
            }, 1000);
        });
    }

    // ─── SECCIÓN DE PALETA DE COLORES ────────────────────────────────────────
    // El sistema de paleta usa tres colores independientes: fondo, primario y acento.
    // Cada uno se guarda en su propia clave de localStorage como un objeto JSON
    // con el color base y todas sus variantes calculadas.
    //
    // Las claves LEGACY_* corresponden al sistema anterior de presets predefinidos
    // (por ejemplo, "palette-blue", "bg-dark"). Se eliminan automáticamente para
    // evitar conflictos de clases CSS con el nuevo sistema de colores personalizados.

    const LEGACY_BG_KEY = 'gloveup_bg';           // Clave del sistema antiguo de fondo
    const LEGACY_PALETTE_KEY = 'gloveup_palette'; // Clave del sistema antiguo de paleta
    const CUSTOM_BG_KEY = 'gloveup_custom_bg';       // Color de fondo personalizado (nuevo sistema)
    const CUSTOM_PRIMARY_KEY = 'gloveup_custom_primary'; // Color primario personalizado
    const CUSTOM_ACCENT_KEY = 'gloveup_custom_accent';   // Color de acento personalizado

    /**
     * Elimina los ajustes del sistema de presets anterior para que no interfieran
     * con el nuevo sistema de colores personalizados.
     *
     * Acciones:
     *  1. Elimina las claves antiguas de localStorage.
     *  2. Elimina del body las clases CSS de fondo antiguas (bg-*) excepto 'bg-custom'.
     *  3. Elimina del body las clases CSS de paleta antigua (palette-*).
     *
     * Se llama al cargar la página y al entrar en la sección de paleta para garantizar
     * que no queden restos del sistema viejo que puedan sobreescribir el nuevo.
     */
    function clearLegacyPresets() {
        // Eliminar las claves del sistema antiguo del localStorage
        localStorage.removeItem(LEGACY_BG_KEY);
        localStorage.removeItem(LEGACY_PALETTE_KEY);
        // Recorrer todas las clases del body y eliminar las que sean del sistema viejo
        Array.from(document.body.classList).forEach((cls) => {
            // Eliminar clases de fondo antiguas (ej: 'bg-gray', 'bg-blue') pero NO 'bg-custom'
            if (cls.startsWith('bg-') && cls !== 'bg-custom') document.body.classList.remove(cls);
            // Eliminar clases de paleta antiguas (ej: 'palette-blue', 'palette-orange')
            if (cls.startsWith('palette-')) document.body.classList.remove(cls);
        });
    }

    // Limpiar ajustes legacy al cargar la página, antes de que el usuario interactúe,
    // para asegurar un estado limpio desde el inicio de la sesión.
    clearLegacyPresets();

    // Al entrar en la sección de paleta, limpiar posibles residuos legacy y
    // sincronizar los color pickers con los valores actualmente guardados.
    if (navManagePalette) {
        navManagePalette.addEventListener('click', () => {
            showSubView(paletteView);
            clearLegacyPresets();  // Asegurar que no queden clases legacy activas
            refreshCustomUI();     // Mostrar en los inputs los colores guardados actualmente
        });
    }

    // Referencias a los inputs de tipo color (<input type="color">) y sus botones
    // de reset, que devuelven cada color a su valor por defecto del sistema.
    const customBgInput = document.getElementById('custom-bg-color');           // Picker de color de fondo
    const customPrimaryInput = document.getElementById('custom-primary-color'); // Picker de color primario
    const customAccentInput = document.getElementById('custom-accent-color');   // Picker de color de acento
    const customBgReset = document.getElementById('custom-bg-reset');           // Botón reset de fondo
    const customPrimaryReset = document.getElementById('custom-primary-reset'); // Botón reset de primario
    const customAccentReset = document.getElementById('custom-accent-reset');   // Botón reset de acento

    // ── Utilidades matemáticas de color ─────────────────────────────────────
    // Estas funciones convierten entre formatos de color (hex ↔ rgb) y realizan
    // operaciones matemáticas necesarias para calcular variantes de un color.

    /**
     * Limita un número al rango [min, max] (clamp matemático).
     * Evita desbordamientos al calcular valores de canal de color (0-255) o
     * valores de opacidad (0-1).
     *
     * @param {number} n - Valor a limitar.
     * @param {number} min - Límite inferior.
     * @param {number} max - Límite superior.
     * @returns {number} El valor limitado al rango.
     */
    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    /**
     * Convierte un color en formato hexadecimal (#RRGGBB) a un objeto con los
     * valores enteros de cada canal RGB. Solo acepta el formato de 6 dígitos.
     *
     * @param {string} hex - Color en formato '#RRGGBB' (con o sin #).
     * @returns {{ r: number, g: number, b: number } | null} Objeto RGB o null si el formato es inválido.
     */
    function hexToRgb(hex) {
        if (!hex) return null;
        const cleaned = hex.toString().trim().replace('#', ''); // Eliminar el # si lo tiene
        if (cleaned.length !== 6) return null; // Solo se acepta formato de 6 dígitos
        // Parsear cada par de dígitos hexadecimales como entero en base 16
        const r = parseInt(cleaned.slice(0, 2), 16);
        const g = parseInt(cleaned.slice(2, 4), 16);
        const b = parseInt(cleaned.slice(4, 6), 16);
        // Si algún canal no es un número válido, el hex era inválido
        if ([r, g, b].some(Number.isNaN)) return null;
        return { r, g, b };
    }

    /**
     * Convierte un objeto con canales RGB enteros a string hexadecimal (#RRGGBB).
     * Aplica clamp(0,255) a cada canal antes de convertir para garantizar
     * que el resultado sea un hex de color válido.
     *
     * @param {{ r: number, g: number, b: number }} param0 - Objeto con canales RGB.
     * @returns {string} Color en formato '#RRGGBB'.
     */
    function rgbToHex({ r, g, b }) {
        // Convertir cada canal a hexadecimal de 2 dígitos con padding
        const toHex = (v) => clamp(v, 0, 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    /**
     * Mezcla linealmente dos colores hexadecimales según un factor t.
     * Cuando t=0 devuelve hexA puro; cuando t=1 devuelve hexB puro.
     * Valores intermedios producen una mezcla proporcional canal por canal.
     *
     * Usado para calcular variantes más claras (mezcla con #ffffff) o más
     * oscuras (mezcla con #000000) de un color base.
     *
     * @param {string} hexA - Color base (t=0).
     * @param {string} hexB - Color destino (t=1).
     * @param {number} t - Factor de mezcla en [0, 1].
     * @returns {string} Color resultante en formato '#RRGGBB'.
     */
    function mixHex(hexA, hexB, t) {
        const a = hexToRgb(hexA);
        const b = hexToRgb(hexB);
        if (!a || !b) return hexA; // Si alguno es inválido, devolver el color base sin cambios
        const tt = clamp(t, 0, 1); // Asegurar que el factor esté en [0,1]
        return rgbToHex({
            // Interpolación lineal canal por canal: a*(1-t) + b*t
            r: Math.round(a.r * (1 - tt) + b.r * tt),
            g: Math.round(a.g * (1 - tt) + b.g * tt),
            b: Math.round(a.b * (1 - tt) + b.b * tt)
        });
    }

    /**
     * Genera un string CSS rgba() a partir de un color hexadecimal y un valor
     * de opacidad. Se usa para crear variantes translúcidas de un color (soft, glow,
     * glass, sombras semitransparentes).
     *
     * @param {string} hex - Color base en formato '#RRGGBB'.
     * @param {number} alpha - Opacidad en [0, 1] (0=transparente, 1=opaco).
     * @returns {string} String CSS de la forma 'rgba(r, g, b, a)'.
     */
    function rgbaString(hex, alpha) {
        const rgb = hexToRgb(hex);
        if (!rgb) return `rgba(0,0,0,${alpha})`; // Fallback a negro si el hex es inválido
        const a = clamp(alpha, 0, 1);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
    }

    /**
     * Calcula la luminancia relativa de un color RGB según la especificación WCAG 2.1.
     * La luminancia es una medida de cuánta luz percibe el ojo humano en un color,
     * independientemente del tono. Va de 0 (negro absoluto) a 1 (blanco absoluto).
     *
     * Se usa para decidir si el estado hover de un color debe ser más claro
     * (colores oscuros → aclarar) o más oscuro (colores claros → oscurecer),
     * garantizando que el contraste sea siempre perceptible.
     *
     * Fórmula: L = 0.2126·R + 0.7152·G + 0.0722·B (en espacio lineal sRGB).
     *
     * @param {{ r: number, g: number, b: number }} param0 - Color en espacio sRGB (0-255).
     * @returns {number} Luminancia relativa en [0, 1].
     */
    function relativeLuminance({ r, g, b }) {
        const toLinear = (v) => {
            const s = v / 255; // Normalizar al rango [0, 1]
            // Corrección gamma sRGB según WCAG: valores muy oscuros usan escala lineal,
            // el resto usa la curva de potencia estándar de gamma 2.2 aproximado.
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        const R = toLinear(r);
        const G = toLinear(g);
        const B = toLinear(b);
        // Coeficientes de luminosidad perceptual del ojo humano (más sensible al verde)
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    }

    /**
     * Calcula automáticamente el color de hover para un color dado.
     * La dirección del hover (aclarar u oscurecer) depende de la luminancia:
     *   - Colores oscuros (luminancia < 0.5): se mezclan un 12% con blanco → más claro.
     *   - Colores claros (luminancia >= 0.5): se mezclan un 12% con negro → más oscuro.
     *
     * El 12% de mezcla es suficiente para que el hover sea perceptible sin alterar
     * demasiado el color original.
     *
     * @param {string} hex - Color base en formato '#RRGGBB'.
     * @returns {string} Color de hover derivado en formato '#RRGGBB'.
     */
    function autoHover(hex) {
        const rgb = hexToRgb(hex);
        if (!rgb) return hex; // Si el hex es inválido, devolver el mismo color sin cambios
        const lum = relativeLuminance(rgb);
        // Aclarar si el color es oscuro, oscurecer si es claro
        return lum < 0.5 ? mixHex(hex, '#ffffff', 0.12) : mixHex(hex, '#000000', 0.12);
    }

    // ── Funciones de reset de color ──────────────────────────────────────────
    // Cada función de reset realiza tres operaciones:
    //   1. Eliminar la clave correspondiente de localStorage.
    //   2. Quitar la clase CSS de personalización del body.
    //   3. Eliminar las propiedades CSS inline del body para que el CSS base tome el control.

    /**
     * Restablece el color de fondo al valor por defecto del tema.
     * Elimina el objeto de fondo de localStorage, quita la clase 'bg-custom' del body,
     * y elimina las variables CSS inline de fondo para que el CSS global vuelva a aplicarse.
     *
     * Variables CSS afectadas:
     *   --glv-bg-body, --glv-bg-light, --glv-bg-card, --glv-bg-elevated, --glv-glass-bg
     */
    function clearCustomBg() {
        localStorage.removeItem(CUSTOM_BG_KEY); // Eliminar datos persistidos
        document.body.classList.remove('bg-custom'); // Quitar clase de personalización
        // Eliminar las propiedades CSS inline para que el stylesheet tome el control
        ['--glv-bg-body', '--glv-bg-light', '--glv-bg-card', '--glv-bg-elevated', '--glv-glass-bg'].forEach((v) => {
            document.body.style.removeProperty(v);
        });
    }

    /**
     * Restablece el color primario al valor por defecto del tema.
     * Elimina el objeto de color primario de localStorage, quita la clase
     * 'primary-custom' del body, y elimina las variables CSS inline de primario.
     *
     * Variables CSS afectadas: --glv-primary, --glv-primary-hover
     */
    function clearCustomPrimary() {
        localStorage.removeItem(CUSTOM_PRIMARY_KEY);
        document.body.classList.remove('primary-custom');
        ['--glv-primary', '--glv-primary-hover'].forEach((v) => {
            document.body.style.removeProperty(v);
        });
    }

    /**
     * Restablece el color de acento al valor por defecto del tema.
     * Elimina todos los datos del acento personalizado de localStorage, quita la
     * clase 'accent-custom' del body, y elimina todas las variables CSS derivadas
     * del acento (hover, soft, glow, sombras).
     *
     * Variables CSS afectadas:
     *   --glv-accent, --glv-accent-hover, --glv-accent-soft, --glv-accent-glow,
     *   --glv-shadow-accent, --glv-shadow-accent-lg
     */
    function clearCustomAccent() {
        localStorage.removeItem(CUSTOM_ACCENT_KEY);
        document.body.classList.remove('accent-custom');
        ['--glv-accent', '--glv-accent-hover', '--glv-accent-soft', '--glv-accent-glow', '--glv-shadow-accent', '--glv-shadow-accent-lg'].forEach((v) => {
            document.body.style.removeProperty(v);
        });
    }

    // ── Funciones de aplicación de color ────────────────────────────────────
    // Cada función de aplicación calcula las variantes derivadas del color elegido,
    // persiste el objeto completo en localStorage y aplica las variables CSS al body.
    // Al escribir sobre el body con style.setProperty, el cambio es inmediato (tiempo real).

    /**
     * Aplica un color de fondo personalizado a toda la interfaz.
     *
     * Calcula variantes de superficie a partir del color base:
     *   - bgBody:    el color elegido directamente como fondo de página.
     *   - bgLight:   mezcla 60% con blanco, para superficies secundarias más claras.
     *   - bgCard:    blanco puro (#ffffff) para las tarjetas, asegurando legibilidad.
     *   - bgElevated: blanco puro para elementos elevados (modales, dropdowns).
     *   - glassBg:   versión translúcida al 82% del color base, para efectos glass-morphism.
     *
     * Persiste todas las variantes en localStorage para poder restaurarlas al recargar
     * sin necesidad de recalcularlas.
     *
     * @param {string} hex - Color de fondo base en formato '#RRGGBB'.
     */
    function applyCustomBg(hex) {
        const bgBody = hex;
        const bgLight = mixHex(hex, '#ffffff', 0.6);  // Superficie más clara: 60% mezcla con blanco
        const bgCard = '#ffffff';                      // Tarjetas siempre blancas para máximo contraste
        const bgElevated = '#ffffff';                  // Elementos elevados también blancos
        const glassBg = rgbaString(hex, 0.82);         // Fondo translúcido para el efecto glass

        // Persistir el objeto completo con todas las variantes calculadas
        const payload = { bgBody, bgLight, bgCard, bgElevated, glassBg };
        localStorage.setItem(CUSTOM_BG_KEY, JSON.stringify(payload));

        // Añadir la clase marcadora y aplicar las variables CSS inline en el body
        document.body.classList.add('bg-custom');
        document.body.style.setProperty('--glv-bg-body', bgBody);
        document.body.style.setProperty('--glv-bg-light', bgLight);
        document.body.style.setProperty('--glv-bg-card', bgCard);
        document.body.style.setProperty('--glv-bg-elevated', bgElevated);
        document.body.style.setProperty('--glv-glass-bg', glassBg);
    }

    /**
     * Aplica un color primario personalizado a la interfaz.
     *
     * El color primario se usa típicamente para botones principales, enlaces activos
     * y otros elementos de alta prominencia. Se calcula un color de hover automático
     * usando la luminancia del color para decidir si aclarar u oscurecer.
     *
     * @param {string} hex - Color primario base en formato '#RRGGBB'.
     */
    function applyCustomPrimary(hex) {
        const primary = hex;
        const primaryHover = autoHover(hex); // Hover automático: aclarar u oscurecer según luminancia

        // Persistir el color base y su hover
        const payload = { primary, primaryHover };
        localStorage.setItem(CUSTOM_PRIMARY_KEY, JSON.stringify(payload));

        document.body.classList.add('primary-custom');
        document.body.style.setProperty('--glv-primary', primary);
        document.body.style.setProperty('--glv-primary-hover', primaryHover);
    }

    /**
     * Aplica un color de acento personalizado a la interfaz.
     *
     * El color de acento se usa en etiquetas, badges, iconos destacados y efectos
     * visuales secundarios. Genera automáticamente un sistema de variantes completo:
     *
     *   - accent:         el color base tal cual.
     *   - accentHover:    18% más oscuro (mezcla con negro), para interacciones hover.
     *   - accentSoft:     10% de opacidad, para fondos tenues de etiquetas o chips.
     *   - accentGlow:     25% de opacidad, para halos y efectos de brillo suave.
     *   - shadowAccent:   sombra estándar (8px blur) con 16% de opacidad del acento.
     *   - shadowAccentLg: sombra grande (16px blur) con 22% de opacidad, para cards.
     *
     * @param {string} hex - Color de acento base en formato '#RRGGBB'.
     */
    function applyCustomAccent(hex) {
        const accent = hex;
        const accentHover = mixHex(hex, '#000000', 0.18); // 18% más oscuro para el estado hover
        const accentSoft = rgbaString(hex, 0.1);           // Muy translúcido para fondos sutiles
        const accentGlow = rgbaString(hex, 0.25);          // Semi-transparente para halos de brillo
        const shadowAccent = `0 8px 24px ${rgbaString(hex, 0.16)}`;    // Sombra estándar
        const shadowAccentLg = `0 16px 40px ${rgbaString(hex, 0.22)}`; // Sombra grande para tarjetas

        // Persistir todas las variantes calculadas
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
     * Sincroniza los inputs de tipo color de la UI con los valores actualmente
     * guardados en localStorage. Si no hay valor guardado para algún componente,
     * se usa el color por defecto del sistema GloveUp para ese slot.
     *
     * Se llama en dos momentos:
     *   1. Al entrar en la sección de paleta (para mostrar los colores actuales).
     *   2. Después de hacer reset de cualquier color (para reflejar el default).
     *
     * Cada bloque try/catch lee una clave de localStorage de forma independiente;
     * si una clave falla, las demás se siguen leyendo correctamente.
     */
    function refreshCustomUI() {
        // Colores por defecto del sistema de diseño GloveUp
        let bgValue = '#f8fafc';      // Fondo: gris muy claro (blanco frío)
        let primaryValue = '#0a0a0a'; // Primario: casi negro
        let accentValue = '#f97316';  // Acento: naranja GloveUp

        // Intentar leer el color de fondo guardado
        try {
            const rawBg = localStorage.getItem(CUSTOM_BG_KEY);
            if (rawBg) {
                const parsed = JSON.parse(rawBg);
                // Verificar que el valor parseado tiene la propiedad esperada y es un string
                if (parsed && typeof parsed.bgBody === 'string') bgValue = parsed.bgBody;
            }
        } catch (_) {
            // Si el JSON de fondo está corrupto, usar el valor por defecto
        }

        // Intentar leer el color primario guardado
        try {
            const rawPrimary = localStorage.getItem(CUSTOM_PRIMARY_KEY);
            if (rawPrimary) {
                const parsed = JSON.parse(rawPrimary);
                if (parsed && typeof parsed.primary === 'string') primaryValue = parsed.primary;
            }
        } catch (_) {
            // Si el JSON de primario está corrupto, usar el valor por defecto
        }

        // Intentar leer el color de acento guardado
        try {
            const rawAccent = localStorage.getItem(CUSTOM_ACCENT_KEY);
            if (rawAccent) {
                const parsed = JSON.parse(rawAccent);
                if (parsed && typeof parsed.accent === 'string') accentValue = parsed.accent;
            }
        } catch (_) {
            // Si el JSON de acento está corrupto, usar el valor por defecto
        }

        // Actualizar el valor visible de cada input de color con el dato leído
        if (customBgInput) customBgInput.value = bgValue;
        if (customPrimaryInput) customPrimaryInput.value = primaryValue;
        if (customAccentInput) customAccentInput.value = accentValue;
    }

    // ── Eventos de los inputs de color (aplicación en tiempo real) ───────────
    // Los inputs de tipo color disparan el evento 'input' en cada cambio del picker.
    // Antes de aplicar, se valida que el valor sea un hex de 6 dígitos completo,
    // ya que durante la selección el navegador puede emitir valores parciales.

    // Fondo: validar el hex y aplicar en tiempo real al cambiar el picker
    if (customBgInput) {
        customBgInput.addEventListener('input', () => {
            const val = (customBgInput.value || '').toString();
            // hexToRgb devuelve null si el valor no es un hex completo de 6 dígitos
            if (!hexToRgb(val)) return; // Ignorar valores parciales o inválidos
            clearLegacyPresets(); // Asegurar que no haya clases legacy activas antes de aplicar
            applyCustomBg(val);
        });
    }

    // Primario: validar y aplicar en tiempo real
    if (customPrimaryInput) {
        customPrimaryInput.addEventListener('input', () => {
            const val = (customPrimaryInput.value || '').toString();
            if (!hexToRgb(val)) return; // Ignorar si el hex no es válido todavía
            applyCustomPrimary(val);
        });
    }

    // Acento: limpiar legacy antes de aplicar para evitar conflictos de clases CSS
    if (customAccentInput) {
        customAccentInput.addEventListener('input', () => {
            const val = (customAccentInput.value || '').toString();
            if (!hexToRgb(val)) return;
            clearLegacyPresets(); // Evitar que clases palette-* antiguas interfieran
            applyCustomAccent(val);
        });
    }

    // ── Botones de reset ─────────────────────────────────────────────────────
    // Cada botón de reset elimina la personalización de su color, limpia las
    // variables CSS del body y actualiza el input para mostrar el color por defecto.

    if (customBgReset) {
        customBgReset.addEventListener('click', () => {
            clearCustomBg();    // Eliminar datos de fondo personalizado y sus variables CSS
            refreshCustomUI();  // Actualizar el input para mostrar el color por defecto del sistema
        });
    }

    if (customPrimaryReset) {
        customPrimaryReset.addEventListener('click', () => {
            clearCustomPrimary(); // Eliminar datos de primario personalizado y sus variables CSS
            refreshCustomUI();    // Reflejar el color por defecto en el input
        });
    }

    if (customAccentReset) {
        customAccentReset.addEventListener('click', () => {
            clearCustomAccent(); // Eliminar datos de acento personalizado y sus variables CSS
            refreshCustomUI();   // Reflejar el color por defecto en el input
        });
    }

    // ─── SECCIÓN DE TEMA OSCURO / CLARO ─────────────────────────────────────
    // El tema se gestiona mediante la clase CSS 'theme-dark' en el body.
    // El CSS global usa esta clase para cambiar los valores de las variables de color.
    // El estado se persiste en localStorage para mantenerlo entre sesiones.

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        const body = document.body;
        const THEME_KEY = 'gloveup_theme'; // Clave de localStorage para el tema activo

        // Al cargar la página, aplicar el tema guardado (si es oscuro, actualizar el icono).
        // No se necesita hacer classList.add aquí porque el script de inicialización
        // del layout ya aplica la clase 'theme-dark' al cargar si el tema guardado es 'dark'.
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme === 'dark') updateThemeIcon(true); // Solo sincronizar el icono del botón

        themeBtn.addEventListener('click', () => {
            // Alternar la clase 'theme-dark' en el body (add si no está, remove si está)
            body.classList.toggle('theme-dark');
            // Leer el estado resultante para saber qué tema ha quedado activo
            const isDark = body.classList.contains('theme-dark');
            // Persistir la preferencia para la próxima sesión
            localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
            // Actualizar el texto e icono del botón para reflejar el estado actual
            updateThemeIcon(isDark);
        });

        /**
         * Actualiza el icono FontAwesome y el texto descriptivo del botón de tema
         * para que indiquen siempre la acción que realizará el siguiente clic
         * (no el estado actual, sino el contrario):
         *
         *   - Modo oscuro activo  → muestra "fa-sun" y "Tema Claro"  (clicar → modo claro).
         *   - Modo claro activo   → muestra "fa-moon" y "Tema Oscuro" (clicar → modo oscuro).
         *
         * @param {boolean} isDark - true si el modo oscuro está activo, false si es claro.
         */
        function updateThemeIcon(isDark) {
            const icon = themeBtn.querySelector('i');    // Elemento <i> con la clase de FontAwesome
            const text = themeBtn.querySelector('span'); // Elemento <span> con el texto del botón
            // En modo oscuro → mostrar el sol (icono de cambio a claro)
            if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            // En modo oscuro → el botón dice "Tema Claro" (para indicar adónde lleva)
            if (text) text.textContent = isDark ? 'Tema Claro' : 'Tema Oscuro';
        }
    }

    // ─── CERRAR SESIÓN ───────────────────────────────────────────────────────
    // El proceso de cierre de sesión elimina todos los datos de identidad y sesión
    // del usuario antes de redirigir a la pantalla de login, garantizando que
    // no quede información sensible accesible en el navegador.

    /**
     * Al hacer clic en el botón de logout:
     *  1. Elimina de localStorage todas las claves de datos del usuario
     *     (nombre, email, rol, DNI, estado de registro y sesión mantenida).
     *  2. Elimina de sessionStorage las claves de sesión temporal
     *     (flag de sesión activa e ID de usuario de la sesión actual).
     *  3. Redirige a la página de autenticación (auth/index.html).
     *
     * Claves de localStorage eliminadas:
     *   - gloveup_user_name:           Nombre visible del usuario.
     *   - gloveup_user_email:          Email del usuario.
     *   - gloveup_session_maintained:  Flag "mantener sesión iniciada".
     *   - gloveup_is_registered:       Flag de usuario registrado completamente.
     *   - gloveup_user_role:           Rol del usuario (entrenador, deportista, etc.).
     *   - gloveup_user_dni:            DNI del usuario.
     *
     * Las claves de colores y notificaciones NO se eliminan para que las
     * preferencias de UI se conserven si el usuario vuelve a iniciar sesión.
     */
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // Eliminar datos de identidad y sesión del usuario de localStorage
            ['gloveup_user_name', 'gloveup_user_email', 'gloveup_session_maintained',
                'gloveup_is_registered', 'gloveup_user_role', 'gloveup_user_dni'
            ].forEach(k => localStorage.removeItem(k));

            // Eliminar también las claves de sesión de sessionStorage
            // (sessionStorage se limpia automáticamente al cerrar la pestaña,
            //  pero se elimina aquí explícitamente por si el usuario navega sin cerrarla)
            sessionStorage.removeItem('gloveup_session_maintained');
            sessionStorage.removeItem('gloveup_user_id');

            // Redirigir a la pantalla de autenticación
            window.location.href = '../auth/index.html';
        });
    }
});
