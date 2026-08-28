<?php

declare(strict_types=1);

/**
 * coach-panel.php — Perfil del gimnasio + gestión de boxeadores.
 *
 * Migración de CoachManagement (dashboard/entrenador/dashboard.react.js).
 * /gestion y /mi-gimnasio llevan aquí; sólo cambia la pestaña inicial
 * (ver la nota en routes.php sobre el cruce de nombres del dashboard clásico).
 * El mapa de ubicación (Leaflet + geocodificación Nominatim) no se ha
 * migrado — igual que en Gimnasios, se sustituye por campos de texto
 * simples de dirección y ciudad.
 *
 * La tercera pestaña, "Pagos", migra CoachFinance — antes huérfana, sin
 * ningún enlace en el menú clásico salvo el cruce de nombres ya corregido.
 * Dos de sus métricas ("Pagos este mes" y "Cobros") mostrarán siempre 0:
 * "Cobros" porque GET /me/cobros es un stub del backend que nunca se llegó
 * a implementar, y "Pagos este mes" porque cuenta boxer.pagos, el mismo
 * campo que no existe en el esquema de Mongoose (ver la nota sobre Retos y
 * el botón "Marcar como pagado" de Gestión). Se documenta, no se oculta:
 * es lo que el backend real devuelve hoy.
 *
 * @var array<string, mixed> $route
 */

