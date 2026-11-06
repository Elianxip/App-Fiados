/* FIADOS 2.0 — capa segura de respaldo y validación local.
   No modifica ni borra los datos existentes automáticamente. */
(() => {
  'use strict';
  const CLIENTS_KEY = 'fiado_clients';
  const TX_KEY = 'fiado_txs';
  const BACKUP_VERSION = 1;

  const readArray = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      throw new Error('Los datos locales no tienen un formato JSON válido. No se modificó nada.');
    }
  };

  const snapshot = () => ({
    app: 'Fiados',
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    clients: readArray(CLIENTS_KEY),
    transactions: readArray(TX_KEY),
    paymentPlans: readArray('fiados_payment_plans')
  });

  const validate = (data) => {
    if (!data || data.app !== 'Fiados' || !Array.isArray(data.clients) || !Array.isArray(data.transactions)) {
      throw new Error('El archivo no parece ser un respaldo válido de Fiados.');
    }
    const ids = new Set();
    for (const c of data.clients) {
      if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || !c.name.trim()) {
        throw new Error('Hay un cliente con datos incompletos. Importación cancelada.');
      }
      if (ids.has(c.id)) throw new Error('Hay IDs de clientes duplicados. Importación cancelada.');
      ids.add(c.id);
    }
    if (data.paymentPlans !== undefined && !Array.isArray(data.paymentPlans)) throw new Error('Los planes de pago del respaldo no son válidos.');
    const txIds = new Set();
    for (const tx of data.transactions) {
      if (!tx || typeof tx.id !== 'string' || !ids.has(tx.clientId) ||
          !['DEBT', 'PAYMENT'].includes(tx.type) ||
          !Number.isFinite(Number(tx.amount)) || Number(tx.amount) <= 0 ||
          !Number.isFinite(Number(tx.date))) {
        throw new Error('Hay un movimiento inválido o vinculado a un cliente inexistente. Importación cancelada.');
      }
      if (txIds.has(tx.id)) throw new Error('Hay IDs de movimientos duplicados. Importación cancelada.');
      txIds.add(tx.id);
    }
    return true;
  };

  const download = () => {
    const data = snapshot();
    validate(data);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fiados-respaldo-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    status.textContent = 'Respaldo descargado. Guárdalo en un lugar seguro.';
  };

  const panel = document.createElement('section');
  panel.className = 'glass fiados-v2-backup';
  panel.setAttribute('aria-labelledby', 'fiados-v2-backup-title');
  const title = document.createElement('h2');
  title.id = 'fiados-v2-backup-title';
  title.textContent = 'Fiados 2.0 · Protección de datos';
  const description = document.createElement('p');
  description.textContent = 'Antes de migrar o cambiar de dispositivo, descarga una copia de tus clientes y movimientos.';
  const actions = document.createElement('div');
  actions.className = 'fiados-v2-backup-actions';
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'btn btn-primary';
  exportButton.textContent = 'Descargar respaldo';
  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.className = 'btn btn-secondary';
  importButton.textContent = 'Restaurar respaldo';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;
  const status = document.createElement('p');
  status.className = 'fiados-v2-status';
  status.setAttribute('role', 'status');
  actions.append(exportButton, importButton);
  panel.append(title, description, actions, fileInput, status);

  exportButton.addEventListener('click', () => {
    try { download(); } catch (error) { status.textContent = error.message; }
  });
  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      validate(data);
      const summary = data.clients.length + ' clientes y ' + data.transactions.length + ' movimientos';
      if (!window.confirm('El respaldo contiene ' + summary + '. Restaurarlo reemplazará los datos locales actuales de este navegador. Primero descarga un respaldo actual. ¿Continuar?')) return;
      const current = snapshot();
      validate(current);
      const safetyBlob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
      const safetyUrl = URL.createObjectURL(safetyBlob);
      const link = document.createElement('a');
      link.href = safetyUrl;
      link.download = 'fiados-respaldo-anterior-' + Date.now() + '.json';
      link.click();
      URL.revokeObjectURL(safetyUrl);
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(data.clients));
      localStorage.setItem(TX_KEY, JSON.stringify(data.transactions));
      if (Array.isArray(data.paymentPlans)) localStorage.setItem('fiados_payment_plans', JSON.stringify(data.paymentPlans));
      status.textContent = 'Respaldo restaurado. Recargando la aplicación…';
      window.location.reload();
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : error.message;
    } finally {
      fileInput.value = '';
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const dashboard = document.getElementById('view-dashboard');
    if (dashboard) dashboard.appendChild(panel);
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        status.textContent = 'La instalación offline no pudo activarse en este navegador.';
      });
    }
  });
})();
