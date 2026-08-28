/**
 * landing-smoke.mjs — Comprobación de humo de la portada rediseñada.
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

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });

check('el shell es "public" (sin sidebar)', await page.$eval('body', (b) => b.dataset.shell === 'public'));
check('la vista lleva data-page="landing"', !!(await page.$('[data-page="landing"]')));

check('la cabecera pegajosa está presente', !!(await page.$('header.sticky')));

const words = await page.$$eval('h1 .hero-word', (els) => els.map((e) => e.textContent.trim()));
check('el titular se parte en 3 palabras animadas', words.join(' ') === 'Find your fight', words.join(' '));

check('los orbes decorativos del hero existen', (await page.$$('.hero-orb')).length === 2);

const chips = await page.$$eval('.hero-chip', (els) => els.map((e) => e.textContent.trim()));
check('las 4 disciplinas aparecen como chips', chips.join(',') === 'Boxeo,Muay Thai,MMA,Kickboxing', chips.join(','));

// ── Antes de hacer scroll: los bloques revelados siguen ocultos ──────
const beforeVisible = await page.$eval('#como-funciona h2', (el) => el.classList.contains('is-visible'));
check('"Cómo funciona" empieza oculto antes de hacer scroll', beforeVisible === false);

await page.evaluate(() => document.querySelector('#testimonios').scrollIntoView());
await page.waitForFunction(
    () => document.querySelector('#testimonios h2')?.classList.contains('is-visible'),
    { timeout: 5000 },
);
check('la sección de testimonios se revela al hacer scroll', true);

const starCount = await page.$$eval('figure.card:first-of-type .fa-star', (els) => els.length);
check('cada testimonio muestra 5 estrellas', starCount === 5, String(starCount));

// ── Navegación por ancla dentro de la misma página ────────────────────
const scrollBefore = await page.evaluate(() => window.scrollY);
await page.click('a[href="#como-funciona"]');
await new Promise((r) => setTimeout(r, 500));
const scrollAfter = await page.evaluate(() => window.scrollY);
const howTop = await page.$eval('#como-funciona', (el) => el.getBoundingClientRect().top);
check('el enlace "Cómo funciona" navega al ancla',
    scrollAfter < scrollBefore && howTop >= -150 && howTop <= 300,
    `antes=${scrollBefore} después=${scrollAfter} top=${howTop}`);

// ── El modal de login sigue funcionando desde "Iniciar sesión" ───────
await page.click('header button[data-login-trigger]');
await page.waitForFunction(() => document.getElementById('login-modal')?.hidden === false, { timeout: 5000 });
check('"Iniciar sesión" en la cabecera abre el modal de login', true);

await page.click('#login-modal button[data-modal-close]');
await page.waitForFunction(() => document.getElementById('login-modal')?.hidden === true, { timeout: 5000 });
check('el modal se cierra correctamente', true);

// ── "Probar la app" y el CTA del hero llevan de verdad a Sparring ────
check('"Probar la app" de la cabecera NO lleva data-login-trigger (navega de verdad)',
    !(await page.$eval('header a[href="/sparring"]', (el) => el.hasAttribute('data-login-trigger'))));

await page.click('header a[href="/sparring"]');
await page.waitForFunction(() => location.pathname === '/sparring', { timeout: 10000 });
const pathAfterTry = await page.evaluate(() => location.pathname);
check('"Probar la app" navega de verdad a /sparring sin pedir login', pathAfterTry === '/sparring');

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
process.exit(failures ? 1 : 0);
