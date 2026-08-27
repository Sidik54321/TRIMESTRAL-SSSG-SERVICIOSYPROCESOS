<?php

declare(strict_types=1);

/**
 * gyms.php — Listado de gimnasios. Sección de referencia de la migración.
 *
 * El marcado se sirve desde PHP con esqueletos de carga; los datos los pide
 * app/js/pages/gyms.js a /api/gimnasios y rellena la rejilla. El atributo
 * data-page le indica al router qué módulo debe cargar tras insertar la vista.
 */
?>
<div data-page="gyms">

    <!-- ── Cabecera de sección ───────────────────────────────────── -->
    <section class="relative overflow-hidden bg-ink px-6 py-14 text-white sm:py-20">
        <div class="absolute inset-0 opacity-20">
            <img src="/assets/images/Sparring_Club_Collection-Link-Image.jpg" alt=""
                 class="h-full w-full object-cover">
        </div>
        <div class="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-transparent"></div>

        <div class="relative mx-auto max-w-5xl">
            <h2 class="text-3xl sm:text-4xl">Encuentra tu gimnasio de boxeo</h2>
            <p class="mt-3 text-sm text-white/70">
                Explora los gimnasios registrados en GloveUp y únete al que mejor encaje contigo.
            </p>

            <div class="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
                <div class="relative flex-1">
                    <i class="fas fa-search pointer-events-none absolute left-4 top-1/2
                              -translate-y-1/2 text-faint" aria-hidden="true"></i>
                    <input type="search" id="gym-search"
                           class="field pl-11 text-body"
                           placeholder="Nombre del gimnasio, ciudad o código postal…"
                           autocomplete="off">
                </div>
                <button type="button" id="gym-search-btn" class="btn-primary shrink-0">
                    Buscar
                </button>
            </div>
        </div>
    </section>

    <!-- ── Contenido ─────────────────────────────────────────────── -->
    <div class="mx-auto max-w-7xl px-6 py-10">
        <div class="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">

            <!-- Filtros -->
            <aside class="lg:sticky lg:top-6 lg:self-start">
                <div class="card p-5">
                    <h3 class="flex items-center gap-2 text-sm uppercase tracking-wide">
                        <i class="fas fa-filter text-accent" aria-hidden="true"></i> Filtros
                    </h3>

                    <div class="mt-5 space-y-6">
                        <div>
                            <label for="gym-city"
                                   class="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
                                Ubicación
                            </label>
                            <!-- Las opciones se rellenan con las ciudades reales de la API -->
                            <select id="gym-city" class="field">
                                <option value="">Todas las ciudades</option>
                            </select>
                        </div>

                        <div>
                            <span class="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
                                Mostrar
                            </span>
                            <label class="flex cursor-pointer items-center gap-2 text-sm">
                                <input type="checkbox" id="gym-only-favs"
                                       class="h-4 w-4 accent-accent">
                                Sólo favoritos
                            </label>
                            <label class="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                                <input type="checkbox" id="gym-only-located"
                                       class="h-4 w-4 accent-accent">
                                Con ubicación en el mapa
                            </label>
                        </div>

                        <button type="button" id="gym-reset" class="btn-ghost w-full">
                            Limpiar filtros
                        </button>
                    </div>
                </div>

                <!-- El mapa Leaflet aún no está migrado (Fase 3) -->
                <a href="/legacy/gyms/index.html#mapa" target="_blank" rel="noopener"
                   class="card-interactive mt-4 flex items-center gap-3 p-4 text-sm">
                    <i class="fas fa-map-marked-alt text-lg text-accent" aria-hidden="true"></i>
                    <span>
                        <span class="block font-bold">Explorar en el mapa</span>
                        <span class="text-xs text-muted">Se abre la vista clásica</span>
                    </span>
                </a>
            </aside>

            <!-- Resultados -->
            <section>
                <div class="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 class="text-xl">Gimnasios</h3>
                    <p id="gym-count" class="text-sm text-muted" aria-live="polite"></p>
                </div>

                <!-- Gimnasio del usuario, si pertenece a alguno -->
                <div id="my-gym" hidden class="mt-6">
                    <p class="mb-3 flex items-center gap-2 text-xs font-bold uppercase
                              tracking-wide text-accent">
                        <i class="fas fa-map-marker-alt" aria-hidden="true"></i> Mi gimnasio
                    </p>
                    <div id="my-gym-card"></div>
                    <hr class="mt-6 border-hairline dark:border-white/10">
                </div>

                <!-- Esqueletos mientras responde la API -->
                <div id="gym-skeletons" class="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    <?php for ($i = 0; $i < 6; $i++): ?>
                        <div class="card overflow-hidden">
                            <div class="skeleton h-40 rounded-none"></div>
                            <div class="space-y-3 p-5">
                                <div class="skeleton h-5 w-3/4"></div>
                                <div class="skeleton h-4 w-1/2"></div>
                                <div class="skeleton h-4 w-full"></div>
                            </div>
                        </div>
                    <?php endfor; ?>
                </div>

                <div id="gym-grid" hidden class="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"></div>

                <!-- Estado vacío -->
                <div id="gym-empty" hidden class="card mt-6 p-12 text-center">
                    <i class="fas fa-building text-4xl text-faint" aria-hidden="true"></i>
                    <p class="mt-4 font-bold">No hay gimnasios que coincidan</p>
                    <p class="mt-1 text-sm text-muted">Prueba con otra búsqueda o limpia los filtros.</p>
                </div>

                <!-- Estado de error -->
                <div id="gym-error" hidden
                     class="mt-6 rounded-card border border-red-200 bg-red-50 p-6 text-center
                            dark:border-red-500/30 dark:bg-red-500/10">
                    <i class="fas fa-triangle-exclamation text-2xl text-red-500" aria-hidden="true"></i>
                    <p class="mt-3 font-bold text-red-700 dark:text-red-300">
                        No se han podido cargar los gimnasios
                    </p>
                    <p id="gym-error-msg" class="mt-1 text-sm text-red-600 dark:text-red-400"></p>
                    <button type="button" id="gym-retry" class="btn-ghost mt-5">Reintentar</button>
                </div>

                <nav id="gym-pagination" class="mt-8 flex justify-center gap-1"
                     aria-label="Paginación"></nav>
            </section>
        </div>
    </div>
</div>
