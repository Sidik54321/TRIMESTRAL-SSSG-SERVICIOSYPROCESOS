/* chat.js — Sistema de chat GloveUp con historial de conversaciones */
(function () {
    'use strict';

    const API = (localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${window.location.hostname}:3000` : '')).replace(/\/+$/, '');
    const me = () => (localStorage.getItem('gloveup_user_email') || '').trim().toLowerCase();

    let activeContact = null;
    let pollId = null;

    const $ = id => document.getElementById(id);
    const apiFetch = (path, opts = {}) =>
        fetch(API + path, {
            method: opts.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
        }).then(r => r.json()).catch(() => null);

    /* ── Panels ───────────────────────────────────── */
    function showPanel(id) {
        ['glv-home-panel', 'glv-search-panel', 'glv-conv-panel'].forEach(p => {
            const el = $(p);
            if (el) el.classList.toggle('hidden', p !== id);
        });
    }

    /* ── Conversation List ────────────────────────── */
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

    /* ── Search ───────────────────────────────────── */
    let searchTimeout = null;
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

    /* ── Conversation ─────────────────────────────── */
    function openConversation(contact) {
        activeContact = contact;
        const nameEl = $('glv-conv-name');
        if (nameEl) nameEl.textContent = contact.nombre || contact.email;
        showPanel('glv-conv-panel');
        fetchMessages(true);
        startPolling();
    }

    function closeConversation() {
        stopPolling();
        activeContact = null;
        showPanel('glv-home-panel');
        loadConversations();
    }

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

    async function fetchMessages(scroll) {
        if (!activeContact) return;
        const msgs = await apiFetch(`/api/chat/mensajes?email=${encodeURIComponent(me())}&con=${encodeURIComponent(activeContact.email)}`);
        if (!Array.isArray(msgs)) return;
        const box = $('glv-messages');
        if (!box) return;
        const wasBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 50;
        box.innerHTML = '';
        msgs.forEach(m => box.appendChild(renderBubble(m)));
        if (wasBottom || scroll) box.scrollTop = box.scrollHeight;
    }

    async function sendMessage() {
        const input = $('glv-input');
        const text = (input ? input.value : '').trim();
        if (!text || !activeContact) return;
        if (input) input.value = '';
        await apiFetch('/api/chat/mensajes', { method: 'POST', body: { de: me(), para: activeContact.email, texto: text } });
        fetchMessages(true);
    }

    function startPolling() { stopPolling(); pollId = setInterval(() => fetchMessages(false), 15000); }
    function stopPolling() { if (pollId) { clearInterval(pollId); pollId = null; } }

    /* ── Badge ────────────────────────────────────── */
    async function updateBadge() {
        const data = await apiFetch(`/api/chat/no-leidos?email=${encodeURIComponent(me())}`);
        const badge = $('glv-chat-badge');
        if (!badge || !data) return;
        if (data.count > 0) { badge.textContent = data.count > 9 ? '9+' : data.count; badge.style.display = 'flex'; }
        else badge.style.display = 'none';
    }

    /* ── Utils ────────────────────────────────────── */
    function truncate(str, n) { return str && str.length > n ? str.slice(0, n) + '…' : str || ''; }
    function formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        if (sameDay) return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        return d.getDate() + '/' + (d.getMonth() + 1);
    }

    /* ── Init ─────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = $('chat-toggle-btn');
        const chatBox = $('chat-box');

        if (toggleBtn && chatBox) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = !chatBox.classList.contains('hidden');
                if (isOpen) { chatBox.classList.add('hidden'); stopPolling(); }
                else { chatBox.classList.remove('hidden'); showPanel('glv-home-panel'); loadConversations(); }
            });
        }

        // Home panel buttons
        const closeBtn = $('chat-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => { if (chatBox) chatBox.classList.add('hidden'); stopPolling(); });

        const newChatBtn = $('glv-new-chat-btn');
        if (newChatBtn) newChatBtn.addEventListener('click', () => {
            showPanel('glv-search-panel');
            const si = $('glv-search-input');
            if (si) { si.value = ''; si.focus(); doSearch(''); }
        });

        // Search panel
        const searchBack = $('glv-search-back');
        if (searchBack) searchBack.addEventListener('click', () => showPanel('glv-home-panel'));
        const searchClose = $('glv-search-close');
        if (searchClose) searchClose.addEventListener('click', () => { if (chatBox) chatBox.classList.add('hidden'); });
        const searchInput = $('glv-search-input');
        if (searchInput) searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => doSearch(searchInput.value.trim()), 300);
        });

        // Conv panel
        const backBtn = $('glv-back-btn');
        if (backBtn) backBtn.addEventListener('click', closeConversation);
        const convClose = $('glv-conv-close-btn');
        if (convClose) convClose.addEventListener('click', () => { if (chatBox) chatBox.classList.add('hidden'); closeConversation(); });
        const sendBtn = $('glv-send-btn');
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);
        const inputEl = $('glv-input');
        if (inputEl) inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

        // Badge
        if (me()) { updateBadge(); setInterval(updateBadge, 120000); }
    });
})();
