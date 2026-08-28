<?php

declare(strict_types=1);

/**
 * sparring.php — Buscar compañero de sparring.
 *
 * El marcado se sirve desde PHP con esqueletos de carga; los datos los pide
 * app/js/pages/sparring.js a /api/boxeadores y rellena la lista. El modal
 * de "retar a sparring" vive aquí como <dialog> nativo, igual que en la
 * versión clásica, porque ya trae foco y cierre con Escape sin JS extra.
 *
 * data-guest-ok: esta vista se puede explorar sin sesión (ver app/js/app.js,
 * que por eso no exige guard() aquí). sparring.js gatea sus propias
 * acciones (ver perfil, retar) abriendo el modal de login cuando no hay
 * email en la sesión, en vez de ejecutarlas.
 */
?>
<div data-page="sparring" data-guest-ok>

    <!-- ── Cabecera ──────────────────────────────────────────────── -->
    <section class="bg-ink px-6 py-14 text-white sm:py-20">
        <div class="mx-auto max-w-5xl text-center">
            <h2 class="text-3xl sm:text-4xl">Encuentra tu compañero de sparring</h2>
            <p class="mx-auto mt-3 max-w-xl text-sm text-white/70">
                Filtra por nivel, peso y ubicación para encontrar el sparring ideal.
            </p>
        </div>
    </section>

    <div class="mx-auto max-w-6xl px-6 py-10">

        <!-- ── Filtros ───────────────────────────────────────────── -->
        <section class="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <select id="sp-level" class="field">
                <option value="">Nivel</option>
                <option>Principiante</option>
                <option>Intermedio</option>
                <option>Avanzado</option>
                <option>Profesional</option>
            </select>

            <select id="sp-weight" class="field">
                <option value="">Categoría de peso (lb)</option>
                <option>105 - 112 (Mosca)</option>
                <option>113 - 118 (Gallo)</option>
                <option>119 - 126 (Pluma)</option>
                <option>127 - 135 (Ligero)</option>
                <option>136 - 147 (Wélter)</option>
                <option>148 - 160 (Mediano)</option>
                <option>161+ (Pesado)</option>
            </select>

            <select id="sp-location" class="field">
                <option value="">Todas las ubicaciones</option>
            </select>

            <button type="button" id="sp-reset" class="btn-ghost">Limpiar filtros</button>
        </section>

        <!-- ── Resultados ────────────────────────────────────────── -->
        <div class="mt-8 flex flex-wrap items-baseline justify-between gap-3">
            <h3 class="text-xl">Sparrings</h3>
            <p id="sp-count" class="text-sm text-muted" aria-live="polite"></p>
        </div>

        <div id="sp-skeletons" class="mt-5 space-y-3">
            <?php for ($i = 0; $i < 6; $i++): ?>
                <div class="card flex items-center gap-4 p-4">
                    <div class="skeleton h-12 w-12 shrink-0 rounded-full"></div>
                    <div class="flex-1 space-y-2">
                        <div class="skeleton h-4 w-1/3"></div>
                        <div class="skeleton h-3 w-1/4"></div>
                    </div>
                    <div class="skeleton hidden h-9 w-24 sm:block"></div>
                </div>
            <?php endfor; ?>
        </div>

        <div id="sp-list" hidden class="mt-5 space-y-3"></div>

        <div id="sp-empty" hidden class="card mt-5 p-12 text-center">
            <i class="fas fa-user-slash text-4xl text-faint" aria-hidden="true"></i>
            <p class="mt-4 font-bold">No hay sparrings que coincidan</p>
            <p class="mt-1 text-sm text-muted">Prueba con otros filtros.</p>
        </div>

        <div id="sp-error" hidden
             class="mt-5 rounded-card border border-red-200 bg-red-50 p-6 text-center
                    dark:border-red-500/30 dark:bg-red-500/10">
            <i class="fas fa-triangle-exclamation text-2xl text-red-500" aria-hidden="true"></i>
            <p class="mt-3 font-bold text-red-700 dark:text-red-300">No se han podido cargar los sparrings</p>
            <button type="button" id="sp-retry" class="btn-ghost mt-5">Reintentar</button>
        </div>

        <nav id="sp-pagination" class="mt-8 flex justify-center gap-1" aria-label="Paginación"></nav>
    </div>

    <!-- ── Modal: retar a sparring ─────────────────────────────── -->
    <dialog id="challenge-modal"
            class="w-full max-w-lg rounded-panel bg-surface p-0 text-body shadow-lift
                   backdrop:bg-black/60 backdrop:backdrop-blur-sm
                   dark:bg-night-soft dark:text-white">
        <form method="dialog" id="challenge-form" novalidate class="flex max-h-[85vh] flex-col">
            <header class="flex items-center justify-between border-b border-hairline px-6 py-4 dark:border-white/10">
                <h3 id="challenge-title" class="text-lg font-bold">Retar a sparring</h3>
                <button type="button" id="challenge-close" aria-label="Cerrar"
                        class="grid h-9 w-9 place-items-center rounded-full text-muted
                               transition-colors hover:bg-sunken dark:hover:bg-white/10">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">

                <!-- Tipo de sparring -->
                <label class="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
                    Tipo de sparring
                </label>
                <div id="preset-grid" class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <?php
                    $presets = [
                        ['fa-feather-alt',      'Técnico (ligero)',   'Sparring técnico (ligero)'],
                        ['fa-walking',          'Medio (ritmo)',      'Sparring medio (ritmo constante)'],
                        ['fa-fire',             'Duro (intenso)',     'Sparring duro (intenso)'],
                        ['fa-arrows-alt-h',     'Distancia y jab',    'Trabajo de distancia y jab'],
                        ['fa-shield-alt',       'Defensa y contra',   'Trabajo de defensa y contra'],
                        ['fa-trophy',           'Combate',            'Preparación para combate'],
                    ];
                    foreach ($presets as [$icon, $label, $value]): ?>
                        <button type="button" data-preset="<?= htmlspecialchars($value, ENT_QUOTES) ?>"
                                class="preset-card flex flex-col items-center gap-2 rounded-xl border-2
                                       border-hairline p-3 text-center text-xs font-semibold
                                       transition-colors hover:border-accent
                                       aria-pressed:border-accent aria-pressed:bg-accent-soft
                                       dark:border-white/10">
                            <i class="fas <?= $icon ?> text-lg text-accent" aria-hidden="true"></i>
                            <?= htmlspecialchars($label, ENT_QUOTES) ?>
                        </button>
                    <?php endforeach; ?>
                </div>
                <input type="hidden" id="challenge-preset" required>

                <!-- Entrenadores -->
                <label for="coach-search" class="mb-2 mt-6 block text-xs font-bold uppercase tracking-wide text-muted">
                    Entrenador(es) supervisor(es)
                </label>
                <input type="text" id="coach-search" class="field" placeholder="Buscar por nombre o gimnasio…" autocomplete="off">
                <div id="coach-checklist" class="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl
                                                  border border-hairline p-2 dark:border-white/10"></div>

                <!-- Gimnasio -->
                <label for="gym-search" class="mb-2 mt-6 block text-xs font-bold uppercase tracking-wide text-muted">
                    Gimnasio
                </label>
                <input type="text" id="gym-search" class="field" placeholder="Buscar gimnasio por nombre…" autocomplete="off">
                <div id="gym-checklist" class="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl
                                                border border-hairline p-2 dark:border-white/10"></div>

                <!-- Fecha y hora -->
                <label for="challenge-datetime" class="mb-2 mt-6 block text-xs font-bold uppercase tracking-wide text-muted">
                    Fecha y hora
                </label>
                <input id="challenge-datetime" type="text" readonly required
                       class="field cursor-pointer" placeholder="Selecciona fecha y hora">

                <!-- Nota -->
                <label for="challenge-note" class="mb-2 mt-6 block text-xs font-bold uppercase tracking-wide text-muted">
                    Nota (opcional)
                </label>
                <textarea id="challenge-note" rows="3" class="field resize-none"
                          placeholder="Horario, objetivo, reglas, protecciones…"></textarea>
            </div>

            <footer class="flex justify-end gap-3 border-t border-hairline px-6 py-4 dark:border-white/10">
                <button type="button" id="challenge-cancel" class="btn-ghost">Cancelar</button>
                <button type="submit" class="btn-primary">Enviar reto</button>
            </footer>
        </form>
    </dialog>

    <!-- ── Confirmación de cierre ───────────────────────────────── -->
    <dialog id="challenge-cancel-confirm"
            class="w-full max-w-sm rounded-panel bg-surface p-6 text-body shadow-lift
                   backdrop:bg-black/60 dark:bg-night-soft dark:text-white">
        <form method="dialog">
            <h3 class="text-lg font-bold">Cancelar sparring</h3>
            <p class="mt-2 text-sm text-muted dark:text-white/60">
                ¿Deseas cancelar el sparring? Los cambios realizados no se guardarán.
            </p>
            <div class="mt-6 flex justify-end gap-3">
                <button value="stay" class="btn-ghost">Seguir editando</button>
                <button value="confirm" class="btn-primary">Cancelar sparring</button>
            </div>
        </form>
    </dialog>

    <!-- ── Selector de fecha y hora ──────────────────────────────── -->
    <dialog id="dt-overlay" aria-label="Seleccionar fecha y hora"
            class="w-full max-w-xs rounded-panel bg-surface p-5 text-body shadow-lift
                   backdrop:bg-black/60 dark:bg-night-soft dark:text-white">
        <div class="flex items-center justify-between">
            <button type="button" id="dt-prev" aria-label="Mes anterior"
                    class="grid h-8 w-8 place-items-center rounded-full hover:bg-sunken dark:hover:bg-white/10">
                <i class="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            <div id="dt-title" class="text-sm font-bold"></div>
            <button type="button" id="dt-next" aria-label="Mes siguiente"
                    class="grid h-8 w-8 place-items-center rounded-full hover:bg-sunken dark:hover:bg-white/10">
                <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
        </div>

        <div id="dt-weekdays" class="mt-3 grid grid-cols-7 text-center text-xs font-bold text-muted"></div>
        <div id="dt-grid" class="mt-1 grid grid-cols-7 gap-1"></div>

        <div class="mt-4 flex items-center justify-between gap-2 border-t border-hairline pt-4 dark:border-white/10">
            <span class="text-xs font-bold uppercase tracking-wide text-muted">Hora</span>
            <div class="flex items-center gap-1">
                <select id="dt-hour" aria-label="Hora" class="field w-16 px-2 py-1.5 text-center"></select>
                <span>:</span>
                <select id="dt-minute" aria-label="Minutos" class="field w-16 px-2 py-1.5 text-center"></select>
            </div>
        </div>

        <div class="mt-5 flex items-center justify-between">
            <button type="button" id="dt-today" class="btn-ghost px-4 py-2 text-xs">Hoy</button>
            <div class="flex gap-2">
                <button type="button" id="dt-cancel" class="btn-ghost px-4 py-2 text-xs">Cancelar</button>
                <button type="button" id="dt-apply" class="btn-primary px-4 py-2 text-xs">Aplicar</button>
            </div>
        </div>
    </dialog>
</div>
