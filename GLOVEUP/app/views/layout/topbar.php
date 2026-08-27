<?php

declare(strict_types=1);

use GloveUp\View;

/**
 * topbar.php — Barra superior de la aplicación.
 *
 * Igual que el sidebar, se renderiza una sola vez y persiste entre
 * navegaciones. El nombre y el avatar los rellena app.js con los datos de
 * la sesión; hasta entonces se muestran esqueletos de carga.
 *
 * @var string      $heading Título de la sección actual
 * @var string|null $nav     Elemento activo del menú, para marcar el avatar
 */
?>
<header class="z-30 flex h-16 shrink-0 items-center gap-4 border-b border-hairline
               bg-surface px-4 shadow-xs sm:px-6
               dark:border-white/10 dark:bg-night-soft">

    <!-- Abre el menú en pantallas pequeñas -->
    <button type="button" id="sidebar-open"
            class="grid h-10 w-10 place-items-center rounded-xl text-muted
                   transition-colors hover:bg-sunken lg:hidden
                   dark:text-white/70 dark:hover:bg-white/10"
            aria-label="Abrir menú">
        <i class="fas fa-bars" aria-hidden="true"></i>
    </button>

    <!-- Título de la sección actual: lo actualiza el router -->
    <h1 id="topbar-title" class="truncate text-lg font-bold sm:text-xl"><?= View::e($heading) ?></h1>

    <div class="ml-auto flex items-center gap-2">
        <a href="/legacy/home/dashboard.html#notificaciones"
           class="relative grid h-10 w-10 place-items-center rounded-xl text-muted
                  transition-colors hover:bg-sunken
                  dark:text-white/70 dark:hover:bg-white/10"
           aria-label="Notificaciones">
            <i class="fas fa-bell" aria-hidden="true"></i>
            <span id="notif-dot" hidden
                  class="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent
                         ring-2 ring-surface dark:ring-night-soft"></span>
        </a>

        <a href="/perfil" data-nav="perfil" <?= $nav === 'perfil' ? 'aria-current="page"' : '' ?>
           class="flex items-center gap-3 rounded-full py-1 pl-1 pr-3
                  transition-colors hover:bg-sunken dark:hover:bg-white/10">
            <img id="topbar-avatar" src="/assets/images/unnamed-removebg-preview.png" alt=""
                 class="h-8 w-8 rounded-full bg-sunken object-cover">
            <span id="topbar-user"
                  class="skeleton hidden h-4 w-24 text-sm font-semibold sm:block"></span>
        </a>
    </div>
</header>
