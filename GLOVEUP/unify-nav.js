const fs = require('fs');

const files = [
    { path: 'dashboard/boxeador/dashboard.html', depth: '../../', active: 'inicio' },
    { path: 'dashboard/entrenador/dashboard.html', depth: '../../', active: 'inicio' },
    { path: 'gyms/index.html', depth: '../', active: 'gimnasios' },
    { path: 'sparring/index.html', depth: '../', active: 'sparring' },
    { path: 'profile/index.html', depth: '../', active: 'perfil' } // mis sparrings is a tab of profile
];

for (const file of files) {
    if (!fs.existsSync(file.path)) continue;
    let content = fs.readFileSync(file.path, 'utf8');
    
    // We construct the unified nav exactly for this file
    const navHtml =         <nav class="sidebar-nav">
            <ul>
                <li id="nav-item-inicio" \>
                    <a id="nav-home-link" href="\home/dashboard.html">
                        <i class="fas fa-home"></i>
                        <span>Inicio</span>
                    </a>
                </li>
                <li id="nav-item-sparring" \>
                    <a href="\sparring/index.html">
                        <i class="fas fa-fist-raised"></i>
                        <span>Buscar Sparring</span>
                    </a>
                </li>
                <li id="nav-item-gimnasios" \>
                    <a href="\gyms/index.html">
                        <i class="fas fa-building"></i>
                        <span>Gimnasios</span>
                    </a>
                </li>
                <li id="nav-profile-item" \>
                    <a href="\profile/index.html">
                        <i class="fas fa-user"></i>
                        <span>Mi Perfil</span>
                    </a>
                </li>
                <li id="nav-sparrings-item">
                    <a href="\profile/index.html?tab=sparrings">
                        <i class="fas fa-clipboard-list"></i>
                        <span>Mis Sparrings</span>
                    </a>
                </li>
                <li id="coach-nav-item" style="display: none;">
                    <a href="\dashboard/entrenador/dashboard.html#coach-management">
                        <i class="fas fa-users-cog"></i>
                        <span>Gestión</span>
                    </a>
                </li>
                <li id="coach-gym-nav-item" style="display: none;">
                    <a href="\dashboard/entrenador/dashboard.html#coach-gym">
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
        </nav>;

    // Replace the existing <nav class="sidebar-nav">...</nav>
    const navRegex = /<nav class="sidebar-nav">[\s\S]*?<\/nav>/;
    content = content.replace(navRegex, navHtml);
    
    // Replace the DOMContentLoaded script where they hide/show
    // Actually it's better to just inject a small inline script immediately after </nav> that enforces the visibility, 
    // and let the existing variables throw no errors if I handle them carefully.
    
    fs.writeFileSync(file.path, content);
    console.log('Updated ' + file.path);
}
