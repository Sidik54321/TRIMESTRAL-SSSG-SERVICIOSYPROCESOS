// sidebar.js — Menú lateral colapsable: toggle, persistencia en localStorage y redispatch de resize.

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.main-sidebar');
    const body = document.body;
    if (!sidebar) return;

    // Botón creado por JS para mantener el HTML limpio
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'sidebar-toggle';
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.title = 'Alternar menú';
    toggleBtn.setAttribute('aria-label', 'Alternar menú lateral');
    sidebar.appendChild(toggleBtn);

    // Restaurar estado previo desde localStorage
    const isCollapsed = localStorage.getItem('gloveup_sidebar_collapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        body.classList.add('sidebar-collapsed');
    }

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        body.classList.toggle('sidebar-collapsed');

        const nowCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('gloveup_sidebar_collapsed', String(nowCollapsed));

        // 300 ms = duración de la transición CSS; FullCalendar y Leaflet necesitan resize para recalcularse
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    });
});
