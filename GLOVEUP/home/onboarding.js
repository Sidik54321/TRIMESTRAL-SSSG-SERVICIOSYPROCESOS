/**
 * GloveUp — Onboarding "Primeros Pasos"
 * Se persiste en localStorage con clave individualizada por email.
 * Puede inserir el widget en el dashboard O renderizar la página completa (#full-page).
 */

(function () {
    'use strict';

    const LS_EMAIL       = 'gloveup_user_email';
    const LS_ROLE        = 'gloveup_user_role';
    const LS_DONE_PREFIX = 'gloveup_onboarding_done_';

    const API = () => (localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${window.location.hostname}:3000` : '')).replace(/\/+$/, '');

    // ── Pasos por rol ────────────────────────────────────────────────────────
    const STEPS_BOXEADOR = [
        {
            id: 'profile',
            icon: 'fas fa-user-edit',
            title: 'Completa tu perfil',
            desc:  'Añade tu foto, peso, disciplina y ubicación para que otros te encuentren más fácil.',
            action: 'Ir a Mi Perfil',
            href:  '../../profile/index.html',
            check: async (email) => {
                try {
                    const r = await fetch(`${API()}/api/boxeadores/me?email=${encodeURIComponent(email)}`);
                    const d = await r.json();
                    return !!(d.foto && d.peso && d.disciplina && d.ubicacion);
                } catch { return false; }
            }
        },
        {
            id: 'sparring_search',
            icon: 'fas fa-fist-raised',
            title: 'Busca tu primer sparring',
            desc:  'Usa el buscador para encontrar compañeros de combate por nivel, peso y ubicación.',
            action: 'Buscar Sparring',
            href:  '../../sparring/index.html',
            check: async () => false
        },
        {
            id: 'challenge_sent',
            icon: 'fas fa-paper-plane',
            title: 'Reta a alguien',
            desc:  'Envía tu primer reto de sparring. Usa los filtros para encontrar al rival perfecto.',
            action: 'Ir al buscador',
            href:  '../../sparring/index.html',
            check: async (email) => {
                try {
                    const r = await fetch(`${API()}/api/boxeadores/challenges?email=${encodeURIComponent(email)}`);
                    const d = await r.json();
                    return Array.isArray(d.sent) && d.sent.length > 0;
                } catch { return false; }
            }
        },
        {
            id: 'gym_explore',
            icon: 'fas fa-building',
            title: 'Explora un gimnasio',
            desc:  'Conoce los gimnasios disponibles, sus precios y entrenadores.',
            action: 'Ver Gimnasios',
            href:  '../../gyms/index.html',
            check: async () => false
        }
    ];

    const STEPS_ENTRENADOR = [
        {
            id: 'profile',
            icon: 'fas fa-id-card',
            title: 'Completa tu perfil de entrenador',
            desc:  'Añade tu especialidad, precio mensual y foto para que los boxeadores puedan encontrarte.',
            action: 'Ir a Mi Perfil',
            href:  '../../profile/index.html',
            check: async (email) => {
                try {
                    const r = await fetch(`${API()}/api/entrenadores/me?email=${encodeURIComponent(email)}`);
                    const d = await r.json();
                    return !!(d.foto && d.especialidad);
                } catch { return false; }
            }
        },
        {
            id: 'create_gym',
            icon: 'fas fa-dumbbell',
            title: 'Crea tu gimnasio',
            desc:  'Registra el gimnasio donde entrenas: nombre, ubicación y descripción. Esto permite que los boxeadores te encuentren.',
            action: 'Ver Gimnasios',
            href:  '../../gyms/index.html',
            check: async (email) => {
                try {
                    const r = await fetch(`${API()}/api/gimnasios`);
                    const gyms = await r.json();
                    return Array.isArray(gyms) && gyms.some(g => (g.creadoPorEmail || '').toLowerCase() === email.toLowerCase());
                } catch { return false; }
            }
        },
        {
            id: 'add_boxer',
            icon: 'fas fa-users-cog',
            title: 'Añade tu primer boxeador',
            desc:  'Registra un boxeador bajo tu gestión usando su email o DNI/Licencia.',
            action: 'Ir a Gestión',
            href:  '../../dashboard/entrenador/dashboard.html#coach-management',
            check: async (email) => {
                try {
                    const r = await fetch(`${API()}/api/entrenadores/me/boxeadores?email=${encodeURIComponent(email)}`);
                    const d = await r.json();
                    return Array.isArray(d) && d.length > 0;
                } catch { return false; }
            }
        },
        {
            id: 'sparring_search',
            icon: 'fas fa-fist-raised',
            title: 'Busca sparrings para tus pupilos',
            desc:  'Explora el buscador y contacta con entrenadores de otros boxeadores.',
            action: 'Buscar Sparring',
            href:  '../../sparring/index.html',
            check: async () => false
        },
        {
            id: 'gym_explore',
            icon: 'fas fa-map-marker-alt',
            title: 'Visita la sección de gimnasios',
            desc:  'Explora instalaciones disponibles en el mapa para tus sesiones.',
            action: 'Ver Gimnasios',
            href:  '../../gyms/index.html',
            check: async () => false
        }
    ];

    // ── Helpers de persistencia ──────────────────────────────────────────────
    function getDoneSet(email) {
        try { return new Set(JSON.parse(localStorage.getItem(LS_DONE_PREFIX + email) || '[]')); }
        catch { return new Set(); }
    }
    function saveDoneSet(email, set) {
        localStorage.setItem(LS_DONE_PREFIX + email, JSON.stringify([...set]));
    }
    function markDone(email, id) {
        const s = getDoneSet(email);
        s.add(id);
        saveDoneSet(email, s);
    }

    // ── Build HTML de tarjetas ───────────────────────────────────────────────
    function buildHTML(steps, doneSet, pct, isFullPage) {
        const cardsHtml = steps.map(step => {
            const done = doneSet.has(step.id);
            return `
            <div class="onboarding-card${done ? ' done' : ''}" data-step="${step.id}" data-href="${step.href}">
                <div class="onboarding-card-icon"><i class="${step.icon}"></i></div>
                <div class="onboarding-card-title">${step.title}</div>
                <div class="onboarding-card-desc">${step.desc}</div>
                ${done
                    ? `<span class="onboarding-card-action"><i class="fas fa-check-circle"></i> Completado</span>`
                    : `<span class="onboarding-card-action">${step.action} <i class="fas fa-arrow-right"></i></span>`
                }
            </div>`;
        }).join('');

        const allDone = doneSet.size >= steps.length;

        return `
        <div class="onboarding-header">
            <h2>🥊 Primeros Pasos en GloveUp</h2>
            <p>Sigue estos pasos para sacar el máximo provecho de la plataforma.</p>
        </div>
        <div class="onboarding-progress-wrap">
            <span class="onboarding-progress-label">Tu Progreso</span>
            <div class="onboarding-progress-track">
                <div class="onboarding-progress-fill" style="width:${pct}%"></div>
            </div>
            <span class="onboarding-progress-pct">${pct}%</span>
        </div>
        ${allDone
            ? `<div style="text-align:center;padding:40px 20px;">
                    <div style="font-size:3rem;margin-bottom:12px;">🎉</div>
                    <h3 style="font-family:var(--font-heading,'Outfit',sans-serif);font-size:1.4rem;font-weight:800;margin:0 0 8px">¡Todo listo!</h3>
                    <p style="color:var(--color-text-light,#64748b);margin:0">Has completado todos los pasos de configuración inicial.</p>
               </div>`
            : `<div class="onboarding-cards">${cardsHtml}</div>`
        }`;
    }

    // ── Render en un contenedor dado ─────────────────────────────────────────
    async function renderOnboarding(containerEl, isDashboardWidget) {
        const email = (localStorage.getItem(LS_EMAIL) || '').trim().toLowerCase();
        const role  = (localStorage.getItem(LS_ROLE)  || 'usuario').toLowerCase();

        if (!email) {
            if (containerEl) containerEl.innerHTML = '<p style="color:#94a3b8;text-align:center">Inicia sesión para ver tus primeros pasos.</p>';
            return;
        }

        const steps   = role === 'entrenador' ? STEPS_ENTRENADOR : STEPS_BOXEADOR;
        const doneSet = getDoneSet(email);

        // Verificaciones async via API
        const checks = await Promise.all(
            steps.map(s => s.check(email).then(v => ({ id: s.id, done: v })).catch(() => ({ id: s.id, done: false })))
        );
        checks.forEach(({ id, done }) => { if (done) doneSet.add(id); });
        saveDoneSet(email, doneSet);

        const totalDone  = steps.filter(s => doneSet.has(s.id)).length;
        const totalSteps = steps.length;
        const pct = Math.round((totalDone / totalSteps) * 100);

        // En widget del dashboard: si todos completos, ocultar
        if (isDashboardWidget && totalDone >= totalSteps) {
            if (containerEl && containerEl.parentNode) containerEl.parentNode.removeChild(containerEl);
            return;
        }

        containerEl.innerHTML = buildHTML(steps, doneSet, pct, !isDashboardWidget);

        // Eventos de clic en tarjetas pendientes
        containerEl.querySelectorAll('.onboarding-card:not(.done)').forEach(card => {
            card.addEventListener('click', () => {
                markDone(email, card.dataset.step);
                window.location.href = card.dataset.href;
            });
        });
    }

    // ── Modo página completa ─────────────────────────────────────────────────
    function initFullPage() {
        const el = document.getElementById('onboarding-full-root');
        if (!el) return;
        renderOnboarding(el, false);
    }

    // ── Exponer para uso externo ─────────────────────────────────────────────
    window.GlvOnboarding = { markDone, getDoneSet };

    // ── Detectar contexto ────────────────────────────────────────────────────
    if (document.getElementById('onboarding-full-root')) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFullPage);
        else initFullPage();
    }

})();
