/**
 * image-editor.js — Editor modal de imágenes antes de confirmarlas.
 *
 * Exporta una función: openImageEditor(file, options) → Promise<string|null>
 * Devuelve un dataURL con la imagen editada, o null si el usuario cancela.
 *
 * Controles:
 *  - Arrastrar   → mover la imagen dentro del área de recorte
 *  - Rueda ratón → zoom
 *  - Botones +/- → zoom
 *  - Botón girar → rotar 90° en sentido horario
 *  - Confirmar   → exporta el resultado como dataURL
 *  - Cancelar    → devuelve null
 */

const EDITOR_ID = 'gloveup-image-editor-modal';

function injectStyles() {
    if (document.getElementById('gloveup-image-editor-styles')) return;
    const style = document.createElement('style');
    style.id = 'gloveup-image-editor-styles';
    style.textContent = `
#gloveup-image-editor-modal {
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.82);
    display: flex; align-items: center; justify-content: center;
    animation: gie-fadein .18s ease;
}
@keyframes gie-fadein { from { opacity:0 } to { opacity:1 } }
#gloveup-image-editor-modal .gie-box {
    background: #1a1a2e; border-radius: 14px;
    padding: 24px; display: flex; flex-direction: column; align-items: center;
    gap: 16px; box-shadow: 0 8px 40px rgba(0,0,0,.7);
    max-width: 95vw;
}
#gloveup-image-editor-modal .gie-title {
    color: #fff; font-size: 1.1rem; font-weight: 600; margin: 0;
}
#gloveup-image-editor-modal .gie-canvas-wrap {
    position: relative; border-radius: 10px; overflow: hidden;
    cursor: grab; user-select: none; touch-action: none;
    border: 2px solid #e63946;
}
#gloveup-image-editor-modal .gie-canvas-wrap:active { cursor: grabbing; }
#gloveup-image-editor-modal canvas { display: block; }
#gloveup-image-editor-modal .gie-controls {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center;
}
#gloveup-image-editor-modal .gie-controls label {
    color: #ccc; font-size: .82rem; display: flex; align-items: center; gap: 6px;
}
#gloveup-image-editor-modal .gie-controls input[type=range] {
    width: 100px; accent-color: #e63946;
}
#gloveup-image-editor-modal .gie-btn {
    border: none; border-radius: 8px; padding: 8px 14px;
    font-size: .88rem; font-weight: 600; cursor: pointer; transition: opacity .15s;
}
#gloveup-image-editor-modal .gie-btn:hover { opacity: .85; }
#gloveup-image-editor-modal .gie-btn-icon {
    background: #2d2d4e; color: #fff; font-size: 1.1rem; padding: 7px 12px;
}
#gloveup-image-editor-modal .gie-btn-confirm {
    background: #e63946; color: #fff; padding: 9px 26px;
}
#gloveup-image-editor-modal .gie-btn-cancel {
    background: #2d2d4e; color: #ccc;
}
#gloveup-image-editor-modal .gie-actions {
    display: flex; gap: 10px;
}
#gloveup-image-editor-modal .gie-hint {
    color: #888; font-size: .75rem; text-align: center;
}
`;
    document.head.appendChild(style);
}

