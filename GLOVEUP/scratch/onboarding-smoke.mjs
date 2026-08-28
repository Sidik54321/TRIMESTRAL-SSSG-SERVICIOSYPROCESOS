/**
 * onboarding-smoke.mjs — Comprobación de humo de Primeros Pasos.
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
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

async function loginAs(email, role) {
    await page.evaluate((email, role) => {
        localStorage.setItem('gloveup_user_email', email);
        localStorage.setItem('gloveup_user_role', role);
    }, email, role);
}

// boxeador3@test.com no tiene foto/peso/disciplina/ubicacion completos en el
// seed (o si los tiene, se limpia su progreso guardado para partir de cero).
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await loginAs('boxeador3@test.com', 'boxeador');
await page.evaluate(() => localStorage.removeItem('gloveup_onboarding_done_boxeador3@test.com'));

await page.goto(`${BASE}/primeros-pasos`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelectorAll('[data-onboarding-root] article[data-step]').length > 0, { timeout: 15000 });

check('el menú marca Primeros Pasos como activo',
    (await page.$eval('[data-nav="primeros-pasos"]', (el) => el.getAttribute('aria-current'))) === 'page');
check('se muestra el manual de boxeador', !(await page.$eval('[data-manual="boxeador"]', (el) => el.hidden)));
check('el manual de entrenador está oculto', await page.$eval('[data-manual="entrenador"]', (el) => el.hidden));

const stepIds = await page.$$eval('[data-step]', (els) => els.map((e) => e.dataset.step));
check('aparecen los 4 pasos del boxeador',
    ['profile', 'sparring_search', 'challenge_sent', 'gym_explore'].every((id) => stepIds.includes(id)),
    stepIds.join(', '));

// ── Descartar un paso con la "×" ──────────────────────────────────────
const before = (await page.$$('[data-step]')).length;
await page.click('[data-dismiss="gym_explore"]');
await new Promise((r) => setTimeout(r, 400));
await page.waitForFunction(
    (before) => document.querySelectorAll('[data-step]').length < before,
    { timeout: 5000 },
    before,
);
check('descartar un paso lo elimina de la lista',
    !(await page.$$eval('[data-step]', (els) => els.some((e) => e.dataset.step === 'gym_explore'))));

const doneSet = await page.evaluate(() => JSON.parse(localStorage.getItem('gloveup_onboarding_done_boxeador3@test.com') || '[]'));
check('el paso descartado se persiste en localStorage', doneSet.includes('gym_explore'), JSON.stringify(doneSet));

// ── Pulsar una tarjeta navega y la marca como hecha ───────────────────
await page.click('[data-step="sparring_search"]');
await page.waitForFunction(() => location.pathname === '/sparring', { timeout: 10000 });
check('pulsar una tarjeta navega a su destino (SPA, sin recarga)', true);

const doneAfterNav = await page.evaluate(() => JSON.parse(localStorage.getItem('gloveup_onboarding_done_boxeador3@test.com') || '[]'));
check('la tarjeta pulsada también se marca como hecha', doneAfterNav.includes('sparring_search'));

// ── Marcar todos los pasos restantes y ver el estado "todo listo" ────
await page.evaluate(() => {
    localStorage.setItem('gloveup_onboarding_done_boxeador3@test.com',
        JSON.stringify(['profile', 'sparring_search', 'challenge_sent', 'gym_explore']));
});
await page.goto(`${BASE}/primeros-pasos`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('[data-onboarding-root]')?.textContent.includes('¡Todo listo!'), { timeout: 15000 });
check('con todos los pasos hechos se muestra el mensaje de celebración', true);

check('el enlace de Primeros Pasos se oculta del menú cuando todo está hecho',
    await page.$eval('[data-nav="primeros-pasos"]', (el) => el.closest('li').hidden));

// ── Un entrenador ve sus propios pasos y su manual ────────────────────
await loginAs('entrenador1@test.com', 'entrenador');
await page.evaluate(() => localStorage.removeItem('gloveup_onboarding_done_entrenador1@test.com'));
await page.goto(`${BASE}/primeros-pasos`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelectorAll('[data-onboarding-root] article[data-step]').length > 0, { timeout: 15000 });

// entrenador1@test.com (seedMinimal) ya tiene un boxeador asignado
// (Boxeador.entrenadorId), así que ese paso se autocompleta y no aparece
// como tarjeta pendiente. El gimnasio del seed no lleva "creadoPorEmail"
// (dato del fixture, no de la lógica), así que ese paso sí queda pendiente
// — igual que pasaría con la versión clásica ante los mismos datos.
const coachDoneSet = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('gloveup_onboarding_done_entrenador1@test.com') || '[]'));
check('añadir boxeador se detecta como ya completado', coachDoneSet.includes('add_boxer'), coachDoneSet.join(', '));
check('se muestra el manual de entrenador', !(await page.$eval('[data-manual="entrenador"]', (el) => el.hidden)));
check('el manual de boxeador está oculto', await page.$eval('[data-manual="boxeador"]', (el) => el.hidden));

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
process.exit(failures ? 1 : 0);
