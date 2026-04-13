const fs = require('fs');
const path = require('path');

const files = [
    { path: 'dashboard/boxeador/dashboard.html', depth: '../../', active: 'inicio' },
    { path: 'dashboard/entrenador/dashboard.html', depth: '../../', active: 'inicio' },
    { path: 'gyms/index.html', depth: '../', active: 'gimnasios' },
    { path: 'sparring/index.html', depth: '../', active: 'sparring' },
    { path: 'profile/index.html', depth: '../', active: 'perfil' }
];

for (const f of files) {
    if (!fs.existsSync(f.path)) {
        console.log(`Skipping ${f.path}`);
        continue;
    }

    let content = fs.readFileSync(f.path, 'utf8');

    const navReplacement = `        <nav class="sidebar-nav">
            <ul>
                <li id="nav-item-inicio" ${f.active === 'inicio' ? 'class="active"' : ''}>
                    <a id="nav-home-link" href="${f.depth}home/dashboard.html">
                        <i class="fas fa-home"></i>
                        <span>Inicio</span>
                    </a>
                </li>
                <li id="nav-item-sparring" ${f.active === 'sparring' ? 'class="active"' : ''}>
                    <a href="${f.depth}sparring/index.html">
                        <i class="fas fa-fist-raised"></i>
                        <span>Buscar Sparring</span>
                    </a>
                </li>
                <li ${f.active === 'gimnasios' ? 'class="active"' : ''}>
                    <a href="${f.depth}gyms/index.html">
                        <i class="fas fa-building"></i>
                        <span>Gimnasios</span>
                    </a>
                </li>
                <li id="nav-profile-item" ${f.active === 'perfil' && !content.includes('tab=sparrings') && content.includes('<li id="nav-profile-item" class="active">') ? 'class="active"' : ''}>
                    <a href="${f.depth}profile/index.html">
                        <i class="fas fa-user"></i>
                        <span>Mi Perfil</span>
                    </a>
                </li>
                <li id="nav-sparrings-item" ${f.active === 'perfil' && content.includes('tab=sparrings') && content.includes('<li id="nav-sparrings-item" class="active">') ? 'class="active"' : ''}>
                    <a href="${f.depth}profile/index.html?tab=sparrings">
                        <i class="fas fa-clipboard-list"></i>
                        <span>Mis Sparrings</span>
                    </a>
                </li>
                <li id="coach-nav-item" style="display: none;">
                    <a href="${f.depth}dashboard/entrenador/dashboard.html#coach-management">
                        <i class="fas fa-users-cog"></i>
                        <span>Gestión</span>
                    </a>
                </li>
                <li id="coach-gym-nav-item" style="display: none;">
                    <a href="${f.depth}dashboard/entrenador/dashboard.html#coach-gym">
                        <i class="fas fa-building"></i>
                        <span>Mi Gimnasio</span>
                    </a>
                </li>
                <li>
                    <a href="#">
                        <i class="fas fa-envelope"></i>
                        <span>Mensajes</span>
                    </a>
                </li>
            </ul>
        </nav>`;

    // Replace the exact <nav> tag
    const navMatch = content.match(/<nav class="sidebar-nav">([\s\S]*?)<\/nav>/);
    if (navMatch) {
       content = content.replace(navMatch[0], navReplacement);
    } else {
       console.log(`Could not find <nav class="sidebar-nav"> in ${f.path}`);
    }

    const scriptAppend = `
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const role = (localStorage.getItem('gloveup_user_role') || 'usuario').toLowerCase();
            const coachNavItem = document.getElementById('coach-nav-item');
            const coachGymNavItem = document.getElementById('coach-gym-nav-item');
            const sparringsNavItem = document.getElementById('nav-sparrings-item');
            const buscarSparringNavItem = document.getElementById('nav-item-sparring');
            const homeLink = document.getElementById('nav-home-link');
            
            if (homeLink) {
                homeLink.href = role === 'entrenador' ? '${f.depth}dashboard/entrenador/dashboard.html' : '${f.depth}dashboard/boxeador/dashboard.html';
            }
            if (coachNavItem) coachNavItem.style.display = role === 'entrenador' ? '' : 'none';
            if (coachGymNavItem) coachGymNavItem.style.display = role === 'entrenador' ? '' : 'none';
            if (sparringsNavItem) sparringsNavItem.style.display = role === 'entrenador' ? 'none' : '';
            if (buscarSparringNavItem) buscarSparringNavItem.style.display = role === 'entrenador' ? 'none' : '';
        });
    </script>
</aside>`;

    if (!content.includes('const buscarSparringNavItem')) {
        content = content.replace(/<\/aside>/, scriptAppend);
    }

    fs.writeFileSync(f.path, content);
    console.log(`Successfully updated ${f.path}`);
}
