/**
 * sparring-smoke.mjs — Comprobación de humo de la página de Sparring.
 *
 *   docker run --rm --network docker_default \
 *     -v "<ruta>/scratch:/home/pptruser/work" -w /home/pptruser/work \
 *     ghcr.io/puppeteer/puppeteer:latest node sparring-smoke.mjs
 */

import puppeteer from 'puppeteer';

const BASE = process.env.BASE || 'http://web';
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
    const line = `${ok ? 'OK  ' : 'FALLO'} ${name}${detail ? ' — ' + detail : ''}`;
    results.push(line);
    console.log(line);
    if (!ok) failures += 1;
}

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const consoleErrors = [];
const failedRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

// Sesión de un boxeador con gimnasio y entrenador asignados (seedMinimal.js)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await page.evaluate(() => {
    localStorage.setItem('gloveup_user_email', 'boxeador1@test.com');
    localStorage.setItem('gloveup_user_role', 'boxeador');
});

await page.goto(`${BASE}/sparring`, { waitUntil: 'networkidle2' });
await page.waitForSelector('#sp-list article', { timeout: 15000 });

const rows = await page.$$eval('#sp-list article p.font-bold', (els) => els.map((e) => e.textContent.trim()));
check('la lista carga boxeadores de la API', rows.length >= 3, rows.join(', '));

check('el menú marca Buscar Sparring como activo',
    (await page.$eval('[data-nav="sparring"]', (el) => el.getAttribute('aria-current'))) === 'page');

// ── Filtro por nivel ────────────────────────────────────────────────
const levels = await page.$$eval('#sp-level option', (els) => els.map((e) => e.textContent.trim()));
check('el filtro de nivel trae las opciones esperadas',
    ['Principiante', 'Intermedio', 'Avanzado', 'Profesional'].every((l) => levels.includes(l)));

await page.select('#sp-level', 'Profesional');
await new Promise((r) => setTimeout(r, 300));
const filteredCount = (await page.$$('#sp-list article')).length;
check('el filtro de nivel reduce la lista', filteredCount >= 1 && filteredCount < rows.length,
    `${filteredCount} de ${rows.length}`);

await page.click('#sp-reset');
await new Promise((r) => setTimeout(r, 300));
check('limpiar filtros restaura la lista completa',
    (await page.$$('#sp-list article')).length === rows.length);

// ── Modal de reto: boxeador con gimnasio puede retar a otro ─────────
const challengeBtn = await page.$('#sp-list button[data-challenge]:not([disabled])');
check('hay al menos un botón de reto habilitado', Boolean(challengeBtn));

if (challengeBtn) {
    await challengeBtn.click();
    await page.waitForFunction(() => document.querySelector('#challenge-modal')?.open, { timeout: 5000 });
    check('el modal de reto se abre', await page.$eval('#challenge-modal', (d) => d.open));

    await page.waitForFunction(
        () => document.querySelectorAll('#coach-checklist input[type=checkbox]').length > 0,
        { timeout: 10000 },
    );
    const requiredChecked = await page.$$eval('#coach-checklist input:disabled', (els) => els.every((el) => el.checked));
    check('los entrenadores obligatorios ya están marcados y bloqueados',
        (await page.$$('#coach-checklist input:disabled')).length > 0 && requiredChecked);

    await page.waitForFunction(
        () => document.querySelectorAll('#gym-checklist input[type=radio]').length > 0,
        { timeout: 10000 },
    );
    check('el selector de gimnasio carga opciones',
        (await page.$$('#gym-checklist input[type=radio]')).length >= 1);

    // Tipo de sparring
    await page.click('.preset-card[data-preset*="técnico"]');
    check('seleccionar un tipo de sparring lo marca',
        (await page.$eval('#challenge-preset', (el) => el.value)).length > 0);

    // Gimnasio: el primero de la lista
    await page.click('#gym-checklist input[type=radio]');

    // Selector de fecha y hora
    await page.click('#challenge-datetime');
    try {
        await page.waitForFunction(() => document.querySelector('#dt-overlay')?.open, { timeout: 5000 });
    } catch {
        await page.screenshot({ path: '/home/pptruser/work/dt-overlay-fail.png' });
    }
    check('el selector de fecha se abre', await page.$eval('#dt-overlay', (d) => d.open));

    // Se avanza al mes siguiente y se elige su día 15: cualquier día de hoy
    // arrastra la hora actual y "aplicar" lo rechazaría por ser el pasado.
    await page.click('#dt-next');
    await page.waitForFunction(() => document.querySelector('#dt-grid [data-day="15"]'), { timeout: 5000 });
    await page.click('#dt-grid [data-day="15"]');
    await page.click('#dt-apply');

    await page.waitForFunction(() => !document.querySelector('#dt-overlay')?.open, { timeout: 5000 });
    check('aplicar la fecha la escribe en el campo',
        (await page.$eval('#challenge-datetime', (el) => el.value)).length > 0);

    // Cerrar con confirmación
    await page.click('#challenge-close');
    await page.waitForFunction(() => document.querySelector('#challenge-cancel-confirm')?.open, { timeout: 5000 });
    check('cerrar el modal pide confirmación', await page.$eval('#challenge-cancel-confirm', (d) => d.open));

    await page.click('#challenge-cancel-confirm button[value="confirm"]');
    await page.waitForFunction(() => !document.querySelector('#challenge-modal')?.open, { timeout: 5000 });
    check('confirmar el cierre cierra el modal', !(await page.$eval('#challenge-modal', (d) => d.open)));
}

// ── Un entrenador no ve botones de reto activos ──────────────────────
await page.evaluate(() => {
    localStorage.setItem('gloveup_user_email', 'entrenador1@test.com');
    localStorage.setItem('gloveup_user_role', 'entrenador');
});
await page.goto(`${BASE}/sparring`, { waitUntil: 'networkidle2' });
await page.waitForSelector('#sp-list article', { timeout: 15000 });
const coachDisabled = await page.$$eval('#sp-list button[data-challenge]', (els) => els.every((el) => el.disabled));
check('un entrenador no puede retar directamente', coachDisabled);

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
if (failedRequests.length) console.log('\nPeticiones fallidas:\n  ' + [...new Set(failedRequests)].join('\n  '));

process.exit(failures ? 1 : 0);
