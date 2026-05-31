/**
 * sidebar.js — Gestión del menú lateral colapsable.
 * Crea dinámicamente el botón de alternar, persiste el estado en localStorage
 * y dispara un evento 'resize' para que componentes como FullCalendar o
 * Leaflet recalculen su tamaño tras la transición CSS.
 */

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.main-sidebar');
    const body = document.body;
    if (!sidebar) return;

    // ─── CREACIÓN DEL BOTÓN DE ALTERNAR ─────────────────────────────────────

    // Crear el botón de hamburguesa e insertarlo dentro del sidebar
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'sidebar-toggle';
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.title = 'Alternar menú';
    sidebar.appendChild(toggleBtn);

    // ─── ESTADO INICIAL DESDE LOCALSTORAGE ──────────────────────────────────

    // Restaurar el estado colapsado/expandido de la sesión anterior
    const isCollapsed = localStorage.getItem('gloveup_sidebar_collapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        body.classList.add('sidebar-collapsed');
    }

    // ─── EVENTO DE CLIC PARA ALTERNAR ───────────────────────────────────────

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        body.classList.toggle('sidebar-collapsed');
        // Guardar el nuevo estado para que persista en próximas visitas
        const nowCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('gloveup_sidebar_collapsed', nowCollapsed);

        // Disparar resize después de la transición CSS para que componentes
        // visuales como FullCalendar o Leaflet recalculen sus dimensiones
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300);
    });
});
