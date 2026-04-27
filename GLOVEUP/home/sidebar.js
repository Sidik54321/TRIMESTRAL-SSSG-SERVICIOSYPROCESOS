document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.main-sidebar');
    const body = document.body;
    if (!sidebar) return;

    // Create Toggle Button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'sidebar-toggle';
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.title = 'Alternar menú';
    sidebar.appendChild(toggleBtn);

    // Initial state from localStorage
    const isCollapsed = localStorage.getItem('gloveup_sidebar_collapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        body.classList.add('sidebar-collapsed');
    }

    // Toggle event
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        body.classList.toggle('sidebar-collapsed');
        const nowCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('gloveup_sidebar_collapsed', nowCollapsed);
        
        // Trigger window resize for complex components like FullCalendar or Leaflet
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300);
    });
});
