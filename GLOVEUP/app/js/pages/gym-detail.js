/**
 * gym-detail.js — Módulo de la ficha de un gimnasio.
 */

import { api } from '../api.js';

let abort = null;

/** @param {HTMLElement} root Div con data-page="gym-detail" */
export function init(root) {
    const key = root.dataset.gymKey || '';
    const loading = root.querySelector('#gym-detail-loading');
    const article = root.querySelector('#gym-detail');
    const error = root.querySelector('#gym-detail-error');

    abort?.abort();
    const run = new AbortController();
    abort = run;

    api.gimnasio(key)
        .then((gym) => {
            if (run.signal.aborted) return;

            loading.hidden = true;

            // lookup responde 200 con null cuando la clave no existe
            if (!gym) {
                error.hidden = false;
                return;
            }

            article.innerHTML = template(gym);
            article.hidden = false;
            document.title = `${gym.nombre} — GloveUp`;

            const heading = document.getElementById('topbar-title');
            if (heading) heading.textContent = gym.nombre;
        })
        .catch(() => {
            if (run.signal.aborted) return;
            loading.hidden = true;
            error.hidden = false;
        });
}

export function destroy() {
    abort?.abort();
    abort = null;
}

function template(gym) {
    const fotos = Array.isArray(gym.fotos) ? gym.fotos.filter(Boolean) : [];
    const portada = gym.fotoPerfil || fotos[0] || '/assets/images/Sparring_Club_Collection-Link-Image.jpg';

    const dato = (icon, label, value) => (value
        ? `<div class="flex items-start gap-3">
               <i class="fas ${icon} mt-1 w-4 text-center text-accent"></i>
               <div>
                   <p class="text-xs font-bold uppercase tracking-wide text-muted">${label}</p>
                   <p class="text-sm">${escapeHtml(value)}</p>
               </div>
           </div>`
        : '');

    return `
        <img src="${escapeAttr(portada)}" alt=""
             class="h-64 w-full rounded-panel object-cover shadow-float">

        <header class="mt-8">
            <h2 class="text-3xl">${escapeHtml(gym.nombre)}</h2>
            <p class="mt-2 flex items-center gap-2 text-sm text-muted">
                <i class="fas fa-location-dot text-accent"></i>
                ${escapeHtml(gym.ubicacion || 'Ubicación no indicada')}
            </p>
        </header>

        ${gym.bio ? `<p class="mt-6 leading-relaxed text-muted dark:text-white/70">
            ${escapeHtml(gym.bio)}</p>` : ''}

        <div class="card mt-8 grid gap-6 p-6 sm:grid-cols-2">
            ${dato('fa-map-pin', 'Dirección', gym.direccion)}
            ${dato('fa-user-tie', 'Entrenador', gym.nombreEntrenador)}
            ${dato('fa-clock', 'Horario', gym.horario)}
            ${dato('fa-envelope', 'Contacto', gym.correoContacto)}
            ${dato('fa-phone', 'Teléfono', gym.telefono)}
        </div>

        ${fotos.length > 1 ? `
            <h3 class="mt-10 text-lg">Instalaciones</h3>
            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                ${fotos.slice(0, 6).map((f) => `
                    <img src="${escapeAttr(f)}" alt="" loading="lazy"
                         class="aspect-square w-full rounded-card object-cover">
                `).join('')}
            </div>` : ''}
    `;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
