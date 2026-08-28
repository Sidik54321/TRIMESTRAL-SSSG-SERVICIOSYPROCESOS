/**
 * settings.js — Módulo de Ajustes.
 *
 * Tres subvistas conmutadas por show/hide, igual que la versión clásica.
 * Todo lo que gestiona esta página vive en localStorage: no hay llamadas a
 * la API. El tema oscuro no se toca aquí — el botón vive en el sidebar y ya
 * lo gestiona app.js globalmente.
 */

import * as colorTheme from '../color-theme.js';

const NOTIF_PREFS_KEY = 'gloveup_notif_prefs';
const NOTIF_DEFAULTS = { sparring: true, mensajes: true, gimnasio: true, general: true };

let els = {};

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="settings" */
export function init(root) {
    els = {
        root,
        back: root.querySelector('#settings-back'),
        views: {
            home: root.querySelector('#settings-home'),
            'settings-notifications': root.querySelector('#settings-notifications'),
            'settings-palette': root.querySelector('#settings-palette'),
        },
        notifToggles: root.querySelectorAll('[data-notif]'),
        saveNotifs: root.querySelector('#settings-save-notifs'),
        colorInputs: root.querySelectorAll('[data-color-input]'),
        colorResets: root.querySelectorAll('[data-color-reset]'),
    };

    root.querySelectorAll('[data-goto]').forEach((btn) => {
        btn.addEventListener('click', () => showView(btn.dataset.goto));
    });
    els.back.addEventListener('click', () => showView('home'));

    els.saveNotifs.addEventListener('click', saveNotifPrefs);

    els.colorInputs.forEach((input) => {
        input.value = colorTheme.currentColor(input.dataset.colorInput);
        input.addEventListener('input', () => colorTheme.applyColor(input.dataset.colorInput, input.value));
    });

    els.colorResets.forEach((btn) => {
        btn.addEventListener('click', () => {
            colorTheme.resetColor(btn.dataset.colorReset);
            const input = root.querySelector(`[data-color-input="${btn.dataset.colorReset}"]`);
            if (input) input.value = colorTheme.currentColor(btn.dataset.colorReset);
        });
    });

    showView('home');
}

export function destroy() {
    els = {};
}

function showView(name) {
    Object.entries(els.views).forEach(([key, el]) => { el.hidden = key !== name; });
    els.back.hidden = name === 'home';

    if (name === 'settings-notifications') loadNotifPrefs();
}

/* ── Notificaciones ────────────────────────────────────────────────── */

function loadNotifPrefs() {
    let prefs = { ...NOTIF_DEFAULTS };
    try {
        const raw = localStorage.getItem(NOTIF_PREFS_KEY);
        if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
    } catch {
        // JSON corrupto: se mantienen los valores por defecto
    }
    els.notifToggles.forEach((input) => { input.checked = Boolean(prefs[input.dataset.notif]); });
}

function saveNotifPrefs() {
    const prefs = {};
    els.notifToggles.forEach((input) => { prefs[input.dataset.notif] = input.checked; });
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));

    const original = els.saveNotifs.textContent;
    els.saveNotifs.textContent = '¡Guardado!';
    els.saveNotifs.disabled = true;
    setTimeout(() => {
        els.saveNotifs.textContent = original;
        els.saveNotifs.disabled = false;
        showView('home');
    }, 900);
}
