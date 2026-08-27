/**
 * spa-smoke.mjs — Comprobación de humo de la SPA en un navegador real.
 *
 * Se ejecuta dentro de un contenedor con Chromium, en la misma red que el
 * resto de servicios, así que la app responde en http://web.
 *
 *   docker run --rm --network docker_default \
 *     -v "<ruta>/scratch:/work" -w /work \
 *     ghcr.io/puppeteer/puppeteer:latest node spa-smoke.mjs
 */

import puppeteer from 'puppeteer';

const BASE = process.env.BASE || 'http://web';
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
    results.push(`${ok ? 'OK  ' : 'FALLO'} ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) failures += 1;
}

const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// Se recogen los errores de consola y de red para detectar recursos rotos
const consoleErrors = [];
const failedRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('requestfailed', (r) => failedRequests.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

// ── 1. Landing pública ────────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
check('landing renderiza el hero',
    (await page.$eval('h1', (el) => el.textContent.trim().toLowerCase())) === 'find your fight');

check('Tailwind aplicado (botón naranja)',
    (await page.$eval('.btn-primary', (el) => getComputedStyle(el).backgroundColor)) === 'rgb(249, 115, 22)');

// El modal debe abrirse sin navegar
await page.click('[data-login-trigger]');
check('modal de login se abre', !(await page.$eval('#login-modal', (el) => el.hidden)));
await page.click('[data-modal-close]');

// ── 2. Sesión: /gimnasios sin login debe expulsar ─────────────────
await page.goto(`${BASE}/gimnasios`, { waitUntil: 'networkidle2' });
check('sin sesión redirige al login',
    page.url().includes('/legacy/auth/'), page.url());

// ── 3. Con sesión simulada ────────────────────────────────────────
await page.evaluate(() => {
    localStorage.setItem('gloveup_user_email', 'boxeador1@test.com');
    localStorage.setItem('gloveup_user_role', 'boxeador');
});

await page.goto(`${BASE}/gimnasios`, { waitUntil: 'networkidle2' });
await page.waitForSelector('#gym-grid article', { timeout: 15000 });

const cards = await page.$$eval('#gym-grid article h4', (els) => els.map((e) => e.textContent.trim()));
check('la rejilla carga gimnasios de la API', cards.length === 2, cards.join(', '));

check('el menú marca Gimnasios como activo',
    (await page.$eval('[data-nav="gimnasios"]', (el) => el.getAttribute('aria-current'))) === 'page');

check('el rol boxeador oculta las secciones de entrenador',
    await page.$eval('[data-roles="entrenador"]', (el) => el.hidden));

// ── 4. Navegación SPA: no debe recargar el documento ──────────────
await page.evaluate(() => { window.__noReload = true; });
await page.click('a[data-nav="ajustes"]');
await page.waitForFunction(() => location.pathname === '/ajustes', { timeout: 10000 });

check('navegación SPA sin recarga de página',
    await page.evaluate(() => window.__noReload === true));
check('la URL cambia con history', page.url().endsWith('/ajustes'));
check('el título del documento se actualiza',
    (await page.title()).startsWith('Ajustes'));
check('la barra superior refleja la sección',
    (await page.$eval('#topbar-title', (el) => el.textContent.trim())) === 'Ajustes');

// ── 5. Atrás/adelante del navegador ───────────────────────────────
await page.goBack();
await page.waitForFunction(() => location.pathname === '/gimnasios', { timeout: 10000 });
await page.waitForSelector('#gym-grid article', { timeout: 15000 });
check('el botón atrás restaura la vista anterior',
    await page.evaluate(() => window.__noReload === true));

// ── 6. Ficha de gimnasio ──────────────────────────────────────────
await page.click('#gym-grid article a[href^="/gimnasios/"]');
await page.waitForSelector('#gym-detail:not([hidden])', { timeout: 15000 });
check('la ficha de gimnasio carga sus datos',
    (await page.$eval('#gym-detail h2', (el) => el.textContent.trim())).length > 0,
    await page.$eval('#gym-detail h2', (el) => el.textContent.trim()));

// ── 7. Filtros y favoritos ────────────────────────────────────────
await page.goBack();
await page.waitForSelector('#gym-grid article', { timeout: 15000 });

await page.type('#gym-search', 'ring');
await page.waitForFunction(
    () => document.querySelectorAll('#gym-grid article').length === 1,
    { timeout: 5000 },
).then(() => check('la búsqueda filtra la rejilla', true))
 .catch(() => check('la búsqueda filtra la rejilla', false));

await page.click('#gym-reset');
await page.click('#gym-grid article [data-fav]');
check('el favorito se guarda en localStorage',
    (await page.evaluate(() => JSON.parse(localStorage.getItem('gloveup_gym_favorites') || '[]'))).length === 1);

// ── 8. Tema oscuro ────────────────────────────────────────────────
await page.click('#theme-toggle');
check('el tema oscuro se activa',
    await page.evaluate(() => document.documentElement.classList.contains('theme-dark')));
check('el tema oscuro persiste',
    (await page.evaluate(() => localStorage.getItem('gloveup_theme'))) === 'dark');

// ── 9. 404 ────────────────────────────────────────────────────────
await page.goto(`${BASE}/ruta-inventada`, { waitUntil: 'networkidle2' });
check('ruta desconocida muestra el 404',
    (await page.$eval('body', (el) => el.textContent)).includes('404'));

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);

if (consoleErrors.length) {
    console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
}
if (failedRequests.length) {
    console.log('\nPeticiones fallidas:\n  ' + [...new Set(failedRequests)].join('\n  '));
}

process.exit(failures ? 1 : 0);
