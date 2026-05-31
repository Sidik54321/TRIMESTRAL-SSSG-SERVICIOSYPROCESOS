/**
 * chat.js — Sistema de chat de GloveUp con historial de conversaciones.
 * Implementado mediante polling HTTP cada 15 segundos (sin WebSockets).
 * Permite buscar usuarios, abrir conversaciones y enviar mensajes de texto.
 * El badge de mensajes no leídos se actualiza también cada 2 minutos.
 */
(function () {
    'use strict';

    // ─── CONFIGURACIÓN Y ESTADO ──────────────────────────────────────────────

    // Detección dinámica del host para entornos locales y de producción
    const _glv_h = window.location.hostname;
    const _glv_apiHost = (_glv_h === '127.0.0.1' || _glv_h === 'localhost' || _glv_h === '') ? 'localhost' : _glv_h;
    const API = (localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_glv_apiHost}:3000` : '')).replace(/\/+$/, '');

    /** Devuelve el email del usuario activo (fuente de verdad del "yo"). */
    const me = () => (localStorage.getItem('gloveup_user_email') || '').trim().toLowerCase();

    // Estado de la conversación actualmente abierta y el ID del intervalo de polling
    let activeContact = null;
    let pollId = null;

    /** Alias de document.getElementById para código más conciso. */
    const $ = id => document.getElementById(id);

    /**
     * Realiza una petición JSON a la API.
     * Devuelve null en caso de error para que los fallos sean silenciosos.
     */
    const apiFetch = (path, opts = {}) =>
        fetch(API + path, {
            method: opts.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
        }).then(r => r.json()).catch(() => null);

    // ─── GESTIÓN DE PANELES ──────────────────────────────────────────────────

    /**
     * Muestra el panel indicado y oculta el resto.
     * Los tres paneles posibles son: home, search y conv(ersación).
     */
    function showPanel(id) {
        ['glv-home-panel', 'glv-search-panel', 'glv-conv-panel'].forEach(p => {
            const el = $(p);
            if (el) el.classList.toggle('hidden', p !== id);
        });
    }

    // ─── LISTA DE CONVERSACIONES ─────────────────────────────────────────────

    /**
     * Carga y renderiza la lista de conversaciones recientes del usuario.
     * Muestra la última línea del chat y el número de mensajes no leídos.
     */
    async function loadConversations() {
        const list = $('glv-conv-list');
        if (!list || !me()) return;
        list.innerHTML = '<li class="glv-list-hint">Cargando…</li>';
        const convs = await apiFetch(`/api/chat/conversaciones?email=${encodeURIComponent(me())}`);
        list.innerHTML = '';
        if (!Array.isArray(convs) || !convs.length) {
            list.innerHTML = '<li class="glv-list-hint">Aún no hay conversaciones.<br>Pulsa <b>+</b> para empezar.</li>';
            return;
        }
        convs.forEach(c => {
            const li = document.createElement('li');
            li.className = 'glv-conv-item';
            // Usar la primera letra del nombre como avatar textual
            const initials = (c.nombre || c.email).charAt(0).toUpperCase();
            const preview = c.ultimo ? truncate(c.ultimo.texto, 38) : 'Sin mensajes';
            const ts = c.ultimo ? formatTime(c.ultimo.fecha) : '';
            li.innerHTML = `
                <div class="glv-avatar">${initials}</div>
                <div class="glv-conv-meta">
                    <div class="glv-conv-top">
                        <span class="glv-conv-name">${c.nombre || c.email}</span>
                        <span class="glv-conv-ts">${ts}</span>
                    </div>
                    <div class="glv-conv-preview">${preview}${c.noLeidos > 0 ? `<span class="glv-unread-badge">${c.noLeidos}</span>` : ''}</div>
                </div>`;
            li.addEventListener('click', () => openConversation({ email: c.email, nombre: c.nombre }));
            list.appendChild(li);
        });
    }

    // ─── BÚSQUEDA DE CONTACTOS ───────────────────────────────────────────────

    // Temporizador para el debounce del input de búsqueda (evita llamadas por cada tecla)
    let searchTimeout = null;

    /**
     * Busca usuarios en la API según la cadena introducida.
     * Muestra resultados con el rol del usuario (entrenador / boxeador).
     */
    async function doSearch(q) {
        const results = $('glv-search-results');
        if (!results) return;
        results.innerHTML = '<li class="glv-list-hint">Buscando…</li>';
        const contacts = await apiFetch(`/api/chat/buscar?email=${encodeURIComponent(me())}&q=${encodeURIComponent(q)}`);
        results.innerHTML = '';
        if (!Array.isArray(contacts) || !contacts.length) {
            results.innerHTML = '<li class="glv-list-hint">Sin resultados.</li>';
            return;
        }
        contacts.forEach(c => {
            const li = document.createElement('li');
            li.className = 'glv-search-item';
            const roleLabel = c.rol === 'entrenador' ? ' <small>(Entrenador)</small>' : '';
            li.innerHTML = `<div class="glv-avatar sm">${(c.nombre || c.email).charAt(0).toUpperCase()}</div><span>${c.nombre || c.email}${roleLabel}</span>`;
            li.addEventListener('click', () => { openConversation(c); });
            results.appendChild(li);
        });
    }

    // ─── GESTIÓN DE CONVERSACIÓN ACTIVA ─────────────────────────────────────

    /**
     * Abre la conversación con el contacto indicado.
     * Actualiza el estado global, muestra el panel y arranca el polling.
     */
    function openConversation(contact) {
        activeContact = contact;
        const nameEl = $('glv-conv-name');
        if (nameEl) nameEl.textContent = contact.nombre || contact.email;
        showPanel('glv-conv-panel');
        fetchMessages(true); // Carga inicial con scroll al final
        startPolling();
    }

    /**
     * Cierra la conversación activa, detiene el polling y vuelve al panel home.
     * Recarga la lista de conversaciones para reflejar mensajes leídos.
     */
    function closeConversation() {
        stopPolling();
        activeContact = null;
        showPanel('glv-home-panel');
        loadConversations();
    }

    /**
     * Crea y devuelve el elemento DOM de una burbuja de mensaje.
     * Las burbujas propias se alinean a la derecha; las del interlocutor, a la izquierda.
     */
    function renderBubble(msg) {
        const mine = msg.de === me();
        const div = document.createElement('div');
        div.className = 'glv-bubble ' + (mine ? 'glv-mine' : 'glv-theirs');
        const txt = document.createElement('span');
        txt.className = 'glv-bubble-text';
        txt.textContent = msg.texto;
        const ts = document.createElement('span');
        ts.className = 'glv-bubble-time';
        ts.textContent = formatTime(msg.createdAt);
        div.appendChild(txt);
        div.appendChild(ts);
        return div;
    }

    /**
     * Obtiene los mensajes de la conversación activa y los renderiza.
     * Si scroll=true o el usuario ya estaba al final, hace scroll automático.
     */
    async function fetchMessages(scroll) {
        if (!activeContact) return;
        const msgs = await apiFetch(`/api/chat/mensajes?email=${encodeURIComponent(me())}&con=${encodeURIComponent(activeContact.email)}`);
        if (!Array.isArray(msgs)) return;
        const box = $('glv-messages');
        if (!box) return;
        // Detectar si el usuario está al final del scroll antes de reemplazar el contenido
        const wasBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 50;
        box.innerHTML = '';
        msgs.forEach(m => box.appendChild(renderBubble(m)));
        // Hacer scroll solo si el usuario estaba al final o es la primera carga
        if (wasBottom || scroll) box.scrollTop = box.scrollHeight;
    }

    /**
     * Envía el mensaje escrito en el input al interlocutor activo.
     * Limpia el input y recarga los mensajes inmediatamente.
     */
    async function sendMessage() {
        const input = $('glv-input');
        const text = (input ? input.value : '').trim();
        if (!text || !activeContact) return;
        if (input) input.value = '';
        await apiFetch('/api/chat/mensajes', { method: 'POST', body: { de: me(), para: activeContact.email, texto: text } });
        fetchMessages(true);
    }

    // ─── POLLING DE MENSAJES ─────────────────────────────────────────────────

    /** Inicia el polling de mensajes cada 15 segundos. Detiene el anterior si existía. */
    function startPolling() { stopPolling(); pollId = setInterval(() => fetchMessages(false), 15000); }

    /** Detiene el polling activo y libera el intervalo. */
    function stopPolling() { if (pollId) { clearInterval(pollId); pollId = null; } }

    // ─── BADGE DE MENSAJES NO LEÍDOS ─────────────────────────────────────────

    /**
     * Actualiza el badge del botón flotante de chat con el total de no leídos.
     * Limita la visualización a "9+" para no desbordar el espacio del icono.
     */
    async function updateBadge() {
        const data = await apiFetch(`/api/chat/no-leidos?email=${encodeURIComponent(me())}`);
        const badge = $('glv-chat-badge');
        if (!badge || !data) return;
        if (data.count > 0) { badge.textContent = data.count > 9 ? '9+' : data.count; badge.style.display = 'flex'; }
        else badge.style.display = 'none';
    }

    // ─── UTILIDADES ──────────────────────────────────────────────────────────

    /** Trunca un string a n caracteres añadiendo '…' al final. */
    function truncate(str, n) { return str && str.length > n ? str.slice(0, n) + '…' : str || ''; }

    /**
     * Formatea una fecha ISO como hora (si es hoy) o como día/mes (si es otro día).
     */
    function formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        // Si es el mismo día mostrar HH:MM, si no mostrar d/M
        if (sameDay) return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        return d.getDate() + '/' + (d.getMonth() + 1);
    }

    // ─── INICIALIZACIÓN ──────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = $('chat-toggle-btn');
        const chatBox = $('chat-box');

        // Botón flotante → abrir/cerrar el widget de chat
        if (toggleBtn && chatBox) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = !chatBox.classList.contains('hidden');
                if (isOpen) { chatBox.classList.add('hidden'); stopPolling(); }
                else { chatBox.classList.remove('hidden'); showPanel('glv-home-panel'); loadConversations(); }
            });
        }

        // ── Botones del panel home ───────────────────────────────────────────
        const closeBtn = $('chat-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => { if (chatBox) chatBox.classList.add('hidden'); stopPolling(); });

        // Botón "+" → abrir panel de búsqueda para iniciar nueva conversación
        const newChatBtn = $('glv-new-chat-btn');
        if (newChatBtn) newChatBtn.addEventListener('click', () => {
            showPanel('glv-search-panel');
            const si = $('glv-search-input');
            if (si) { si.value = ''; si.focus(); doSearch(''); } // Búsqueda vacía muestra todos los contactos
        });

        // ── Panel de búsqueda ────────────────────────────────────────────────
        const searchBack = $('glv-search-back');
        if (searchBack) searchBack.addEventListener('click', () => showPanel('glv-home-panel'));
        const searchClose = $('glv-search-close');
        if (searchClose) searchClose.addEventListener('click', () => { if (chatBox) chatBox.classList.add('hidden'); });
        const searchInput = $('glv-search-input');
        // Debounce de 300 ms para no lanzar búsquedas con cada pulsación de tecla
        if (searchInput) searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => doSearch(searchInput.value.trim()), 300);
        });

        // ── Panel de conversación ────────────────────────────────────────────
        const backBtn = $('glv-back-btn');
        if (backBtn) backBtn.addEventListener('click', closeConversation);
        const convClose = $('glv-conv-close-btn');
        if (convClose) convClose.addEventListener('click', () => { if (chatBox) chatBox.classList.add('hidden'); closeConversation(); });
        const sendBtn = $('glv-send-btn');
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);
        // Enviar con Enter (sin necesidad de hacer clic en el botón)
        const inputEl = $('glv-input');
        if (inputEl) inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

        // Iniciar polling del badge cada 2 minutos si hay sesión activa
        if (me()) { updateBadge(); setInterval(updateBadge, 120000); }
    });
})();
