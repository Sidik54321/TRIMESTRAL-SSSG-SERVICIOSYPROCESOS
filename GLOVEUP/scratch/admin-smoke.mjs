/**
 * admin-smoke.mjs — Comprobación de humo del panel de administración.
 */

import puppeteer from 'puppeteer';

const BASE = process.env.BASE || 'http://web';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
    console.error('Falta la variable de entorno ADMIN_PASSWORD');
    process.exit(1);
}

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

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });

check('el shell es "public" (sin sidebar de boxeador)',
    (await page.$eval('body', (b) => b.dataset.shell)) === 'public');
check('se muestra la pantalla de login de admin', !(await page.$eval('#admin-login', (el) => el.hidden)));
check('el panel está oculto hasta autenticar', await page.$eval('#admin-panel', (el) => el.hidden));

// ── Contraseña incorrecta ─────────────────────────────────────────────
await page.type('#admin-password', 'contraseña-mala');
await page.click('#admin-login-submit');
await page.waitForFunction(() => !document.getElementById('admin-login-error')?.hidden, { timeout: 5000 });
check('contraseña incorrecta muestra un error', true);
check('el panel sigue oculto tras el fallo', await page.$eval('#admin-panel', (el) => el.hidden));

// ── Contraseña correcta ───────────────────────────────────────────────
await page.evaluate(() => { document.getElementById('admin-password').value = ''; });
await page.type('#admin-password', ADMIN_PASSWORD, { delay: 0 });
await page.click('#admin-login-submit');
await page.waitForFunction(() => document.getElementById('admin-panel')?.hidden === false, { timeout: 10000 });
check('login correcto abre el panel', true);

const hasToken = await page.evaluate(() => !!localStorage.getItem('gloveup_admin_token'));
check('el token se guarda en localStorage', hasToken);

// ── Resumen ────────────────────────────────────────────────────────────
await page.waitForFunction(() => !document.getElementById('admin-stats')?.hidden, { timeout: 10000 });
const usuariosCount = await page.$eval('[data-stat="usuarios"] [data-stat-value]', (el) => el.textContent.trim());
check('la tarjeta de usuarios muestra un número real', Number(usuariosCount) >= 4, usuariosCount);

const chartExists = await page.$eval('#admin-growth-chart', (el) => el.getContext('2d') !== null);
check('el gráfico de altas se dibuja', chartExists);

// ── Recargar y comprobar que la sesión de admin persiste ───────────────
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.getElementById('admin-panel')?.hidden === false, { timeout: 10000 });
check('recargar la página mantiene la sesión de admin (token en localStorage)', true);

// ── Usuarios: listar, crear, borrar ────────────────────────────────────
await page.click('[data-tab="usuarios"]');
await page.waitForFunction(() => !document.getElementById('admin-users-table')?.hidden, { timeout: 10000 });
const beforeRows = await page.$$eval('#admin-users-body tr', (els) => els.length);
check('la tabla de usuarios carga filas reales', beforeRows >= 4, String(beforeRows));

await page.click('#admin-create-user-btn');
await page.waitForFunction(() => document.getElementById('admin-create-modal')?.open, { timeout: 5000 });
await page.select('#admin-create-rol', 'boxeador');
await page.type('#admin-create-nombre', 'Admin Test Boxer');
await page.type('#admin-create-email', 'admintestboxer@gloveup.com');
await page.type('#admin-create-password', 'Password123');
await page.type('#admin-create-dni', 'ADMINSMOKE1');
const [createResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/admin/usuarios') && r.request().method() === 'POST'),
    page.click('#admin-create-submit'),
]);
check('crear usuario responde 2xx', createResp.ok(), String(createResp.status()));

await page.waitForFunction(
    (before) => document.querySelectorAll('#admin-users-body tr').length > before,
    { timeout: 10000 },
    beforeRows,
);
const afterCreateRows = await page.$$eval('#admin-users-body tr', (els) => els.length);
check('el usuario creado aparece en la tabla', afterCreateRows === beforeRows + 1,
    `${beforeRows} -> ${afterCreateRows}`);

// Borrarlo para dejar el fixture como estaba
const [deleteResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/admin/usuarios/') && r.request().method() === 'DELETE'),
    (async () => {
        await page.evaluate(() => {
            const row = [...document.querySelectorAll('#admin-users-body tr')]
                .find((tr) => tr.textContent.includes('Admin Test Boxer'));
            row.querySelector('[data-delete-user]').click();
        });
        await page.waitForFunction(() => document.getElementById('admin-confirm-modal')?.open, { timeout: 5000 });
        await page.click('#admin-confirm-ok');
    })(),
]);
check('borrar usuario responde 2xx', deleteResp.ok(), String(deleteResp.status()));

await page.waitForFunction(
    (before) => document.querySelectorAll('#admin-users-body tr').length === before,
    { timeout: 10000 },
    beforeRows,
);
check('el usuario borrado desaparece de la tabla', true);

// ── Gimnasios: crear uno vía API pública y borrarlo desde el panel ─────
const gymName = `Admin Smoke Gym ${Date.now()}`;
await page.evaluate(async (nombre) => {
    await fetch('/api/gimnasios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, ubicacion: 'Ciudad de Prueba' }),
    });
}, gymName);

await page.click('[data-tab="gimnasios"]');
await page.type('#admin-gyms-search', 'Admin Smoke Gym');
await page.waitForFunction(
    (nombre) => document.getElementById('admin-gyms-body')?.textContent.includes(nombre),
    { timeout: 10000 },
    gymName,
);
check('el gimnasio nuevo aparece en el panel', true);

const [gymDeleteResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/admin/gimnasios/') && r.request().method() === 'DELETE'),
    (async () => {
        await page.click('#admin-gyms-body [data-delete-gym]');
        await page.waitForFunction(() => document.getElementById('admin-confirm-modal')?.open, { timeout: 5000 });
        await page.click('#admin-confirm-ok');
    })(),
]);
check('borrar gimnasio responde 2xx', gymDeleteResp.ok(), String(gymDeleteResp.status()));

// ── Cerrar sesión de admin ─────────────────────────────────────────────
await page.click('#admin-logout');
await page.waitForFunction(() => document.getElementById('admin-login')?.hidden === false, { timeout: 5000 });
check('cerrar sesión vuelve a la pantalla de login', true);
const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('gloveup_admin_token'));
check('el token se borra al cerrar sesión', tokenAfterLogout === null);

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
process.exit(failures ? 1 : 0);
