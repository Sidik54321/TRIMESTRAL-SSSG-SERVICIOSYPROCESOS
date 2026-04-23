// c:\Users\syu02\GLOVEUP\GLOVEUP\settings\settings.js

document.addEventListener('DOMContentLoaded', () => {
    // Nav logic
    const homeView = document.getElementById('settings-home-view');
    const notifsView = document.getElementById('settings-notifications-view');
    const btnVolver = document.getElementById('btn-volver');
    const navManageNotifs = document.getElementById('nav-manage-notifications');

    // Notification Toggles
    const toggleSparring = document.getElementById('notif-toggle-sparring');
    const toggleMensajes = document.getElementById('notif-toggle-mensajes');
    const toggleGimnasio = document.getElementById('notif-toggle-gimnasio');
    const toggleGeneral = document.getElementById('notif-toggle-general');
    const btnSaveNotifs = document.getElementById('btn-save-notifs');

    const NOTIF_PREFS_KEY = 'gloveup_notif_prefs';

    // 1. Navigation Event Listeners
    if (navManageNotifs) {
        navManageNotifs.addEventListener('click', () => {
            homeView.classList.add('hidden');
            notifsView.classList.remove('hidden');
            btnVolver.style.visibility = 'visible';
            loadPreferences(); // Load toggles state on view enter
        });
    }

    if (btnVolver) {
        btnVolver.addEventListener('click', () => {
            notifsView.classList.add('hidden');
            homeView.classList.remove('hidden');
            btnVolver.style.visibility = 'hidden';
        });
    }

    // 2. Preferences Logic
    function loadPreferences() {
        const raw = localStorage.getItem(NOTIF_PREFS_KEY);
        let prefs = {
            sparring: true,
            mensajes: true,
            gimnasio: true,
            general: true
        };

        if (raw) {
            try {
                prefs = JSON.parse(raw);
            } catch (err) {
                console.error('Error parsing notif prefs', err);
            }
        }

        if (toggleSparring) toggleSparring.checked = prefs.sparring;
        if (toggleMensajes) toggleMensajes.checked = prefs.mensajes;
        if (toggleGimnasio) toggleGimnasio.checked = prefs.gimnasio;
        if (toggleGeneral) toggleGeneral.checked = prefs.general;
    }

    if (btnSaveNotifs) {
        btnSaveNotifs.addEventListener('click', () => {
            const prefs = {
                sparring: toggleSparring.checked,
                mensajes: toggleMensajes.checked,
                gimnasio: toggleGimnasio.checked,
                general: toggleGeneral.checked
            };

            localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
            
            // Visual feedback
            const originalText = btnSaveNotifs.textContent;
            btnSaveNotifs.textContent = '¡Guardado!';
            btnSaveNotifs.style.backgroundColor = '#10b981'; // success green
            btnSaveNotifs.style.borderColor = '#10b981';
            
            setTimeout(() => {
                btnSaveNotifs.textContent = originalText;
                btnSaveNotifs.style.backgroundColor = '';
                btnSaveNotifs.style.borderColor = '';
                btnVolver.click(); // Optional: return to main menu after saving
            }, 1000);
        });
    }

    // Optional Theme logic specific to settings module if needed
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            setTimeout(() => {
                // If anything dynamically depends on theme, do it here
            }, 50);
        });
    }
});
