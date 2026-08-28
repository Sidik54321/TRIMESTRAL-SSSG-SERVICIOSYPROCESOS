/**
 * guest-mode-smoke.mjs — Comprobación de humo del modo invitado.
 *
 * Verifica que, sin sesión, se puede explorar Gimnasios y Sparring, que el
 * resto de secciones gatean con el modal de login, y que las acciones
 * reales (favorito, ver ficha, ver perfil, retar) también lo abren en vez
 * de ejecutarse.
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
await page.setViewport({ width: 1280, height: 900 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

async function isModalOpen() {
    return page.evaluate(() => document.getElementById('login-modal')?.hidden === false);
}
async function closeModal() {
    await page.click('#login-modal button[data-modal-close]');
    await page.waitForFunction(() => document.getElementById('login-modal')?.hidden === true, { timeout: 5000 });
}

// ── 1. /gimnasios sin sesión: ya NO expulsa a login ───────────────────
await page.goto(`${BASE}/gimnasios`, { waitUntil: 'networkidle2' });
check('sin sesión, /gimnasios se queda en /gimnasios (no redirige a login)',
    page.url() === `${BASE}/gimnasios`, page.url());
check('el shell tiene sidebar (shell=app)',
    (await page.$eval('body', (b) => b.dataset.shell)) === 'app');

await page.waitForSelector('#gym-grid article', { timeout: 15000 });
const gymCount = await page.$$eval('#gym-grid article', (els) => els.length);
check('la rejilla de gimnasios carga datos reales sin sesión', gymCount === 2, String(gymCount));

check('el aviso de modo invitado se muestra en el sidebar',
    !(await page.$eval('[data-guest-only]', (el) => el.hidden)));
check('"Cerrar sesión" está oculto sin sesión',
    await page.$eval('#logout-button', (el) => el.hidden));
check('el chip de perfil dice "Iniciar sesión"',
    (await page.$eval('#topbar-user', (el) => el.textContent.trim())) === 'Iniciar sesión');

// ── 2. Acciones gateadas en Gimnasios ─────────────────────────────────
await page.click('#gym-grid article [data-fav]');
check('pulsar el favorito sin sesión abre el login', await isModalOpen());
await closeModal();

await page.click('#gym-grid article a[href^="/gimnasios/"]');
check('pulsar "Ver gimnasio" sin sesión abre el login (no navega)', await isModalOpen());
check('la URL sigue en /gimnasios (no navegó a la ficha)', page.url() === `${BASE}/gimnasios`);
await closeModal();

// ── 3. Enlaces del sidebar/topbar que no son explorables ──────────────
await page.click('a[data-nav="inicio"]');
check('"Inicio" en el sidebar abre el login en vez de navegar', await isModalOpen());
await closeModal();

await page.click('a[data-nav="ajustes"]');
check('"Ajustes" en el sidebar abre el login en vez de navegar', await isModalOpen());
await closeModal();

await page.click('a[data-nav="perfil"]');
check('el chip de perfil de la topbar abre el login en vez de navegar', await isModalOpen());
await closeModal();

check('la URL nunca cambió durante esos tres clics', page.url() === `${BASE}/gimnasios`, page.url());

// ── 4. Navegar de verdad a Sparring (ambas explorables) ────────────────
await page.click('a[data-nav="sparring"]');
await page.waitForFunction(() => location.pathname === '/sparring', { timeout: 10000 });
check('el enlace "Buscar Sparring" del sidebar SÍ navega (es explorable)', true);
await page.waitForSelector('#sp-list article', { timeout: 15000 });
check('la lista de sparring carga datos reales sin sesión',
    (await page.$$eval('#sp-list article', (els) => els.length)) > 0);

// ── 5. Acciones gateadas en Sparring ───────────────────────────────────
const challengeLabel = await page.$eval('#sp-list article [data-challenge]', (el) => el.textContent.trim());
check('el botón de retar dice "Inicia sesión" y no está deshabilitado',
    challengeLabel === 'Inicia sesión'
    && !(await page.$eval('#sp-list article [data-challenge]', (el) => el.disabled)));

await page.click('#sp-list article [data-challenge]');
check('pulsar "Inicia sesión" (retar) abre el login en vez del modal de reto',
    await isModalOpen() && !(await page.$eval('#challenge-modal', (el) => el.open)));
await closeModal();

await page.click('#sp-list article a[data-save-state]');
check('pulsar "Ver perfil" sin sesión abre el login (no navega)', await isModalOpen());
check('la URL sigue en /sparring (no navegó al perfil)', page.url() === `${BASE}/sparring`);
await closeModal();

// ── 6. Con sesión, todo vuelve a comportarse con normalidad ───────────
await page.evaluate(() => {
    localStorage.setItem('gloveup_user_email', 'boxeador1@test.com');
    localStorage.setItem('gloveup_user_role', 'boxeador');
});
await page.goto(`${BASE}/gimnasios`, { waitUntil: 'networkidle2' });
await page.waitForSelector('#gym-grid article', { timeout: 15000 });

check('con sesión, el aviso de invitado se oculta',
    await page.$eval('[data-guest-only]', (el) => el.hidden));
check('con sesión, "Cerrar sesión" se muestra',
    !(await page.$eval('#logout-button', (el) => el.hidden)));

await page.click('#gym-grid article a[href^="/gimnasios/"]');
await page.waitForFunction(() => location.pathname.startsWith('/gimnasios/'), { timeout: 10000 });
check('con sesión, "Ver gimnasio" navega de verdad a la ficha', true);

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
process.exit(failures ? 1 : 0);
