/**
 * GloveUp — Onboarding "Primeros Pasos"
 * Se persiste en localStorage con clave individualizada por email.
 * Los pasos completados desaparecen de la lista.
 */

(function () {
    'use strict';

    const LS_EMAIL       = 'gloveup_user_email';
    const LS_ROLE        = 'gloveup_user_role';
    const LS_DONE_PREFIX = 'gloveup_onboarding_done_';

    const _glv_h = window.location.hostname;
    const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
    const API = () => (localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');

    // ── Pasos por rol ────────────────────────────────────────────────────────
    const STEPS_BOXEADOR = [
        {
            id: 'profile',
            icon: 'fas fa-user-edit',
            title: 'Completa tu perfil',
            desc:  'Añade tu foto, peso, disciplina y ubicación para que otros te encuentren más fácil.',
            action: 'Ir a Mi Perfil',
            href:  '../profile/index.html',
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
            href:  '../sparring/index.html',
            check: async () => false
        },
        {
            id: 'challenge_sent',
            icon: 'fas fa-paper-plane',
            title: 'Reta a alguien',
            desc:  'Envía tu primer reto de sparring. Usa los filtros para encontrar al rival perfecto.',
            action: 'Ir al buscador',
            href:  '../sparring/index.html',
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
            href:  '../gyms/index.html',
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
            href:  '../profile/index.html',
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
            desc:  'Registra el gimnasio donde entrenas: nombre, ubicación y descripción.',
            action: 'Ver Gimnasios',
            href:  '../gyms/index.html',
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
            href:  '../dashboard/entrenador/dashboard.html#coach-management',
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
            href:  '../sparring/index.html',
            check: async () => false
        },
        {
            id: 'gym_explore',
            icon: 'fas fa-map-marker-alt',
            title: 'Visita la sección de gimnasios',
            desc:  'Explora instalaciones disponibles en el mapa para tus sesiones.',
            action: 'Ver Gimnasios',
            href:  '../gyms/index.html',
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

    // ── Build HTML: sólo pasos pendientes ────────────────────────────────────
    function buildHTML(steps, doneSet, pct) {
        const pending = steps.filter(s => !doneSet.has(s.id));

        const cardsHtml = pending.map(step => `
            <div class="onboarding-card" data-step="${step.id}" data-href="${step.href}">
                <button class="onboarding-card-dismiss" data-step="${step.id}" title="Marcar como hecho">
                    <i class="fas fa-times"></i>
                </button>
                <div class="onboarding-card-icon"><i class="${step.icon}"></i></div>
                <div class="onboarding-card-title">${step.title}</div>
                <div class="onboarding-card-desc">${step.desc}</div>
                <span class="onboarding-card-action">${step.action} <i class="fas fa-arrow-right"></i></span>
            </div>`
        ).join('');

        const allDone = pending.length === 0;

        return `
        <div class="onboarding-progress-wrap">
            <span class="onboarding-progress-label">Tu Progreso</span>
            <div class="onboarding-progress-track">
                <div class="onboarding-progress-fill" style="width:${pct}%"></div>
            </div>
            <span class="onboarding-progress-pct">${pct}%</span>
        </div>
        ${allDone
            ? `<div style="text-align:center;padding:48px 20px;">
                    <div style="font-size:3.5rem;margin-bottom:14px;">🎉</div>
                    <h3 style="font-family:var(--font-heading,'Outfit',sans-serif);font-size:1.5rem;font-weight:800;margin:0 0 8px">¡Todo listo!</h3>
                    <p style="color:var(--color-text-light,#64748b);margin:0 0 20px">Has completado todos los pasos de configuración inicial.</p>
                    <a href="../sparring/index.html" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;padding:12px 24px;border-radius:99px;font-weight:700;text-decoration:none;font-size:0.9rem;">
                        <i class="fas fa-fist-raised"></i> Buscar Sparring
                    </a>
               </div>`
            : `<div class="onboarding-cards">${cardsHtml}</div>`
        }`;
    }

    // ── Render ───────────────────────────────────────────────────────────────
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

        // Widget del dashboard: si todos completos, ocultar
        if (isDashboardWidget && totalDone >= totalSteps) {
            if (containerEl && containerEl.parentNode) containerEl.parentNode.removeChild(containerEl);
            return;
        }

        containerEl.innerHTML = buildHTML(steps, doneSet, pct);

        // Clic en tarjeta → marcar hecho + navegar
        containerEl.querySelectorAll('.onboarding-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.onboarding-card-dismiss')) return;
                markDone(email, card.dataset.step);
                window.location.href = card.dataset.href;
            });
        });

        // Clic en "×" → marcar hecho + animar desaparición + re-render
        containerEl.querySelectorAll('.onboarding-card-dismiss').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const stepId = btn.dataset.step;
                const card = btn.closest('.onboarding-card');
                markDone(email, stepId);
                if (card) {
                    card.classList.add('dismissing');
                    setTimeout(() => renderOnboarding(containerEl, isDashboardWidget), 260);
                } else {
                    renderOnboarding(containerEl, isDashboardWidget);
                }
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
