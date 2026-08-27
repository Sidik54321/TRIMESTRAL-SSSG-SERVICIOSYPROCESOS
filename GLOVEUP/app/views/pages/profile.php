<?php

declare(strict_types=1);

/**
 * profile.php — Edición del perfil propio.
 *
 * El marcado cubre los campos de boxeador y de entrenador a la vez; el rol
 * sólo se conoce en el cliente (vive en localStorage), así que profile.js
 * decide qué grupo de campos mostrar con la clase [data-role]. El HTML no
 * intenta adivinar el rol para no parpadear entre versiones al cargar.
 */
?>
<div data-page="profile">
    <div class="mx-auto max-w-4xl px-6 py-8">

        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h2 class="text-2xl">Mi Perfil</h2>
                <p id="profile-subtitle" class="mt-1 text-sm text-muted dark:text-white/60">Tus datos de perfil.</p>
            </div>
            <button type="button" id="btn-save-profile" class="btn-primary">
                <i class="fas fa-save" aria-hidden="true"></i> Guardar perfil
            </button>
        </div>

        <div class="card mt-6 p-6">
            <!-- Foto -->
            <div class="flex flex-wrap items-center gap-4">
                <img id="profile-photo" src="/assets/images/unnamed-removebg-preview.png" alt="Foto de perfil"
                     class="h-24 w-24 rounded-full bg-sunken object-cover dark:bg-white/10">
                <div class="flex gap-2">
                    <label class="btn-ghost cursor-pointer">
                        <input id="photo-input" type="file" accept="image/*" class="hidden">
                        Cambiar foto
                    </label>
                    <button type="button" id="btn-remove-photo" class="btn-ghost">Quitar foto</button>
                </div>
            </div>

            <!-- Campos comunes -->
            <div class="mt-8 grid gap-4 sm:grid-cols-2">
                <div>
                    <label for="p-name" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Nombre</label>
                    <input id="p-name" type="text" class="field" placeholder="Tu nombre">
                </div>
                <div>
                    <label for="p-email" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                        Correo electrónico (tu ID de cuenta)
                    </label>
                    <input id="p-email" type="email" class="field" placeholder="tu@correo.com">
                </div>

                <!-- Sólo boxeador -->
                <div data-role="boxeador">
                    <label for="p-alias" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Alias</label>
                    <input id="p-alias" type="text" class="field" placeholder="@tuusuario">
                </div>
                <div>
                    <label id="p-discipline-label" for="p-discipline"
                           class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Disciplina</label>
                    <select id="p-discipline" class="field">
                        <option value="">Selecciona</option>
                        <option>Boxeo</option>
                        <option>Muay Thai</option>
                        <option>MMA</option>
                        <option>Kickboxing</option>
                    </select>
                </div>
                <div>
                    <label for="p-location" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Ubicación</label>
                    <input id="p-location" type="text" class="field" placeholder="Ciudad, país">
                </div>

                <!-- Sólo entrenador -->
                <div data-role="entrenador" hidden>
                    <label for="p-coach-gym" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Gimnasio</label>
                    <input id="p-coach-gym" type="text" class="field" placeholder="Nombre del gimnasio">
                </div>
                <div data-role="entrenador" hidden>
                    <label for="p-coach-price" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                        Precio mensual (€)
                    </label>
                    <input id="p-coach-price" type="number" min="0" step="0.01" class="field" placeholder="0">
                </div>

                <!-- Sólo boxeador: estadísticas -->
                <div data-role="boxeador" class="col-span-full grid grid-cols-3 gap-4">
                    <div>
                        <label for="p-weight" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Peso (kg)</label>
                        <input id="p-weight" type="number" class="field" placeholder="70">
                    </div>
                    <div>
                        <label for="p-height" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Altura (cm)</label>
                        <input id="p-height" type="number" class="field" placeholder="175">
                    </div>
                    <div>
                        <label for="p-age" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Edad</label>
                        <input id="p-age" type="number" class="field" placeholder="25">
                    </div>
                </div>

                <div data-role="boxeador">
                    <label for="p-weight-class" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Categoría</label>
                    <select id="p-weight-class" class="field">
                        <option value="">Selecciona</option>
                        <?php foreach (['Paja', 'Minimosca', 'Mosca', 'Supermosca', 'Gallo', 'Supergallo', 'Pluma',
                                        'Superpluma', 'Ligero', 'Superligero', 'Wélter', 'Superwélter', 'Medio',
                                        'Supermedio', 'Semicompleto', 'Crucero', 'Puente', 'Pesado'] as $w): ?>
                            <option><?= $w ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div data-role="boxeador">
                    <label for="p-stance" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Guardia</label>
                    <select id="p-stance" class="field">
                        <option value="">Selecciona</option>
                        <option>Diestro</option>
                        <option>Zurdo</option>
                    </select>
                </div>
                <div data-role="boxeador">
                    <label for="p-gender" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Género</label>
                    <select id="p-gender" class="field">
                        <option value="">Selecciona</option>
                        <option>Masculino</option>
                        <option>Femenino</option>
                        <option>Otro</option>
                    </select>
                </div>
                <div data-role="boxeador">
                    <label for="p-freq" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                        Frecuencia de sparring
                    </label>
                    <select id="p-freq" class="field">
                        <option value="">Selecciona</option>
                        <option>Diaria</option>
                        <option>Semanal</option>
                        <option>Mensual</option>
                    </select>
                </div>

                <div data-role="boxeador" class="col-span-full">
                    <label for="p-bio" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Bio</label>
                    <textarea id="p-bio" rows="4" class="field resize-none"
                              placeholder="Cuéntanos tu estilo, objetivos, disponibilidad…"></textarea>
                </div>
            </div>
        </div>

        <!-- Ver perfil de otro boxeador (sólo boxeadores) -->
        <div id="lookup-card" data-role="boxeador" class="card mt-6 p-6">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold">Ver perfil de otro boxeador</h3>
                <span class="text-xs text-muted">Email o DNI/licencia</span>
            </div>
            <div class="mt-4 flex gap-2">
                <input id="lookup-input" type="text" class="field"
                       placeholder="Ej: demo.boxeador01@gloveup.com o BOX0001">
                <button type="button" id="lookup-btn" class="btn-primary shrink-0">
                    <i class="fas fa-search" aria-hidden="true"></i> Ver
                </button>
            </div>
        </div>
    </div>
</div>
