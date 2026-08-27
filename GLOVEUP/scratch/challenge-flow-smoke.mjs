/**
 * challenge-flow-smoke.mjs — Ciclo completo de un reto: enviar, aceptar y valorar.
 *
 * Boxeador1 reta a Boxeador2 (ambos con gimnasio y entrenador asignados por
 * seedMinimal.js). La confirmación de un reto boxeador-boxeador la dan los
 * DOS ENTRENADORES vía POST /api/entrenadores/me/challenges/respond — el
 * endpoint que usaban los boxeadores para responder está deprecado (410) y
 * my-sparrings.js ya no lo llama. Como la UI de "Retos" del entrenador aún
 * no está migrada (sigue en /legacy), aquí se llama a la API directamente
 * para simular esa aprobación y poder probar la sesión resultante.
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
page.on('pageerror', (e) => console.log('pageerror:', String(e)));

async function loginAs(email, role) {
    await page.evaluate((email, role) => {
        localStorage.setItem('gloveup_user_email', email);
        localStorage.setItem('gloveup_user_role', role);
    }, email, role);
}

// ── 1. Boxeador1 reta a Boxeador2 ────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await loginAs('boxeador1@test.com', 'boxeador');

await page.goto(`${BASE}/sparring`, { waitUntil: 'networkidle2' });
await page.waitForSelector('#sp-list article', { timeout: 15000 });

const names = await page.$$eval('#sp-list article p.font-bold', (els) => els.map((e) => e.textContent.trim()));
const targetIndex = names.findIndex((n) => n.includes('Maria'));
check('Maria Boxeadora aparece en la lista', targetIndex >= 0, names.join(', '));

const targetBtn = (await page.$$('#sp-list button[data-challenge]'))[targetIndex];
await targetBtn.click();
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

const [sendResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/boxeadores/challenges') && r.request().method() === 'POST'),
    page.click('#challenge-form button[type="submit"]'),
]);
const sent = await sendResponse.json();
check('el reto se envía correctamente', sendResponse.ok(), String(sendResponse.status()));

// ── 2. Boxeador2 lo ve en Mis Sparrings, pendiente de sus entrenadores ──
await loginAs('boxeador2@test.com', 'boxeador');
await page.goto(`${BASE}/mis-sparrings`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelectorAll('#challenges-received-list article').length > 0, { timeout: 15000 });

const receivedText = await page.$eval('#challenges-received-list', (el) => el.textContent);
check('Boxeador2 ve el reto recibido de Juan', receivedText.includes('Juan Boxeador'));
check('el estado explica que espera al entrenador del retado', receivedText.includes('Esperando al entrenador del retado'));

// La aprobación es cosa de los entrenadores (sección "Retos", aún en /legacy);
// se simula aquí llamando a la API directamente con ambos entrenadores.
async function coachRespond(coachEmail, action) {
    return page.evaluate(async (coachEmail, challengeId, action) => {
        const res = await fetch(`/api/entrenadores/me/challenges/respond?email=${encodeURIComponent(coachEmail)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengeId, action }),
        });
        return { status: res.status, body: await res.json().catch(() => ({})) };
    }, coachEmail, sent.id, action);
}

const fromCoachResp = await coachRespond('entrenador1@test.com', 'accept');
check('el entrenador del retador aprueba', fromCoachResp.status >= 200 && fromCoachResp.status < 300, JSON.stringify(fromCoachResp.body));

const toCoachResp = await coachRespond('entrenador2@test.com', 'accept');
check('el entrenador del retado aprueba y confirma el sparring',
    toCoachResp.status >= 200 && toCoachResp.status < 300, JSON.stringify(toCoachResp.body));

await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelectorAll('#sessions-list article').length > 0, { timeout: 15000 });
check('confirmado por ambos entrenadores, aparece como sesión programada', true);

// ── 3. Boxeador1 valora la sesión ────────────────────────────────────
await loginAs('boxeador1@test.com', 'boxeador');
await page.goto(`${BASE}/mis-sparrings`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelectorAll('#sessions-list [data-review]').length > 0, { timeout: 15000 });

await page.click('#sessions-list [data-review]');
await page.waitForFunction(() => document.querySelector('#review-modal')?.open, { timeout: 5000 });

await page.click('#review-stars [data-star="5"]');
check('seleccionar 5 estrellas rellena el campo oculto',
    (await page.$eval('#review-rating', (el) => el.value)) === '5');

await page.click('.tag-btn[data-tag="Buen ritmo"]');
await page.type('#review-note', 'Gran sesión, buen nivel');

const [reviewResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/sessions/complete')),
    page.click('#review-form button[type="submit"]'),
]);
const reviewBody = await reviewResponse.json().catch(() => ({}));
check('valorar la sesión responde 2xx', reviewResponse.ok(), JSON.stringify(reviewBody).slice(0, 200));

await page.waitForFunction(() => !document.querySelector('#review-modal')?.open, { timeout: 5000 });

// ── 4. La sesión completada aparece en el historial de ambos ────────
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.getElementById('history-count')?.textContent.trim() !== '0 registros', { timeout: 15000 });
const historyText1 = await page.$eval('#history-tbody', (el) => el.textContent);
check('el historial de Boxeador1 muestra la sesión completada', historyText1.includes('Maria'));

await loginAs('boxeador2@test.com', 'boxeador');
await page.goto(`${BASE}/mis-sparrings`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.getElementById('history-count')?.textContent.trim() !== '0 registros', { timeout: 15000 });
const historyText2 = await page.$eval('#history-tbody', (el) => el.textContent);
check('el historial de Boxeador2 muestra la sesión completada', historyText2.includes('Juan'));

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
process.exit(failures ? 1 : 0);
