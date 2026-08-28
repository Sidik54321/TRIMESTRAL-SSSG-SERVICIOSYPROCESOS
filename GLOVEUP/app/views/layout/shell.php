<?php

declare(strict_types=1);

use GloveUp\View;

/**
 * shell.php — Documento HTML completo de la SPA.
 *
 * Se renderiza sólo en la primera carga. A partir de ahí el router del
 * cliente sustituye únicamente el contenido de #app-view, así que todo lo
 * que hay aquí (sidebar, topbar, scripts) persiste entre navegaciones.
 *
 * @var string      $title   Título del documento
 * @var string|null $nav     Elemento activo del menú
 * @var string      $shell   "app" (con sidebar) o "public" (a ancho completo)
 * @var string      $content HTML de la vista
 * @var View        $view
 */

$isApp = $shell === 'app';
?>
<!DOCTYPE html>
<html lang="es" class="<?= $isApp ? 'h-full' : '' ?>">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= View::e($title) ?></title>

    <link rel="icon" href="/assets/images/logo-fondo-blanco.jpg">

    <!-- Tema oscuro aplicado antes del primer pintado para evitar el parpadeo
         blanco al recargar. Debe ir antes de la hoja de estilos. -->
    <script>
        (function () {
            try {
                if (localStorage.getItem('gloveup_theme') === 'dark') {
                    document.documentElement.classList.add('theme-dark');
                }
                if (localStorage.getItem('gloveup_sidebar_collapsed') === 'true') {
                    document.documentElement.classList.add('sidebar-collapsed');
                }
                // Paleta de colores personalizada (ver color-theme.js): se aplica
                // aquí, sin esperar al módulo, por la misma razón que el tema
                // oscuro — evitar el parpadeo con los colores de fábrica.
                ['gloveup_theme_bg', 'gloveup_theme_primary', 'gloveup_theme_accent'].forEach(function (key) {
                    var raw = localStorage.getItem(key);
                    if (!raw) return;
                    var stored = JSON.parse(raw);
                    for (var name in stored.vars) {
                        document.documentElement.style.setProperty(name, stored.vars[name]);
                    }
                });
            } catch (e) {
                /* localStorage bloqueado o dato corrupto: se usan los colores de fábrica */
            }
        })();
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">

    <link rel="stylesheet" href="/assets/css/app.css">
    <link rel="stylesheet" href="/assets/css/toasts.css">

    <meta property="og:title" content="GloveUp - Find your fight">
    <meta property="og:description" content="La plataforma para conectar y entrenar deportes de combate.">
    <meta property="og:type" content="website">
    <meta property="og:image" content="/assets/images/Sparring_Club_Collection-Link-Image.jpg">
</head>

<body data-shell="<?= View::e($shell) ?>" class="<?= $isApp ? 'h-full' : '' ?>">

    <!-- Barra de progreso de las navegaciones de la SPA -->
    <div id="spa-progress"
         class="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 origin-left
                scale-x-0 bg-accent opacity-0 transition-all duration-300"></div>

    <?php if ($isApp): ?>
        <div class="flex h-full">
            <?= $view->render('layout/sidebar', ['nav' => $nav, 'view' => $view]) ?>

            <div class="flex min-w-0 flex-1 flex-col">
                <?php // El título de la barra es el del documento sin el sufijo "— GloveUp" ?>
                <?= $view->render('layout/topbar', [
                    'heading' => trim(explode('—', $title)[0]),
                    'nav'     => $nav,
                ]) ?>

                <!-- Región que el router intercambia en cada navegación -->
                <main id="app-view" class="min-h-0 flex-1 overflow-y-auto" tabindex="-1">
                    <?= $content ?>
                </main>
            </div>
        </div>
    <?php else: ?>
        <main id="app-view" tabindex="-1">
            <?= $content ?>
        </main>
    <?php endif; ?>

    <?php // Fuera de #app-view a propósito: persiste entre navegaciones de la
          // SPA en vez de reinsertarse (y perder su estado) en cada una. ?>
    <?= $view->render('layout/login-modal', []) ?>

    <script src="/assets/js/toasts.js"></script>
    <script type="module" src="/assets/js/app.js"></script>
</body>

</html>
