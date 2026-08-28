/**
 * coach-dashboard-smoke.mjs — Comprobación de humo de Inicio (entrenador).
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

await page.goto(`${BASE}/inicio`, { waitUntil: 'networkidle2' });
try {
    await page.waitForFunction(() => document.querySelector('.glv-calendar .fc-toolbar') !== null, { timeout: 15000 });
} catch {
    console.log('Errores de consola:', JSON.stringify([...new Set(consoleErrors)]));
    console.log('data-role entrenador hidden:', await page.$eval('[data-role="entrenador"]', (el) => el.hidden).catch((e) => String(e)));
    console.log('coach-cal-skeleton hidden:', await page.$eval('#coach-cal-skeleton', (el) => el.hidden).catch((e) => String(e)));
    console.log('coach-cal-root hidden:', await page.$eval('#coach-cal-root', (el) => el.hidden).catch((e) => String(e)));
    console.log('window.FullCalendar:', await page.evaluate(() => typeof window.FullCalendar));
    await browser.close();
    process.exit(1);
}

check('el bloque de entrenador está visible', !(await page.$eval('[data-role="entrenador"]', (el) => el.hidden)));
check('el bloque de boxeador está oculto', await page.$eval('[data-role="boxeador"]', (el) => el.hidden));
check('la cabecera muestra el nombre del entrenador',
    (await page.$eval('#coach-heading', (el) => el.textContent.trim())).length > 0);

// Juan y Pedro son boxeadores de entrenador1 (seedMinimal) con fecha de alta
await page.waitForFunction(
    () => document.querySelectorAll('.glv-calendar .fc-event').length > 0,
    { timeout: 10000 },
);
// Se evita comparar la tilde de "Inscripción" literal en este archivo:
// alguna herramienta por el camino puede normalizar el acento de forma
// distinta a como lo pinta el navegador: se compara sólo el prefijo.
const allEventTitles = await page.$$eval('.glv-calendar .fc-event', (els) => els.map((e) => e.textContent.trim()));
check('aparecen eventos automáticos de inscripción',
    allEventTitles.some((t) => t.startsWith('Inscripci')), allEventTitles.join(' | '));
check('aparece el recordatorio de planificación semanal',
    allEventTitles.some((t) => t.includes('planificar semana')), allEventTitles.join(' | '));

// ── Filtros: desactivar "Recordatorios" oculta esos eventos ─────────
const reminderEventsBefore = await page.$$eval(
    '.glv-calendar .fc-event',
    (els) => els.filter((e) => e.textContent.includes('Recordatorio') || e.textContent.includes('ingresos')).length,
);
await page.click('[data-filter="recordatorio"]');
await new Promise((r) => setTimeout(r, 300));
const reminderEventsAfter = await page.$$eval(
    '.glv-calendar .fc-event:not([style*="display: none"])',
    (els) => els.filter((e) => e.textContent.includes('Recordatorio') || e.textContent.includes('ingresos')).length,
);
check('desactivar el filtro de Recordatorios los oculta',
    reminderEventsBefore > 0 && reminderEventsAfter === 0, `${reminderEventsBefore} -> ${reminderEventsAfter}`);
await page.click('[data-filter="recordatorio"]'); // reactivar

// ── Clic en un evento automático muestra detalles, no abre el modal ──
await page.evaluate(() => {
    const ev = Array.from(document.querySelectorAll('.glv-calendar .fc-event'))
        .find((el) => el.textContent.startsWith('Inscripci'));
    ev?.click();
});
await new Promise((r) => setTimeout(r, 200));
check('un evento automático no abre el modal de edición',
    !(await page.$eval('#event-modal', (d) => d.open)));
const detailsText = await page.$eval('#coach-cal-details-text', (el) => el.textContent);
check('un evento automático muestra sus detalles como texto', detailsText.includes('Inscripci'), detailsText);

// ── Crear un evento personalizado propio del entrenador ──────────────
// Se busca un día del mes actual que no tenga ya un evento encima: si se
// hace clic sobre un día con eventos, Puppeteer puede acertar sobre la
// propia "pill" del evento (dispara eventClick, no dateClick).
const emptyDayFrame = await page.evaluateHandle(() => {
    const days = Array.from(document.querySelectorAll('.glv-calendar .fc-daygrid-day:not(.fc-day-other)'));
    const empty = days.find((d) => !d.querySelector('.fc-event'));
    return empty ? empty.querySelector('.fc-daygrid-day-frame') : null;
});
await emptyDayFrame.click();
await page.waitForFunction(() => document.querySelector('#event-modal')?.open, { timeout: 5000 });
await page.evaluate(() => { document.getElementById('event-field-title').value = ''; });
await page.type('#event-field-title', 'Torneo interno');
await page.click('#event-colors .color-btn[data-color="#22c55e"]');

// refresh() dispara un segundo GET tras el POST (para releer del servidor
// en vez de fiarse del optimista); se espera a ambos antes de mirar el DOM.
const [createResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/entrenadores/me/calendar-events') && r.request().method() === 'POST'),
    page.click('#event-form button[type="submit"]'),
]);
check('crear un evento del entrenador responde 2xx', createResp.ok(), String(createResp.status()));

await page.waitForResponse((r) => r.url().includes('/entrenadores/me/calendar-events') && r.request().method() === 'GET');
// FullCalendar tarda un poco en repintar tras addEvent(); confirmado por
// separado que el evento llega bien (API 201 + presente en el DOM más
// tarde) — este margen es sólo para el repintado, no para la red.
await new Promise((r) => setTimeout(r, 1500));
const hasEvent = await page.$$eval('.glv-calendar .fc-event',
    (els) => els.some((e) => e.textContent.includes('Torneo interno')));
check('el evento del entrenador aparece en su calendario', hasEvent);

// ── Editar y eliminar (limpieza) ──────────────────────────────────────
await page.evaluate(() => {
    const ev = Array.from(document.querySelectorAll('.glv-calendar .fc-event'))
        .find((el) => el.textContent.includes('Torneo interno'));
    ev?.click();
});
await page.waitForFunction(() => document.querySelector('#event-modal')?.open, { timeout: 5000 });
check('editar un evento propio abre el modal con sus datos',
    (await page.$eval('#event-field-title', (el) => el.value)) === 'Torneo interno');

await page.click('#event-delete');
await page.waitForFunction(() => document.querySelector('#event-delete-confirm')?.open, { timeout: 5000 });
const [deleteResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/entrenadores/me/calendar-events/') && r.request().method() === 'DELETE'),
    page.click('#event-delete-confirm button[value="confirm"]'),
]);
check('eliminar el evento del entrenador responde 2xx', deleteResp.ok(), String(deleteResp.status()));

await page.waitForFunction(
    () => !document.querySelector('.glv-calendar')?.textContent.includes('Torneo interno'),
    { timeout: 10000 },
);
check('el evento eliminado desaparece del calendario', true);

// ── El boxeador sigue viendo su propio dashboard sin cambios ─────────
await page.evaluate(() => {
    localStorage.setItem('gloveup_user_email', 'boxeador1@test.com');
    localStorage.setItem('gloveup_user_role', 'boxeador');
});
await page.goto(`${BASE}/inicio`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('.glv-calendar .fc-toolbar') !== null, { timeout: 20000 });
check('el boxeador ve su propio panel (métricas), no el del entrenador',
    (await page.$$('[data-metric]')).length === 3);
check('el bloque de entrenador está oculto para un boxeador',
    await page.$eval('[data-role="entrenador"]', (el) => el.hidden));

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} comprobaciones correctas`);
if (consoleErrors.length) console.log('\nErrores de consola:\n  ' + [...new Set(consoleErrors)].join('\n  '));
process.exit(failures ? 1 : 0);
