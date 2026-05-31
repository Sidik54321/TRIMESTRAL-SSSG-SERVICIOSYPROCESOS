/**
 * auth.js — Lógica de autenticación para auth/index.html.
 * Gestiona registro, inicio de sesión y recuperación de contraseña.
 * Persiste la sesión del usuario en localStorage / sessionStorage.
 * Redirige al dashboard correcto según el rol (boxeador / entrenador).
 */

// ─── CLAVES DE ALMACENAMIENTO LOCAL ─────────────────────────────────────────

// Claves utilizadas para almacenar el estado de sesión en localStorage/sessionStorage
const REGISTERED_KEY = 'gloveup_is_registered';
const SESSION_MAINTAINED_KEY = 'gloveup_session_maintained';
const STORED_EMAIL_KEY = 'gloveup_user_email';
const STORED_USERNAME_KEY = 'gloveup_user_name';
const STORED_USER_ID_KEY = 'gloveup_user_id';
const STORED_USER_ROLE_KEY = 'gloveup_user_role';
const STORED_USER_DNI_KEY = 'gloveup_user_dni';

// ─── CONFIGURACIÓN DE LA URL BASE DE LA API ──────────────────────────────────

// Detecta el host dinámicamente para funcionar tanto en local como en producción
const _glv_h = window.location.hostname;
const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
// Permite sobreescribir la URL base desde localStorage (útil para despliegues alternativos)
const API_BASE_URL = (window.localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');

// Eliminado: lógica BoxRec ID (no se requiere)

// ─── DIÁLOGO DE ALERTAS ──────────────────────────────────────────────────────

/**
 * Muestra un diálogo <dialog> nativo con título y mensaje.
 * Soporta cierre automático tras un tiempo con autoCloseMs.
 * Devuelve una Promise que resuelve con el valor de retorno del diálogo.
 */
function showAuthAlert({
    title,
    message,
    autoCloseMs
}) {
    const dialog = document.getElementById('auth-alert-dialog');
    const titleEl = document.getElementById('auth-alert-title');
    const messageEl = document.getElementById('auth-alert-message');
    if (!dialog || typeof dialog.showModal !== 'function' || !titleEl || !messageEl) {
        return Promise.resolve('');
    }

    titleEl.textContent = String(title || 'Aviso');
    messageEl.textContent = String(message || '');

    // Si el diálogo ya está abierto, cerrarlo antes de reabrirlo
    if (dialog.open) {
        try {
            dialog.close('reopen');
        } catch (_) {}
    }

    return new Promise((resolve) => {
        const onClose = () => resolve(String(dialog.returnValue || ''));
        dialog.addEventListener('close', onClose, { once: true });
        dialog.showModal();
        // Cierre automático opcional para alertas temporales (ej: tras login exitoso)
        if (typeof autoCloseMs === 'number' && Number.isFinite(autoCloseMs) && autoCloseMs > 0) {
            window.setTimeout(() => {
                if (!dialog.open) return;
                try {
                    dialog.close('auto');
                } catch (_) {}
            }, autoCloseMs);
        }
    });
}

// ─── FORMULARIO DE REGISTRO ──────────────────────────────────────────────────

/**
 * Valida y envía el formulario de registro al backend.
 * Adjunta los campos opcionales según el tipo de cuenta (boxeador/entrenador).
 * En caso de éxito, redirige al tab de inicio de sesión.
 */
export function validateSignUpForm(event) {
    event.preventDefault();

    // Helper para leer valores de inputs por su ID de forma segura
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el && 'value' in el ? String(el.value) : '';
    };

    const name = getValue('name_signup').trim();
    const email = getValue('email_signup').trim().toLowerCase();
    const accountType = (getValue('account_type_signup') || 'boxeador').trim().toLowerCase();
    const dniLicencia = getValue('dni_signup').trim().toUpperCase();
    const pass = getValue('pass_signup');
    const repeatPass = getValue('pass_repeat_signup');
    const level = getValue('level_signup');
    const errorMessageDiv = document.getElementById('signup-error-message');

    if (!errorMessageDiv) {
        showAuthAlert({
            title: 'Error',
            message: 'No se pudo inicializar el formulario de registro.'
        });
        return false;
    }

    // Ocultar cualquier mensaje de error previo
    errorMessageDiv.style.display = 'none';

    // Validaciones del lado cliente antes de llamar a la API
    if (!name || !email || !pass) {
        errorMessageDiv.textContent = '⛔ Debes completar nombre, email y contraseña.';
        errorMessageDiv.style.display = 'block';
        return false;
    }

    if (!dniLicencia || dniLicencia.length < 6) {
        errorMessageDiv.textContent = '⛔ Debes indicar el DNI / Licencia.';
        errorMessageDiv.style.display = 'block';
        return false;
    }

    if (pass !== repeatPass) {
        errorMessageDiv.textContent = '❌ ¡Error! Las contraseñas no coinciden. Por favor, revísalas.';
        errorMessageDiv.style.display = 'block';
        return false;
    }

    // Deshabilitar el botón durante la petición para evitar dobles envíos
    const submitButton = event.target.querySelector('input[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    // Construir el cuerpo de la petición con los campos comunes
    const registerBody = {
        nombre: name,
        email: email,
        password: pass,
        rol: accountType,
        dniLicencia
    };

    // Añadir campos específicos según el tipo de cuenta
    if (accountType === 'boxeador') {
        registerBody.nivel = level;
        registerBody.disciplina = 'Boxeo';
    }

    if (accountType === 'entrenador') {
        registerBody.especialidad = 'Boxeo';
    }

    requestJson('/api/auth/register', {
            method: 'POST',
            body: registerBody
        })
        .then((payload) => {
            // Limpiar datos de sesión previos para no interferir con el nuevo usuario
            localStorage.removeItem(REGISTERED_KEY);
            localStorage.removeItem(STORED_EMAIL_KEY);
            localStorage.removeItem(STORED_USERNAME_KEY);
            localStorage.removeItem(STORED_USER_ROLE_KEY);
            localStorage.removeItem(STORED_USER_DNI_KEY);
            localStorage.removeItem(SESSION_MAINTAINED_KEY);
            sessionStorage.removeItem(STORED_USER_ID_KEY);
            sessionStorage.removeItem(SESSION_MAINTAINED_KEY);
            showAuthAlert({
                title: 'Registro completado',
                message: 'Ya puedes iniciar sesión.'
            });
            // Cambiar al tab de inicio de sesión y pre-rellenar el email
            document.getElementById('tab-1').checked = true;
            document.getElementById('tab-2').checked = false;

            const signInUserInput = document.getElementById('user_signin');
            if (signInUserInput) {
                signInUserInput.value = email;
                signInUserInput.focus();
            }
        })
        .catch((err) => {
            const message = err && err.message ? err.message : 'No se pudo registrar. Verifica servidor y MongoDB.';
            errorMessageDiv.textContent = `❌ ${message}`;
            errorMessageDiv.style.display = 'block';
        })
        .finally(() => {
            if (submitButton) submitButton.disabled = false;
        });

    return false;
}

// ─── FORMULARIO DE INICIO DE SESIÓN ─────────────────────────────────────────

/**
 * Valida y envía el formulario de login al backend.
 * Guarda los datos del usuario en storage y redirige al dashboard correspondiente.
 * Si se marca "mantener sesión", se persiste en localStorage; si no, solo en sessionStorage.
 */
export function validateSignInForm(event) {
    event.preventDefault();

    // Leer el checkbox de "mantener sesión"
    const checkEl = document.getElementById('check');
    const maintainSessionChecked = Boolean(checkEl && checkEl.checked);
    const errorMessageDiv = document.getElementById('signin-error-message');

    const userInput = document.getElementById('user_signin');
    const passInput = document.getElementById('pass_signin');

    if (!userInput || !passInput || !errorMessageDiv) {
        showAuthAlert({
            title: 'Error',
            message: 'No se pudo inicializar el formulario de inicio de sesión.'
        });
        return false;
    }

    const userAttempt = userInput.value.trim();
    const passAttempt = passInput.value;

    errorMessageDiv.style.display = 'none';

    if (!userAttempt || !passAttempt) {
        errorMessageDiv.textContent = '⛔ Debes introducir email y contraseña.';
        errorMessageDiv.style.display = 'block';
        return false;
    }

    const submitButton = event.target.querySelector('input[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    requestJson('/api/auth/login', {
            method: 'POST',
            body: {
                identifier: userAttempt,
                password: passAttempt
            }
        })
        .then((data) => {
            // Persistir datos del usuario en localStorage
            localStorage.setItem(REGISTERED_KEY, 'true');
            localStorage.setItem(STORED_EMAIL_KEY, data.email);
            localStorage.setItem(STORED_USERNAME_KEY, data.nombre);
            localStorage.setItem(STORED_USER_ROLE_KEY, data.rol || 'usuario');
            localStorage.setItem(STORED_USER_DNI_KEY, data.dniLicencia || '');
            // El ID de usuario solo se guarda en sessionStorage (más efímero)
            sessionStorage.setItem(STORED_USER_ID_KEY, data.id || '');

            // Determinar si se mantiene la sesión entre cierres de pestaña
            if (maintainSessionChecked) {
                localStorage.setItem(SESSION_MAINTAINED_KEY, 'true');
                sessionStorage.setItem(SESSION_MAINTAINED_KEY, 'true');
            } else {
                localStorage.removeItem(SESSION_MAINTAINED_KEY);
                sessionStorage.setItem(SESSION_MAINTAINED_KEY, 'true');
            }

            // Redirigir al dashboard según el rol recibido del servidor
            const role = (data.rol || 'usuario').toLowerCase();
            const nextUrl = role === 'entrenador' ? '../dashboard/entrenador/dashboard.html' : '../dashboard/boxeador/dashboard.html';
            if (typeof window.showToast === 'function') {
                window.showToast('Has iniciado sesión correctamente.', 'success', 1200);
            } else {
                showAuthAlert({
                    title: 'Inicio de sesión',
                    message: 'Has iniciado sesión correctamente.',
                    autoCloseMs: 1000
                });
            }
            // Pequeño retardo para que el usuario vea el toast antes de navegar
            window.setTimeout(() => {
                window.location.href = nextUrl;
            }, 900);
        })
        .catch((err) => {
            // Diferenciar error de red de error de credenciales para mensaje más útil
            const rawMessage = err && err.message ? err.message.toLowerCase() : '';
            if (rawMessage.includes('failed') || rawMessage.includes('network') || rawMessage.includes('conectar')) {
                errorMessageDiv.textContent = `⚠️ No se pudo conectar con el servidor. Verifica que esté activo en ${API_BASE_URL}.`;
            } else {
                errorMessageDiv.textContent = `❌ ${err.message || 'Email/Usuario o Contraseña incorrectos. Por favor, revísalos.'}`;
            }
            errorMessageDiv.style.display = 'block';
            // Limpiar contraseña por seguridad y devolver el foco al usuario
            passInput.value = '';
            userInput.focus();
        })
        .finally(() => {
            if (submitButton) submitButton.disabled = false;
        });

    return false;
}

