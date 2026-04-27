// Lógica de autenticación (auth/index.html)

const REGISTERED_KEY = 'gloveup_is_registered';
const SESSION_MAINTAINED_KEY = 'gloveup_session_maintained';
const STORED_EMAIL_KEY = 'gloveup_user_email';
const STORED_USERNAME_KEY = 'gloveup_user_name';
const STORED_USER_ID_KEY = 'gloveup_user_id';
const STORED_USER_ROLE_KEY = 'gloveup_user_role';
const STORED_USER_DNI_KEY = 'gloveup_user_dni';
const _glv_h = window.location.hostname;
const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
const API_BASE_URL = (window.localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');

// Eliminado: lógica BoxRec ID (no se requiere)

export function validateSignUpForm(event) {
    event.preventDefault();

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
    const coachGym = getValue('coach_gym_signup').trim();
    const coachSpecialty = getValue('coach_specialty_signup').trim();
    const errorMessageDiv = document.getElementById('signup-error-message');

    if (!errorMessageDiv) {
        alert('No se pudo inicializar el formulario de registro.');
        return false;
    }

    errorMessageDiv.style.display = 'none';

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

    const submitButton = event.target.querySelector('input[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    const registerBody = {
        nombre: name,
        email: email,
        password: pass,
        rol: accountType,
        dniLicencia
    };

    if (accountType === 'boxeador') {
        registerBody.nivel = level;
        registerBody.disciplina = 'Boxeo';
    }

    if (accountType === 'entrenador') {
        registerBody.especialidad = coachSpecialty || 'Boxeo';
        registerBody.gimnasio = coachGym;
    }

    requestJson('/api/auth/register', {
            method: 'POST',
            body: registerBody
        })
        .then((payload) => {
            localStorage.removeItem(REGISTERED_KEY);
            localStorage.removeItem(STORED_EMAIL_KEY);
            localStorage.removeItem(STORED_USERNAME_KEY);
            localStorage.removeItem(STORED_USER_ROLE_KEY);
            localStorage.removeItem(STORED_USER_DNI_KEY);
            localStorage.removeItem(SESSION_MAINTAINED_KEY);
            sessionStorage.removeItem(STORED_USER_ID_KEY);
            sessionStorage.removeItem(SESSION_MAINTAINED_KEY);
            alert('🎉 ¡Registro completado! Ya puedes iniciar sesión.');
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

export function validateSignInForm(event) {
    event.preventDefault();

    const checkEl = document.getElementById('check');
    const maintainSessionChecked = Boolean(checkEl && checkEl.checked);
    const errorMessageDiv = document.getElementById('signin-error-message');

    const userInput = document.getElementById('user_signin');
    const passInput = document.getElementById('pass_signin');

    if (!userInput || !passInput || !errorMessageDiv) {
        alert('No se pudo inicializar el formulario de inicio de sesión.');
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
            localStorage.setItem(REGISTERED_KEY, 'true');
            localStorage.setItem(STORED_EMAIL_KEY, data.email);
            localStorage.setItem(STORED_USERNAME_KEY, data.nombre);
            localStorage.setItem(STORED_USER_ROLE_KEY, data.rol || 'usuario');
            localStorage.setItem(STORED_USER_DNI_KEY, data.dniLicencia || '');
            sessionStorage.setItem(STORED_USER_ID_KEY, data.id || '');

            if (maintainSessionChecked) {
                localStorage.setItem(SESSION_MAINTAINED_KEY, 'true');
                sessionStorage.setItem(SESSION_MAINTAINED_KEY, 'true');
            } else {
                localStorage.removeItem(SESSION_MAINTAINED_KEY);
                sessionStorage.setItem(SESSION_MAINTAINED_KEY, 'true');
            }

            alert('✅ Inicio de sesión exitoso. ¡Bienvenido!');
            const role = (data.rol || 'usuario').toLowerCase();
            window.location.href = role === 'entrenador' ? '../dashboard/entrenador/dashboard.html' : '../dashboard/boxeador/dashboard.html';
        })
        .catch((err) => {
            const rawMessage = err && err.message ? err.message.toLowerCase() : '';
            if (rawMessage.includes('failed') || rawMessage.includes('network') || rawMessage.includes('conectar')) {
                errorMessageDiv.textContent = `⚠️ No se pudo conectar con el servidor. Verifica que esté activo en ${API_BASE_URL}.`;
            } else {
                errorMessageDiv.textContent = `❌ ${err.message || 'Email/Usuario o Contraseña incorrectos. Por favor, revísalos.'}`;
            }
            errorMessageDiv.style.display = 'block';
            passInput.value = '';
            userInput.focus();
        })
        .finally(() => {
            if (submitButton) submitButton.disabled = false;
        });

    return false;
}

export function validateForgotPasswordForm(event) {
    event.preventDefault();

    const errorMessageDiv = document.getElementById('forgot-error-message');
    const successMessageDiv = document.getElementById('forgot-success-message');
    const emailInput = document.getElementById('email_forgot');
    const dniInput = document.getElementById('dni_forgot');
    const passInput = document.getElementById('pass_forgot');
    const passRepeatInput = document.getElementById('pass_repeat_forgot');

    if (!errorMessageDiv || !successMessageDiv || !emailInput || !dniInput || !passInput || !passRepeatInput) {
        alert('No se pudo inicializar el formulario de recuperar contraseña.');
        return false;
    }

    const email = String(emailInput.value || '').trim().toLowerCase();
    const dniLicencia = String(dniInput.value || '').trim().toUpperCase();
    const password = String(passInput.value || '');
    const passwordRepeat = String(passRepeatInput.value || '');

    errorMessageDiv.style.display = 'none';
    successMessageDiv.style.display = 'none';

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
            emailInput.value = '';
            dniInput.value = '';
            passInput.value = '';
            passRepeatInput.value = '';

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
        const raw = err && err.message ? err.message.toLowerCase() : '';
        if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')) {
            throw new Error(`No se pudo conectar con ${API_BASE_URL}`);
        }
        throw err;
    });
}

