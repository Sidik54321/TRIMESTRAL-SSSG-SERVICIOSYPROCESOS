/**
 * sparring-submit-smoke.mjs — Envío real de un reto de sparring end-to-end.
 */

import puppeteer from 'puppeteer';

const BASE = process.env.BASE || 'http://web';
let ok = true;

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror:', String(e)));

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await page.evaluate(() => {
    localStorage.setItem('gloveup_user_email', 'boxeador1@test.com');
    localStorage.setItem('gloveup_user_role', 'boxeador');
});

await page.goto(`${BASE}/sparring`, { waitUntil: 'networkidle2' });
await page.waitForSelector('#sp-list article', { timeout: 15000 });

const btn = await page.$('#sp-list button[data-challenge]:not([disabled])');
await btn.click();
await page.waitForFunction(() => document.querySelector('#challenge-modal')?.open, { timeout: 5000 });
await page.waitForFunction(() => document.querySelectorAll('#gym-checklist input[type=radio]').length > 0, { timeout: 10000 });

await page.click('.preset-card[data-preset*="técnico"]');
await page.click('#gym-checklist input[type=radio]');

await page.click('#challenge-datetime');
await page.waitForFunction(() => document.querySelector('#dt-overlay')?.open, { timeout: 5000 });
await page.click('#dt-next');
await page.waitForFunction(() => document.querySelector('#dt-grid [data-day="15"]'), { timeout: 5000 });
await page.click('#dt-grid [data-day="15"]');
await page.click('#dt-apply');
await page.waitForFunction(() => !document.querySelector('#dt-overlay')?.open, { timeout: 5000 });

await page.type('#challenge-note', 'Prueba automatizada de humo');

const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/boxeadores/challenges') && r.request().method() === 'POST'),
    page.click('#challenge-form button[type="submit"]'),
]);

const status = response.status();
const body = await response.json().catch(() => ({}));
console.log('POST /api/boxeadores/challenges ->', status, JSON.stringify(body));

if (status >= 200 && status < 300) {
    console.log('OK   el reto se envía correctamente y el backend lo acepta');
} else {
    console.log('FALLO el backend rechazó el reto:', body.error || status);
    ok = false;
}

const modalClosed = await page.waitForFunction(() => !document.querySelector('#challenge-modal')?.open, { timeout: 5000 })
    .then(() => true).catch(() => false);
console.log(modalClosed ? 'OK   el modal se cierra tras enviar' : 'FALLO el modal no se cerró tras enviar');
ok = ok && modalClosed;

await browser.close();
process.exit(ok ? 0 : 1);
