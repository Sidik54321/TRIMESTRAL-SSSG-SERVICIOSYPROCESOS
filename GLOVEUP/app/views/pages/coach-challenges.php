<?php

declare(strict_types=1);

/**
 * coach-challenges.php — Retos de los boxeadores del entrenador.
 *
 * Sólo tiene sentido para entrenadores: un reto boxeador-boxeador lo
 * confirman los dos entrenadores implicados (ver my-sparrings.js), y esta
 * es la pantalla donde lo hacen. coach-challenges.js repite la comprobación
 * de rol por si se llega aquí escribiendo la URL a mano.
 */
?>
<div data-page="coach-challenges">
    <div class="mx-auto max-w-4xl px-6 py-8">
        <h2 id="cc-heading" class="text-2xl">Entrenador</h2>
        <p class="mt-1 text-sm text-muted dark:text-white/60">Peticiones de sparring externas para tus boxeadores.</p>

        <!-- ── Filtros ───────────────────────────────────────────── -->
        <div id="cc-tabs" class="mt-6 flex flex-wrap gap-2 rounded-panel bg-sunken p-3 dark:bg-white/5">
            <?php
            $tabs = [
                ['key' => 'pending',   'label' => 'En curso',    'icon' => 'fa-spinner fa-spin'],
                ['key' => 'accepted',  'label' => 'Aceptado',    'icon' => 'fa-check-circle'],
                ['key' => 'declined',  'label' => 'Rechazado',   'icon' => 'fa-times-circle'],
                ['key' => 'completed', 'label' => 'Completados', 'icon' => 'fa-flag-checkered'],
                ['key' => 'history',   'label' => 'Historial',   'icon' => 'fa-history'],
            ];
            foreach ($tabs as $i => $tab): ?>
                <button type="button" data-tab="<?= $tab['key'] ?>"
                        class="tab-btn inline-flex items-center gap-2 rounded-full border-2 border-transparent
                               bg-surface px-4 py-2 text-xs font-bold text-body transition-colors
                               aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white
                               dark:bg-night-soft dark:text-white dark:aria-pressed:border-white"
                        <?= $i === 0 ? 'aria-pressed="true"' : '' ?>>
                    <i class="fas <?= $tab['icon'] ?>" aria-hidden="true"></i>
                    <?= $tab['label'] ?>
                    <span data-count="<?= $tab['key'] ?>"
                          class="rounded-full bg-hairline-strong/20 px-2 py-0.5 text-[0.7rem]
                                 dark:bg-white/15">0</span>
                </button>
            <?php endforeach; ?>
        </div>

        <div id="cc-message" hidden class="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"></div>

        <!-- ── Lista ─────────────────────────────────────────────── -->
        <div id="cc-skeletons" class="mt-6 space-y-3">
            <?php for ($i = 0; $i < 3; $i++): ?>
                <div class="card h-40 p-6"><div class="skeleton h-full w-full"></div></div>
            <?php endfor; ?>
        </div>

        <div id="cc-list" hidden class="mt-6 space-y-4"></div>

        <div id="cc-empty" hidden class="card mt-6 p-12 text-center">
            <i class="fas fa-shield-alt text-4xl text-faint" aria-hidden="true"></i>
            <p id="cc-empty-text" class="mt-4 font-bold">No hay retos para tus boxeadores.</p>
        </div>
    </div>

    <!-- ── Modal: finalizar y valorar ───────────────────────────── -->
    <dialog id="complete-modal"
            class="w-full max-w-sm rounded-panel bg-surface p-6 text-center text-body shadow-lift
                   backdrop:bg-black/60 dark:bg-night-soft dark:text-white">
        <h3 class="text-xl font-black">Finalizar sparring</h3>
        <p class="mt-2 text-sm text-muted dark:text-white/60">
            ¿Cómo fue el desempeño? Tu valoración ayuda a mejorar la comunidad.
        </p>

        <div id="complete-stars" class="mt-6 flex justify-center gap-3 text-3xl">
            <?php for ($i = 1; $i <= 5; $i++): ?>
                <button type="button" data-star="<?= $i ?>" aria-label="<?= $i ?> estrellas"
                        class="star-btn text-faint transition-transform hover:scale-110 hover:text-accent">★</button>
            <?php endfor; ?>
        </div>
        <input type="hidden" id="complete-rating" value="5">

        <label for="complete-note" class="mb-2 mt-6 block text-left text-xs font-bold uppercase tracking-wide text-muted">
            Comentarios (opcional)
        </label>
        <textarea id="complete-note" rows="3" class="field resize-none"
                  placeholder="Ej: Muy buena técnica, respetuoso…"></textarea>

        <div class="mt-6 flex gap-3">
            <button type="button" id="complete-cancel" class="btn-ghost flex-1">Cancelar</button>
            <button type="button" id="complete-submit" class="btn-primary flex-1">Finalizar</button>
        </div>
    </dialog>
</div>