$defaultTab = $route['default_tab'] ?? 'gym';
?>
<div data-page="coach-panel" data-default-tab="<?= htmlspecialchars($defaultTab, ENT_QUOTES) ?>">
    <div class="mx-auto max-w-5xl px-6 py-8">

        <div id="cp-skeleton" class="space-y-4">
            <div class="skeleton h-10 w-64"></div>
            <div class="skeleton h-64"></div>
        </div>

        <div id="cp-message" hidden class="mb-4 rounded-xl px-4 py-3 text-sm font-semibold"></div>

        <!-- ── Sin gimnasio todavía ─────────────────────────────────── -->
        <div id="cp-empty" hidden class="grid place-items-center px-6 py-20 text-center">
            <span class="grid h-20 w-20 place-items-center rounded-2xl bg-sky-100 text-3xl text-sky-600
                         dark:bg-sky-500/15 dark:text-sky-400">
                <i class="fas fa-building" aria-hidden="true"></i>
            </span>
            <h2 class="mt-6 text-2xl">Aún no tienes un gimnasio</h2>
            <p class="mt-2 max-w-md text-sm text-muted dark:text-white/60">
                Registra tu gimnasio para empezar a gestionar boxeadores, horarios y mucho más.
            </p>
            <button type="button" id="cp-start-create" class="btn-primary mt-6">
                <i class="fas fa-plus" aria-hidden="true"></i> Crear gimnasio
            </button>
        </div>

        <!-- ── Panel principal ──────────────────────────────────────── -->
        <div id="cp-panel" hidden>
            <div id="cp-tabs" class="flex gap-6 border-b border-hairline dark:border-white/10">
                <button type="button" data-tab="gym"
                        class="tab-underline flex items-center gap-2 pb-3 text-sm font-bold text-muted
                               aria-pressed:border-accent aria-pressed:text-accent
                               dark:text-white/60">
                    <i class="fas fa-building" aria-hidden="true"></i> Mi Gimnasio
                </button>
                <button type="button" data-tab="boxers" id="cp-tab-boxers" hidden
                        class="tab-underline flex items-center gap-2 pb-3 text-sm font-bold text-muted
                               aria-pressed:border-accent aria-pressed:text-accent
                               dark:text-white/60">
                    <i class="fas fa-users" aria-hidden="true"></i>
                    <span id="cp-boxers-count-label">Mis Boxeadores</span>
                </button>
                <button type="button" data-tab="payments" id="cp-tab-payments" hidden
                        class="tab-underline flex items-center gap-2 pb-3 text-sm font-bold text-muted
                               aria-pressed:border-accent aria-pressed:text-accent
                               dark:text-white/60">
                    <i class="fas fa-euro-sign" aria-hidden="true"></i> Pagos
                </button>
            </div>

            <!-- ══ Pestaña: gimnasio ══════════════════════════════════ -->
            <section id="cp-gym-tab" class="mt-6">
                <h2 id="cp-gym-heading" class="text-xl">Mi gimnasio</h2>

                <div class="card mt-4 space-y-6 p-6">
                    <!-- Foto + nombre -->
                    <div class="flex items-center gap-5">
                        <div class="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl
                                    border-2 border-hairline bg-sunken dark:border-white/10 dark:bg-white/5">
                            <img id="cp-photo-preview" alt="" class="hidden h-full w-full object-cover">
                            <div id="cp-photo-placeholder" class="grid h-full w-full place-items-center text-2xl text-faint">
                                <i class="fas fa-image" aria-hidden="true"></i>
                            </div>
                            <label class="absolute inset-0 grid cursor-pointer place-items-center bg-black/0
                                          text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white">
                                <i class="fas fa-camera" aria-hidden="true"></i>
                                <input type="file" id="cp-photo-input" accept="image/*" class="hidden">
                            </label>
                        </div>
                        <div class="flex-1">
                            <label for="cp-nombre" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                                Nombre del gimnasio
                            </label>
                            <input id="cp-nombre" type="text" class="field" placeholder="Ej: Boxing Club Valencia">
                        </div>
                    </div>

                    <!-- Contacto -->
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label for="cp-correo" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                                Correo de contacto
                            </label>
                            <input id="cp-correo" type="email" class="field" placeholder="info@gimnasio.com">
                        </div>
                        <div>
                            <label for="cp-telefono" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                                Teléfono
                            </label>
                            <input id="cp-telefono" type="text" class="field" placeholder="+34 600 000 000">
                        </div>
                    </div>

                    <!-- Instructor + días -->
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label for="cp-instructor" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                                Dueño / instructor principal
                            </label>
                            <input id="cp-instructor" type="text" class="field" placeholder="Nombre del entrenador">
                        </div>
                        <div>
                            <span class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Días de apertura</span>
                            <div id="cp-days" class="flex gap-1.5">
                                <?php foreach (['L', 'M', 'X', 'J', 'V', 'S', 'D'] as $i => $day): ?>
                                    <button type="button" data-day="<?= $i ?>"
                                            class="day-btn grid h-9 w-9 place-items-center rounded-full border
                                                   border-hairline text-sm font-bold text-muted transition-colors
                                                   aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white
                                                   dark:border-white/15 dark:text-white/60">
                                        <?= $day ?>
                                    </button>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>

                    <!-- Horario -->
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label for="cp-hora-apertura" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                                Hora de apertura
                            </label>
                            <input id="cp-hora-apertura" type="time" class="field" value="08:00">
                        </div>
                        <div>
                            <label for="cp-hora-cierre" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                                Hora de cierre
                            </label>
                            <input id="cp-hora-cierre" type="time" class="field" value="22:00">
                        </div>
                    </div>

                    <!-- Ubicación -->
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label for="cp-direccion" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                                Dirección
                            </label>
                            <input id="cp-direccion" type="text" class="field" placeholder="Calle, número">
                        </div>
                        <div>
                            <label for="cp-ciudad" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                                Ciudad
                            </label>
                            <input id="cp-ciudad" type="text" class="field" placeholder="Madrid">
                        </div>
                    </div>

                    <!-- Bio -->
                    <div>
                        <label for="cp-bio" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                            Biografía
                        </label>
                        <textarea id="cp-bio" rows="4" class="field resize-none"
                                  placeholder="Cuenta qué hace especial a tu gimnasio…"></textarea>
                    </div>

                    <!-- Galería -->
                    <div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold uppercase tracking-wide text-muted">Galería del gimnasio</span>
                            <label class="btn-ghost cursor-pointer px-3 py-1.5 text-xs">
                                <input type="file" id="cp-gallery-input" accept="image/*" multiple class="hidden">
                                <i class="fas fa-plus" aria-hidden="true"></i> Añadir fotos
                            </label>
                        </div>
                        <div id="cp-gallery" class="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4"></div>
                    </div>

                    <div class="flex justify-end border-t border-hairline pt-5 dark:border-white/10">
                        <button type="button" id="cp-save-gym" class="btn-primary">
                            <i class="fas fa-save" aria-hidden="true"></i> Guardar gimnasio
                        </button>
                    </div>
                </div>
            </section>

            <!-- ══ Pestaña: boxeadores ════════════════════════════════ -->
            <section id="cp-boxers-tab" hidden class="mt-6">
                <h2 class="text-xl">Tus boxeadores</h2>

                <div class="mt-4 flex flex-wrap gap-3">
                    <input id="cp-search" type="search" class="field flex-1" style="min-width:200px"
                           placeholder="Buscar boxeador…">
                    <div class="flex flex-1 gap-2" style="min-width:280px">
                        <input id="cp-assign" type="text" class="field flex-1" placeholder="Email o DNI para asignar">
                        <button type="button" id="cp-assign-add" class="btn-primary shrink-0">Añadir</button>
                        <button type="button" id="cp-assign-remove" class="btn-ghost shrink-0
                                                text-red-600 dark:text-red-400">Quitar</button>
                    </div>
                </div>

                <div id="cp-boxers-message" hidden class="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"></div>

                <div id="cp-boxers-list" class="mt-5 space-y-3"></div>
            </section>

            <!-- ══ Pestaña: pagos ═════════════════════════════════════ -->
            <section id="cp-payments-tab" hidden class="mt-6">
                <h2 class="text-xl">Pagos e ingresos</h2>

                <div id="cp-payments-skeleton" class="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    <?php for ($i = 0; $i < 5; $i++): ?>
                        <div class="skeleton h-44"></div>
                    <?php endfor; ?>
                </div>

                <div id="cp-payments-content" hidden>
                    <!-- Métricas -->
                    <div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                        <?php
                        $metrics = [
                            ['key' => 'gimnasio',    'icon' => 'fa-building',      'label' => 'Tu gimnasio'],
                            ['key' => 'boxeadores',  'icon' => 'fa-users',         'label' => 'Boxeadores activos'],
                            ['key' => 'pagos',       'icon' => 'fa-check-circle',  'label' => 'Pagos este mes'],
                            ['key' => 'ingresos',    'icon' => 'fa-sack-dollar',   'label' => 'Ingresos este mes'],
                            ['key' => 'cobros',      'icon' => 'fa-receipt',       'label' => 'Cobros'],
                        ];
                        foreach ($metrics as $m): ?>
                            <div class="card p-4" data-pmetric="<?= $m['key'] ?>">
                                <span class="flex items-center gap-2 text-xs font-semibold text-muted dark:text-white/60">
                                    <i class="fas <?= $m['icon'] ?> text-xs" aria-hidden="true"></i> <?= $m['label'] ?>
                                </span>
                                <div class="mt-2 flex justify-center">
                                    <div class="relative h-20 w-20">
                                        <canvas data-pmetric-canvas width="80" height="80"></canvas>
                                        <span data-pmetric-value
                                              class="absolute inset-0 grid place-items-center text-center text-sm font-black"></span>
                                    </div>
                                </div>
                                <p data-pmetric-sub class="mt-2 text-center text-xs text-muted dark:text-white/60"></p>
                            </div>
                        <?php endforeach; ?>
                    </div>

                    <!-- Precio mensual -->
                    <div class="card mt-6 p-5">
                        <h3 class="text-lg font-bold">Precio mensual</h3>
                        <p class="mt-1 text-sm text-muted dark:text-white/60">
                            Define el precio para el cálculo estimado de ingresos.
                        </p>
                        <div class="mt-4 flex max-w-md gap-3">
                            <input id="cp-price-input" type="number" min="0" step="0.01" class="field" placeholder="0.00 €">
                            <button type="button" id="cp-save-price" class="btn-primary shrink-0">Guardar</button>
                        </div>
                    </div>

                    <!-- Ingresos por inscripciones -->
                    <div class="card mt-6 p-5">
                        <h3 class="text-lg font-bold">Inscripciones (ingresos)</h3>
                        <div class="relative mt-4 h-64">
                            <canvas id="cp-revenue-chart"></canvas>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>

    <!-- ── Modal: confirmar pago ─────────────────────────────────── -->
    <dialog id="cp-pay-confirm"
            class="w-full max-w-sm rounded-panel bg-surface p-6 text-center text-body shadow-lift
                   backdrop:bg-black/60 dark:bg-night-soft dark:text-white">
        <form method="dialog">
            <i id="cp-pay-icon" class="fas fa-money-bill-wave text-4xl text-green-600" aria-hidden="true"></i>
            <h3 id="cp-pay-title" class="mt-4 text-lg font-bold">Confirmar pago</h3>
            <p id="cp-pay-text" class="mt-2 text-sm text-muted dark:text-white/60"></p>
            <div class="mt-6 flex gap-3">
                <button value="cancel" class="btn-ghost flex-1">Cancelar</button>
                <button value="confirm" class="btn-primary flex-1">Confirmar</button>
            </div>
        </form>
    </dialog>

    <!-- ── Modal: dar de baja (borrado permanente) ───────────────── -->
    <dialog id="cp-delete-confirm"
            class="w-full max-w-sm rounded-panel bg-surface p-6 text-center text-body shadow-lift
                   backdrop:bg-black/60 dark:bg-night-soft dark:text-white">
        <form method="dialog">
            <i class="fas fa-triangle-exclamation text-4xl text-red-500" aria-hidden="true"></i>
            <h3 class="mt-4 text-lg font-bold">Dar de baja a <span id="cp-delete-name"></span></h3>
            <p class="mt-2 text-sm text-muted dark:text-white/60">
                Esto borra permanentemente su cuenta de boxeador. No se puede deshacer.
            </p>
            <div class="mt-6 flex gap-3">
                <button value="cancel" class="btn-ghost flex-1">Cancelar</button>
                <button value="confirm"
                        class="flex-1 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white
                               transition-colors hover:bg-red-700">Sí, dar de baja</button>
            </div>
        </form>
    </dialog>
</div>
