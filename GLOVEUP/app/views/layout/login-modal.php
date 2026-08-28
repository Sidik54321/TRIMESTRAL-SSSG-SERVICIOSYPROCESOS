<?php

declare(strict_types=1);

/**
 * login-modal.php — Modal de "inicia sesión o crea tu cuenta".
 *
 * Vive en el shell, fuera de #app-view, para estar disponible tanto en la
 * landing pública como en las páginas explorables sin cuenta (Gimnasios,
 * Sparring): así persiste entre navegaciones igual que el sidebar y no hay
 * que insertarlo en cada vista. Lo abre app/js/login-modal.js, activado por
 * dos atributos declarativos: data-login-trigger (siempre) y data-guest-lock
 * (sólo cuando no hay sesión, ver app/js/app.js).
 */
?>
<div id="login-modal" hidden class="fixed inset-0 z-50 grid place-items-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" data-modal-close></div>

    <div role="dialog" aria-modal="true" aria-labelledby="login-modal-title"
         class="relative w-full max-w-md rounded-panel bg-surface p-8 text-center
                shadow-lift dark:bg-night-soft">
        <button type="button" data-modal-close aria-label="Cerrar"
                class="absolute right-4 top-4 grid h-9 w-9 place-items-center
                       rounded-full text-muted transition-colors hover:bg-sunken
                       dark:hover:bg-white/10">
            <i class="fas fa-times" aria-hidden="true"></i>
        </button>

        <h3 id="login-modal-title" class="text-2xl">Inicia sesión en GloveUp</h3>
        <p class="mt-3 text-sm text-muted dark:text-white/60">
            Para continuar, inicia sesión o crea tu cuenta gratuita.
        </p>

        <div class="mt-8 flex flex-col gap-3">
            <a href="/legacy/auth/index.html" class="btn-primary">Iniciar sesión</a>
            <a href="/legacy/auth/index.html" class="btn-ghost">Crear cuenta</a>
        </div>
    </div>
</div>
