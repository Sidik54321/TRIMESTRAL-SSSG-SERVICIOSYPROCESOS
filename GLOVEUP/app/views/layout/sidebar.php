<?php

declare(strict_types=1);

use GloveUp\View;

/**
 * sidebar.php — Menú lateral de la aplicación.
 *
 * Vive fuera de #app-view, así que se renderiza una sola vez y persiste
 * entre navegaciones. El elemento activo se marca en servidor con
 * aria-current y el router lo actualiza en cliente al navegar.
 *
 * Los elementos con "roles" sólo se muestran a esos roles; el filtrado lo
 * hace app.js leyendo gloveup_user_role, igual que hacían las páginas
 * antiguas, y se aplica antes del primer pintado.
 *
 * @var string|null $nav
 */

$items = [
    ['id' => 'primeros-pasos', 'href' => '/primeros-pasos', 'icon' => 'fa-rocket',        'label' => 'Primeros Pasos'],
    ['id' => 'inicio',         'href' => '/inicio',         'icon' => 'fa-home',          'label' => 'Inicio'],
    ['id' => 'sparring',       'href' => '/sparring',       'icon' => 'fa-fist-raised',   'label' => 'Buscar Sparring'],
    ['id' => 'gimnasios',      'href' => '/gimnasios',      'icon' => 'fa-building',      'label' => 'Gimnasios'],
    ['id' => 'mis-sparrings',  'href' => '/mis-sparrings',  'icon' => 'fa-clipboard-list','label' => 'Mis Sparrings', 'roles' => ['boxeador']],
    ['id' => 'gestion',        'href' => '/gestion',        'icon' => 'fa-users-cog',     'label' => 'Gestión',       'roles' => ['entrenador']],
    ['id' => 'retos',          'href' => '/retos',          'icon' => 'fa-fist-raised',   'label' => 'Retos',         'roles' => ['entrenador']],
    ['id' => 'mi-gimnasio',    'href' => '/mi-gimnasio',    'icon' => 'fa-building',      'label' => 'Mi Gimnasio',   'roles' => ['entrenador']],
];
?>
<!-- En escritorio es una columna más del layout; por debajo de lg pasa a
     panel deslizante y su visibilidad la controla data-open. -->
<aside id="sidebar"
       class="flex h-full w-sidebar shrink-0 flex-col bg-night text-white
              transition-all duration-300 ease-out
              max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50
              -translate-x-full data-[open=true]:translate-x-0 lg:translate-x-0"
       data-open="false">

    <!-- Cabecera -->
    <div class="flex items-center gap-3 px-5 py-6">
        <img src="/assets/images/unnamed-removebg-preview.png" alt=""
             class="h-9 w-9 shrink-0 object-contain">
        <span class="nav-label font-display text-xl font-black tracking-tight">GloveUp</span>
    </div>

    <!-- Navegación -->
    <nav class="min-h-0 flex-1 overflow-y-auto px-3" aria-label="Navegación principal">
        <ul class="space-y-1">
            <?php foreach ($items as $item): ?>
                <li <?= isset($item['roles']) ? 'data-roles="' . View::e(implode(',', $item['roles'])) . '" hidden' : '' ?>>
                    <a href="<?= View::e($item['href']) ?>"
                       class="nav-link"
                       data-nav="<?= View::e($item['id']) ?>"
                       <?= $nav === $item['id'] ? 'aria-current="page"' : '' ?>>
                        <i class="fas <?= View::e($item['icon']) ?>" aria-hidden="true"></i>
                        <span class="nav-label"><?= View::e($item['label']) ?></span>
                    </a>
                </li>
            <?php endforeach; ?>
        </ul>
    </nav>

    <!-- Manuales: abren la página antigua en una pestaña nueva -->
    <div class="nav-label space-y-2 px-3 py-4">
        <a href="/legacy/onboarding/manual-boxeador.html" target="_blank" rel="noopener"
           class="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs
                  font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <i class="fas fa-file-pdf" aria-hidden="true"></i> Manual Boxeador
        </a>
        <a href="/legacy/onboarding/manual-entrenador.html" target="_blank" rel="noopener"
           class="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs
                  font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <i class="fas fa-file-pdf" aria-hidden="true"></i> Manual Entrenador
        </a>
    </div>

    <!-- Pie -->
    <div class="space-y-1 border-t border-white/10 px-3 py-4">
        <button type="button" id="theme-toggle" class="nav-link w-full">
            <i class="fas fa-moon" aria-hidden="true"></i>
            <span class="nav-label">Tema Oscuro</span>
        </button>
        <a href="/ajustes" class="nav-link" data-nav="ajustes"
           <?= $nav === 'ajustes' ? 'aria-current="page"' : '' ?>>
            <i class="fas fa-cog" aria-hidden="true"></i>
            <span class="nav-label">Ajustes</span>
        </a>
        <button type="button" id="logout-button"
                class="nav-link w-full text-red-400 hover:bg-red-500/10 hover:text-red-300">
            <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
            <span class="nav-label">Cerrar Sesión</span>
        </button>
        <button type="button" id="sidebar-toggle"
                class="nav-link w-full max-lg:hidden" title="Alternar menú"
                aria-label="Alternar menú lateral">
            <i class="fas fa-bars" aria-hidden="true"></i>
            <span class="nav-label">Contraer</span>
        </button>
    </div>
</aside>

<!-- Fondo oscuro del menú en móvil -->
<div id="sidebar-backdrop" hidden
     class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"></div>