// ─── FORMULARIO DE RECUPERACIÓN DE CONTRASEÑA ───────────────────────────────

/**
 * Valida y envía el formulario de restablecimiento de contraseña.
 * Usa email + DNI/licencia como verificación de identidad (sin email externo).
 * En caso de éxito, oculta el panel y vuelve al tab de login.
 */
export function validateForgotPasswordForm(event) {
    event.preventDefault();

    const errorMessageDiv = document.getElementById('forgot-error-message');
    const successMessageDiv = document.getElementById('forgot-success-message');
    const emailInput = document.getElementById('email_forgot');
    const dniInput = document.getElementById('dni_forgot');
    const passInput = document.getElementById('pass_forgot');
    const passRepeatInput = document.getElementById('pass_repeat_forgot');

    if (!errorMessageDiv || !successMessageDiv || !emailInput || !dniInput || !passInput || !passRepeatInput) {
        showAuthAlert({
            title: 'Error',
            message: 'No se pudo inicializar el formulario de recuperar contraseña.'
        });
        return false;
    }

    const email = String(emailInput.value || '').trim().toLowerCase();
    const dniLicencia = String(dniInput.value || '').trim().toUpperCase();
    const password = String(passInput.value || '');
    const passwordRepeat = String(passRepeatInput.value || '');

    // Ocultar mensajes de estado anteriores
    errorMessageDiv.style.display = 'none';
    successMessageDiv.style.display = 'none';

    // Validaciones básicas del lado cliente
    if (!email || !dniLicencia || !password) {
        errorMessageDiv.textContent = '⛔ Debes completar email, DNI/licencia y la nueva contraseña.';
        errorMessageDiv.style.display = 'block';
        return false;
    }

    if (dniLicencia.length < 6) {
        errorMessageDiv.textContent = '⛔ El DNI/licencia no es válido.';
        errorMessageDiv.style.display = 'block';
        return false;
    }

    if (password !== passwordRepeat) {
        errorMessageDiv.textContent = '❌ ¡Error! Las contraseñas no coinciden.';
        errorMessageDiv.style.display = 'block';
        return false;
    }

    const submitButton = event.target.querySelector('input[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    requestJson('/api/auth/forgot-password', {
            method: 'POST',
            body: {
                email,
                dniLicencia,
                password
            }
        })
        .then(() => {
            successMessageDiv.textContent = '✅ Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.';
            successMessageDiv.style.display = 'block';
            // Limpiar los campos del formulario por seguridad
            emailInput.value = '';
            dniInput.value = '';
            passInput.value = '';
            passRepeatInput.value = '';

            // Ocultar el panel de recuperación y volver al tab de login
            const forgotPanel = document.getElementById('forgot-panel');
            if (forgotPanel) forgotPanel.style.display = 'none';
            const signInInput = document.getElementById('tab-1');
            const signUpInput = document.getElementById('tab-2');
            if (signInInput) signInInput.checked = true;
            if (signUpInput) signUpInput.checked = false;
            window.location.hash = '';
        })
        .catch((err) => {
            errorMessageDiv.textContent = `❌ ${err && err.message ? err.message : 'No se pudo actualizar la contraseña.'}`;
            errorMessageDiv.style.display = 'block';
        })
        .finally(() => {
            if (submitButton) submitButton.disabled = false;
        });

    return false;
}

