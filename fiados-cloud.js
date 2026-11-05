/* Fiados 2.0 — Supabase Auth + explicit first migration + local-first sync.
   Does not upload, overwrite or download existing data without a deliberate choice. */
(() => {
  'use strict';
  const CLIENTS_KEY = 'fiado_clients';
  const TX_KEY = 'fiado_txs';
  const config = window.FIADOS_SUPABASE_CONFIG;
  const state = { client: null, user: null, mode: 'local', busy: false, channel: null };
  const $ = (id) => document.getElementById(id);
  const read = (key) => {
    try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; }
    catch { throw new Error('No se pudieron leer los datos locales. No se modificó nada.'); }
  };
  const localData = () => ({ clients: read(CLIENTS_KEY), transactions: read(TX_KEY) });
  const setStatus = (msg, error = false) => {
    const el = $('fiados-cloud-status');
    if (el) { el.textContent = msg; el.dataset.error = error ? 'true' : 'false'; }
  };
  const setBusy = (busy) => {
    state.busy = busy;
    document.querySelectorAll('[data-cloud-action]').forEach(b => b.disabled = busy);
  };
  const clientRows = (userId, clients) => clients.map(c => ({
    id: String(c.id), owner_id: userId, name: String(c.name || '').trim(),
    phone: String(c.phone || ''), created_at: new Date(Number(c.createdAt) || Date.now()).toISOString()
  }));
  const txRows = (userId, txs) => txs.map(t => ({
    id: String(t.id), owner_id: userId, client_id: String(t.clientId),
    type: t.type, amount: Number(t.amount), description: String(t.desc || ''),
    occurred_at: new Date(Number(t.date)).toISOString(), due_at: null
  }));
  const toLocal = (clients, txs) => ({
    clients: clients.map(c => ({ id: c.id, name: c.name, phone: c.phone || '', createdAt: new Date(c.created_at).getTime() })),
    transactions: txs.map(t => ({ id: t.id, clientId: t.client_id, type: t.type, amount: Number(t.amount), desc: t.description || '', date: new Date(t.occurred_at).getTime() }))
  });
  const validate = (data) => {
    const ids = new Set(data.clients.map(c => String(c.id)));
    const seen = new Set();
    for (const t of data.transactions) {
      if (!ids.has(String(t.clientId)) || !['DEBT','PAYMENT'].includes(t.type) ||
          !Number.isFinite(Number(t.amount)) || Number(t.amount) <= 0 ||
          !Number.isFinite(Number(t.date)) || seen.has(String(t.id))) {
        throw new Error('Los datos contienen movimientos inválidos o referencias rotas. Se canceló la sincronización.');
      }
      seen.add(String(t.id));
    }
  };
  const fetchCloud = async () => {
    const uid = state.user.id;
    const [c, t] = await Promise.all([
      state.client.from('clients').select('id,name,phone,created_at').eq('owner_id', uid),
      state.client.from('transactions').select('id,client_id,type,amount,description,occurred_at').eq('owner_id', uid)
    ]);
    if (c.error) throw c.error;
    if (t.error) throw t.error;
    return toLocal(c.data || [], t.data || []);
  };
  const upsertLocalToCloud = async (data) => {
    validate(data);
    const clients = clientRows(state.user.id, data.clients);
    const txs = txRows(state.user.id, data.transactions);
    if (clients.length) {
      const { error } = await state.client.from('clients').upsert(clients, { onConflict: 'owner_id,id' });
      if (error) throw error;
    }
    if (txs.length) {
      const { error } = await state.client.from('transactions').upsert(txs, { onConflict: 'owner_id,id' });
      if (error) throw error;
    }
  };
  const replaceLocal = (data) => {
    validate(data);
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(data.clients));
    localStorage.setItem(TX_KEY, JSON.stringify(data.transactions));
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };
  const refreshSessionUI = () => {
    const auth = $('fiados-auth');
    const sync = $('fiados-sync-controls');
    if (auth) auth.hidden = !!state.user;
    if (sync) sync.hidden = !state.user;
    const who = $('fiados-cloud-user');
    if (who) who.textContent = state.user ? state.user.email || 'Sesión iniciada' : 'Sin conectar';
    const mode = $('fiados-cloud-mode');
    if (mode) mode.textContent = state.user ? 'Cuenta protegida · sincronización manual inicial' : 'Solo almacenamiento local';
  };
  const inspectAndOfferMigration = async () => {
    const local = localData();
    const remote = await fetchCloud();
    const localCount = local.clients.length + local.transactions.length;
    const remoteCount = remote.clients.length + remote.transactions.length;
    if (localCount && !remoteCount) {
      state.mode = 'pending-upload';
      setStatus('Cuenta conectada. La nube está vacía y este dispositivo tiene ' + local.clients.length + ' clientes y ' + local.transactions.length + ' movimientos. Pulsa “Subir datos de este dispositivo” para migrarlos.');
      $('fiados-upload-local').hidden = false;
      $('fiados-download-cloud').hidden = true;
    } else if (!localCount && remoteCount) {
      state.mode = 'pending-download';
      setStatus('Encontramos ' + remote.clients.length + ' clientes y ' + remote.transactions.length + ' movimientos en la nube. Pulsa “Descargar datos de la nube” para traerlos a este dispositivo.');
      $('fiados-upload-local').hidden = true;
      $('fiados-download-cloud').hidden = false;
    } else if (localCount && remoteCount) {
      const normalize = (x) => JSON.stringify({
        clients: [...x.clients].sort((a,b) => String(a.id).localeCompare(String(b.id))),
        transactions: [...x.transactions].sort((a,b) => String(a.id).localeCompare(String(b.id)))
      });
      if (normalize(local) === normalize(remote)) {
        state.mode = 'ready';
        setStatus('Este dispositivo ya está sincronizado con la nube.');
        $('fiados-upload-local').hidden = true;
        $('fiados-download-cloud').hidden = true;
        return;
      }
      state.mode = 'paused-conflict';
      setStatus('Hay datos en ambos lados (' + localCount + ' locales y ' + remoteCount + ' en la nube). Por seguridad se pausó la sincronización automática. Exporta ambos respaldos y revisaremos la combinación antes de continuar.', true);
      $('fiados-upload-local').hidden = true;
      $('fiados-download-cloud').hidden = true;
    } else {
      state.mode = 'ready';
      setStatus('Cuenta conectada. No hay datos todavía. Puedes comenzar a registrar clientes.');
      $('fiados-upload-local').hidden = true;
      $('fiados-download-cloud').hidden = true;
    }
  };
  const signIn = async (event) => {
    event.preventDefault();
    const email = $('fiados-email').value.trim();
    const password = $('fiados-password').value;
    if (!email || !password) return setStatus('Escribe tu correo y contraseña.', true);
    setBusy(true);
    try {
      const { error } = await state.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e) { setStatus(e.message || 'No se pudo iniciar sesión.', true); }
    finally { setBusy(false); }
  };
  const signUp = async () => {
    const email = $('fiados-email').value.trim();
    const password = $('fiados-password').value;
    if (!email || password.length < 8) return setStatus('Escribe un correo válido y una contraseña de al menos 8 caracteres.', true);
    setBusy(true);
    try {
      const { data, error } = await state.client.auth.signUp({ email, password });
      if (error) throw error;
      setStatus(data.session ? 'Cuenta creada. Sesión iniciada.' : 'Cuenta creada. Revisa tu correo para confirmar la dirección y luego inicia sesión.');
    } catch (e) { setStatus(e.message || 'No se pudo crear la cuenta.', true); }
    finally { setBusy(false); }
  };
  const uploadLocal = async () => {
    if (!state.user || state.busy) return;
    setBusy(true);
    try {
      const local = localData();
      const remote = await fetchCloud();
      if (remote.clients.length || remote.transactions.length) throw new Error('La nube ya contiene datos. Se canceló para evitar sobrescribirlos.');
      if (!window.confirm('Se copiarán ' + local.clients.length + ' clientes y ' + local.transactions.length + ' movimientos de este dispositivo a tu cuenta Supabase. Los datos locales no se borrarán. ¿Continuar?')) return;
      await upsertLocalToCloud(local);
      state.mode = 'ready';
      setStatus('Migración inicial completada. Los datos locales se conservaron y ya existe una copia en la nube.');
      $('fiados-upload-local').hidden = true;
      subscribeRealtime();
    } catch (e) { setStatus(e.message || 'Falló la migración.', true); }
    finally { setBusy(false); }
  };
  const downloadCloud = async () => {
    if (!state.user || state.busy) return;
    setBusy(true);
    try {
      const local = localData();
      if (local.clients.length || local.transactions.length) throw new Error('Este dispositivo ya tiene datos. No se reemplazó nada; primero exporta y compara los respaldos.');
      const remote = await fetchCloud();
      if (!window.confirm('Se copiarán ' + remote.clients.length + ' clientes y ' + remote.transactions.length + ' movimientos desde la nube a este dispositivo. ¿Continuar?')) return;
      replaceLocal(remote);
      state.mode = 'ready';
      setStatus('Datos descargados y cargados en este dispositivo.');
      $('fiados-download-cloud').hidden = true;
      subscribeRealtime();
    } catch (e) { setStatus(e.message || 'Falló la descarga.', true); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    if (!window.confirm('¿Cerrar sesión en Supabase? Los datos locales permanecerán en este dispositivo.')) return;
    await state.client.auth.signOut();
  };
  const syncCurrentLocalChange = async () => {
    if (!state.user || state.mode !== 'ready') return;
    state.mode = 'syncing';
    try {
      await upsertLocalToCloud(localData());
      state.mode = 'ready';
      setStatus('Cambios guardados y sincronizados.');
    } catch (e) {
      state.mode = 'sync-error';
      setStatus('Guardado localmente, pero falló la sincronización: ' + (e.message || 'error') + '. No cierres esta sesión hasta recuperar conexión.', true);
    }
  };
  const subscribeRealtime = () => {
    if (state.channel) state.client.removeChannel(state.channel);
    if (!state.user) return;
    const uid = state.user.id;
    state.channel = state.client.channel('fiados-owner-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: 'owner_id=eq.' + uid }, async () => {
        if (state.mode !== 'ready') return;
        try { const fresh = await fetchCloud(); replaceLocal(fresh); setStatus('Clientes actualizados desde tus otros dispositivos.'); }
        catch (e) { setStatus('No se pudo actualizar la vista: ' + e.message, true); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: 'owner_id=eq.' + uid }, async () => {
        if (state.mode !== 'ready') return;
        try { const fresh = await fetchCloud(); replaceLocal(fresh); setStatus('Movimientos actualizados desde tus otros dispositivos.'); }
        catch (e) { setStatus('No se pudo actualizar la vista: ' + e.message, true); }
      })
      .subscribe();
  };
  const init = async () => {
    const panel = $('fiados-cloud-panel');
    if (!panel) return;
    if (!config || !window.supabase || !config.url || !config.publishableKey) {
      setStatus('No se pudo cargar la configuración o la librería Supabase. La app sigue en modo local.', true);
      return;
    }
    state.client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    $('fiados-auth-form').addEventListener('submit', signIn);
    $('fiados-signup').addEventListener('click', signUp);
    $('fiados-upload-local').addEventListener('click', uploadLocal);
    $('fiados-download-cloud').addEventListener('click', downloadCloud);
    $('fiados-signout').addEventListener('click', signOut);
    const { data, error } = await state.client.auth.getSession();
    if (error) setStatus(error.message, true);
    state.user = data && data.session ? data.session.user : null;
    refreshSessionUI();
    if (state.user) {
      try { await inspectAndOfferMigration(); if (state.mode === 'ready') subscribeRealtime(); } catch (e) { setStatus('Conectado, pero no se pudo leer la base de datos. Revisa que ejecutaste la migración SQL y las políticas RLS. ' + (e.message || ''), true); }
    } else setStatus('Conecta tu cuenta para habilitar la sincronización. Tus datos locales no se enviarán sin tu autorización.');
    state.client.auth.onAuthStateChange((_event, session) => {
      state.user = session ? session.user : null;
      state.mode = 'local';
      refreshSessionUI();
      if (state.user) setTimeout(async () => { try { await inspectAndOfferMigration(); if (state.mode === 'ready') subscribeRealtime(); } catch(e) { setStatus(e.message, true); } }, 0);
      else { if (state.channel) state.client.removeChannel(state.channel); state.channel = null; setStatus('Sesión cerrada. Tus datos locales permanecen disponibles.'); }
    });
    window.FiadosCloud = {
      syncAfterLocalSave: syncCurrentLocalChange,
      getStatus: () => ({ signedIn: !!state.user, mode: state.mode })
    };
  };
  document.addEventListener('DOMContentLoaded', init);
})();
