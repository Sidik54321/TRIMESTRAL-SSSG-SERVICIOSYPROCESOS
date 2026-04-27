/**
 * toasts.js — Motor de notificaciones GloveUp
 */
(function() {
    'use strict';

    function initContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    const ICONS = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    window.showToast = function(msg, type = 'info', duration = 4000) {
        const container = initContainer();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconClass = ICONS[type] || ICONS.info;
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${msg}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        const closeBtn = toast.querySelector('.toast-close');
        const removeToast = () => {
            toast.style.animation = 'toast-out 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        };

        closeBtn.onclick = removeToast;
        if (duration > 0) setTimeout(removeToast, duration);
    };

    // Sobrescribir alert nativo
    window.alert = function(msg) {
        const isError = /error|falló|incorrecto|inválido|no existe|faltan|completar|mal/i.test(msg);
        window.showToast(msg, isError ? 'error' : 'success');
    };
})();
