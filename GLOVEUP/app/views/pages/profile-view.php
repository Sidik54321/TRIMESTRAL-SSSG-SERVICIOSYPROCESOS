<?php

declare(strict_types=1);

use GloveUp\View;

/**
 * profile-view.php — Ficha de sólo lectura de otro boxeador.
 *
 * Se llega aquí desde "Ver perfil" en Buscar Sparring, o desde el buscador
 * de la propia página de Perfil. Sólo boxeadores tienen ficha pública; los
 * entrenadores no se buscan por este camino, igual que en la versión clásica.
 *
 * @var array<string, string> $params
 */

$identifier = $params['identifier'] ?? '';
?>
<div data-page="profile-view" data-identifier="<?= View::e($identifier) ?>">
    <div class="mx-auto max-w-3xl px-6 py-8">
        <a href="/sparring" class="inline-flex items-center gap-2 text-sm font-semibold
                                    text-muted transition-colors hover:text-accent">
            <i class="fas fa-arrow-left" aria-hidden="true"></i> Volver a Buscar Sparring
        </a>

        <div id="view-loading" class="mt-6">
            <div class="card flex items-center gap-4 p-6">
                <div class="skeleton h-24 w-24 shrink-0 rounded-full"></div>
                <div class="flex-1 space-y-3">
                    <div class="skeleton h-6 w-1/2"></div>
                    <div class="skeleton h-4 w-1/3"></div>
                </div>
            </div>
        </div>

        <article id="view-card" hidden class="mt-6"></article>

        <div id="view-error" hidden
             class="mt-6 rounded-card border border-red-200 bg-red-50 p-8 text-center
                    dark:border-red-500/30 dark:bg-red-500/10">
            <i class="fas fa-triangle-exclamation text-2xl text-red-500" aria-hidden="true"></i>
            <p class="mt-3 font-bold text-red-700 dark:text-red-300">Perfil no encontrado</p>
            <a href="/sparring" class="btn-ghost mt-5">Volver a Buscar Sparring</a>
        </div>
    </div>
</div>
