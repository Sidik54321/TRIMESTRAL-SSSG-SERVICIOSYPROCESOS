<?php

declare(strict_types=1);

/**
 * my-sparrings.php — Retos, sesiones e historial del boxeador.
 *
 * Sólo tiene sentido para boxeadores: el sidebar ya oculta este enlace a
 * los entrenadores, pero my-sparrings.js repite la comprobación por si se
 * llega aquí escribiendo la URL a mano.
 */
?>
<div data-page="my-sparrings">
    <div class="mx-auto max-w-5xl px-6 py-8">
        <h2 class="text-2xl">Mis Sparrings</h2>
        <p class="mt-1 text-sm text-muted dark:text-white/60">Tu historial y tus retos de sparring.</p>

        <!-- ── Retos ─────────────────────────────────────────────── -->
        <section class="card mt-6 p-6">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold">Retos de sparring</h3>
                <span id="challenges-count" class="text-sm text-muted">0</span>
            </div>

            <h4 class="mt-6 text-xs font-bold uppercase tracking-wide text-muted">Recibidos</h4>
            <div class="mt-2 space-y-3" id="challenges-received-list"></div>
            <nav id="challenges-received-pagination" class="mt-4 flex justify-center gap-1"></nav>

            <h4 class="mt-8 text-xs font-bold uppercase tracking-wide text-muted">Enviados</h4>
            <div class="mt-2 space-y-3" id="challenges-sent-list"></div>
            <nav id="challenges-sent-pagination" class="mt-4 flex justify-center gap-1"></nav>
        </section>

        <!-- ── Sesiones programadas ──────────────────────────────── -->
        <section class="card mt-6 p-6">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold">Sesiones programadas</h3>
                <span id="sessions-count" class="text-sm text-muted">0</span>
            </div>
            <div class="mt-4 space-y-3" id="sessions-list"></div>
        </section>

        <!-- ── Historial ─────────────────────────────────────────── -->
        <section class="card mt-6 p-6">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold">Historial de sparrings</h3>
                <span id="history-count" class="text-sm text-muted">0 registros</span>
            </div>

            <div id="history-empty" hidden class="mt-6 text-center">
                <i class="fas fa-clipboard-list text-4xl text-faint" aria-hidden="true"></i>
                <p class="mt-4 font-bold">Aún no tienes sparrings completados.</p>
                <p class="mt-1 text-sm text-muted">Aquí aparecerán tus sesiones una vez que se completen.</p>
            </div>

            <div id="history-wrap" class="mt-4 overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead>
                        <tr class="border-b border-hairline text-xs uppercase tracking-wide text-muted dark:border-white/10">
                            <th class="py-2 pr-4">Fecha</th>
                            <th class="py-2 pr-4">Partner</th>
                            <th class="py-2 pr-4">Gimnasio</th>
                            <th class="py-2">Notas</th>
                        </tr>
                    </thead>
                    <tbody id="history-tbody" class="divide-y divide-hairline dark:divide-white/10"></tbody>
                </table>
            </div>
        </section>
    </div>

    <!-- ── Modal: valorar sparring ───────────────────────────────── -->
    <dialog id="review-modal"
            class="w-full max-w-md rounded-panel bg-surface p-0 text-body shadow-lift
                   backdrop:bg-black/60 dark:bg-night-soft dark:text-white">
        <form method="dialog" id="review-form" class="flex max-h-[85vh] flex-col">
            <header class="flex items-center justify-between border-b border-hairline px-6 py-4 dark:border-white/10">
                <h3 class="text-lg font-bold">Valorar sparring</h3>
                <button type="button" id="review-close" aria-label="Cerrar"
                        class="grid h-9 w-9 place-items-center rounded-full text-muted
                               transition-colors hover:bg-sunken dark:hover:bg-white/10">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <label class="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
                    Valoración (1 a 5)
                </label>
                <div id="review-stars" class="flex flex-row-reverse justify-end gap-1 text-3xl">
                    <?php for ($i = 5; $i >= 1; $i--): ?>
                        <button type="button" data-star="<?= $i ?>" aria-label="<?= $i ?> estrellas"
                                class="star-btn text-faint transition-colors hover:text-accent">★</button>
                    <?php endfor; ?>
                </div>
                <input type="hidden" id="review-rating" required>

                <label class="mb-2 mt-6 block text-xs font-bold uppercase tracking-wide text-muted">
                    Comentarios rápidos
                </label>
                <div id="review-tags" class="flex flex-wrap gap-2">
                    <?php foreach (['Buen ritmo', 'Técnico', 'Respetuoso', 'Mucha intensidad', 'Buen nivel', 'Aprendí mucho'] as $tag): ?>
                        <button type="button" data-tag="<?= htmlspecialchars($tag, ENT_QUOTES) ?>"
                                class="tag-btn chip transition-colors aria-pressed:bg-accent aria-pressed:text-white">
                            <?= htmlspecialchars($tag, ENT_QUOTES) ?>
                        </button>
                    <?php endforeach; ?>
                </div>

                <label for="review-note" class="mb-2 mt-6 block text-xs font-bold uppercase tracking-wide text-muted">
                    Extra (opcional)
                </label>
                <textarea id="review-note" rows="3" class="field resize-none"
                          placeholder="Algo a destacar, reglas, protecciones, sensaciones…"></textarea>
            </div>

            <footer class="flex justify-end gap-3 border-t border-hairline px-6 py-4 dark:border-white/10">
                <button type="button" id="review-cancel" class="btn-ghost">Cancelar</button>
                <button type="submit" class="btn-primary">Enviar valoración</button>
            </footer>
        </form>
    </dialog>
</div>
