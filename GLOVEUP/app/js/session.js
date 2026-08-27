/**
 * session.js — Sesión del usuario y control de acceso.
 *
 * Se conserva el mismo mecanismo que las páginas antiguas (el email en
 * localStorage, validado contra /api/auth/me) para que ambas versiones
 * compartan sesión durante la migración. Cambiarlo a cookies de sesión de
 * PHP obligaría a migrar también el login, y eso es trabajo de la Fase 2.
 */

import { api } from './api.js';

const EMAIL_KEY = 'gloveup_user_email';
const ROLE_KEY = 'gloveup_user_role';
const NAME_KEY = 'gloveup_user_name';

/** @returns {string} Email de la sesión, o cadena vacía si no hay */
export function email() {
    return (localStorage.getItem(EMAIL_KEY) || '').trim().toLowerCase();
}

/** @returns {string} "boxeador", "entrenador" o "usuario" */
export function role() {
    return (localStorage.getItem(ROLE_KEY) || 'usuario').toLowerCase();
}

/** @returns {string} Nombre mostrado en la barra superior */
export function name() {
    return localStorage.getItem(NAME_KEY) || '';
}

/** Borra la sesión y devuelve al login. */
export function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/legacy/auth/index.html');
}

/**
 * Verifica la sesión contra el servidor.
 *
 * Sin email en localStorage se redirige de inmediato. Si el servidor
 * responde que la sesión no vale, se limpia y se redirige. Si el servidor
 * no responde, se deja pasar: la API volverá a fallar más adelante y es
 * preferible a bloquear la app por un corte de red.
 *
 * @returns {Promise<boolean>} true si se puede seguir renderizando
 */
export async function guard() {
    const current = email();

    if (!current) {
        window.location.replace('/legacy/auth/index.html');
        return false;
    }

    try {
        await api.me(current);
        return true;
    } catch (err) {
        // Un error de red deja pasar; un rechazo del servidor cierra sesión
        if (err instanceof TypeError) {
            return true;
        }
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('/legacy/auth/index.html');
        return false;
    }
}
