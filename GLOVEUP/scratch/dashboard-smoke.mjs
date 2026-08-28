/**
 * dashboard-smoke.mjs — Comprobación de humo de Inicio (dashboard del boxeador).
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

// ── 1. Boxeador ───────────────────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await loginAs('boxeador1@test.com', 'boxeador');
await page.goto(`${BASE}/inicio`, { waitUntil: 'networkidle2' });

await page.waitForFunction(
    () => document.querySelector('.fc-toolbar') !== null,
    { timeout: 20000 },
);
check('el menú marca Inicio como activo',
    (await page.$eval('[data-nav="inicio"]', (el) => el.getAttribute('aria-current'))) === 'page');

check('el bloque de boxeador está visible',
    !(await page.$eval('[data-role="boxeador"]', (el) => el.hidden)));
check('el bloque de entrenador está oculto',
    await page.$eval('[data-role="entrenador"]', (el) => el.hidden));

// Métricas con Chart.js
await page.waitForFunction(
    () => document.querySelectorAll('[data-metric] canvas').length === 3,
    { timeout: 10000 },
);
const metricValues = await page.$$eval('[data-metric-value]', (els) => els.map((e) => e.textContent.trim()));
check('las 3 tarjetas de métricas muestran un valor numérico',
    metricValues.length === 3 && metricValues.every((v) => /^\d+$/.test(v)), metricValues.join(', '));

const chartsRendered = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-metric] canvas')).every((c) => c.getContext('2d')));
check('Chart.js dibuja las 3 donas', chartsRendered);

// Calendario con FullCalendar
check('FullCalendar se monta en el panel', await page.$eval('.glv-calendar .fc-toolbar-title', (el) => el.textContent.trim().length > 0));

// ── 2. Crear un evento personalizado ─────────────────────────────────
await page.click('.fc-daygrid-day[data-date] .fc-daygrid-day-frame');
await page.waitForFunction(() => document.querySelector('#event-modal')?.open, { timeout: 5000 });
check('hacer clic en un día abre el modal de nuevo evento',
    (await page.$eval('#event-title', (el) => el.textContent.trim())) === 'Nuevo evento');

await page.type('#event-field-title', 'Entrenamiento de fuerza');
await page.click('#event-colors .color-btn[data-color="#3b82f6"]');
check('elegir un color lo marca como seleccionado',
    (await page.$eval('#event-field-color', (el) => el.value)) === '#3b82f6');

const [createResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/calendar-events') && r.request().method() === 'POST'),
    page.click('#event-form button[type="submit"]'),
]);
check('crear el evento responde 2xx', createResp.ok(), String(createResp.status()));

await page.waitForFunction(() => !document.querySelector('#event-modal')?.open, { timeout: 5000 });
await page.waitForFunction(
    () => document.querySelectorAll('.glv-calendar .fc-event').length > 0,
    { timeout: 10000 },
);
check('el evento creado aparece en el calendario',
    (await page.$eval('.glv-calendar', (el) => el.textContent)).includes('Entrenamiento de fuerza'));

// ── 3. Editar el evento recién creado ────────────────────────────────
await page.evaluate(() => {
    const ev = Array.from(document.querySelectorAll('.glv-calendar .fc-event'))
        .find((el) => el.textContent.includes('Entrenamiento de fuerza'));
    ev?.click();
});
await page.waitForFunction(() => document.querySelector('#event-modal')?.open, { timeout: 5000 });
check('hacer clic en el evento abre el modal en modo edición',
    (await page.$eval('#event-title', (el) => el.textContent.trim())) === 'Editar evento');
check('el botón eliminar aparece al editar',
    !(await page.$eval('#event-delete', (el) => el.hidden)));

await page.evaluate(() => { document.getElementById('event-field-title').value = ''; });
await page.type('#event-field-title', 'Entrenamiento intenso');

const [updateResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/calendar-events/') && r.request().method() === 'PUT'),
    page.click('#event-form button[type="submit"]'),
]);
check('editar el evento responde 2xx', updateResp.ok(), String(updateResp.status()));

await page.waitForFunction(
    () => document.querySelector('.glv-calendar')?.textContent.includes('Entrenamiento intenso'),
    { timeout: 10000 },
);
check('el calendario refleja el título editado', true);

// ── 4. Eliminar el evento ─────────────────────────────────────────────
await page.evaluate(() => {
    const ev = Array.from(document.querySelectorAll('.glv-calendar .fc-event'))
        .find((el) => el.textContent.includes('Entrenamiento intenso'));
    ev?.click();
});
await page.waitForFunction(() => document.querySelector('#event-modal')?.open, { timeout: 5000 });
await page.click('#event-delete');
await page.waitForFunction(() => document.querySelector('#event-delete-confirm')?.open, { timeout: 5000 });

const [deleteResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/calendar-events/') && r.request().method() === 'DELETE'),
    page.click('#event-delete-confirm button[value="confirm"]'),
]);
check('eliminar el evento responde 2xx', deleteResp.ok(), String(deleteResp.status()));

await page.waitForFunction(
    () => !document.querySelector('.glv-calendar')?.textContent.includes('Entrenamiento intenso'),
    { timeout: 10000 },
);
check('el evento eliminado desaparece del calendario', true);

// ── 5. Entrenador ve su propio panel (calendario) ─────────────────────
// El panel de Inicio del entrenador ahora está migrado (ver
// coach-dashboard-smoke.mjs para su cobertura completa); aquí sólo se
// confirma que el ramal por rol sigue eligiendo el bloque correcto.
await loginAs('entrenador1@test.com', 'entrenador');
await page.goto(`${BASE}/inicio`, { waitUntil: 'networkidle2' });
check('un entrenador ve el bloque de entrenador',
    !(await page.$eval('[data-role="entrenador"]', (el) => el.hidden)));
check('un entrenador no ve el bloque de boxeador',
    await page.$eval('[data-role="boxeador"]', (el) => el.hidden));

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
process.exit(failures ? 1 : 0);
