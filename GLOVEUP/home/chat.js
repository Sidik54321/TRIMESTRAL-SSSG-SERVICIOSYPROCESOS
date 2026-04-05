/* ============================================== */
/* CHAT EN TIEMPO REAL — GLOVEUP                  */
/* ============================================== */

(function () {
    'use strict';

    const API = (window.localStorage.getItem('gloveup_api_base_url') || 'http://localhost:3000').replace(/\/+$/, '');
    const userEmail = () => (localStorage.getItem('gloveup_user_email') || '').trim().toLowerCase();

    let currentContact = null;
    let pollInterval = null;

    const $ = (id) => document.getElementById(id);

    const apiFetch = (path, opts = {}) => fetch(API + path, {
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    }).then(r => r.json()).catch(() => null);

    function renderContact(c) {
        const li = document.createElement('li');
        const role = c.rol === 'entrenador' ? ' <small style="opacity:.55">(Entrenador)</small>' : '';
        li.innerHTML = `<i class="fas fa-user-circle"></i> <span>${c.nombre || c.email}</span>${role}`;
        li.style.cursor = 'pointer';
        li.dataset.email = c.email;
        li.addEventListener('click', () => openConversation(c));
        return li;
    }

    function renderMessage(msg) {
        const mine = msg.de === userEmail();
        const div = document.createElement('div');
        div.className = 'glv-bubble ' + (mine ? 'glv-mine' : 'glv-theirs');
        const text = document.createElement('span');
        text.className = 'glv-bubble-text';
        text.textContent = msg.texto;
        const time = document.createElement('span');
        time.className = 'glv-bubble-time';
        const d = new Date(msg.createdAt || Date.now());
        time.textContent = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        div.appendChild(text);
        div.appendChild(time);
        return div;
    }

    async function loadMessages(scroll) {
        if (!currentContact) return;
        const msgs = await apiFetch(`/api/chat/mensajes?email=${encodeURIComponent(userEmail())}&con=${encodeURIComponent(currentContact.email)}`);
        if (!Array.isArray(msgs)) return;
        const container = $('glv-messages');
        if (!container) return;
        const wasBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
        container.innerHTML = '';
        msgs.forEach(m => container.appendChild(renderMessage(m)));
        if (wasBottom || scroll) container.scrollTop = container.scrollHeight;
    }

    function openConversation(contact) {
        currentContact = contact;
        const nameEl = $('glv-conv-name');
        if (nameEl) nameEl.textContent = contact.nombre || contact.email;
        const contactsPanel = $('glv-contacts-panel');
        const convPanel = $('glv-conv-panel');
        if (contactsPanel) contactsPanel.classList.add('hidden');
        if (convPanel) convPanel.classList.remove('hidden');
        loadMessages(true);
        startPolling();
    }

    function closeConversation() {
        stopPolling();
        currentContact = null;
        const contactsPanel = $('glv-contacts-panel');
        const convPanel = $('glv-conv-panel');
        if (convPanel) convPanel.classList.add('hidden');
        if (contactsPanel) contactsPanel.classList.remove('hidden');
    }

    function startPolling() {
        stopPolling();
        pollInterval = setInterval(() => loadMessages(false), 3000);
    }

    function stopPolling() {
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }

    async function sendMessage() {
        const input = $('glv-input');
        const texto = (input ? input.value : '').trim();
        if (!texto || !currentContact) return;
        if (input) input.value = '';
        await apiFetch('/api/chat/mensajes', {
            method: 'POST',
            body: { de: userEmail(), para: currentContact.email, texto }
        });
        await loadMessages(true);
    }

    async function updateBadge() {
        const email = userEmail();
        if (!email) return;
        const data = await apiFetch(`/api/chat/no-leidos?email=${encodeURIComponent(email)}`);
        const badge = $('glv-chat-badge');
        if (!badge || !data) return;
        if (data.count > 0) {
            badge.textContent = data.count > 9 ? '9+' : String(data.count);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    async function initContacts() {
        const email = userEmail();
        if (!email) return;
        const list = $('glv-contact-list');
        if (!list) return;
        list.innerHTML = '<li style="opacity:.5;padding:12px 20px">Cargando contactos…</li>';
        const contacts = await apiFetch(`/api/chat/contactos?email=${encodeURIComponent(email)}`);
        list.innerHTML = '';
        if (!Array.isArray(contacts) || contacts.length === 0) {
            list.innerHTML = '<li style="opacity:.5;padding:12px 20px">Sin contactos disponibles aún.</li>';
            return;
        }
        contacts.forEach(c => list.appendChild(renderContact(c)));
        updateBadge();
    }

    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = $('chat-toggle-btn');
        const chatBox = $('chat-box');

        if (toggleBtn && chatBox) {
            toggleBtn.addEventListener('click', () => {
                const open = !chatBox.classList.contains('hidden');
                if (open) {
                    chatBox.classList.add('hidden');
                    stopPolling();
                } else {
                    chatBox.classList.remove('hidden');
                    initContacts();
                }
            });
        }

        const closeBtn = $('chat-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            if (chatBox) chatBox.classList.add('hidden');
            stopPolling();
        });

        const backBtn = $('glv-back-btn');
        if (backBtn) backBtn.addEventListener('click', closeConversation);

        const convCloseBtn = $('glv-conv-close-btn');
        if (convCloseBtn) convCloseBtn.addEventListener('click', () => {
            if (chatBox) chatBox.classList.add('hidden');
            closeConversation();
        });

        const sendBtn = $('glv-send-btn');
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);

        const inputEl = $('glv-input');
        if (inputEl) inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

        // Badge de no leídos cada 30s
        if (userEmail()) {
            updateBadge();
            setInterval(updateBadge, 30000);
        }
    });
})();