export function openImageEditor(file, options = {}) {
    return new Promise((resolve) => {
        injectStyles();

        const OUTPUT_SIZE = options.outputSize || 512;
        const CROP_SIZE   = Math.min(window.innerWidth * 0.75, window.innerHeight * 0.55, 380);
        const CIRCLE_CROP = options.circle !== false;

        // Cargar la imagen
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            buildEditor(img);
        };
        img.src = objectUrl;

        function buildEditor(img) {
            // Estado
            let scale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
            let angle = 0; // múltiplos de 90
            let ox = 0, oy = 0; // offset del centro de la imagen respecto al centro del canvas
            let dragging = false, lastX = 0, lastY = 0;
            let brightness = 100, contrast = 100;

            // Montar DOM
            const modal = document.createElement('div');
            modal.id = EDITOR_ID;
            modal.innerHTML = `
                <div class="gie-box">
                    <p class="gie-title">Ajustar imagen</p>
                    <div class="gie-canvas-wrap" id="gie-wrap">
                        <canvas id="gie-canvas" width="${CROP_SIZE}" height="${CROP_SIZE}"></canvas>
                    </div>
                    <div class="gie-controls">
                        <button class="gie-btn gie-btn-icon" id="gie-zoom-out" title="Reducir">−</button>
                        <label>Zoom <input type="range" id="gie-zoom-range" min="10" max="500" value="100"></label>
                        <button class="gie-btn gie-btn-icon" id="gie-zoom-in" title="Ampliar">+</button>
                        <button class="gie-btn gie-btn-icon" id="gie-rotate" title="Girar 90°">↻</button>
                    </div>
                    <div class="gie-controls">
                        <label>Brillo <input type="range" id="gie-brightness" min="20" max="200" value="100"></label>
                        <label>Contraste <input type="range" id="gie-contrast" min="20" max="200" value="100"></label>
                    </div>
                    <p class="gie-hint">Arrastra para encuadrar · rueda del ratón para hacer zoom</p>
                    <div class="gie-actions">
                        <button class="gie-btn gie-btn-cancel" id="gie-cancel">Cancelar</button>
                        <button class="gie-btn gie-btn-confirm" id="gie-confirm">Confirmar</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            const canvas = document.getElementById('gie-canvas');
            const ctx = canvas.getContext('2d');
            const zoomRange = document.getElementById('gie-zoom-range');

            function getBaseScale() {
                return Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
            }

            function currentScale() {
                return getBaseScale() * (parseInt(zoomRange.value) / 100);
            }

            function clampOffset() {
                const s = currentScale();
                const rotated = angle % 180 !== 0;
                const iw = rotated ? img.height * s : img.width * s;
                const ih = rotated ? img.width * s  : img.height * s;
                const maxOx = Math.max(0, (iw - CROP_SIZE) / 2);
                const maxOy = Math.max(0, (ih - CROP_SIZE) / 2);
                ox = Math.max(-maxOx, Math.min(maxOx, ox));
                oy = Math.max(-maxOy, Math.min(maxOy, oy));
            }

            function draw() {
                ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
                ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

                const s = currentScale();
                ctx.save();
                ctx.translate(CROP_SIZE / 2 + ox, CROP_SIZE / 2 + oy);
                ctx.rotate(angle * Math.PI / 180);
                ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
                ctx.restore();
                ctx.filter = 'none';

                // Viñeta de recorte circular
                if (CIRCLE_CROP) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-in';
                    ctx.beginPath();
                    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    // Borde decorativo
                    ctx.save();
                    ctx.strokeStyle = '#e63946';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2 - 1, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // Zoom con rueda
            const wrap = document.getElementById('gie-wrap');
            wrap.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 5 : -5;
                zoomRange.value = Math.max(10, Math.min(500, parseInt(zoomRange.value) + delta));
                clampOffset(); draw();
            }, { passive: false });

            // Drag
            wrap.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });

            // Touch drag
            wrap.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) { lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
            }, { passive: true });
            wrap.addEventListener('touchmove', (e) => {
                if (e.touches.length === 1) {
                    ox += e.touches[0].clientX - lastX; oy += e.touches[0].clientY - lastY;
                    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
                    clampOffset(); draw();
                }
            }, { passive: true });

            // Controles
            document.getElementById('gie-zoom-in').addEventListener('click', () => {
                zoomRange.value = Math.min(500, parseInt(zoomRange.value) + 10); clampOffset(); draw();
            });
            document.getElementById('gie-zoom-out').addEventListener('click', () => {
                zoomRange.value = Math.max(10, parseInt(zoomRange.value) - 10); clampOffset(); draw();
            });
            zoomRange.addEventListener('input', () => { clampOffset(); draw(); });

            document.getElementById('gie-rotate').addEventListener('click', () => {
                angle = (angle + 90) % 360; ox = 0; oy = 0; clampOffset(); draw();
            });

            document.getElementById('gie-brightness').addEventListener('input', (e) => {
                brightness = parseInt(e.target.value); draw();
            });
            document.getElementById('gie-contrast').addEventListener('input', (e) => {
                contrast = parseInt(e.target.value); draw();
            });

            // Confirmar → exportar a OUTPUT_SIZE
            document.getElementById('gie-confirm').addEventListener('click', () => {
                const out = document.createElement('canvas');
                out.width = out.height = OUTPUT_SIZE;
                const octx = out.getContext('2d');
                const ratio = OUTPUT_SIZE / CROP_SIZE;

                octx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
                const s = currentScale() * ratio;
                octx.save();
                octx.translate(OUTPUT_SIZE / 2 + ox * ratio, OUTPUT_SIZE / 2 + oy * ratio);
                octx.rotate(angle * Math.PI / 180);
                octx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
                octx.restore();
                octx.filter = 'none';

                if (CIRCLE_CROP) {
                    octx.globalCompositeOperation = 'destination-in';
                    octx.beginPath();
                    octx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
                    octx.fill();
                }

                const dataUrl = out.toDataURL('image/png');
                cleanup();
                resolve(dataUrl);
            });

            document.getElementById('gie-cancel').addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            function onMouseMove(e) {
                if (!dragging) return;
                ox += e.clientX - lastX; oy += e.clientY - lastY;
                lastX = e.clientX; lastY = e.clientY;
                clampOffset(); draw();
            }
            function onMouseUp() { dragging = false; }
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);

            function onKeydown(e) { if (e.key === 'Escape') { cleanup(); resolve(null); } }
            window.addEventListener('keydown', onKeydown);

            function cleanup() {
                window.removeEventListener('keydown', onKeydown);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                modal.remove();
            }

            draw();
        }
    });
}

// Exponer globalmente para scripts clásicos (no módulos ES)
window.openImageEditor = openImageEditor;
