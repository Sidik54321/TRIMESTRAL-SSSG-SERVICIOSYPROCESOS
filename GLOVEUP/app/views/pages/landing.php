<?php

declare(strict_types=1);

/**
 * landing.php — Página pública de entrada.
 *
 * Migración de home/home.html a Tailwind. Mantiene el mismo contenido y el
 * modal que invita a iniciar sesión al pulsar cualquier acción, ahora con
 * el atributo data-login-trigger que gestiona app.js.
 */

$comoFunciona = [
    ['icon' => 'fa-search',       'title' => 'Busca',    'text' => 'Encuentra perfiles según nivel, peso y ubicación.'],
    ['icon' => 'fa-comments',     'title' => 'Contacta', 'text' => 'Envía mensajes directos a tus sparrings potenciales.'],
    ['icon' => 'fa-fist-raised',  'title' => 'Entrena',  'text' => 'Coordina tus sesiones y ¡sube al ring!'],
];

$testimonios = [
    ['img' => 'alexJP.jpg', 'nombre' => 'Alejandro "Sanchez"', 'texto' => 'GloveUp me ayudó a encontrar un compañero de sparring avanzado cerca de casa. ¡Mi boxeo ha mejorado muchísimo!'],
    ['img' => 'ibrajp.jpg', 'nombre' => 'Ibrahim "Mohamed"',   'texto' => 'Soy nueva en el Muay Thai y GloveUp fue la clave para encontrar gente de mi nivel para practicar. ¡Totalmente recomendable!'],
    ['img' => 'umarjp.jpg', 'nombre' => 'Umar "Muniru"',       'texto' => 'Prepararme para mi última competición fue mucho más fácil gracias a GloveUp. Conecté con atletas serios y dedicados.'],
];
?>

<!-- ── Hero ──────────────────────────────────────────────────────── -->
<section class="relative grid min-h-[85vh] place-items-center overflow-hidden">
    <video autoplay muted loop playsinline
           poster="/assets/images/Sparring_Club_Collection-Link-Image.jpg"
           class="absolute inset-0 h-full w-full object-cover">
        <source src="/assets/videos/4761706-uhd_4096_2160_25fps.mp4" type="video/mp4">
        <source src="/assets/videos/videoplayback.webm" type="video/webm">
    </video>

    <!-- Velo que garantiza contraste del texto sobre el vídeo -->
    <div class="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80"></div>

    <div class="relative mx-auto max-w-4xl px-6 text-center text-white">
        <h1 class="text-5xl font-black uppercase leading-none sm:text-7xl lg:text-8xl">
            Find your fight
        </h1>
        <p class="mx-auto mt-6 max-w-xl text-lg text-white/80">
            Encuentra compañeros de sparring de tu nivel, disciplina y ciudad.
        </p>
        <a href="/sparring" data-login-trigger class="btn-primary mt-10">
            Encuentra tu partner
        </a>
    </div>
</section>

<!-- ── Sobre nosotros ────────────────────────────────────────────── -->
<section class="bg-canvas py-20 dark:bg-night sm:py-28">
    <div class="mx-auto max-w-6xl px-6">
        <div class="grid items-center gap-12 lg:grid-cols-2">
            <div>
                <h2 class="text-3xl uppercase sm:text-4xl">Sobre nosotros</h2>
                <p class="mt-6 text-base leading-relaxed text-muted dark:text-white/70">
                    GloveUp es la plataforma definitiva para conectar a entusiastas y
                    profesionales de los deportes de combate. Nuestro objetivo es crear una
                    comunidad donde sea fácil encontrar compañeros de sparring que se ajusten
                    a tu nivel, disciplina y ubicación. Ya sea que busques mejorar tus
                    habilidades, prepararte para una competición o simplemente disfrutar de un
                    buen entrenamiento, GloveUp te pone en contacto con la persona adecuada.
                </p>
                <a href="/gimnasios" class="btn-ghost mt-8">Descubre más</a>
            </div>

            <img src="/assets/images/Sparring_Club_Collection-Link-Image.jpg"
                 alt="Gimnasio de boxeo" loading="lazy"
                 class="aspect-4/3 w-full rounded-panel object-cover shadow-lift">
        </div>

        <!-- Cómo funciona -->
        <h2 class="mt-24 text-center text-3xl uppercase sm:text-4xl">Cómo funciona</h2>

        <div class="mt-12 grid gap-6 sm:grid-cols-3">
            <?php foreach ($comoFunciona as $paso): ?>
                <a href="/sparring" data-login-trigger
                   class="card-interactive group flex flex-col items-center p-8 text-center">
                    <span class="grid h-16 w-16 place-items-center rounded-full
                                 bg-accent-soft text-2xl text-accent
                                 transition-transform duration-250 group-hover:scale-110">
                        <i class="fas <?= htmlspecialchars($paso['icon'], ENT_QUOTES) ?>" aria-hidden="true"></i>
                    </span>
                    <h3 class="mt-6 text-xl"><?= htmlspecialchars($paso['title'], ENT_QUOTES) ?></h3>
                    <p class="mt-2 text-sm text-muted dark:text-white/60">
                        <?= htmlspecialchars($paso['text'], ENT_QUOTES) ?>
                    </p>
                </a>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<!-- ── Testimonios ───────────────────────────────────────────────── -->
<section class="bg-sunken py-20 dark:bg-night-soft sm:py-28">
    <div class="mx-auto max-w-6xl px-6">
        <h2 class="text-center text-3xl uppercase sm:text-4xl">Testimonios</h2>

        <div class="mt-12 grid gap-6 sm:grid-cols-3">
            <?php foreach ($testimonios as $t): ?>
                <figure class="card flex flex-col items-center p-8 text-center">
                    <img src="/assets/images/<?= htmlspecialchars($t['img'], ENT_QUOTES) ?>"
                         alt="" loading="lazy"
                         class="h-20 w-20 rounded-full object-cover ring-4 ring-accent-soft">
                    <blockquote class="mt-6 text-sm leading-relaxed text-muted dark:text-white/70">
                        “<?= htmlspecialchars($t['texto'], ENT_QUOTES) ?>”
                    </blockquote>
                    <figcaption class="mt-4 text-sm font-bold text-accent">
                        <?= htmlspecialchars($t['nombre'], ENT_QUOTES) ?>
                    </figcaption>
                </figure>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<!-- ── Llamada a la acción ───────────────────────────────────────── -->
<section class="bg-ink py-20 text-center text-white sm:py-24">
    <div class="mx-auto max-w-2xl px-6">
        <h2 class="text-3xl sm:text-4xl">¿Listo para unirte a la comunidad?</h2>
        <a href="/sparring" data-login-trigger class="btn-primary mt-8">¡Únete ahora!</a>
    </div>
</section>

<!-- ── Pie ───────────────────────────────────────────────────────── -->
<footer class="bg-night py-10 text-white/60">
    <div class="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6
                sm:flex-row sm:justify-between">
        <p class="text-sm">&copy; 2025 GloveUp. Todos los derechos reservados.</p>
        <nav class="flex gap-6 text-sm">
            <a href="/legacy/onboarding/faq.html" class="transition-colors hover:text-white">Preguntas frecuentes</a>
            <a href="#" class="transition-colors hover:text-white">Privacidad</a>
            <a href="#" class="transition-colors hover:text-white">Contacto</a>
        </nav>
    </div>
</footer>

<!-- ── Modal de inicio de sesión ─────────────────────────────────── -->
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
