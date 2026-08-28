/**
 * onboarding.js (página) — Primeros Pasos.
 *
 * Pinta la checklist que calcula app/js/onboarding.js. Marcar un paso como
 * hecho (al pulsarlo o al descartarlo con la "×") navega por la SPA en vez
 * de forzar una recarga completa, a diferencia de la versión clásica.
 */

import * as session from '../session.js';
import { navigate } from '../router.js';
import { evaluate, markDone, hideNavIfDone } from '../onboarding.js';

let els = {};

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="onboarding" */
export function init(root) {
    els = {
        root,
        checklist: root.querySelector('[data-onboarding-root]'),
        manualBoxeador: root.querySelector('[data-manual="boxeador"]'),
        manualEntrenador: root.querySelector('[data-manual="entrenador"]'),
    };

    const isCoach = session.role() === 'entrenador';
    (isCoach ? els.manualEntrenador : els.manualBoxeador).hidden = false;

    load();
}

export function destroy() {
    els = {};
}

async function load() {
    const email = session.email();
    if (!email) {
        els.checklist.innerHTML = `<p class="py-10 text-center text-sm text-muted">
            Inicia sesión para ver tus primeros pasos.</p>`;
        return;
    }

    const { steps, doneSet, pct } = await evaluate(email, session.role());
    hideNavIfDone(doneSet, steps);
    render(steps, doneSet, pct);
}

function render(steps, doneSet, pct) {
    const pending = steps.filter((s) => !doneSet.has(s.id));

    if (pending.length === 0) {
        els.checklist.innerHTML = `
            <div class="card p-12 text-center">
                <p class="text-5xl">🎉</p>
                <h3 class="mt-4 text-xl">¡Todo listo!</h3>
                <p class="mt-2 text-sm text-muted dark:text-white/60">
                    Has completado todos los pasos de configuración inicial.
                </p>
                <a href="/sparring" class="btn-primary mt-6">
                    <i class="fas fa-fist-raised" aria-hidden="true"></i> Buscar sparring
                </a>
            </div>
        `;
        return;
    }

    els.checklist.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="text-xs font-bold uppercase tracking-wide text-muted">Tu progreso</span>
            <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken dark:bg-white/10">
                <div class="h-full rounded-full bg-accent transition-all duration-500" style="width:${pct}%"></div>
            </div>
            <span class="text-sm font-black">${pct}%</span>
        </div>
        <div class="mt-6 grid gap-4 sm:grid-cols-2">
            ${pending.map((step) => `
                <article data-step="${step.id}" data-href="${step.href}"
                         class="card-interactive relative cursor-pointer p-5">
                    <button type="button" data-dismiss="${step.id}" title="Marcar como hecho"
                            class="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full
                                   text-faint transition-colors hover:bg-sunken hover:text-muted
                                   dark:hover:bg-white/10">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                    <span class="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-lg text-accent">
                        <i class="fas ${step.icon}" aria-hidden="true"></i>
                    </span>
                    <h4 class="mt-3 font-bold">${step.title}</h4>
                    <p class="mt-1 text-sm text-muted dark:text-white/60">${step.desc}</p>
                    <span class="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-accent">
                        ${step.action} <i class="fas fa-arrow-right text-[0.65rem]" aria-hidden="true"></i>
                    </span>
                </article>
            `).join('')}
        </div>
    `;

    els.checklist.querySelectorAll('[data-step]').forEach((card) => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-dismiss]')) return;
            markDone(session.email(), card.dataset.step);
            navigate(card.dataset.href);
        });
    });

    els.checklist.querySelectorAll('[data-dismiss]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            markDone(session.email(), btn.dataset.dismiss);
            const card = btn.closest('[data-step]');
            card?.classList.add('opacity-0', 'scale-95');
            setTimeout(load, 200);
        });
    });
}
