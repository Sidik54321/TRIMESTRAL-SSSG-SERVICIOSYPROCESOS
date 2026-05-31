/**
 * toasts.js — Motor de notificaciones emergentes de GloveUp.
 *
 * Proporciona la función global window.showToast() para mostrar mensajes
 * de retroalimentación no intrusivos en la esquina de la pantalla.
 *
 * Características:
 *  - Crea el contenedor .toast-container automáticamente si no existe en el DOM.
 *  - Soporta cuatro tipos de notificación con icono diferenciado:
 *      · success  → icono de check (operación completada)
 *      · error    → icono de exclamación (problema crítico)
 *      · warning  → icono de triángulo (advertencia)
 *      · info     → icono de info (información neutral)
 *  - Cierre automático configurable mediante el parámetro duration.
 *  - Cierre manual pulsando el botón ×.
 *  - Sobreescribe window.alert() nativo para que todos los alert() existentes
 *    en el código muestren toasts en vez de diálogos bloqueantes del navegador.
 *
 * Dependencias: Font Awesome (icono fa-*) y assets/css/toasts.css.
 */
(function() {
    'use strict';

    /**
     * Obtiene (o crea) el contenedor de toasts en el <body>.
     * El contenedor se posiciona fijo mediante CSS y acumula múltiples toasts.
     *
     * @returns {HTMLElement} El elemento .toast-container existente o recién creado.
     */
    function initContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    // Mapa de tipo de notificación → clase de icono de Font Awesome
    const ICONS = {
        success: 'fa-check-circle',
        error:   'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info:    'fa-info-circle'
    };

    /**
     * Muestra un mensaje emergente (toast) en la página.
     *
     * @param {string} msg        - Texto del mensaje a mostrar.
     * @param {string} [type='info'] - Tipo de notificación: 'success'|'error'|'warning'|'info'.
     *                                Determina el color y el icono del toast.
     * @param {number} [duration=4000] - Milisegundos antes de que el toast desaparezca
     *                                   automáticamente. 0 = no desaparece solo.
     */
    window.showToast = function(msg, type = 'info', duration = 4000) {
        const container = initContainer();
        const toast = document.createElement('div');
        // La clase CSS del tipo controla el color de fondo y borde del toast
        toast.className = `toast ${type}`;

        // Usar el icono correspondiente al tipo, o 'info' como fallback
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

        // Función de eliminación con animación de salida (CSS keyframe toast-out)
        const closeBtn = toast.querySelector('.toast-close');
        const removeToast = () => {
            toast.style.animation = 'toast-out 0.3s ease forwards';
            // Esperar a que termine la animación antes de retirar el elemento del DOM
            setTimeout(() => toast.remove(), 300);
        };

        // Cierre manual: botón ×
        closeBtn.onclick = removeToast;
        // Cierre automático: después de `duration` ms (si es mayor que 0)
        if (duration > 0) setTimeout(removeToast, duration);
    };

    /**
     * Sobreescribe window.alert() nativo para mostrar toasts en su lugar.
     *
     * Detecta automáticamente si el mensaje parece un error (por palabras clave)
     * y usa el tipo 'error' para resaltarlo en rojo; de lo contrario, 'success'.
     * Esto permite que código legacy que use alert() se beneficie del sistema
     * de toasts sin requerir cambios en el código existente.
     *
     * @param {string} msg - Mensaje original del alert().
     */
    window.alert = function(msg) {
        const isError = /error|falló|incorrecto|inválido|no existe|faltan|completar|mal/i.test(msg);
        window.showToast(msg, isError ? 'error' : 'success');
    };
})();
