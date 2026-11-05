(() => {
  'use strict';
  let installPrompt = null;
  const addInstallControl = () => {
    const header = document.querySelector('#view-dashboard .view-header');
    if (!header || document.getElementById('pwa-install-button')) return;
    const button = document.createElement('button');
    button.id = 'pwa-install-button';
    button.type = 'button';
    button.textContent = 'Instalar Fiados 2.0';
    button.hidden = true;
    const hint = document.createElement('p');
    hint.id = 'pwa-install-hint';
    hint.textContent = 'En Android, instala Fiados 2.0 para abrirlo como una app desde tu pantalla de inicio.';
    hint.hidden = true;
    button.addEventListener('click', async () => {
      if (!installPrompt) {
        hint.hidden = false;
        hint.textContent = 'Abre el menú ⋮ de Chrome y selecciona “Instalar aplicación” o “Añadir a pantalla principal”.';
        return;
      }
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      button.hidden = true;
    });
    header.append(button, hint);
  };
  document.addEventListener('DOMContentLoaded', async () => {
    addInstallControl();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      try { await navigator.serviceWorker.register('./service-worker.js', { scope: './' }); }
      catch (error) { console.warn('No se pudo registrar el modo sin conexión:', error); }
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const button = document.getElementById('pwa-install-button');
    const hint = document.getElementById('pwa-install-hint');
    if (standalone && button) {
      button.hidden = true;
      if (hint) { hint.hidden = false; hint.textContent = 'Fiados 2.0 está instalado en este dispositivo.'; }
    } else if (button) button.hidden = false;
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    const button = document.getElementById('pwa-install-button');
    if (button) button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    const button = document.getElementById('pwa-install-button');
    const hint = document.getElementById('pwa-install-hint');
    if (button) button.hidden = true;
    if (hint) { hint.hidden = false; hint.textContent = 'Fiados 2.0 se instaló correctamente.'; }
  });
})();