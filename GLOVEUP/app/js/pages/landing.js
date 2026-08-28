/**
 * landing.js (página) — Portada pública.
 *
 * Revela los bloques marcados con la clase .reveal a medida que entran en
 * el viewport (IntersectionObserver, disparo único por elemento). El
 * titular del hero y sus botones se animan aparte, con CSS puro, para que
 * lo primero que ve alguien no dependa de que este módulo llegue a
 * cargarse. El modal de inicio de sesión ya lo gestiona app.js.
 */

let observer = null;

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="landing" */
export function init(root) {
    const targets = root.querySelectorAll('.reveal');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
        targets.forEach((el) => el.classList.add('is-visible'));
        return;
    }

    observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.18 });

    targets.forEach((el) => observer.observe(el));
}

export function destroy() {
    observer?.disconnect();
    observer = null;
}
