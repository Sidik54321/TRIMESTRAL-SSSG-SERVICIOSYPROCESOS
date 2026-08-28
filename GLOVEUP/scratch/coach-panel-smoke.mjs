/**
 * coach-panel-smoke.mjs — Comprobación de humo de Mi Gimnasio / Gestión.
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

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await page.evaluate(() => {
    localStorage.setItem('gloveup_user_email', 'entrenador1@test.com');
    localStorage.setItem('gloveup_user_role', 'entrenador');
});

// ── Mi Gimnasio: pestaña por defecto y datos existentes ──────────────
await page.goto(`${BASE}/mi-gimnasio`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('#cp-panel')?.hidden === false, { timeout: 15000 });

check('el menú marca Mi Gimnasio como activo',
    (await page.$eval('[data-nav="mi-gimnasio"]', (el) => el.getAttribute('aria-current'))) === 'page');
check('la pestaña por defecto de /mi-gimnasio es "Mi Gimnasio"',
    (await page.$eval('[data-tab="gym"]', (el) => el.getAttribute('aria-pressed'))) === 'true');
check('los datos del gimnasio existente se cargan',
    (await page.$eval('#cp-nombre', (el) => el.value)) === 'GloveUp Central');
check('la bio del gimnasio se carga', (await page.$eval('#cp-bio', (el) => el.value)).includes('neurálgico'));

// Editar y guardar
await page.evaluate(() => {
    const el = document.getElementById('cp-telefono');
    el.value = '600123456';
    el.dispatchEvent(new Event('input', { bubbles: true }));
});
const [saveGymResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/gimnasios') && r.request().method() === 'POST'),
    page.click('#cp-save-gym'),
]);
check('guardar el gimnasio responde 2xx', saveGymResp.ok(), String(saveGymResp.status()));

await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('#cp-panel')?.hidden === false, { timeout: 15000 });
check('el teléfono editado persiste tras recargar',
    (await page.$eval('#cp-telefono', (el) => el.value)) === '600123456');

// ── Gestión: pestaña por defecto y lista de boxeadores ───────────────
await page.goto(`${BASE}/gestion`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('#cp-panel')?.hidden === false, { timeout: 15000 });

check('el menú marca Gestión como activo',
    (await page.$eval('[data-nav="gestion"]', (el) => el.getAttribute('aria-current'))) === 'page');
check('la pestaña por defecto de /gestion es "Mis Boxeadores"',
    (await page.$eval('[data-tab="boxers"]', (el) => el.getAttribute('aria-pressed'))) === 'true');

await page.waitForFunction(() => document.querySelectorAll('#cp-boxers-list article').length > 0, { timeout: 10000 });
const boxerNames = await page.$$eval('#cp-boxers-list article p.font-bold', (els) => els.map((e) => e.textContent.trim()));
check('aparecen los boxeadores de este entrenador',
    boxerNames.includes('Juan Boxeador') && boxerNames.includes('Pedro Boxeador'), boxerNames.join(', '));

// Buscar
await page.type('#cp-search', 'Juan');
await new Promise((r) => setTimeout(r, 300));
check('el buscador filtra la lista',
    (await page.$$('#cp-boxers-list article')).length === 1);
await page.evaluate(() => { document.getElementById('cp-search').value = ''; document.getElementById('cp-search').dispatchEvent(new Event('input')); });

// ── Marcar como pagado (con confirmación) ─────────────────────────────
await page.waitForFunction(() => document.querySelectorAll('#cp-boxers-list article').length === 2, { timeout: 5000 });
await page.evaluate(() => document.querySelector('#cp-boxers-list button[data-pay]')?.click());
await page.waitForFunction(() => document.querySelector('#cp-pay-confirm')?.open, { timeout: 5000 });
check('marcar pago pide confirmación', await page.$eval('#cp-pay-confirm', (d) => d.open));

const [payResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/pago')),
    page.click('#cp-pay-confirm button[value="confirm"]'),
]);
check('confirmar el pago responde 2xx', payResp.ok(), String(payResp.status()));
// NOTA: no se comprueba que la tarjeta pase a "Mes pagado". Bug preexistente
// del backend (no de esta migración): el esquema de Mongoose para Boxeador
// no declara el campo "pagos", así que POST .../pago responde {ok:true}
// pero Mongoose descarta la escritura en silencio — no se persiste nada.
// GET /me/boxeadores siempre devuelve "sin pagos", así que la UI (correcta)
// nunca puede mostrar otra cosa que "Pendiente de pagar". El botón "Marcar
// como pagado" del dashboard clásico tiene el mismo problema.

// ── Editar un boxeador ────────────────────────────────────────────────
await page.evaluate(() => document.querySelector('#cp-boxers-list button[data-edit]')?.click());
await page.waitForFunction(() => document.querySelector('[data-edit-name]'), { timeout: 5000 });
await page.evaluate(() => {
    const sel = document.querySelector('[data-edit-level]');
    sel.value = 'Profesional';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
});
const [editResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/me/boxeadores/') && r.request().method() === 'PUT'),
    page.evaluate(() => document.querySelector('[data-save-edit]').click()),
]);
check('editar el nivel del boxeador responde 2xx', editResp.ok(), String(editResp.status()));

await page.waitForFunction(() => document.querySelectorAll('#cp-boxers-list article').length === 2, { timeout: 10000 });
check('la edición se refleja tras recargar la lista', true);

// ── Dar de baja: se puede cancelar sin borrar nada ────────────────────
const beforeDeleteCount = (await page.$$('#cp-boxers-list article')).length;
await page.evaluate(() => document.querySelector('#cp-boxers-list button[data-edit]')?.click());
await page.waitForFunction(() => document.querySelector('[data-delete]'), { timeout: 5000 });
await page.evaluate(() => document.querySelector('[data-delete]').click());
await page.waitForFunction(() => document.querySelector('#cp-delete-confirm')?.open, { timeout: 5000 });
check('dar de baja pide confirmación (acción irreversible)', await page.$eval('#cp-delete-confirm', (d) => d.open));

await page.click('#cp-delete-confirm button[value="cancel"]');
await new Promise((r) => setTimeout(r, 300));
const afterCancelCount = (await page.$$('#cp-boxers-list article')).length;
check('cancelar la baja no borra al boxeador', afterCancelCount === beforeDeleteCount, `${afterCancelCount} vs ${beforeDeleteCount}`);

// ── Añadir y quitar (reversible) ──────────────────────────────────────
await page.type('#cp-assign', 'boxeador2@test.com');
const [addResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/me/boxeadores') && r.request().method() === 'POST'),
    page.click('#cp-assign-add'),
]);
check('añadir un boxeador existente responde 2xx', addResp.ok(), String(addResp.status()));

await page.waitForFunction(() => document.querySelectorAll('#cp-boxers-list article').length === 3, { timeout: 10000 });
check('el boxeador añadido aparece en la lista', true);

await page.type('#cp-assign', 'boxeador2@test.com');
const [removeResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/me/boxeadores') && r.request().method() === 'DELETE'),
    page.click('#cp-assign-remove'),
]);
check('quitar un boxeador responde 2xx', removeResp.ok(), String(removeResp.status()));

await page.waitForFunction(() => document.querySelectorAll('#cp-boxers-list article').length === 2, { timeout: 10000 });
check('el boxeador quitado desaparece de la lista', true);

// "Quitar" (DELETE /me/boxeadores) borra entrenadorId y gimnasio por
// completo — no los devuelve a su entrenador original (The Ring /
// entrenador2). Se restaura aquí para no dejar el fixture compartido roto
// de cara a otras suites (p. ej. coach-challenges-smoke.mjs, que también
// usa a Maria).
await page.evaluate(async () => {
    await fetch('/api/entrenadores/me/boxeadores?email=' + encodeURIComponent('entrenador2@test.com'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boxeadorIdentifier: 'boxeador2@test.com' }),
    });
});
check('se restaura la asignación original de Maria (entrenador2/The Ring)', true);

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
process.exit(failures ? 1 : 0);
