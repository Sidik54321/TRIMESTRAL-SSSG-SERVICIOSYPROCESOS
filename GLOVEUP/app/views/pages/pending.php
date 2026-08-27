<?php

declare(strict_types=1);

use GloveUp\View;

/**
 * pending.php — Sección todavía no migrada a la SPA.
 *
 * Mantiene la aplicación utilizable durante la migración por fases: el
 * usuario navega por la SPA y, al llegar a una sección pendiente, salta a
 * la página clásica sin perder el hilo.
 *
 * @var array<string, mixed> $route
 */

$label  = (string) ($route['label'] ?? 'Esta sección');
$legacy = (string) ($route['legacy'] ?? '/legacy/home/dashboard.html');
?>
<div class="grid min-h-full place-items-center px-6 py-16">
    <div class="card max-w-md p-10 text-center">
        <span class="grid h-14 w-14 place-items-center justify-self-center
                     rounded-full bg-accent-soft text-xl text-accent">
            <i class="fas fa-screwdriver-wrench" aria-hidden="true"></i>
        </span>

        <h2 class="mt-6 text-2xl"><?= View::e($label) ?></h2>
        <p class="mt-3 text-sm text-muted dark:text-white/60">
            Esta sección aún no se ha migrado a la nueva interfaz. Sigue disponible
            en su versión clásica con toda su funcionalidad.
        </p>

        <a href="<?= View::e($legacy) ?>" data-external class="btn-primary mt-8">
            Abrir versión clásica
        </a>
    </div>
</div>
