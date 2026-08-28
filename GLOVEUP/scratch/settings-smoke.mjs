/**
 * settings-smoke.mjs — Comprobación de humo de Ajustes.
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
    localStorage.setItem('gloveup_user_email', 'boxeador1@test.com');
    localStorage.setItem('gloveup_user_role', 'boxeador');
});

await page.goto(`${BASE}/ajustes`, { waitUntil: 'networkidle2' });

check('el menú marca Ajustes como activo',
    (await page.$eval('[data-nav="ajustes"]', (el) => el.getAttribute('aria-current'))) === 'page');
check('se muestra el menú principal de ajustes',
    !(await page.$eval('#settings-home', (el) => el.hidden)));
check('el botón Volver está oculto en el menú principal',
    await page.$eval('#settings-back', (el) => el.hidden));

// ── Notificaciones ────────────────────────────────────────────────────
await page.click('[data-goto="settings-notifications"]');
check('entrar en Notificaciones oculta el menú principal',
    await page.$eval('#settings-home', (el) => el.hidden));
check('el botón Volver aparece', !(await page.$eval('#settings-back', (el) => el.hidden)));

await page.click('[data-notif="mensajes"]'); // lo desmarca (empieza checked)
await page.click('#settings-save-notifs');
await new Promise((r) => setTimeout(r, 1000));
check('guardar notificaciones vuelve al menú principal',
    !(await page.$eval('#settings-home', (el) => el.hidden)));

const storedNotifs = await page.evaluate(() => JSON.parse(localStorage.getItem('gloveup_notif_prefs') || '{}'));
check('la preferencia desmarcada se persiste en localStorage',
    storedNotifs.mensajes === false && storedNotifs.sparring === true,
    JSON.stringify(storedNotifs));

// Reentrar debe reflejar lo guardado
await page.click('[data-goto="settings-notifications"]');
check('al reentrar, el toggle refleja el valor guardado',
    (await page.$eval('[data-notif="mensajes"]', (el) => el.checked)) === false);
await page.click('#settings-back');

// ── Paleta de colores ────────────────────────────────────────────────
await page.click('[data-goto="settings-palette"]');
check('se muestra la subvista de paleta',
    !(await page.$eval('#settings-palette', (el) => el.hidden)));

await page.evaluate(() => {
    const input = document.querySelector('[data-color-input="accent"]');
    input.value = '#3b82f6';
    input.dispatchEvent(new Event('input', { bubbles: true }));
});

const accentVar = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
check('cambiar el acento actualiza la variable CSS en <html>', accentVar === '#3b82f6', accentVar);

const btnBg = await page.evaluate(() => {
    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    document.body.appendChild(btn);
    const bg = getComputedStyle(btn).backgroundColor;
    btn.remove();
    return bg;
});
check('un botón primario ya usa el nuevo acento (naranja -> azul)',
    btnBg === 'rgb(59, 130, 246)', btnBg);

const storedAccent = await page.evaluate(() => JSON.parse(localStorage.getItem('gloveup_theme_accent') || 'null'));
check('el acento personalizado se guarda en localStorage', storedAccent?.base === '#3b82f6');

// ── Persiste tras recargar (aplicado antes del primer pintado) ───────
await page.reload({ waitUntil: 'networkidle2' });
const accentAfterReload = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
check('el acento personalizado sobrevive a una recarga completa',
    accentAfterReload === '#3b82f6', accentAfterReload);

// ── Restablecer ───────────────────────────────────────────────────────
await page.goto(`${BASE}/ajustes`, { waitUntil: 'networkidle2' });
await page.click('[data-goto="settings-palette"]');
await page.click('[data-color-reset="accent"]');
const accentAfterReset = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
check('restablecer el acento vuelve al naranja de fábrica',
    accentAfterReset === '#f97316', accentAfterReset);
check('restablecer borra la clave de localStorage',
    (await page.evaluate(() => localStorage.getItem('gloveup_theme_accent'))) === null);

// El resto de la SPA (fuera de Ajustes) también debe verse ya restablecida
await page.goto(`${BASE}/gimnasios`, { waitUntil: 'networkidle2' });
const accentOnOtherPage = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
check('el color restablecido se aplica también en otras páginas',
    accentOnOtherPage === '#f97316', accentOnOtherPage);

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
process.exit(failures ? 1 : 0);
