<?php

declare(strict_types=1);

/**
 * not-found.php — Respuesta 404 de la SPA.
 */
?>
<div class="grid min-h-screen place-items-center px-6 text-center">
    <div>
        <p class="font-display text-8xl font-black text-accent">404</p>
        <h2 class="mt-4 text-2xl">Aquí no hay nadie entrenando</h2>
        <p class="mt-3 text-sm text-muted dark:text-white/60">
            La página que buscas no existe o ha cambiado de sitio.
        </p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/" class="btn-primary">Volver al inicio</a>
            <a href="/gimnasios" class="btn-ghost">Ver gimnasios</a>
        </div>
    </div>
</div>
