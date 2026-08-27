/**
 * coach-challenges-smoke.mjs — Ciclo completo desde la UI de Retos.
 *
 * Juan reta a Maria desde Sparring. Sus dos entrenadores lo aprueban desde
 * la propia interfaz de Retos (antes se hacía vía API directa porque esa
 * pantalla no existía). El entrenador de Maria además finaliza y valora el
 * sparring desde Retos, y se comprueba que Maria ve la sesión completada.
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
page.on('pageerror', (e) => console.log('pageerror:', String(e)));

async function loginAs(email, role) {
    await page.evaluate((email, role) => {
        localStorage.setItem('gloveup_user_email', email);
        localStorage.setItem('gloveup_user_role', role);
    }, email, role);
}

// ── 1. Juan reta a Maria ─────────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await loginAs('boxeador1@test.com', 'boxeador');
await page.goto(`${BASE}/sparring`, { waitUntil: 'networkidle2' });
await page.waitForSelector('#sp-list article', { timeout: 15000 });

const names = await page.$$eval('#sp-list article p.font-bold', (els) => els.map((e) => e.textContent.trim()));
const targetIndex = names.findIndex((n) => n.includes('Maria'));
const targetBtn = (await page.$$('#sp-list button[data-challenge]'))[targetIndex];
await targetBtn.click();
await page.waitForFunction(() => document.querySelector('#challenge-modal')?.open, { timeout: 5000 });
await page.waitForFunction(() => document.querySelectorAll('#gym-checklist input[type=radio]').length > 0, { timeout: 10000 });
await page.click('.preset-card[data-preset*="técnico"]');
await page.click('#gym-checklist input[type=radio]');
await page.click('#challenge-datetime');
await page.waitForFunction(() => document.querySelector('#dt-overlay')?.open, { timeout: 5000 });
await page.click('#dt-next');
await page.waitForFunction(() => document.querySelector('#dt-grid [data-day="15"]'), { timeout: 5000 });
await page.click('#dt-grid [data-day="15"]');
await page.click('#dt-apply');
await page.waitForFunction(() => !document.querySelector('#dt-overlay')?.open, { timeout: 5000 });

const [sendResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/boxeadores/challenges') && r.request().method() === 'POST'),
    page.click('#challenge-form button[type="submit"]'),
]);
check('el reto se envía correctamente', sendResponse.ok(), String(sendResponse.status()));

// ── 2. El entrenador de Juan lo ve en Retos y lo aprueba ─────────────
await loginAs('entrenador1@test.com', 'entrenador');
await page.goto(`${BASE}/retos`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelectorAll('#cc-list article').length > 0, { timeout: 15000 });

check('el menú marca Retos como activo',
    (await page.$eval('[data-nav="retos"]', (el) => el.getAttribute('aria-current'))) === 'page');

const pendingText = await page.$eval('#cc-list', (el) => el.textContent);
check('el entrenador del retador ve el reto en curso', pendingText.includes('Maria'));
check('el estado indica que debe aprobar su propio reto',
    pendingText.includes('Debes aprobar tu reto') || pendingText.includes('aprobación'));

const [fromApproveResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/challenges/respond')),
    page.click('#cc-list button[data-respond="accept"]'),
]);
check('aprobar desde la UI responde 2xx', fromApproveResp.ok(), String(fromApproveResp.status()));

await page.waitForFunction(() => document.querySelector('#cc-message')?.textContent.includes('aprobado'), { timeout: 10000 });
check('se muestra el mensaje de confirmación tras aprobar', true);

// ── 3. El entrenador de Maria lo aprueba también ─────────────────────
await loginAs('entrenador2@test.com', 'entrenador');
await page.goto(`${BASE}/retos`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelectorAll('#cc-list article').length > 0, { timeout: 15000 });

const [toApproveResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/challenges/respond')),
    page.click('#cc-list button[data-respond="accept"]'),
]);
check('la segunda aprobación confirma el sparring', toApproveResp.ok(), String(toApproveResp.status()));

// ── 4. Ambos entrenadores ven la tarjeta en "Aceptado" ───────────────
// respond() dispara su propio load() en segundo plano tras el POST; se
// espera a que el contador de la pestaña refleje el dato fresco antes de
// leer la lista, para no correr contra un render todavía con datos viejos.
await page.waitForFunction(
    () => Number(document.querySelector('[data-count="accepted"]')?.textContent || '0') >= 1,
    { timeout: 10000 },
);
await page.click('[data-tab="accepted"]');
await page.waitForFunction(() => document.querySelectorAll('#cc-list article').length > 0, { timeout: 10000 });
const acceptedHtml = await page.$eval('#cc-list', (el) => el.innerHTML);
check('tras confirmarse aparece en la pestaña Aceptado',
    acceptedHtml.includes('Finalizar y valorar'));

// ── 5. El entrenador de Maria finaliza y valora desde Retos ──────────
if (!acceptedHtml.includes('Finalizar y valorar')) {
    console.log('No hay boton Finalizar; se aborta el resto del flujo para revisar el HTML de arriba.');
    await browser.close();
    console.log('\n' + results.join('\n'));
    process.exit(1);
}
// click vía evaluate: la lista puede volver a renderizarse justo tras el
// cambio de pestaña (respond() dispara su propio load() en segundo plano),
// y un click "normal" puede apuntar a un nodo que se acaba de desmontar.
await page.evaluate(() => document.querySelector('#cc-list button[data-complete]')?.click());
await page.waitForFunction(() => document.querySelector('#complete-modal')?.open, { timeout: 5000 });
await page.click('#complete-stars [data-star="4"]');
check('seleccionar 4 estrellas actualiza el campo oculto',
    (await page.$eval('#complete-rating', (el) => el.value)) === '4');
await page.type('#complete-note', 'Buen nivel técnico, respetuoso');

const [completeResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/challenges/complete')),
    page.click('#complete-submit'),
]);
check('finalizar y valorar responde 2xx', completeResp.ok(), String(completeResp.status()));

await page.waitForFunction(() => !document.querySelector('#complete-modal')?.open, { timeout: 5000 });
await page.waitForFunction(() => document.querySelectorAll('#cc-list article').length > 0, { timeout: 10000 });
await new Promise((r) => setTimeout(r, 500)); // deja asentar el load() posterior al completar
const completedText = await page.$eval('#cc-list', (el) => el.textContent);
check('la tarjeta muestra la valoración de 4 estrellas', completedText.includes('4/5'));
// NOTA: el comentario del entrenador no se comprueba aquí a propósito.
// Bug preexistente del backend (no de esta migración): el esquema de
// Boxeador.sparringChallengesReceived/Sent no declara "completedNote", así
// que Mongoose lo descarta en el $set silenciosamente. El dato SÍ se guarda
// en sparringSessions.noteEntrenador, pero /me/challenges-for-boxers no lo
// expone para las tarjetas de tipo "challenge". El dashboard React clásico
// tiene el mismo problema (lee challenge.completedNote, que nunca llega).

// ── 6. Archivar mueve la tarjeta al Historial ────────────────────────
const beforeArchiveCount = (await page.$$('#cc-list article')).length;
await page.evaluate(() => document.querySelector('#cc-list [data-archive-toggle]')?.click());
await page.waitForFunction(
    (before) => document.querySelectorAll('#cc-list article').length < before,
    { timeout: 5000 },
    beforeArchiveCount,
).then(() => check('archivar la quita de Completados', true))
 .catch(() => check('archivar la quita de Completados', false));

await page.click('[data-tab="history"]');
await page.waitForFunction(() => document.querySelectorAll('#cc-list article').length > 0, { timeout: 5000 });
check('la tarjeta archivada aparece en Historial', true);

// ── 7. Maria ve la sesión completada en Mis Sparrings ────────────────
await loginAs('boxeador2@test.com', 'boxeador');
await page.goto(`${BASE}/mis-sparrings`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.getElementById('history-count')?.textContent.trim() !== '0 registros', { timeout: 15000 });
check('Maria ve la sesión en su historial de Mis Sparrings',
    (await page.$eval('#history-tbody', (el) => el.textContent)).includes('Juan'));

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
process.exit(failures ? 1 : 0);
