/**
 * profile-smoke.mjs — Comprobación de humo de Mi Perfil, Ver Perfil y Mis Sparrings.
 *
 *   docker run --rm --network docker_default \
 *     -v "<ruta>/scratch:/home/pptruser/work" -w /home/pptruser/work \
 *     ghcr.io/puppeteer/puppeteer:latest node profile-smoke.mjs
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
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

// ── Sesión de boxeador (seedMinimal.js) ─────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await page.evaluate(() => {
    localStorage.setItem('gloveup_user_email', 'boxeador1@test.com');
    localStorage.setItem('gloveup_user_role', 'boxeador');
});

// ── Mi Perfil: carga y campos de boxeador ───────────────────────────
await page.goto(`${BASE}/perfil`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('#p-name')?.value, { timeout: 15000 });

check('el menú marca Mi Perfil como activo (topbar)',
    (await page.$eval('a[data-nav="perfil"]', (el) => el.getAttribute('aria-current'))) === 'page');

check('el formulario carga el nombre del boxeador',
    (await page.$eval('#p-name', (el) => el.value)) === 'Juan Boxeador');

check('los campos de boxeador están visibles', await page.$eval('#p-alias', (el) => !el.closest('[data-role]').hidden));
check('los campos de entrenador están ocultos', await page.$eval('#p-coach-gym', (el) => el.closest('[data-role]').hidden));

// Editar y guardar
await page.evaluate(() => {
    const el = document.getElementById('p-location');
    el.value = 'Madrid Centro';
    el.dispatchEvent(new Event('input', { bubbles: true }));
});
check('el campo refleja el nuevo valor antes de guardar',
    (await page.$eval('#p-location', (el) => el.value)) === 'Madrid Centro');

const [saveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/boxeadores/me') && r.request().method() === 'PUT'),
    page.click('#btn-save-profile'),
]);
const saveBody = saveResponse.request().postData();
console.log('PUT body:', saveBody);
check('guardar el perfil llama al PUT y responde 2xx', saveResponse.ok(), String(saveResponse.status()));

await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('#p-name')?.value, { timeout: 15000 });
check('la ubicación editada persiste tras recargar',
    (await page.$eval('#p-location', (el) => el.value)) === 'Madrid Centro');

// ── Ver perfil de otro boxeador desde el buscador ───────────────────
await page.type('#lookup-input', 'boxeador2@test.com');
await page.click('#lookup-btn');
await page.waitForFunction(() => location.pathname.startsWith('/perfil/'), { timeout: 10000 });
await page.waitForSelector('#view-card:not([hidden])', { timeout: 15000 });

check('la URL cambia a /perfil/{identifier} sin recargar documento',
    page.url().includes('/perfil/boxeador2%40test.com') || page.url().includes('/perfil/boxeador2@test.com'));
check('la ficha de sólo lectura muestra el nombre del otro boxeador',
    (await page.$eval('#view-card h2', (el) => el.textContent.trim())).length > 0,
    await page.$eval('#view-card h2', (el) => el.textContent.trim()));

// ── Ver perfil desde Buscar Sparring ─────────────────────────────────
await page.goto(`${BASE}/sparring`, { waitUntil: 'networkidle2' });
await page.waitForSelector('#sp-list article', { timeout: 15000 });
await page.click('#sp-list a[href^="/perfil/"]');
await page.waitForFunction(() => location.pathname.startsWith('/perfil/'), { timeout: 10000 });
await page.waitForSelector('#view-card:not([hidden])', { timeout: 15000 });
check('el enlace "Ver perfil" de Sparring navega a la ficha migrada', true);

await page.goBack();
await page.waitForSelector('#sp-list article', { timeout: 15000 });
check('volver desde la ficha restaura la lista de sparring',
    (await page.$$('#sp-list article')).length > 0);

// ── Mis Sparrings ────────────────────────────────────────────────────
await page.goto(`${BASE}/mis-sparrings`, { waitUntil: 'networkidle2' });
await page.waitForFunction(
    () => document.querySelector('#challenges-count')?.textContent !== undefined
        && !document.querySelector('#history-count').textContent.includes('undefined'),
    { timeout: 15000 },
);

check('el menú marca Mis Sparrings como activo',
    (await page.$eval('[data-nav="mis-sparrings"]', (el) => el.getAttribute('aria-current'))) === 'page');

const historyCount = await page.$eval('#history-count', (el) => el.textContent.trim());
check('el historial de sparrings carga (aunque esté vacío)', historyCount.length > 0, historyCount);

// ── Un entrenador ve el aviso de sección no disponible ──────────────
await page.evaluate(() => {
    localStorage.setItem('gloveup_user_email', 'entrenador1@test.com');
    localStorage.setItem('gloveup_user_role', 'entrenador');
});
await page.goto(`${BASE}/mis-sparrings`, { waitUntil: 'networkidle2' });
check('un entrenador ve el aviso de sección exclusiva de boxeadores',
    (await page.$eval('[data-page="my-sparrings"]', (el) => el.textContent)).includes('sólo para boxeadores'));

await page.goto(`${BASE}/perfil`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('#p-name')?.value !== undefined, { timeout: 15000 });
check('un entrenador ve los campos de entrenador en Mi Perfil',
    await page.$eval('#p-coach-gym', (el) => !el.closest('[data-role]').hidden));
check('un entrenador no ve el buscador de boxeadores',
    await page.$eval('#lookup-card', (el) => el.hidden));

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));

process.exit(failures ? 1 : 0);
