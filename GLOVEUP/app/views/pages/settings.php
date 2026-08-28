<?php

declare(strict_types=1);

/**
 * settings.php — Ajustes.
 *
 * Tres subvistas alternadas por JS (igual que la versión clásica): menú
 * principal, notificaciones y paleta de colores. No hay nada que depender
 * del rol aquí, a diferencia de Perfil o Inicio.
 */
?>
<div data-page="settings">
    <div class="mx-auto max-w-3xl px-6 py-8">

        <button type="button" id="settings-back"
                class="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted
                       transition-colors hover:text-accent" hidden>
            <i class="fas fa-arrow-left" aria-hidden="true"></i> Volver
        </button>

        <!-- ══ Menú principal ═══════════════════════════════════════ -->
        <section id="settings-home" class="settings-view">
            <h2 class="text-2xl">Configuración</h2>
            <p class="mt-1 text-sm text-muted dark:text-white/60">
                Administra las opciones generales y la cuenta de usuario.
            </p>

            <div class="mt-6 space-y-3">
                <a href="/perfil" class="card-interactive flex items-center justify-between p-5">
                    <div>
                        <h3 class="font-bold">Gestionar mi perfil</h3>
                        <p class="mt-1 text-sm text-muted dark:text-white/60">
                            Personaliza tu perfil de boxeador o entrenador en la plataforma.
                        </p>
                    </div>
                    <i class="fas fa-chevron-right text-faint" aria-hidden="true"></i>
                </a>

                <button type="button" data-goto="settings-notifications"
                        class="card-interactive flex w-full items-center justify-between p-5 text-left">
                    <div>
                        <h3 class="font-bold">Gestionar mis notificaciones</h3>
                        <p class="mt-1 text-sm text-muted dark:text-white/60">
                            Elige qué notificaciones quieres recibir.
                        </p>
                    </div>
                    <i class="fas fa-chevron-right text-faint" aria-hidden="true"></i>
                </button>

                <button type="button" data-goto="settings-palette"
                        class="card-interactive flex w-full items-center justify-between p-5 text-left">
                    <div>
                        <h3 class="font-bold">Paleta de colores</h3>
                        <p class="mt-1 text-sm text-muted dark:text-white/60">
                            Personaliza el color de acento de toda la interfaz.
                        </p>
                    </div>
                    <i class="fas fa-chevron-right text-faint" aria-hidden="true"></i>
                </button>
            </div>
        </section>

        <!-- ══ Notificaciones ═══════════════════════════════════════ -->
        <section id="settings-notifications" class="settings-view" hidden>
            <h2 class="text-2xl">Mis notificaciones</h2>
            <p class="mt-1 text-sm text-muted dark:text-white/60">
                Activa o desactiva los avisos que quieres recibir en GloveUp.
            </p>

            <div class="mt-6 space-y-3">
                <?php
                $notifs = [
                    ['key' => 'sparring', 'title' => 'Nuevos retos y sparring', 'desc' => 'Retos de sparring que has recibido, modificado o respondido.'],
                    ['key' => 'mensajes', 'title' => 'Mensajes privados',        'desc' => 'Avisos sobre nuevos mensajes de chat en la plataforma.'],
                    ['key' => 'gimnasio', 'title' => 'Actividad de gimnasio',    'desc' => 'Cuando un boxeador o entrenador de tu gimnasio hace algo relevante.'],
                    ['key' => 'general',  'title' => 'Alertas del sistema',      'desc' => 'Actualizaciones generales de la plataforma y novedades.'],
                ];
                foreach ($notifs as $n): ?>
                    <div class="card flex items-center justify-between gap-4 p-4">
                        <div>
                            <h4 class="font-bold"><?= $n['title'] ?></h4>
                            <p class="mt-0.5 text-sm text-muted dark:text-white/60"><?= $n['desc'] ?></p>
                        </div>
                        <label class="relative shrink-0">
                            <input type="checkbox" data-notif="<?= $n['key'] ?>" class="peer sr-only" checked>
                            <span class="toggle-track"></span>
                        </label>
                    </div>
                <?php endforeach; ?>
            </div>

            <button type="button" id="settings-save-notifs" class="btn-primary mt-6">
                Guardar preferencias
            </button>
        </section>

        <!-- ══ Paleta de colores ════════════════════════════════════ -->
        <section id="settings-palette" class="settings-view" hidden>
            <h2 class="text-2xl">Paleta de colores</h2>
            <p class="mt-1 text-sm text-muted dark:text-white/60">
                Personaliza los colores principales de la interfaz. El fondo sólo
                afecta al tema claro.
            </p>

            <div class="mt-6 space-y-3">
                <?php
                $swatches = [
                    ['slot' => 'bg',      'label' => 'Fondo'],
                    ['slot' => 'primary', 'label' => 'Primario'],
                    ['slot' => 'accent',  'label' => 'Acento'],
                ];
                foreach ($swatches as $s): ?>
                    <div class="card flex items-center gap-4 p-4">
                        <span class="w-20 shrink-0 text-sm font-bold"><?= $s['label'] ?></span>
                        <input type="color" data-color-input="<?= $s['slot'] ?>"
                               class="h-10 w-16 shrink-0 cursor-pointer rounded-lg border border-hairline
                                      dark:border-white/10">
                        <button type="button" data-color-reset="<?= $s['slot'] ?>" class="btn-ghost ml-auto">
                            Restablecer
                        </button>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>
    </div>
</div>
