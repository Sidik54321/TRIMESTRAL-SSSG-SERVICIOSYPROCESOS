/* notifications.js — Sistema de notificaciones GloveUp */
(function () {
    'use strict';

    const API = (localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${window.location.hostname}:3000` : '')).replace(/\/+$/, '');
    const me = () => (localStorage.getItem('gloveup_user_email') || '').trim().toLowerCase();
    const $ = id => document.getElementById(id);

    const apiFetch = (path, opts = {}) =>
        fetch(API + path, {
            method: opts.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
        }).then(r => r.json()).catch(() => null);

    const ICONS = { mensaje: '💬', sparring: '🥊', gimnasio: '🏋️', general: '🔔' };

    function formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const now = new Date();
        const diff = Math.floor((now - d) / 60000);
        if (diff < 1) return 'ahora';
        if (diff < 60) return `hace ${diff}m`;
        if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
        return d.getDate() + '/' + (d.getMonth() + 1);
    }

    function getLocPrefs() {
        let prefs = { sparring: true, mensaje: true, gimnasio: true, general: true };
        try {
            const raw = localStorage.getItem('gloveup_notif_prefs');
            if (raw) {
                const parsed = JSON.parse(raw);
                prefs = {
                    sparring: parsed.sparring !== false,
                    mensaje: parsed.mensajes !== false,
                    gimnasio: parsed.gimnasio !== false,
                    general: parsed.general !== false,
                };
            }
        } catch (e) {}
        return prefs;
    }

    async function updateBadge() {
        if (!me()) return;
        const notifs = await apiFetch(`/api/notificaciones?email=${encodeURIComponent(me())}`);
        const badge = $('glv-notif-badge');
        if (!badge || !Array.isArray(notifs)) return;
        
        const prefs = getLocPrefs();
        let count = 0;
        notifs.forEach(n => {
            if (n.leida) return;
            const t = n.tipo || 'general';
            if (t === 'sparring' && !prefs.sparring) return;
            if (t === 'mensaje' && !prefs.mensaje) return;
            if (t === 'gimnasio' && !prefs.gimnasio) return;
            if (t === 'general' && !prefs.general) return;
            count++;
        });

        if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'flex'; }
        else badge.style.display = 'none';
    }

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

        filteredNotifs.forEach(n => {
            const li = document.createElement('li');
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
            
            li.addEventListener('click', async (e) => {
                // Si el clic es en el boton de borrar, no hacemos lectura
                if (e.target.closest('.glv-notif-delete')) return;
                
                if (!n.leida) {
                    await apiFetch(`/api/notificaciones/leer/${n._id}`, { method: 'PUT' });
                    li.classList.add('leida');
                    const dot = li.querySelector('.glv-notif-dot');
                    if (dot) dot.remove();
                    updateBadge();
                }
            });

            const delBtn = li.querySelector('.glv-notif-delete');
            if (delBtn) {
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const res = await apiFetch(`/api/notificaciones/${n._id}`, { method: 'DELETE' });
                    if (res && res.ok) {
                        li.style.opacity = '0';
                        setTimeout(() => {
                            li.remove();
                            // Update badge after delete
                            updateBadge();
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

    document.addEventListener('DOMContentLoaded', () => {
        const bell = $('glv-notif-btn');
        const panel = $('glv-notif-panel');
        const closeBtn = $('glv-notif-close');
        const markAllBtn = $('glv-notif-mark-all');

        if (bell && panel) {
            bell.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = !panel.classList.contains('hidden');
                if (open) { panel.classList.add('hidden'); }
                else { panel.classList.remove('hidden'); loadNotifications(); }
            });
        }

        if (closeBtn) closeBtn.addEventListener('click', () => { if (panel) panel.classList.add('hidden'); });

        if (markAllBtn) markAllBtn.addEventListener('click', async () => {
            await apiFetch(`/api/notificaciones/leer-todas?email=${encodeURIComponent(me())}`, { method: 'PUT' });
            loadNotifications();
            updateBadge();
        });

        // Cierra al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (panel && !panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== bell) {
                panel.classList.add('hidden');
            }
        });

        if (me()) {
            updateBadge();
            setInterval(updateBadge, 120000);
        }
    });
})();
