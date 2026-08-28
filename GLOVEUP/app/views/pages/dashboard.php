<?php

declare(strict_types=1);

/**
 * dashboard.php — Inicio.
 *
 * El contenido depende del rol, que sólo se conoce en el cliente. Se
 * renderizan los dos bloques y dashboard.js oculta el que no toca, igual
 * que hace profile.php con sus campos de boxeador/entrenador.
 *
 * El panel del entrenador clásico calculaba métricas de gimnasio pero nunca
 * llegó a pintarlas (el componente original sólo renderizaba la cabecera y
 * el calendario pese a tener el estado listo) — aquí se replica lo que de
 * verdad se veía: cabecera y calendario con eventos automáticos (altas de
 * boxeadores, recordatorios) y personalizados.
 */
?>
<div data-page="dashboard">

    <!-- ══ Boxeador ═══════════════════════════════════════════════ -->
    <div data-role="boxeador" class="mx-auto max-w-6xl px-6 py-8">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h2 class="text-2xl">Tu panel de sparring</h2>
                <p class="mt-1 text-sm text-muted dark:text-white/60">Resumen de tu actividad reciente y accesos rápidos.</p>
            </div>
            <div class="flex gap-2">
                <a href="/sparring" class="btn-primary">Buscar nuevo sparring</a>
                <a href="/gimnasios" class="btn-ghost">Explorar gimnasios</a>
            </div>
        </div>

        <!-- Métricas -->
        <section class="mt-6 grid gap-4 sm:grid-cols-3">
            <?php
            $metrics = [
                ['key' => 'month',    'icon' => 'fa-fist-raised',    'label' => 'Sesiones este mes'],
                ['key' => 'total',    'icon' => 'fa-history',        'label' => 'Total sesiones'],
                ['key' => 'pending',  'icon' => 'fa-hourglass-half', 'label' => 'Retos pendientes'],
            ];
            foreach ($metrics as $m): ?>
                <div class="card p-5" data-metric="<?= $m['key'] ?>">
                    <div class="flex items-center justify-between">
                        <span class="flex items-center gap-2 text-sm font-semibold text-muted dark:text-white/60">
                            <i class="fas <?= $m['icon'] ?> text-xs" aria-hidden="true"></i> <?= $m['label'] ?>
                        </span>
                        <span data-metric-pill class="rounded-full bg-sunken px-2.5 py-0.5 text-xs font-black
                                                       dark:bg-white/10">0</span>
                    </div>
                    <div class="mt-3 flex justify-center">
                        <div class="relative h-24 w-24">
                            <canvas data-metric-canvas width="96" height="96"></canvas>
                            <span data-metric-value
                                  class="absolute inset-0 grid place-items-center text-xl font-black">0</span>
                        </div>
                    </div>
                    <p data-metric-sub class="mt-2 text-center text-xs text-muted dark:text-white/60"></p>
                </div>
            <?php endforeach; ?>
        </section>

        <!-- Sparrings recientes + calendario -->
        <section class="mt-6 grid gap-6 lg:grid-cols-2">
            <div class="card p-5">
                <h3 class="flex items-center gap-2 text-lg font-bold">
                    <i class="fas fa-clock text-muted" aria-hidden="true"></i> Sparrings recientes
                </h3>

                <div data-recent-skeleton class="mt-4 space-y-3">
                    <?php for ($i = 0; $i < 3; $i++): ?>
                        <div class="skeleton h-14"></div>
                    <?php endfor; ?>
                </div>

                <ul data-recent-list hidden class="mt-4 space-y-2"></ul>

                <div data-recent-empty hidden class="mt-6 text-center">
                    <i class="fas fa-fist-raised text-3xl text-faint" aria-hidden="true"></i>
                    <p class="mt-3 text-sm text-muted">
                        Todavía no tienes sesiones registradas. ¡Busca un sparring para empezar!
                    </p>
                </div>
            </div>

            <div class="card p-5">
                <h3 class="flex items-center gap-2 text-lg font-bold">
                    <i class="fas fa-calendar-check text-muted" aria-hidden="true"></i> Mi calendario
                </h3>
                <p data-cal-hint class="mt-2 flex items-start gap-1.5 text-xs text-muted dark:text-white/60">
                    <i class="fas fa-info-circle mt-0.5" aria-hidden="true"></i>
                    Haz clic en un día para añadir un evento o en uno existente para verlo.
                </p>
                <div data-cal-skeleton class="skeleton mt-4 h-80"></div>
                <div data-cal-root hidden class="glv-calendar mt-4"></div>
            </div>
        </section>
    </div>

    <!-- ══ Entrenador ═════════════════════════════════════════════ -->
    <div data-role="entrenador" hidden class="mx-auto max-w-6xl px-6 py-8">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h2 id="coach-heading" class="text-2xl">Entrenador</h2>
                <p class="mt-1 text-sm text-muted dark:text-white/60">Resumen de actividad y gestión de boxeadores.</p>
            </div>
            <div class="flex gap-2">
                <a href="/gestion" class="btn-primary">Gestionar alumnos</a>
                <a href="/mi-gimnasio" class="btn-ghost">Mi gimnasio</a>
            </div>
        </div>

        <section class="card mt-6 p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="flex items-center gap-2 text-lg font-bold">
                    <i class="fas fa-calendar-check text-muted" aria-hidden="true"></i> Calendario de actividad
                </h3>
                <div id="coach-cal-filters" class="flex flex-wrap gap-2">
                    <?php
                    $filters = [
                        ['key' => 'inscripcion',   'label' => 'Altas'],
                        ['key' => 'pago',          'label' => 'Pagos'],
                        ['key' => 'sparring',      'label' => 'Sparrings'],
                        ['key' => 'recordatorio',  'label' => 'Recordatorios'],
                        ['key' => 'personalizado', 'label' => 'Personalizados'],
                    ];
                    foreach ($filters as $f): ?>
                        <button type="button" data-filter="<?= $f['key'] ?>" aria-pressed="true"
                                class="rounded-full border border-hairline px-3 py-1 text-xs font-bold text-muted
                                       transition-colors aria-pressed:border-accent aria-pressed:bg-accent-soft
                                       aria-pressed:text-accent dark:border-white/15 dark:text-white/60">
                            <?= $f['label'] ?>
                        </button>
                    <?php endforeach; ?>
                </div>
            </div>
            <p id="coach-cal-details" class="mt-3 flex items-start gap-1.5 text-xs text-muted dark:text-white/60">
                <i class="fas fa-info-circle mt-0.5" aria-hidden="true"></i>
                <span id="coach-cal-details-text">Selecciona un evento o haz clic en un día para crear uno nuevo.</span>
            </p>
            <div id="coach-cal-skeleton" class="skeleton mt-4 h-96"></div>
            <div id="coach-cal-root" hidden class="glv-calendar mt-4"></div>
        </section>
    </div>

    <!-- ── Modal: nuevo/editar evento ────────────────────────────── -->
    <dialog id="event-modal"
            class="w-full max-w-md rounded-panel bg-surface p-0 text-body shadow-lift
                   backdrop:bg-black/60 dark:bg-night-soft dark:text-white">
        <form method="dialog" id="event-form" class="flex max-h-[85vh] flex-col">
            <header class="flex items-center justify-between border-b border-hairline px-6 py-4 dark:border-white/10">
                <h3 id="event-title" class="text-lg font-bold">Nuevo evento</h3>
                <button type="button" id="event-close" aria-label="Cerrar"
                        class="grid h-9 w-9 place-items-center rounded-full text-muted
                               transition-colors hover:bg-sunken dark:hover:bg-white/10">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </header>

            <div id="event-error" hidden
                 class="mx-6 mt-4 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-800
                        dark:bg-red-500/15 dark:text-red-400"></div>

            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <label for="event-field-title" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                    Título *
                </label>
                <input id="event-field-title" type="text" class="field" placeholder="Ej: Entrenamiento especial">

                <div class="mt-4 grid grid-cols-2 gap-3">
                    <div>
                        <label for="event-field-start" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                            Fecha inicio *
                        </label>
                        <input id="event-field-start" type="date" class="field">
                    </div>
                    <div>
                        <label for="event-field-end" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                            Fecha fin
                        </label>
                        <input id="event-field-end" type="date" class="field">
                    </div>
                </div>

                <div class="mt-4 grid grid-cols-2 gap-3">
                    <div>
                        <label for="event-field-type" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Tipo</label>
                        <select id="event-field-type" class="field">
                            <option value="personalizado">Personalizado</option>
                            <option value="entrenamiento">Entrenamiento</option>
                            <option value="competicion">Competición</option>
                            <option value="descanso">Descanso</option>
                        </select>
                    </div>
                    <div>
                        <span class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Color</span>
                        <div id="event-colors" class="flex flex-wrap gap-2 pt-1">
                            <?php foreach (['#f97316', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#111827'] as $c): ?>
                                <button type="button" data-color="<?= $c ?>"
                                        style="background-color: <?= $c ?>"
                                        class="color-btn h-7 w-7 rounded-full border-2 border-transparent
                                               transition-all aria-pressed:border-ink aria-pressed:scale-110
                                               dark:aria-pressed:border-white"></button>
                            <?php endforeach; ?>
                        </div>
                        <input type="hidden" id="event-field-color" value="#f97316">
                    </div>
                </div>

                <label for="event-field-notes" class="mb-1.5 mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
                    Notas
                </label>
                <textarea id="event-field-notes" rows="3" class="field resize-none" placeholder="Notas opcionales…"></textarea>
            </div>

            <footer class="flex justify-between gap-3 border-t border-hairline px-6 py-4 dark:border-white/10">
                <button type="button" id="event-delete" hidden
                        class="rounded-full border border-red-300 px-4 py-2 text-sm font-bold text-red-600
                               transition-colors hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10">
                    <i class="fas fa-trash" aria-hidden="true"></i> Eliminar
                </button>
                <button type="submit" class="btn-primary ml-auto">
                    <i class="fas fa-save" aria-hidden="true"></i> Guardar
                </button>
            </footer>
        </form>
    </dialog>

    <!-- ── Confirmación de borrado ───────────────────────────────── -->
    <dialog id="event-delete-confirm"
            class="w-full max-w-sm rounded-panel bg-surface p-6 text-center text-body shadow-lift
                   backdrop:bg-black/60 dark:bg-night-soft dark:text-white">
        <form method="dialog">
            <i class="fas fa-triangle-exclamation text-4xl text-red-500" aria-hidden="true"></i>
            <h3 class="mt-4 text-lg font-bold">¿Eliminar este evento?</h3>
            <p class="mt-2 text-sm text-muted dark:text-white/60">Esta acción no se puede deshacer.</p>
            <div class="mt-6 flex gap-3">
                <button value="cancel" class="btn-ghost flex-1">Cancelar</button>
                <button value="confirm" class="btn-primary flex-1">Sí, eliminar</button>
            </div>
        </form>
    </dialog>
</div>
