<?php

declare(strict_types=1);

/**
 * landing.php — Página pública de entrada.
 *
 * Rediseño dinámico (titular animado, orbes en el hero, revelado al hacer
 * scroll y microinteracciones) manteniendo el contenido y las imágenes
 * reales del sitio. El revelado lo activa app/js/pages/landing.js sobre los
 * elementos con la clase .reveal; el resto de las animaciones son CSS puro
 * (ver la sección "Landing pública" de app/css/tailwind.css) para que el
 * hero no dependa de JavaScript.
 *
 * Gimnasios y Sparring ya se pueden explorar sin cuenta (ver
 * app/js/app.js), así que todos los CTA de "probar/explorar" —el botón
 * "Probar la app" de la cabecera, "Entra y observa la app" y "Ver
 * gimnasios" del hero, y las tarjetas de "Cómo funciona"— enlazan de
 * verdad a /sparring o /gimnasios en vez de abrir el modal de login: quien
 * no tenga sesión sólo lo verá al intentar retar a alguien, ver un perfil o
 * la ficha de un gimnasio. "Iniciar sesión" (cabecera) y el CTA final
 * "¡Únete ahora!" sí llevan data-login-trigger a propósito — son para quien
 * ya quiere entrar con su cuenta o crear una, no para explorar. El modal en
 * sí vive en layout/login-modal.php, fuera de esta vista, y lo controla
 * app/js/login-modal.js.
 */

$disciplinas = ['Boxeo', 'Muay Thai', 'MMA', 'Kickboxing'];

