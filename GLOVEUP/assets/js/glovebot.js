/**
 * GloveBot — Chat Widget for GloveUp
 * Floating AI assistant that appears on all pages.
 */
(function () {
    'use strict';

    // Prevent double-initialization
    if (window.__glovebotLoaded) return;
    window.__glovebotLoaded = true;

    // API base URL (same logic as the rest of the app)
    const _h = window.location.hostname;
    const _apiHost = (_h === '127.0.0.1' || _h === 'localhost' || _h === '') ? 'localhost' : _h;
    const API_BASE = (window.localStorage.getItem('gloveup_api_base_url') || (window.location.protocol === 'file:' || window.location.port !== '8080' ? `http://${_apiHost}:3000` : '')).replace(/\/+$/, '');

    const SESSION_KEY = 'glovebot_messages';
    const userRole = (localStorage.getItem('gloveup_user_role') || 'boxeador').toLowerCase();

    // ---- Inject HTML ----
    function injectWidget() {
        // Bubble button
        const bubble = document.createElement('button');
        bubble.className = 'glovebot-bubble';
        bubble.id = 'glovebot-bubble';
        bubble.setAttribute('aria-label', 'Abrir asistente GloveBot');
        bubble.innerHTML = '🥊';
        document.body.appendChild(bubble);

        // Panel
        const panel = document.createElement('div');
        panel.className = 'glovebot-panel';
        panel.id = 'glovebot-panel';
        panel.innerHTML = `
            <div class="glovebot-header">
                <div class="glovebot-header-avatar">🥊</div>
                <div class="glovebot-header-info">
                    <div class="glovebot-header-name">GloveBot</div>
                    <div class="glovebot-header-status">En línea</div>
                </div>
                <button class="glovebot-close" id="glovebot-close" aria-label="Cerrar chat">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="glovebot-messages" id="glovebot-messages">
                <div class="glovebot-welcome">Asistente IA de GloveUp</div>
            </div>
            <div class="glovebot-input-area">
                <input type="text" class="glovebot-input" id="glovebot-input" placeholder="Escribe un mensaje..." autocomplete="off">
                <button class="glovebot-send" id="glovebot-send" aria-label="Enviar mensaje">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;
        document.body.appendChild(panel);
    }

    // ---- State ----
    let messages = []; // { role: 'user'|'assistant', content: string }
    let isOpen = false;
    let isSending = false;

    function loadMessages() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) messages = parsed;
            }
        } catch { /* ignore */ }
    }

    function saveMessages() {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-40)));
        } catch { /* ignore */ }
    }

    // ---- Rendering ----
    function renderMessages() {
        const container = document.getElementById('glovebot-messages');
        if (!container) return;

        // Keep the welcome message
        let html = '<div class="glovebot-welcome">Asistente IA de GloveUp</div>';

        if (messages.length === 0) {
            html += `<div class="glovebot-msg bot">¡Hola! 🥊 Soy <strong>GloveBot</strong>, tu asistente de GloveUp. ¿En qué puedo ayudarte hoy?</div>`;
        }

        messages.forEach(m => {
            const cls = m.role === 'user' ? 'user' : 'bot';
            const escaped = escapeHtml(m.content);
            // Allow basic formatting (bold)
            const formatted = escaped
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            html += `<div class="glovebot-msg ${cls}">${formatted}</div>`;
        });

        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    function showTyping() {
        const container = document.getElementById('glovebot-messages');
        if (!container) return;
        const typing = document.createElement('div');
        typing.className = 'glovebot-typing';
        typing.id = 'glovebot-typing';
        typing.innerHTML = '<span></span><span></span><span></span>';
        container.appendChild(typing);
        container.scrollTop = container.scrollHeight;
    }

    function hideTyping() {
        const el = document.getElementById('glovebot-typing');
        if (el) el.remove();
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- API ----
    async function sendMessage(text) {
        if (!text.trim() || isSending) return;

        isSending = true;
        const input = document.getElementById('glovebot-input');
        const sendBtn = document.getElementById('glovebot-send');
        if (input) input.disabled = true;
        if (sendBtn) sendBtn.disabled = true;

        // Add user message
        messages.push({ role: 'user', content: text.trim() });
        saveMessages();
        renderMessages();

        showTyping();

        try {
            const res = await fetch(`${API_BASE}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages,
                    userRole: userRole
                })
            });

            const data = await res.json().catch(() => ({}));

            hideTyping();

            if (res.ok && data.reply) {
                messages.push({ role: 'assistant', content: data.reply });
            } else {
                const errMsg = data.error || 'Error al conectar con el servidor. Inténtalo más tarde.';
                messages.push({ role: 'assistant', content: `⚠️ ${errMsg}` });
            }
        } catch (err) {
            hideTyping();
            messages.push({ role: 'assistant', content: '⚠️ No se pudo conectar con el servidor. Verifica tu conexión.' });
        }

        saveMessages();
        renderMessages();

        isSending = false;
        if (input) { input.disabled = false; input.focus(); }
        if (sendBtn) sendBtn.disabled = false;
    }

    // ---- Toggle ----
    function togglePanel() {
        const panel = document.getElementById('glovebot-panel');
        const bubble = document.getElementById('glovebot-bubble');
        if (!panel || !bubble) return;

        isOpen = !isOpen;

        if (isOpen) {
            panel.classList.add('visible');
            bubble.classList.add('open');
            bubble.innerHTML = '✕';
            const input = document.getElementById('glovebot-input');
            if (input) setTimeout(() => input.focus(), 100);
        } else {
            panel.classList.remove('visible');
            bubble.classList.remove('open');
            bubble.innerHTML = '🥊';
        }
    }

    // ---- Init ----
    function init() {
        injectWidget();
        loadMessages();
        renderMessages();

        // Events
        const bubble = document.getElementById('glovebot-bubble');
        const closeBtn = document.getElementById('glovebot-close');
        const input = document.getElementById('glovebot-input');
        const sendBtn = document.getElementById('glovebot-send');

        if (bubble) bubble.addEventListener('click', togglePanel);
        if (closeBtn) closeBtn.addEventListener('click', togglePanel);

        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const text = input.value;
                    input.value = '';
                    sendMessage(text);
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                if (!input) return;
                const text = input.value;
                input.value = '';
                sendMessage(text);
            });
        }
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
