/**
 * profile-view.js — Ficha de sólo lectura de otro boxeador.
 */

import { api } from '../api.js';

const DEFAULT_PHOTO = '/assets/images/unnamed-removebg-preview.png';

let abort = null;

/** @param {HTMLElement} root Div con data-page="profile-view" */
export function init(root) {
    const identifier = root.dataset.identifier || '';
    const loading = root.querySelector('#view-loading');
    const card = root.querySelector('#view-card');
    const error = root.querySelector('#view-error');

    abort?.abort();
    const run = new AbortController();
    abort = run;

    api.boxeadorLookup(identifier)
        .then((data) => {
            if (run.signal.aborted) return;

            loading.hidden = true;
            card.innerHTML = template(data || {});
            card.hidden = false;

            const name = data?.nombre || 'Perfil';
            document.title = `${name} — GloveUp`;
            const heading = document.getElementById('topbar-title');
            if (heading) heading.textContent = name;
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

function template(b) {
    const photo = resolvePhoto(b.foto);

    const stat = (label, value) => (value
        ? `<div>
               <p class="text-xs font-bold uppercase tracking-wide text-muted">${label}</p>
               <p class="mt-0.5 font-semibold">${escapeHtml(String(value))}</p>
           </div>`
        : '');

    return `
        <div class="card p-6">
            <div class="flex flex-wrap items-center gap-4">
                <img src="${escapeAttr(photo)}" alt=""
                     class="h-24 w-24 rounded-full bg-sunken object-cover dark:bg-white/10">
                <div>
                    <h2 class="text-2xl">${escapeHtml(b.nombre || 'Boxeador')}</h2>
                    ${b.alias ? `<p class="text-sm text-muted">@${escapeHtml(b.alias.replace(/\s+/g, '').toLowerCase())}</p>` : ''}
                </div>
            </div>

            ${b.bio ? `<p class="mt-6 leading-relaxed text-muted dark:text-white/70">${escapeHtml(b.bio)}</p>` : ''}

            <div class="mt-6 grid grid-cols-2 gap-4 border-t border-hairline pt-6 dark:border-white/10 sm:grid-cols-3">
                ${stat('Nivel', b.nivel)}
                ${stat('Gimnasio', b.gimnasio)}
                ${stat('Disciplina', b.disciplina)}
                ${stat('Ubicación', b.ubicacion)}
                ${stat('Categoría', b.categoriaPeso)}
                ${stat('Guardia', b.guardia)}
                ${stat('Peso', b.peso ? `${b.peso} kg` : '')}
                ${stat('Altura', b.altura ? `${b.altura} cm` : '')}
                ${stat('Frecuencia', b.frecuenciaSparring)}
            </div>
        </div>
    `;
}

function resolvePhoto(value) {
    if (!value) return DEFAULT_PHOTO;
    if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) return value;
    return value.startsWith('/') ? `/legacy${value}` : value;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}
