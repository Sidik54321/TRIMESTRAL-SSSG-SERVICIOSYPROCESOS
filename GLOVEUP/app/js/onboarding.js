/**
 * onboarding.js — Lista de pasos de "Primeros Pasos", compartida.
 *
 * Migración de home/onboarding.js. Vive fuera de app/js/pages porque dos
 * sitios la usan: la propia página de Primeros Pasos y (para ocultar el
 * elemento del menú cuando ya no queda nada pendiente) el dashboard de
 * Inicio del boxeador — igual alcance que tenía el script original, que
 * sólo se cargaba en esas dos páginas, no en toda la app.
 */

import { api } from './api.js';

const DONE_PREFIX = 'gloveup_onboarding_done_';

const STEPS_BOXEADOR = [
    {
        id: 'profile', icon: 'fa-user-edit', title: 'Completa tu perfil',
        desc: 'Añade tu foto, peso, disciplina y ubicación para que otros te encuentren más fácil.',
        action: 'Ir a Mi Perfil', href: '/perfil',
        check: async (email) => {
            const d = await api.boxeador(email).catch(() => null);
            return Boolean(d?.foto && d?.peso && d?.disciplina && d?.ubicacion);
        },
    },
    {
        id: 'sparring_search', icon: 'fa-fist-raised', title: 'Busca tu primer sparring',
        desc: 'Usa el buscador para encontrar compañeros de combate por nivel, peso y ubicación.',
        action: 'Buscar Sparring', href: '/sparring',
        check: async () => false, // sin verificación automática; se descarta a mano
    },
    {
        id: 'challenge_sent', icon: 'fa-paper-plane', title: 'Reta a alguien',
        desc: 'Envía tu primer reto de sparring. Usa los filtros para encontrar al rival perfecto.',
        action: 'Ir al buscador', href: '/sparring',
        check: async (email) => {
            const d = await api.challenges(email).catch(() => null);
            return Array.isArray(d?.sent) && d.sent.length > 0;
        },
    },
    {
        id: 'gym_explore', icon: 'fa-building', title: 'Explora un gimnasio',
        desc: 'Conoce los gimnasios disponibles, sus precios y entrenadores.',
        action: 'Ver Gimnasios', href: '/gimnasios',
        check: async () => false,
    },
];

const STEPS_ENTRENADOR = [
    {
        id: 'profile', icon: 'fa-id-card', title: 'Completa tu perfil de entrenador',
        desc: 'Añade tu especialidad, precio mensual y foto para que los boxeadores puedan encontrarte.',
        action: 'Ir a Mi Perfil', href: '/perfil',
        check: async (email) => {
            const d = await api.entrenador(email).catch(() => null);
            return Boolean(d?.foto && d?.especialidad);
        },
    },
    {
        id: 'create_gym', icon: 'fa-dumbbell', title: 'Crea tu gimnasio',
        desc: 'Registra el gimnasio donde entrenas: nombre, ubicación y descripción.',
        action: 'Ver Gimnasios', href: '/gimnasios',
        check: async (email) => {
            const gyms = await api.gimnasios().catch(() => []);
            return Array.isArray(gyms) && gyms.some((g) => (g.creadoPorEmail || '').toLowerCase() === email.toLowerCase());
        },
    },
    {
        id: 'add_boxer', icon: 'fa-users-cog', title: 'Añade tu primer boxeador',
        desc: 'Registra un boxeador bajo tu gestión usando su email o DNI/Licencia.',
        action: 'Ir a Gestión', href: '/gestion',
        check: async (email) => {
            const d = await api.coachBoxeadores(email).catch(() => []);
            return Array.isArray(d) && d.length > 0;
        },
    },
    {
        id: 'sparring_search', icon: 'fa-fist-raised', title: 'Busca sparrings para tus pupilos',
        desc: 'Explora el buscador y contacta con entrenadores de otros boxeadores.',
        action: 'Buscar Sparring', href: '/sparring',
        check: async () => false,
    },
    {
        id: 'gym_explore', icon: 'fa-map-marker-alt', title: 'Visita la sección de gimnasios',
        desc: 'Explora instalaciones disponibles en el mapa para tus sesiones.',
        action: 'Ver Gimnasios', href: '/gimnasios',
        check: async () => false,
    },
];

/** @param {string} role @returns {Array<object>} */
export function stepsFor(role) {
    return role === 'entrenador' ? STEPS_ENTRENADOR : STEPS_BOXEADOR;
}

/** @param {string} email @returns {Set<string>} */
export function getDoneSet(email) {
    try {
        return new Set(JSON.parse(localStorage.getItem(DONE_PREFIX + email) || '[]'));
    } catch {
        return new Set();
    }
}

function saveDoneSet(email, set) {
    localStorage.setItem(DONE_PREFIX + email, JSON.stringify([...set]));
}

/** @param {string} email @param {string} stepId */
export function markDone(email, stepId) {
    const set = getDoneSet(email);
    set.add(stepId);
    saveDoneSet(email, set);
}

/**
 * Ejecuta las comprobaciones de cada paso contra la API y actualiza el
 * progreso guardado con lo que ya esté completado de verdad.
 *
 * @param {string} email @param {string} role
 * @returns {Promise<{steps: Array<object>, doneSet: Set<string>, pct: number}>}
 */
export async function evaluate(email, role) {
    const steps = stepsFor(role);
    const doneSet = getDoneSet(email);

    const results = await Promise.all(
        steps.map((s) => s.check(email).then((done) => ({ id: s.id, done })).catch(() => ({ id: s.id, done: false }))),
    );
    results.forEach(({ id, done }) => { if (done) doneSet.add(id); });
    saveDoneSet(email, doneSet);

    const totalDone = steps.filter((s) => doneSet.has(s.id)).length;
    return { steps, doneSet, pct: Math.round((totalDone / steps.length) * 100) };
}

/** Oculta "Primeros Pasos" del menú cuando no queda ningún paso pendiente. */
export function hideNavIfDone(doneSet, steps) {
    const link = document.querySelector('[data-nav="primeros-pasos"]');
    const item = link?.closest('li');
    if (item) item.hidden = steps.every((s) => doneSet.has(s.id));
}
