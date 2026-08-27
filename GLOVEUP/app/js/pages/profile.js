/**
 * profile.js — Módulo de "Mi Perfil".
 *
 * La plantilla incluye los campos de boxeador y de entrenador a la vez;
 * este módulo decide qué grupo mostrar según el rol de la sesión y qué
 * payload enviar al guardar, porque el rol sólo se conoce en el cliente
 * (vive en localStorage, PHP no lo ve).
 */

import { api } from '../api.js';
import * as session from '../session.js';
import { navigate } from '../router.js';
import { openImageEditor } from '/assets/js/image-editor.js';

const DEFAULT_PHOTO = '/assets/images/unnamed-removebg-preview.png';

let els = {};
let isCoach = false;
let photo = '';

/** @param {HTMLElement} root Raíz de la vista, el div con data-page="profile" */
export function init(root) {
    isCoach = session.role() === 'entrenador';
    photo = '';

    els = {
        root,
        subtitle: root.querySelector('#profile-subtitle'),
        saveBtn: root.querySelector('#btn-save-profile'),
        photoImg: root.querySelector('#profile-photo'),
        photoInput: root.querySelector('#photo-input'),
        removePhotoBtn: root.querySelector('#btn-remove-photo'),
        disciplineLabel: root.querySelector('#p-discipline-label'),
        lookupInput: root.querySelector('#lookup-input'),
        lookupBtn: root.querySelector('#lookup-btn'),

        name: root.querySelector('#p-name'),
        email: root.querySelector('#p-email'),
        alias: root.querySelector('#p-alias'),
        discipline: root.querySelector('#p-discipline'),
        location: root.querySelector('#p-location'),
        weight: root.querySelector('#p-weight'),
        height: root.querySelector('#p-height'),
        age: root.querySelector('#p-age'),
        weightClass: root.querySelector('#p-weight-class'),
        stance: root.querySelector('#p-stance'),
        gender: root.querySelector('#p-gender'),
        freq: root.querySelector('#p-freq'),
        bio: root.querySelector('#p-bio'),
        coachGym: root.querySelector('#p-coach-gym'),
        coachPrice: root.querySelector('#p-coach-price'),
    };

    root.querySelectorAll('[data-role]').forEach((el) => {
        el.hidden = el.dataset.role !== (isCoach ? 'entrenador' : 'boxeador');
    });

    els.subtitle.textContent = isCoach ? 'Tus datos como entrenador.' : 'Tus datos de perfil.';
    els.disciplineLabel.textContent = isCoach ? 'Especialidad' : 'Disciplina';

    els.saveBtn.addEventListener('click', onSave);
    els.photoInput.addEventListener('change', onPhotoSelected);
    els.removePhotoBtn.addEventListener('click', onRemovePhoto);
    els.lookupBtn.addEventListener('click', onLookup);
    els.lookupInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') onLookup(); });

    load();
}

export function destroy() {
    els = {};
}

/* ── Carga ─────────────────────────────────────────────────────────── */

async function load() {
    const email = session.email();

    try {
        const data = isCoach ? await api.entrenador(email) : await api.boxeador(email);
        applyToForm(data || {});
    } catch {
        // Sin perfil todavía (primera vez): se parte de lo que ya hay en localStorage
        applyToForm({ nombre: session.name(), email });
    }
}

function applyToForm(data) {
    photo = data.foto || '';
    els.photoImg.src = resolvePhoto(photo);
    els.name.value = data.nombre || session.name() || '';
    els.email.value = data.email || session.email() || '';
    els.location.value = data.ubicacion || '';

    if (isCoach) {
        els.discipline.value = data.especialidad || 'Boxeo';
        els.coachGym.value = data.gimnasio || '';
        els.coachPrice.value = data.precioMensual ?? '';
        return;
    }

    els.alias.value = data.alias || '';
    els.discipline.value = data.disciplina || '';
    els.weight.value = data.peso || '';
    els.height.value = data.altura || '';
    els.age.value = data.edad || '';
    els.weightClass.value = data.categoriaPeso || '';
    els.stance.value = data.guardia || '';
    els.gender.value = data.genero || '';
    els.freq.value = data.frecuenciaSparring || '';
    els.bio.value = data.bio || '';
}

function resolvePhoto(value) {
    if (!value) return DEFAULT_PHOTO;
    if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) return value;
    return value.startsWith('/') ? `/legacy${value}` : value;
}

/* ── Guardado ──────────────────────────────────────────────────────── */

function payload() {
    if (isCoach) {
        const price = Number(els.coachPrice.value);
        return {
            nombre: els.name.value.trim(),
            nuevoEmail: els.email.value.trim(),
            especialidad: els.discipline.value.trim() || 'Boxeo',
            gimnasio: els.coachGym.value.trim(),
            ubicacion: els.location.value.trim(),
            precioMensual: Number.isFinite(price) && price >= 0 ? price : 0,
            foto: photo,
        };
    }

    return {
        nombre: els.name.value.trim(),
        nuevoEmail: els.email.value.trim(),
        alias: els.alias.value.trim(),
        disciplina: els.discipline.value.trim(),
        ubicacion: els.location.value.trim(),
        peso: els.weight.value ? String(els.weight.value) : '',
        altura: els.height.value ? String(els.height.value) : '',
        edad: els.age.value ? Number(els.age.value) : null,
        categoriaPeso: els.weightClass.value,
        guardia: els.stance.value,
        genero: els.gender.value,
        frecuenciaSparring: els.freq.value,
        bio: els.bio.value.trim(),
        foto: photo,
    };
}

async function onSave(showToast = true) {
    const email = session.email();
    try {
        const saved = isCoach ? await api.saveEntrenador(email, payload()) : await api.saveBoxeador(email, payload());
        applyToForm(saved || {});

        if (saved?.nombre) localStorage.setItem('gloveup_user_name', saved.nombre);
        if (saved?.email && saved.email !== email) localStorage.setItem('gloveup_user_email', saved.email);

        if (showToast) window.showToast?.('Perfil guardado.', 'success');
    } catch (err) {
        window.showToast?.(err.message || 'No se pudo guardar el perfil', 'error');
    }
}

/* ── Foto ──────────────────────────────────────────────────────────── */

async function onPhotoSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const dataUrl = await openImageEditor(file, { circle: true, outputSize: 512 });
    if (!dataUrl) return; // el usuario canceló el recorte

    photo = dataUrl;
    els.photoImg.src = dataUrl;
    await onSave(false);
}

async function onRemovePhoto() {
    photo = '';
    els.photoImg.src = DEFAULT_PHOTO;
    await onSave(false);
}

/* ── Buscar a otro boxeador ────────────────────────────────────────── */

function onLookup() {
    const value = els.lookupInput.value.trim();
    if (!value) return;

    if (value.toLowerCase() === session.email()) {
        window.showToast?.('Ese eres tú — este es tu propio perfil.', 'info');
        return;
    }

    navigate(`/perfil/${encodeURIComponent(value)}`);
}
