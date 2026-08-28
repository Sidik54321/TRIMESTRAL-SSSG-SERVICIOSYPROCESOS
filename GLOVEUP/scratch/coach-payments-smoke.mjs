/**
 * coach-payments-smoke.mjs — Comprobación de humo de la pestaña Pagos.
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

await page.goto(`${BASE}/gestion`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('#cp-panel')?.hidden === false, { timeout: 15000 });

check('la pestaña Pagos existe y está visible', !(await page.$eval('#cp-tab-payments', (el) => el.hidden)));

await page.click('[data-tab="payments"]');
await page.waitForFunction(() => document.querySelector('#cp-payments-content')?.hidden === false, { timeout: 15000 });
check('activar la pestaña Pagos carga su contenido', true);

// Los <canvas> ya existen en el HTML estático desde el primer render de
// PHP (antes de que loadPayments() traiga los datos), así que no sirven
// para detectar que ha terminado de cargar: se espera a que la tarjeta
// del gimnasio tenga texto real.
await page.waitForFunction(
    () => document.querySelector('[data-pmetric="gimnasio"] [data-pmetric-value]')?.textContent.trim(),
    { timeout: 10000 },
);
check('las 5 tarjetas de métricas se dibujan con Chart.js',
    (await page.$$eval('[data-pmetric] canvas', (els) => els.length)) === 5);

const gymValue = await page.$eval('[data-pmetric="gimnasio"] [data-pmetric-value]', (el) => el.textContent.trim());
check('la métrica "Tu gimnasio" muestra el nombre real', gymValue === 'GloveUp Central', gymValue);

const boxersValue = await page.$eval('[data-pmetric="boxeadores"] [data-pmetric-value]', (el) => el.textContent.trim());
check('la métrica "Boxeadores activos" cuenta los boxeadores reales',
    boxersValue === '2', boxersValue); // Juan y Pedro, seedMinimal

// Se documenta el comportamiento real del backend en vez de fingir que
// funciona: /me/cobros es un stub y "pagos" no existe en el esquema de
// Boxeador (ver notas en coach-panel.php / coach-panel.js), así que estas
// dos métricas están siempre a cero.
const cobrosValue = await page.$eval('[data-pmetric="cobros"] [data-pmetric-value]', (el) => el.textContent.trim());
check('"Cobros" refleja el stub del backend (siempre 0€)', cobrosValue === '0€', cobrosValue);

const pagosValue = await page.$eval('[data-pmetric="pagos"] [data-pmetric-value]', (el) => el.textContent.trim());
check('"Pagos este mes" refleja que el campo no se persiste (0 / N)',
    pagosValue === '0 / 2', pagosValue);

check('se dibuja el gráfico de ingresos por inscripciones',
    await page.$eval('#cp-revenue-chart', (el) => el.getContext('2d') !== null));

// ── Editar el precio mensual ──────────────────────────────────────────
await page.evaluate(() => {
    const el = document.getElementById('cp-price-input');
    el.value = '75';
    el.dispatchEvent(new Event('input', { bubbles: true }));
});
const [saveResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/entrenadores/me') && r.request().method() === 'PUT'),
    page.click('#cp-save-price'),
]);
check('guardar el precio mensual responde 2xx', saveResp.ok(), String(saveResp.status()));

await page.waitForFunction(
    () => document.getElementById('cp-price-input')?.value === '75',
    { timeout: 10000 },
);
check('el precio guardado se refleja tras recargar sus datos', true);

const ingresosValue = await page.$eval('[data-pmetric="ingresos"] [data-pmetric-sub]', (el) => el.textContent.trim());
check('la métrica de ingresos usa el nuevo precio en su descripción',
    ingresosValue.includes('Precio mensual'));

// Restaurar el precio original (0) para no dejar el fixture modificado
await page.evaluate(() => {
    const el = document.getElementById('cp-price-input');
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
});
await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/entrenadores/me') && r.request().method() === 'PUT'),
    page.click('#cp-save-price'),
]);

// ── Cambiar de pestaña y volver no debería recargar (dato cacheado) ──
await page.click('[data-tab="gym"]');
await page.click('[data-tab="payments"]');
await new Promise((r) => setTimeout(r, 300));
check('volver a la pestaña Pagos sigue mostrando las métricas',
    !(await page.$eval('#cp-payments-content', (el) => el.hidden)));

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
process.exit(failures ? 1 : 0);