// ─── HELPER HTTP ─────────────────────────────────────────────────────────────

/**
 * Realiza una petición JSON a la API REST.
 * Lanza un Error con el mensaje del servidor si la respuesta no es OK.
 * Traduce errores de red a mensajes legibles en español.
 */
function requestJson(path, options = {}) {
    const method = options.method || 'GET';
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    const config = {
        method,
        headers
    };

    if (options.body !== undefined) {
        config.body = JSON.stringify(options.body);
    }

    return fetch(`${API_BASE_URL}${path}`, config).then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload.error || `Error ${res.status} en ${path}`);
        }
        return payload;
    }).catch((err) => {
        // Detectar errores de conectividad y normalizar el mensaje
        const raw = err && err.message ? err.message.toLowerCase() : '';
        if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')) {
            throw new Error(`No se pudo conectar con ${API_BASE_URL}`);
        }
        throw err;
    });
}

// ─── INICIALIZACIÓN AL CARGAR EL DOM ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // Detectar si ya existe una sesión activa para decidir qué tab mostrar por defecto
    const storedSessionMaintained =
        sessionStorage.getItem(SESSION_MAINTAINED_KEY) === 'true' ||
        localStorage.getItem(SESSION_MAINTAINED_KEY) === 'true' ?
        'true' :
        'false';

    const signInInput = document.getElementById('tab-1');
    const signUpInput = document.getElementById('tab-2');
    const infoBanner = document.getElementById('redirect-info');
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');  // Parámetro de redirección (ej: desde perfil sin sesión)
    // Eliminado: eventos para BoxRec ID

    // Si ya hay sesión, mostrar el tab de login; si no, mostrar el de registro
    if (storedSessionMaintained === 'true') {
        if (signInInput) signInInput.checked = true;
        if (signUpInput) signUpInput.checked = false;
    } else {
        if (signUpInput) signUpInput.checked = true;
        if (signInInput) signInInput.checked = false;
    }

    // Mostrar banner informativo si el usuario llegó desde una página protegida sin sesión
    if (from === 'profile' && storedSessionMaintained !== 'true') {
        if (infoBanner) {
            infoBanner.textContent = 'Necesitas crear un perfil para poder ver esta sección. Regístrate o inicia sesión.';
            infoBanner.style.display = 'block';
        }
        if (signUpInput) signUpInput.checked = true;
        if (signInInput) signInInput.checked = false;
    }

    // ─── PANEL DE RECUPERACIÓN DE CONTRASEÑA ────────────────────────────────

    const forgotPanel = document.getElementById('forgot-panel');
    const forgotLink = document.getElementById('forgot-password-link');
    const forgotBackLink = document.getElementById('forgot-back-link');

    /** Oculta el panel "¿Olvidaste tu contraseña?" y limpia mensajes. */
    const hideForgotPanel = () => {
        if (forgotPanel) forgotPanel.style.display = 'none';
        const errorMessageDiv = document.getElementById('forgot-error-message');
        const successMessageDiv = document.getElementById('forgot-success-message');
        if (errorMessageDiv) errorMessageDiv.style.display = 'none';
        if (successMessageDiv) successMessageDiv.style.display = 'none';
    };

    /** Muestra el panel de recuperación y fuerza el tab de login visible. */
    const showForgotPanel = () => {
        if (forgotPanel) forgotPanel.style.display = 'block';
        const signInInputLocal = document.getElementById('tab-1');
        const signUpInputLocal = document.getElementById('tab-2');
        if (signInInputLocal) signInInputLocal.checked = true;
        if (signUpInputLocal) signUpInputLocal.checked = false;
        const emailForgot = document.getElementById('email_forgot');
        if (emailForgot) emailForgot.focus();
    };

    /**
     * Sincroniza la visibilidad del panel con el hash de la URL (#forgot).
     * Permite navegar directamente a la recuperación con un enlace.
     */
    const syncForgotFromHash = () => {
        if (String(window.location.hash || '').toLowerCase() === '#forgot') {
            showForgotPanel();
        } else {
            hideForgotPanel();
        }
    };

    // Abrir/cerrar el panel de recuperación usando el hash de la URL
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = 'forgot';
            showForgotPanel();
        });
    }
    if (forgotBackLink) {
        forgotBackLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = '';
            hideForgotPanel();
        });
    }
    // Escuchar cambios de hash para sincronizar (ej: botón atrás del navegador)
    window.addEventListener('hashchange', syncForgotFromHash);
    syncForgotFromHash();

    /** Cierra el panel de recuperación si el hash no es #forgot. */
    const leaveForgotPanel = () => {
        if (String(window.location.hash || '').toLowerCase() !== '#forgot') return;
        window.location.hash = '';
        hideForgotPanel();
    };

    // Cerrar el panel al cambiar de tab (registro o login)
    if (signUpInput) {
        signUpInput.addEventListener('change', () => {
            if (signUpInput.checked) leaveForgotPanel();
        });
    }

    if (signInInput) {
        signInInput.addEventListener('change', () => {
            if (signInInput.checked) leaveForgotPanel();
        });
    }

    // ─── VISIBILIDAD DINÁMICA DE CAMPOS DEL FORMULARIO DE REGISTRO ──────────

    const accountTypeSelect = document.getElementById('account_type_signup');
    const levelGroup = document.getElementById('level_signup_group');

    /**
     * Oculta el campo "nivel" cuando el usuario selecciona "entrenador",
     * ya que ese campo solo aplica a boxeadores.
     */
    const syncSignUpFields = () => {
        const value = (accountTypeSelect ? accountTypeSelect.value || 'boxeador' : 'boxeador').trim().toLowerCase();
        if (levelGroup) levelGroup.style.display = value === 'entrenador' ? 'none' : '';
    };

    if (accountTypeSelect) {
        accountTypeSelect.addEventListener('change', syncSignUpFields);
        syncSignUpFields(); // Aplicar estado inicial al cargar la página
    }
});
