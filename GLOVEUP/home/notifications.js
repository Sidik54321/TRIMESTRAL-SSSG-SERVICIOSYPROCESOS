/**
 * notifications.js — Sistema de notificaciones en tiempo cuasi-real de GloveUp.
 * Consulta la API REST cada 2 minutos (polling) para actualizar el badge.
 * Respeta las preferencias de silencio por tipo guardadas en localStorage.
 * Sin push notifications ni WebSockets — todo via polling HTTP.
 */
(function () {
    'use strict';

    // ─── CONFIGURACIÓN DE API Y HELPERS ─────────────────────────────────────

    // Detección dinámica del host para entornos locales y de producción
    const _glv_h = window.location.hostname;
    const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
    const API = (localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');

    /** Devuelve el email del usuario activo desde localStorage (en minúsculas). */
    const me = () => (localStorage.getItem('gloveup_user_email') || '').trim().toLowerCase();

    /** Alias de document.getElementById para código más conciso. */
    const $ = id => document.getElementById(id);

    /**
     * Realiza una petición JSON a la API y devuelve null en caso de error
     * (sin lanzar excepción, para que los fallos de red sean silenciosos).
     */
    const apiFetch = (path, opts = {}) =>
        fetch(API + path, {
            method: opts.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
        }).then(r => r.json()).catch(() => null);

    // ─── ICONOS POR TIPO DE NOTIFICACIÓN ────────────────────────────────────

    // Mapa de tipo → emoji para representar visualmente cada categoría
    const ICONS = { mensaje: '💬', sparring: '🥊', gimnasio: '🏋️', general: '🔔' };

    // ─── UTILIDADES DE FORMATO ──────────────────────────────────────────────

    /**
     * Formatea una fecha ISO como texto relativo legible.
     * Menos de 1 min → "ahora", menos de 1 h → "hace Xm", etc.
     */
    function formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const now = new Date();
        const diff = Math.floor((now - d) / 60000); // diferencia en minutos
        if (diff < 1) return 'ahora';
        if (diff < 60) return `hace ${diff}m`;
        if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
        // Para fechas de más de un día mostrar día/mes
        return d.getDate() + '/' + (d.getMonth() + 1);
    }

    // ─── PREFERENCIAS DE NOTIFICACIÓN ───────────────────────────────────────

    /**
     * Lee las preferencias de silencio desde localStorage.
     * Si no existen, devuelve todas las categorías activadas por defecto.
     */
    function getLocPrefs() {
        let prefs = { sparring: true, mensaje: true, gimnasio: true, general: true };
        try {
            const raw = localStorage.getItem('gloveup_notif_prefs');
            if (raw) {
                const parsed = JSON.parse(raw);
                prefs = {
                    sparring: parsed.sparring !== false,
                    // La clave en storage es 'mensajes' pero aquí se mapea a 'mensaje'
                    mensaje: parsed.mensajes !== false,
                    gimnasio: parsed.gimnasio !== false,
                    general: parsed.general !== false,
                };
            }
        } catch (e) {}
        return prefs;
    }

    // ─── BADGE DEL BOTÓN DE NOTIFICACIONES ──────────────────────────────────

    /**
     * Actualiza el contador numérico del badge del icono de campana.
     * Filtra según preferencias del usuario; oculta el badge si hay 0 no leídas.
     */
    async function updateBadge() {
        if (!me()) return;
        const notifs = await apiFetch(`/api/notificaciones?email=${encodeURIComponent(me())}`);
        const badge = $('glv-notif-badge');
        if (!badge || !Array.isArray(notifs)) return;

        const prefs = getLocPrefs();
        let count = 0;
        notifs.forEach(n => {
            if (n.leida) return; // Ignorar las ya leídas
            // Ignorar las categorías silenciadas por el usuario
            const t = n.tipo || 'general';
            if (t === 'sparring' && !prefs.sparring) return;
            if (t === 'mensaje' && !prefs.mensaje) return;
            if (t === 'gimnasio' && !prefs.gimnasio) return;
            if (t === 'general' && !prefs.general) return;
            count++;
        });

        // Limitar el badge a "9+" para evitar desbordamiento visual
        if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'flex'; }
        else badge.style.display = 'none';
    }

    // ─── LISTA DE NOTIFICACIONES ─────────────────────────────────────────────

    /**
     * Carga y renderiza la lista completa de notificaciones en el panel.
     * Aplica filtros de preferencias y añade eventos de clic para leer y eliminar.
     */
    async function loadNotifications() {
        const list = $('glv-notif-list');
        if (!list || !me()) return;
        list.innerHTML = '<li class="glv-list-hint">Cargando…</li>';
        const notifs = await apiFetch(`/api/notificaciones?email=${encodeURIComponent(me())}`);
        list.innerHTML = '';
        if (!Array.isArray(notifs) || !notifs.length) {
            list.innerHTML = '<li class="glv-list-hint">Sin notificaciones por ahora.</li>';
            return;
        }

        // Filtrar según preferencias del usuario (respetando lo configurado en Settings)
        const prefs = getLocPrefs();
        const filteredNotifs = notifs.filter(n => {
            const t = n.tipo || 'general';
            if (t === 'sparring' && !prefs.sparring) return false;
            if (t === 'mensaje' && !prefs.mensaje) return false;
            if (t === 'gimnasio' && !prefs.gimnasio) return false;
            if (t === 'general' && !prefs.general) return false;
            return true;
        });

        if (!filteredNotifs.length) {
            list.innerHTML = '<li class="glv-list-hint">Notificaciones silenciadas o vacías.</li>';
            return;
        }

        // Construir un <li> por cada notificación con sus controles
        filteredNotifs.forEach(n => {
            const li = document.createElement('li');
            // Las notificaciones ya leídas reciben la clase CSS 'leida' (opacidad reducida)
            li.className = 'glv-notif-item' + (n.leida ? ' leida' : '');
            li.dataset.id = n._id;
            li.innerHTML = `
                <span class="glv-notif-icon">${ICONS[n.tipo] || '🔔'}</span>
                <div class="glv-notif-body">
                    <div class="glv-notif-title">${n.titulo}</div>
                    ${n.cuerpo ? `<div class="glv-notif-cuerpo">${n.cuerpo}</div>` : ''}
                    <div class="glv-notif-time">${formatTime(n.createdAt)}</div>
                </div>
                ${!n.leida ? '<span class="glv-notif-dot"></span>' : ''}
                <button class="glv-notif-delete" aria-label="Eliminar notificacion" title="Eliminar"><i class="fas fa-times"></i></button>`;

            // Clic en el item → marcar como leída (si no lo estaba aún)
            li.addEventListener('click', async (e) => {
                // Si el clic es en el boton de borrar, no hacemos lectura
                if (e.target.closest('.glv-notif-delete')) return;

                if (!n.leida) {
                    await apiFetch(`/api/notificaciones/leer/${n._id}`, { method: 'PUT' });
                    li.classList.add('leida');
                    const dot = li.querySelector('.glv-notif-dot');
                    if (dot) dot.remove();
                    updateBadge(); // Actualizar el contador tras leer
                }
            });

            // Botón × → eliminar la notificación con animación de desvanecido
            const delBtn = li.querySelector('.glv-notif-delete');
            if (delBtn) {
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Evitar que el clic propague al handler de lectura
                    const res = await apiFetch(`/api/notificaciones/${n._id}`, { method: 'DELETE' });
                    if (res && res.ok) {
                        li.style.opacity = '0'; // Animación de desvanecido antes de retirar del DOM
                        setTimeout(() => {
                            li.remove();
                            // Update badge after delete
                            updateBadge();
                            // Si la lista queda vacía, mostrar mensaje informativo
                            if ($('glv-notif-list').children.length === 0) {
                                $('glv-notif-list').innerHTML = '<li class="glv-list-hint">Sin notificaciones por ahora.</li>';
                            }
                        }, 200);
                    }
                });
            }
            list.appendChild(li);
        });
    }

    // ─── INICIALIZACIÓN Y EVENTOS DEL PANEL ─────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        const bell = $('glv-notif-btn');
        const panel = $('glv-notif-panel');
        const closeBtn = $('glv-notif-close');
        const markAllBtn = $('glv-notif-mark-all');
        const deleteAllBtn = $('glv-notif-delete-all');

        // Botón campana → alternar visibilidad del panel y cargar notificaciones
        if (bell && panel) {
            bell.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = !panel.classList.contains('hidden');
                if (open) { panel.classList.add('hidden'); }
                else { panel.classList.remove('hidden'); loadNotifications(); }
            });
        }

        // Botón cerrar (×) del panel
        if (closeBtn) closeBtn.addEventListener('click', () => { if (panel) panel.classList.add('hidden'); });

        // Marcar todas como leídas de una vez
        if (markAllBtn) markAllBtn.addEventListener('click', async () => {
            await apiFetch(`/api/notificaciones/leer-todas?email=${encodeURIComponent(me())}`, { method: 'PUT' });
            loadNotifications();
            updateBadge();
        });

        // Eliminar todas las notificaciones del usuario
        if (deleteAllBtn) deleteAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            // Vaciar la lista visualmente antes de que responda la API (UX optimista)
            const list = $('glv-notif-list');
            if (list) list.innerHTML = '<li class="glv-list-hint">Sin notificaciones por ahora.</li>';
            await apiFetch(`/api/notificaciones/todas?email=${encodeURIComponent(me())}`, { method: 'DELETE' });
            updateBadge();
        });

        // Cierra al hacer clic fuera del panel
        document.addEventListener('click', (e) => {
            if (panel && !panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== bell) {
                panel.classList.add('hidden');
            }
        });

        // Iniciar polling del badge cada 2 minutos si hay usuario activo
        if (me()) {
            updateBadge();
            setInterval(updateBadge, 120000); // 120 000 ms = 2 minutos
        }
    });
})();
