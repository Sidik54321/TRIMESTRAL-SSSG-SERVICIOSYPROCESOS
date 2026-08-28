<?php

declare(strict_types=1);

/**
 * admin.php — Panel de administración.
 *
 * Ruta con shell "public" (ancho completo, sin el sidebar de boxeador o
 * entrenador): la audiencia es distinta y no tiene por qué tener una cuenta
 * de boxeador/entrenador. El acceso lo controla app/js/pages/admin.js con
 * una contraseña única (ADMIN_PASSWORD en el backend) que cambia por un
 * token de sesión de administrador — nada que ver con session.js, que sigue
 * gestionando sólo la sesión de boxeador/entrenador.
 *
 * Todo el marcado de datos (tarjetas de estadísticas, filas de tablas) lo
 * rellena admin.js tras autenticar; aquí sólo van los esqueletos y la
 * estructura de pestañas, igual que en coach-panel.php.
 */
?>
<div data-page="admin">
    <header class="border-b border-white/10 bg-ink px-6 py-4 text-white">
        <div class="mx-auto flex max-w-6xl items-center justify-between">
            <div class="flex items-center gap-2.5">
                <img src="/assets/images/unnamed-removebg-preview.png" alt=""
                     class="h-8 w-8 object-contain">
                <span class="font-display text-lg font-black">GloveUp <span class="text-accent">Admin</span></span>
            </div>
            <button type="button" id="admin-logout" hidden
                    class="btn-ghost bg-white/10 px-4 py-2 text-xs text-white hover:bg-white/20">
                <i class="fas fa-sign-out-alt" aria-hidden="true"></i> Cerrar sesión
            </button>
        </div>
    </header>

    <!-- ── Puerta de entrada: contraseña de administrador ─────────────── -->
    <div id="admin-login" class="grid min-h-[75vh] place-items-center px-6">
        <form id="admin-login-form" class="card w-full max-w-sm p-8 text-center">
            <span class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-2xl text-accent">
                <i class="fas fa-lock" aria-hidden="true"></i>
            </span>
            <h1 class="mt-5 text-2xl">Panel de administración</h1>
            <p class="mt-2 text-sm text-muted dark:text-white/60">
                Introduce la contraseña de administrador para continuar.
            </p>

            <div id="admin-login-error" hidden
                 class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700
                        dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"></div>

            <input type="password" id="admin-password" required autocomplete="current-password"
                   placeholder="Contraseña"
                   class="field mt-5 text-center">

            <button type="submit" id="admin-login-submit" class="btn-primary mt-5 w-full">
                Entrar
            </button>
        </form>
    </div>

    <!-- ── Panel ────────────────────────────────────────────────────── -->
    <div id="admin-panel" hidden class="mx-auto max-w-6xl px-6 py-8">

        <div id="admin-message" hidden class="mb-4 rounded-xl px-4 py-3 text-sm font-semibold"></div>

        <div class="flex gap-6 border-b border-hairline dark:border-white/10">
            <button type="button" data-tab="resumen" aria-pressed="true"
                    class="tab-underline flex items-center gap-2 pb-3 text-sm font-bold text-muted
                           aria-pressed:border-accent aria-pressed:text-accent dark:text-white/60">
                <i class="fas fa-chart-simple" aria-hidden="true"></i> Resumen
            </button>
            <button type="button" data-tab="usuarios"
                    class="tab-underline flex items-center gap-2 pb-3 text-sm font-bold text-muted
                           aria-pressed:border-accent aria-pressed:text-accent dark:text-white/60">
                <i class="fas fa-users" aria-hidden="true"></i> Usuarios
            </button>
            <button type="button" data-tab="gimnasios"
                    class="tab-underline flex items-center gap-2 pb-3 text-sm font-bold text-muted
                           aria-pressed:border-accent aria-pressed:text-accent dark:text-white/60">
                <i class="fas fa-building" aria-hidden="true"></i> Gimnasios
            </button>
        </div>

        <!-- ══ Resumen ═══════════════════════════════════════════════ -->
        <section id="admin-resumen-tab" class="mt-6">
            <div id="admin-stats-skeleton" class="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <?php for ($i = 0; $i < 6; $i++): ?>
                    <div class="card p-5"><div class="skeleton h-14"></div></div>
                <?php endfor; ?>
            </div>

            <div id="admin-stats" hidden class="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <?php
                $cards = [
                    ['key' => 'usuarios',            'icon' => 'fa-users',        'label' => 'Usuarios'],
                    ['key' => 'boxeadores',          'icon' => 'fa-user',         'label' => 'Boxeadores'],
                    ['key' => 'entrenadores',        'icon' => 'fa-user-tie',     'label' => 'Entrenadores'],
                    ['key' => 'gimnasios',           'icon' => 'fa-building',     'label' => 'Gimnasios'],
                    ['key' => 'retosEnviados',       'icon' => 'fa-fist-raised',  'label' => 'Retos enviados'],
                    ['key' => 'sparringsCompletados','icon' => 'fa-trophy',       'label' => 'Sparrings completados'],
                ];
                foreach ($cards as $c): ?>
                    <div class="card p-5" data-stat="<?= htmlspecialchars($c['key'], ENT_QUOTES) ?>">
                        <span class="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
                            <i class="fas <?= htmlspecialchars($c['icon'], ENT_QUOTES) ?>" aria-hidden="true"></i>
                        </span>
                        <p data-stat-value class="mt-3 text-2xl font-black">0</p>
                        <p class="text-xs font-semibold text-muted dark:text-white/60">
                            <?= htmlspecialchars($c['label'], ENT_QUOTES) ?>
                        </p>
                    </div>
                <?php endforeach; ?>
            </div>

            <div class="card mt-6 p-6">
                <h3 class="text-sm font-bold uppercase tracking-wide text-muted dark:text-white/60">
                    Altas de usuario (últimos 6 meses)
                </h3>
                <div class="mt-4 h-56">
                    <canvas id="admin-growth-chart"></canvas>
                </div>
            </div>
        </section>

        <!-- ══ Usuarios ══════════════════════════════════════════════ -->
        <section id="admin-usuarios-tab" hidden class="mt-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="relative max-w-xs flex-1">
                    <i class="fas fa-search pointer-events-none absolute left-4 top-1/2
                              -translate-y-1/2 text-faint" aria-hidden="true"></i>
                    <input type="search" id="admin-users-search" class="field pl-11"
                           placeholder="Buscar por nombre o email…" autocomplete="off">
                </div>
                <button type="button" id="admin-create-user-btn" class="btn-primary">
                    <i class="fas fa-plus" aria-hidden="true"></i> Crear usuario
                </button>
            </div>

            <div id="admin-users-skeleton" class="mt-5 space-y-2">
                <?php for ($i = 0; $i < 5; $i++): ?><div class="skeleton h-14"></div><?php endfor; ?>
            </div>

            <div class="mt-5 overflow-x-auto">
                <table id="admin-users-table" hidden class="w-full text-left text-sm">
                    <thead>
                        <tr class="border-b border-hairline text-xs uppercase tracking-wide text-muted dark:border-white/10 dark:text-white/50">
                            <th class="py-2 pr-3 font-bold">Nombre</th>
                            <th class="py-2 pr-3 font-bold">Email</th>
                            <th class="py-2 pr-3 font-bold">Rol</th>
                            <th class="py-2 pr-3 font-bold">Gimnasio</th>
                            <th class="py-2 pr-3 font-bold">Alta</th>
                            <th class="py-2 pr-3 font-bold"></th>
                        </tr>
                    </thead>
                    <tbody id="admin-users-body" class="divide-y divide-hairline dark:divide-white/10"></tbody>
                </table>
            </div>

            <p id="admin-users-empty" hidden class="card mt-5 p-10 text-center text-sm text-muted dark:text-white/60">
                No hay usuarios que coincidan con la búsqueda.
            </p>
        </section>

        <!-- ══ Gimnasios ═════════════════════════════════════════════ -->
        <section id="admin-gimnasios-tab" hidden class="mt-6">
            <div class="relative max-w-xs">
                <i class="fas fa-search pointer-events-none absolute left-4 top-1/2
                          -translate-y-1/2 text-faint" aria-hidden="true"></i>
                <input type="search" id="admin-gyms-search" class="field pl-11"
                       placeholder="Buscar por nombre o ciudad…" autocomplete="off">
            </div>

            <div id="admin-gyms-skeleton" class="mt-5 space-y-2">
                <?php for ($i = 0; $i < 5; $i++): ?><div class="skeleton h-14"></div><?php endfor; ?>
            </div>

            <div class="mt-5 overflow-x-auto">
                <table id="admin-gyms-table" hidden class="w-full text-left text-sm">
                    <thead>
                        <tr class="border-b border-hairline text-xs uppercase tracking-wide text-muted dark:border-white/10 dark:text-white/50">
                            <th class="py-2 pr-3 font-bold">Nombre</th>
                            <th class="py-2 pr-3 font-bold">Ciudad</th>
                            <th class="py-2 pr-3 font-bold">Creado por</th>
                            <th class="py-2 pr-3 font-bold"></th>
                        </tr>
                    </thead>
                    <tbody id="admin-gyms-body" class="divide-y divide-hairline dark:divide-white/10"></tbody>
                </table>
            </div>

            <p id="admin-gyms-empty" hidden class="card mt-5 p-10 text-center text-sm text-muted dark:text-white/60">
                No hay gimnasios que coincidan con la búsqueda.
            </p>
        </section>
    </div>

    <!-- ── Modal: crear usuario ────────────────────────────────────── -->
    <dialog id="admin-create-modal"
            class="w-full max-w-md rounded-panel bg-surface p-0 text-body shadow-lift
                   backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:bg-night-soft dark:text-white">
        <form id="admin-create-form" method="dialog" novalidate>
            <header class="flex items-center justify-between border-b border-hairline px-6 py-4 dark:border-white/10">
                <h3 class="text-lg font-bold">Crear usuario</h3>
                <button type="button" data-modal-close aria-label="Cerrar"
                        class="grid h-9 w-9 place-items-center rounded-full text-muted
                               transition-colors hover:bg-sunken dark:hover:bg-white/10">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </header>

            <div class="space-y-4 px-6 py-5">
                <div id="admin-create-error" hidden
                     class="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700
                            dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"></div>

                <div>
                    <label for="admin-create-rol" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Rol</label>
                    <select id="admin-create-rol" class="field" required>
                        <option value="boxeador">Boxeador</option>
                        <option value="entrenador">Entrenador</option>
                    </select>
                </div>
                <div>
                    <label for="admin-create-nombre" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Nombre</label>
                    <input type="text" id="admin-create-nombre" class="field" required>
                </div>
                <div>
                    <label for="admin-create-email" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Email</label>
                    <input type="email" id="admin-create-email" class="field" required>
                </div>
                <div>
                    <label for="admin-create-password" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Contraseña</label>
                    <input type="text" id="admin-create-password" class="field" required
                           placeholder="Mín. 8 caracteres, 1 mayúscula y 1 número">
                </div>
                <div>
                    <label for="admin-create-dni" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">DNI / Licencia</label>
                    <input type="text" id="admin-create-dni" class="field" required>
                </div>
                <div>
                    <label for="admin-create-gimnasio" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Gimnasio (opcional)</label>
                    <input type="text" id="admin-create-gimnasio" class="field">
                </div>
            </div>

            <footer class="flex justify-end gap-3 border-t border-hairline px-6 py-4 dark:border-white/10">
                <button type="button" data-modal-close class="btn-ghost">Cancelar</button>
                <button type="submit" id="admin-create-submit" class="btn-primary">Crear</button>
            </footer>
        </form>
    </dialog>

    <!-- ── Modal: confirmar borrado (usuarios y gimnasios) ────────────── -->
    <dialog id="admin-confirm-modal"
            class="w-full max-w-sm rounded-panel bg-surface p-6 text-body shadow-lift
                   backdrop:bg-black/60 dark:bg-night-soft dark:text-white">
        <h3 class="text-lg font-bold">¿Eliminar?</h3>
        <p id="admin-confirm-text" class="mt-2 text-sm text-muted dark:text-white/60">
            Esta acción no se puede deshacer.
        </p>
        <div class="mt-6 flex justify-end gap-3">
            <button type="button" data-modal-close class="btn-ghost">Cancelar</button>
            <button type="button" id="admin-confirm-ok"
                    class="btn-primary bg-red-600 hover:bg-red-700">Eliminar</button>
        </div>
    </dialog>
</div>