document.addEventListener('DOMContentLoaded', () => {

    const storedSessionMaintained =
        sessionStorage.getItem(SESSION_MAINTAINED_KEY) === 'true' ||
        localStorage.getItem(SESSION_MAINTAINED_KEY) === 'true' ?
        'true' :
        'false';

    const signInInput = document.getElementById('tab-1');
    const signUpInput = document.getElementById('tab-2');
    const infoBanner = document.getElementById('redirect-info');
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    // Eliminado: eventos para BoxRec ID

    if (storedSessionMaintained === 'true') {
        if (signInInput) signInInput.checked = true;
        if (signUpInput) signUpInput.checked = false;
    } else {
        if (signUpInput) signUpInput.checked = true;
        if (signInInput) signInInput.checked = false;
    }

    if (from === 'profile' && storedSessionMaintained !== 'true') {
        if (infoBanner) {
            infoBanner.textContent = 'Necesitas crear un perfil para poder ver esta sección. Regístrate o inicia sesión.';
            infoBanner.style.display = 'block';
        }
        if (signUpInput) signUpInput.checked = true;
        if (signInInput) signInInput.checked = false;
    }

    const forgotPanel = document.getElementById('forgot-panel');
    const forgotLink = document.getElementById('forgot-password-link');
    const forgotBackLink = document.getElementById('forgot-back-link');

    const hideForgotPanel = () => {
        if (forgotPanel) forgotPanel.style.display = 'none';
        const errorMessageDiv = document.getElementById('forgot-error-message');
        const successMessageDiv = document.getElementById('forgot-success-message');
        if (errorMessageDiv) errorMessageDiv.style.display = 'none';
        if (successMessageDiv) successMessageDiv.style.display = 'none';
    };

    const showForgotPanel = () => {
        if (forgotPanel) forgotPanel.style.display = 'block';
        const signInInputLocal = document.getElementById('tab-1');
        const signUpInputLocal = document.getElementById('tab-2');
        if (signInInputLocal) signInInputLocal.checked = true;
        if (signUpInputLocal) signUpInputLocal.checked = false;
        const emailForgot = document.getElementById('email_forgot');
        if (emailForgot) emailForgot.focus();
    };

    const syncForgotFromHash = () => {
        if (String(window.location.hash || '').toLowerCase() === '#forgot') {
            showForgotPanel();
        } else {
            hideForgotPanel();
        }
    };

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
    window.addEventListener('hashchange', syncForgotFromHash);
    syncForgotFromHash();

    const leaveForgotPanel = () => {
        if (String(window.location.hash || '').toLowerCase() !== '#forgot') return;
        window.location.hash = '';
        hideForgotPanel();
    };

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

    const accountTypeSelect = document.getElementById('account_type_signup');
    const levelGroup = document.getElementById('level_signup_group');
    const coachGymGroup = document.getElementById('coach_gym_group');
    const coachSpecialtyGroup = document.getElementById('coach_specialty_group');

    const syncSignUpFields = () => {
        const value = (accountTypeSelect ? accountTypeSelect.value || 'boxeador' : 'boxeador').trim().toLowerCase();
        if (value === 'entrenador') {
            if (levelGroup) levelGroup.style.display = 'none';
            if (coachGymGroup) coachGymGroup.style.display = '';
            if (coachSpecialtyGroup) coachSpecialtyGroup.style.display = '';
        } else {
            if (levelGroup) levelGroup.style.display = '';
            if (coachGymGroup) coachGymGroup.style.display = 'none';
            if (coachSpecialtyGroup) coachSpecialtyGroup.style.display = 'none';
        }
    };

    if (accountTypeSelect) {
        accountTypeSelect.addEventListener('change', syncSignUpFields);
        syncSignUpFields();
    }
});
