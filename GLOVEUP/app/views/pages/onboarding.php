<?php

declare(strict_types=1);

/**
 * onboarding.php — Primeros Pasos.
 *
 * La checklist en sí (qué pasos hay, cuáles están hechos) depende del rol y
 * de llamadas a la API, así que vive entera en onboarding.js. Aquí sólo el
 * andamiaje: cabecera, contenedor con esqueleto de carga, y la fila de
 * enlaces de ayuda.
 */
?>
<div data-page="onboarding">
    <div class="mx-auto max-w-4xl px-6 py-8">

        <!-- Cabecera -->
        <div class="relative overflow-hidden rounded-panel bg-gradient-to-br from-ink via-night-soft to-accent p-10 text-white">
            <i class="fas fa-fist-raised pointer-events-none absolute right-8 top-1/2 -translate-y-1/2
                      text-8xl opacity-10" aria-hidden="true"></i>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-accent/25 px-3 py-1
                         text-xs font-bold uppercase tracking-wide text-orange-200 ring-1 ring-accent/50">
                <i class="fas fa-rocket" aria-hidden="true"></i> Bienvenido a GloveUp
            </span>
            <h2 class="mt-4 text-3xl">Tus primeros pasos</h2>
            <p class="mt-2 max-w-lg text-sm text-white/75">
                Completa la configuración inicial para disfrutar al máximo de la plataforma.
                Cada paso te acerca más a tu próximo sparring.
            </p>
        </div>

        <!-- Checklist -->
        <div data-onboarding-root class="mt-8">
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold uppercase tracking-wide text-muted">Tu progreso</span>
                <div class="skeleton h-2.5 flex-1 rounded-full"></div>
                <span class="skeleton h-4 w-10"></span>
            </div>
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
                <?php for ($i = 0; $i < 4; $i++): ?>
                    <div class="skeleton h-36"></div>
                <?php endfor; ?>
            </div>
        </div>

        <!-- Ayuda adicional -->
        <div class="mt-10 grid gap-4 sm:grid-cols-2">
            <a data-manual="boxeador" href="/legacy/onboarding/manual-boxeador.html" target="_blank" rel="noopener"
               hidden class="card-interactive flex items-start gap-4 p-5">
                <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-lg text-accent">
                    <i class="fas fa-book-open" aria-hidden="true"></i>
                </span>
                <span>
                    <span class="block font-bold">Manual del Boxeador</span>
                    <span class="mt-0.5 block text-sm text-muted dark:text-white/60">
                        Aprende a usar todas las funcionalidades diseñadas para ti.
                    </span>
                </span>
            </a>

            <a data-manual="entrenador" href="/legacy/onboarding/manual-entrenador.html" target="_blank" rel="noopener"
               hidden class="card-interactive flex items-start gap-4 p-5">
                <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-lg text-accent">
                    <i class="fas fa-chalkboard-teacher" aria-hidden="true"></i>
                </span>
                <span>
                    <span class="block font-bold">Manual del Entrenador</span>
                    <span class="mt-0.5 block text-sm text-muted dark:text-white/60">
                        Gestiona tu gimnasio, boxeadores y sparrings de forma profesional.
                    </span>
                </span>
            </a>

            <a href="/sparring" class="card-interactive flex items-start gap-4 p-5">
                <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-lg text-accent">
                    <i class="fas fa-search" aria-hidden="true"></i>
                </span>
                <span>
                    <span class="block font-bold">Encontrar sparring</span>
                    <span class="mt-0.5 block text-sm text-muted dark:text-white/60">
                        Busca por nivel, peso y ubicación a tu próximo rival.
                    </span>
                </span>
            </a>

            <a href="/gimnasios" class="card-interactive flex items-start gap-4 p-5">
                <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-lg text-accent">
                    <i class="fas fa-map-marked-alt" aria-hidden="true"></i>
                </span>
                <span>
                    <span class="block font-bold">Mapa de gimnasios</span>
                    <span class="mt-0.5 block text-sm text-muted dark:text-white/60">
                        Encuentra instalaciones de boxeo cerca de tu ubicación.
                    </span>
                </span>
            </a>
        </div>
    </div>
</div>