$porQue = [
    ['icon' => 'fa-sliders',        'title' => 'Filtra a tu medida',   'text' => 'Por nivel, categoría de peso y ubicación: sólo sparrings que encajan contigo.'],
    ['icon' => 'fa-comments',       'title' => 'Contacto directo',     'text' => 'Sin intermediarios: reta a sparring y habla con la otra persona al instante.'],
    ['icon' => 'fa-calendar-check', 'title' => 'Todo coordinado',      'text' => 'Cada sesión aceptada entra sola en tu calendario, lista para entrenar.'],
];

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
<div data-page="landing">

    <!-- ── Cabecera ──────────────────────────────────────────────────── -->
    <header class="sticky top-0 z-40 border-b border-white/10 bg-ink/80 backdrop-blur-lg">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <a href="/" class="flex items-center gap-2.5">
                <img src="/assets/images/unnamed-removebg-preview.png" alt=""
                     class="h-8 w-8 object-contain transition-transform duration-300 hover:-rotate-6 hover:scale-110">
                <span class="font-display text-lg font-black text-white">GloveUp</span>
            </a>

            <nav class="hidden items-center gap-8 sm:flex">
                <a href="/gimnasios" class="landing-nav-link">Gimnasios</a>
                <a href="#como-funciona" class="landing-nav-link">Cómo funciona</a>
                <a href="#testimonios" class="landing-nav-link">Testimonios</a>
            </nav>

            <div class="hidden items-center gap-4 sm:flex">
                <button type="button" data-login-trigger class="landing-nav-link">Iniciar sesión</button>
                <a href="/sparring" class="btn-primary px-5 py-2.5 text-xs">Probar la app</a>
            </div>
        </div>
    </header>

    <!-- ── Hero ──────────────────────────────────────────────────────── -->
    <section class="relative grid min-h-[88vh] place-items-center overflow-hidden bg-ink">
        <video autoplay muted loop playsinline
               poster="/assets/images/Sparring_Club_Collection-Link-Image.jpg"
               class="absolute inset-0 h-full w-full object-cover opacity-60">
            <source src="/assets/videos/4761706-uhd_4096_2160_25fps.mp4" type="video/mp4">
            <source src="/assets/videos/videoplayback.webm" type="video/webm">
        </video>

        <!-- Orbes decorativos: dan profundidad sin tapar el vídeo -->
        <div class="hero-orb hero-orb--a -left-24 -top-24 h-96 w-96" aria-hidden="true"></div>
        <div class="hero-orb hero-orb--b -bottom-24 -right-16 h-72 w-72" aria-hidden="true"></div>

        <!-- Velo que garantiza contraste del texto sobre el vídeo -->
        <div class="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/65 to-ink"></div>

        <div class="relative mx-auto max-w-3xl px-6 text-center text-white">
            <span class="hero-fade hero-fade--1 inline-flex items-center gap-2 rounded-full
                         border border-accent/40 bg-accent-soft px-4 py-1.5
                         text-[0.7rem] font-extrabold uppercase tracking-widest text-accent">
                <span class="hero-kicker-dot" aria-hidden="true"></span>
                La plataforma de sparring
            </span>

            <h1 class="mt-6 text-5xl font-black uppercase leading-none sm:text-7xl lg:text-8xl">
                <span class="hero-word hero-word--1">Find</span>
                <span class="hero-word hero-word--2">your</span>
                <span class="hero-word hero-word--3">fight</span>
            </h1>

            <p class="hero-fade hero-fade--2 mx-auto mt-6 max-w-xl text-lg text-white/80">
                Encuentra compañeros de sparring de tu nivel, disciplina y ciudad.
            </p>

            <div class="hero-fade hero-fade--3 mt-10 flex flex-wrap items-center justify-center gap-3">
                <a href="/sparring" class="btn-primary">
                    <i class="fas fa-eye" aria-hidden="true"></i> Entra y observa la app
                </a>
                <a href="/gimnasios" class="btn-secondary">Ver gimnasios</a>
            </div>

            <p class="hero-fade hero-fade--3 mt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                Sin necesidad de crear cuenta
            </p>

            <div class="hero-fade hero-fade--4 mt-10 flex flex-wrap justify-center gap-2.5">
                <?php foreach ($disciplinas as $d): ?>
                    <span class="hero-chip"><?= htmlspecialchars($d, ENT_QUOTES) ?></span>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="hero-fade hero-fade--4 absolute inset-x-0 bottom-7 flex flex-col items-center gap-2 text-white/40">
            <span class="text-[0.65rem] font-bold uppercase tracking-widest">Descubre más</span>
            <span class="scroll-cue-line" aria-hidden="true"></span>
        </div>
    </section>

    <!-- ── Por qué GloveUp ──────────────────────────────────────────── -->
    <section class="bg-ink py-16 text-white sm:py-20">
        <div class="mx-auto grid max-w-6xl gap-x-6 gap-y-10 px-6 sm:grid-cols-3">
            <?php foreach ($porQue as $i => $item): ?>
                <div class="reveal <?= $i === 1 ? 'reveal-delay-1' : ($i === 2 ? 'reveal-delay-2' : '') ?>
                            flex items-start gap-4">
                    <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-lg text-accent">
                        <i class="fas <?= htmlspecialchars($item['icon'], ENT_QUOTES) ?>" aria-hidden="true"></i>
                    </span>
                    <div>
                        <h3 class="text-base font-bold"><?= htmlspecialchars($item['title'], ENT_QUOTES) ?></h3>
                        <p class="mt-1.5 text-sm leading-relaxed text-white/60">
                            <?= htmlspecialchars($item['text'], ENT_QUOTES) ?>
                        </p>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>

    <!-- ── Sobre nosotros ────────────────────────────────────────────── -->
    <section class="bg-canvas py-20 dark:bg-night sm:py-28">
        <div class="mx-auto max-w-6xl px-6">
            <div class="grid items-center gap-12 lg:grid-cols-2">
                <div class="reveal">
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

                <div class="reveal reveal-delay-1 relative">
                    <img src="/assets/images/Sparring_Club_Collection-Link-Image.jpg"
                         alt="Gimnasio de boxeo" loading="lazy"
                         class="aspect-4/3 w-full rounded-panel object-cover shadow-lift
                                transition-transform duration-500 hover:scale-[1.03]">

                    <div class="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl
                                bg-ink/80 px-4 py-3 text-white shadow-float backdrop-blur">
                        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                            <i class="fas fa-trophy" aria-hidden="true"></i>
                        </span>
                        <div class="leading-tight">
                            <p class="text-sm font-black">Nivel real</p>
                            <p class="text-[0.7rem] text-white/60">Emparejado por experiencia</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Cómo funciona -->
            <div id="como-funciona" class="scroll-mt-24">
                <h2 class="reveal mt-24 text-center text-3xl uppercase sm:text-4xl">Cómo funciona</h2>

                <div class="relative mt-14">
                    <div class="how-connector" aria-hidden="true"></div>

                    <div class="grid gap-6 sm:grid-cols-3">
                        <?php foreach ($comoFunciona as $i => $paso): ?>
                            <a href="/sparring"
                               class="card-interactive reveal <?= $i === 1 ? 'reveal-delay-1' : ($i === 2 ? 'reveal-delay-2' : '') ?>
                                      group relative flex flex-col items-center p-8 text-center">
                                <span class="absolute right-5 top-4 font-display text-3xl font-black
                                             text-hairline-strong/40 dark:text-white/10">
                                    0<?= $i + 1 ?>
                                </span>
                                <span class="grid h-16 w-16 place-items-center rounded-full
                                             bg-accent-soft text-2xl text-accent
                                             transition-all duration-300
                                             group-hover:-rotate-6 group-hover:scale-110
                                             group-hover:bg-accent group-hover:text-white">
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
            </div>
        </div>
    </section>

    <!-- ── Testimonios ───────────────────────────────────────────────── -->
    <section id="testimonios" class="scroll-mt-24 bg-sunken py-20 dark:bg-night-soft sm:py-28">
        <div class="mx-auto max-w-6xl px-6">
            <h2 class="reveal text-center text-3xl uppercase sm:text-4xl">Testimonios</h2>

            <div class="mt-12 grid gap-6 sm:grid-cols-3">
                <?php foreach ($testimonios as $i => $t): ?>
                    <figure class="card reveal <?= $i === 1 ? 'reveal-delay-1' : ($i === 2 ? 'reveal-delay-2' : '') ?>
                                    flex flex-col items-center p-8 text-center
                                    transition-transform duration-300 hover:-translate-y-1.5">
                        <div class="flex gap-1 text-accent" aria-hidden="true">
                            <?php for ($s = 0; $s < 5; $s++): ?>
                                <i class="fas fa-star text-xs"></i>
                            <?php endfor; ?>
                        </div>

                        <img src="/assets/images/<?= htmlspecialchars($t['img'], ENT_QUOTES) ?>"
                             alt="" loading="lazy"
                             class="mt-4 h-20 w-20 rounded-full object-cover ring-4 ring-accent-soft">
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
    <section class="relative overflow-hidden bg-ink py-20 text-center text-white sm:py-24">
        <div class="cta-stripes" aria-hidden="true"></div>
        <div class="reveal relative mx-auto max-w-2xl px-6">
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

</div>
