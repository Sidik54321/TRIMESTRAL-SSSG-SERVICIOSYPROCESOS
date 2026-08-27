<?php

declare(strict_types=1);

use GloveUp\View;

/**
 * gym-detail.php — Ficha de un gimnasio.
 *
 * La clave del gimnasio llega en la URL (/gimnasios/{key}) y se entrega al
 * módulo de la página mediante data-gym-key; los datos se piden a
 * /api/gimnasios/lookup?key=…
 *
 * @var array<string, string> $params
 */

$key = $params['key'] ?? '';
?>
<div data-page="gym-detail" data-gym-key="<?= View::e($key) ?>">

    <div class="mx-auto max-w-4xl px-6 py-8">
        <a href="/gimnasios" class="inline-flex items-center gap-2 text-sm font-semibold
                                    text-muted transition-colors hover:text-accent">
            <i class="fas fa-arrow-left" aria-hidden="true"></i> Volver a gimnasios
        </a>

        <!-- Esqueleto de carga -->
        <div id="gym-detail-loading" class="mt-6">
            <div class="skeleton h-64 rounded-panel"></div>
            <div class="mt-6 space-y-3">
                <div class="skeleton h-8 w-1/2"></div>
                <div class="skeleton h-4 w-1/3"></div>
                <div class="skeleton h-20 w-full"></div>
            </div>
        </div>

        <article id="gym-detail" hidden class="mt-6"></article>

        <div id="gym-detail-error" hidden
             class="mt-6 rounded-card border border-red-200 bg-red-50 p-8 text-center
                    dark:border-red-500/30 dark:bg-red-500/10">
            <i class="fas fa-triangle-exclamation text-2xl text-red-500" aria-hidden="true"></i>
            <p class="mt-3 font-bold text-red-700 dark:text-red-300">Gimnasio no encontrado</p>
            <a href="/gimnasios" class="btn-ghost mt-5">Ver todos los gimnasios</a>
        </div>
    </div>
</div>
