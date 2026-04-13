const fs = require('fs');

const files = [
    { path: 'dashboard/boxeador/dashboard.html', depth: '../../', active: 'inicio' },
    { path: 'dashboard/entrenador/dashboard.html', depth: '../../', active: 'inicio' },
    { path: 'gyms/index.html', depth: '../', active: 'gimnasios' },
    { path: 'sparring/index.html', depth: '../', active: 'sparring' },
    { path: 'profile/index.html', depth: '../', active: 'perfil' }
];

for (const file of files) {
    if (!fs.existsSync(file.path)) continue;
    let content = fs.readFileSync(file.path, 'utf8');
    
    const isProfile = file.active === 'perfil' && !content.includes('tab=sparrings') && content.includes('<li id="nav-profile-item" class="active">');
    
    // We construct the unified nav exactly for this file
    const navHtml = '        <nav class="sidebar-nav">\\n' +
        '            <ul>\\n' +
        '                <li id="nav-item-inicio" ' + (file.active === 'inicio' ? 'class="active"' : '') + '>\\n' +
        '                    <a id="nav-home-link" href="' + file.depth + 'home/dashboard.html">\\n' +
        '                        <i class="fas fa-home"></i>\\n' +
        '                        <span>Inicio</span>\\n' +
        '                    </a>\\n' +
        '                </li>\\n' +
        '                <li id="nav-item-sparring" ' + (file.active === 'sparring' ? 'class="active"' : '') + '>\\n' +
        '                    <a href="' + file.depth + 'sparring/index.html">\\n' +
        '                        <i class="fas fa-fist-raised"></i>\\n' +
        '                        <span>Buscar Sparring</span>\\n' +
        '                    </a>\\n' +
        '                </li>\\n' +
        '                <li id="nav-item-gimnasios" ' + (file.active === 'gimnasios' ? 'class="active"' : '') + '>\\n' +
        '                    <a href="' + file.depth + 'gyms/index.html">\\n' +
        '                        <i class="fas fa-building"></i>\\n' +
        '                        <span>Gimnasios</span>\\n' +
        '                    </a>\\n' +
        '                </li>\\n' +
        '                <li id="nav-profile-item" ' + (isProfile ? 'class="active"' : '') + '>\\n' +
        '                    <a href="' + file.depth + 'profile/index.html">\\n' +
        '                        <i class="fas fa-user"></i>\\n' +
        '                        <span>Mi Perfil</span>\\n' +
        '                    </a>\\n' +
        '                </li>\\n' +
        '                <li id="nav-sparrings-item">\\n' +
        '                    <a href="' + file.depth + 'profile/index.html?tab=sparrings">\\n' +
        '                        <i class="fas fa-clipboard-list"></i>\\n' +
        '                        <span>Mis Sparrings</span>\\n' +
        '                    </a>\\n' +
        '                </li>\\n' +
        '                <li id="coach-nav-item" style="display: none;">\\n' +
        '                    <a href="' + file.depth + 'dashboard/entrenador/dashboard.html#coach-management">\\n' +
        '                        <i class="fas fa-users-cog"></i>\\n' +
        '                        <span>Gestión</span>\\n' +
        '                    </a>\\n' +
        '                </li>\\n' +
        '                <li id="coach-gym-nav-item" style="display: none;">\\n' +
        '                    <a href="' + file.depth + 'dashboard/entrenador/dashboard.html#coach-gym">\\n' +
        '                        <i class="fas fa-building"></i>\\n' +
        '                        <span>Mi Gimnasio</span>\\n' +
        '                    </a>\\n' +
        '                </li>\\n' +
        '                <li>\\n' +
        '                    <a href="#">\\n' +
        '                        <i class="fas fa-envelope"></i>\\n' +
        '                        <span>Mensajes</span>\\n' +
        '                    </a>\\n' +
        '                </li>\\n' +
        '            </ul>\\n' +
        '        </nav>';

    const navRegex = /<nav class="sidebar-nav">[\\s\\S]*?<\\/nav>/;
    content = content.replace(navRegex, navHtml);
    
    // Append script to manage visibility securely across apps
    const scriptToAppend = '\\n' +
        '    <script>\\n' +
        '        document.addEventListener("DOMContentLoaded", () => {\\n' +
        '            const role = (localStorage.getItem("gloveup_user_role") || "usuario").toLowerCase();\\n' +
        '            const coachNavItem = document.getElementById("coach-nav-item");\\n' +
        '            const coachGymNavItem = document.getElementById("coach-gym-nav-item");\\n' +
        '            const sparringsNavItem = document.getElementById("nav-sparrings-item");\\n' +
        '            const buscarSparringNavItem = document.getElementById("nav-item-sparring");\\n' +
        '            const homeLink = document.getElementById("nav-home-link");\\n' +
        '            \\n' +
        '            if (homeLink) {\\n' +
        '                homeLink.href = role === "entrenador" ? "' + file.depth + 'dashboard/entrenador/dashboard.html" : "' + file.depth + 'dashboard/boxeador/dashboard.html";\\n' +
        '            }\\n' +
        '            if (coachNavItem) coachNavItem.style.display = role === "entrenador" ? "" : "none";\\n' +
        '            if (coachGymNavItem) coachGymNavItem.style.display = role === "entrenador" ? "" : "none";\\n' +
        '            \\n' +
        '            if (sparringsNavItem) sparringsNavItem.style.display = role === "entrenador" ? "none" : "";\\n' +
        '            if (buscarSparringNavItem) buscarSparringNavItem.style.display = role === "entrenador" ? "none" : "";\\n' +
        '        });\\n' +
        '    </script>\\n' +
        '</aside>';

    if (!content.includes('const buscarSparringNavItem')) {
        content = content.replace(/<\\/aside>/, scriptToAppend);
    }
    
    fs.writeFileSync(file.path, content);
    console.log('Updated ' + file.path);
}