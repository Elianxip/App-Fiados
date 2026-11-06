/* Fiados 2.0 — Supabase Auth + explicit first migration + local-first sync.
   Does not upload, overwrite or download existing data without a deliberate choice. */
(() => {
  'use strict';
  const CLIENTS_KEY = 'fiado_clients';
  const TX_KEY = 'fiado_txs';
  const config = window.FIADOS_SUPABASE_CONFIG;
  const state = { client: null, user: null, mode: 'local', busy: false, channel: null, pendingSync: false, initializing: false };
  const PENDING_KEY = 'fiados_sync_pending_v1';
  const markPending = () => localStorage.setItem(PENDING_KEY, '1');
  const clearPending = () => localStorage.removeItem(PENDING_KEY);
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
    phone: String(c.phone || ''), notes: String(c.notes || ''), created_at: new Date(Number(c.createdAt) || Date.now()).toISOString()
  }));
  const txRows = (userId, txs) => txs.map(t => ({
    id: String(t.id), owner_id: userId, client_id: String(t.clientId),
    type: t.type, amount: Number(t.amount), description: String(t.desc || ''),
    occurred_at: new Date(Number(t.date)).toISOString(), due_at: t.dueAt ? new Date(t.dueAt).toISOString() : null
  }));
  const toLocal = (clients, txs) => ({
    clients: clients.map(c => ({ id: c.id, name: c.name, phone: c.phone || '', notes: c.notes || '', createdAt: new Date(c.created_at).getTime() })),
    transactions: txs.map(t => ({ id: t.id, clientId: t.client_id, type: t.type, amount: Number(t.amount), desc: t.description || '', date: new Date(t.occurred_at).getTime(), ...(t.due_at ? {dueAt:t.due_at} : {}) }))
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
    if (!state.user) return;
    markPending();
    if (!navigator.onLine) { state.mode = 'offline-pending'; setStatus('Sin internet. Tus cambios están guardados en este celular y esperan sincronización.', true); return; }
    if (state.mode === 'syncing') { state.pendingSync = true; return; }
    if (!['ready','sync-error','offline-pending'].includes(state.mode)) return;
    state.mode = 'syncing';
    try {
      await upsertLocalToCloud(localData());
      state.mode = 'ready';
      clearPending();
      setStatus('Cambios guardados y sincronizados con Supabase.');
      if (window.FiadosModulesSync?.sync) window.FiadosModulesSync.sync().catch(e => setStatus('Datos principales sincronizados; módulos pendientes: ' + e.message, true));
      if (state.pendingSync) { state.pendingSync = false; await syncCurrentLocalChange(); }
    } catch (e) {
      state.mode = navigator.onLine ? 'sync-error' : 'offline-pending';
      state.pendingSync = false;
      setStatus('Tus datos siguen guardados en el celular. La sincronización quedó pendiente: ' + (e.message || 'sin conexión') + '.', true);
    }
  };
  const resumeSync = async () => {
    if (!navigator.onLine || !state.client || !state.user || state.busy) return;
    try {
      if (['local','sync-error','offline-pending'].includes(state.mode)) {
        if (state.mode === 'local') {
          await inspectAndOfferMigration();
          if (state.mode === 'ready') subscribeRealtime();
        }
        if (localStorage.getItem(PENDING_KEY) === '1' && ['ready','sync-error','offline-pending'].includes(state.mode)) await syncCurrentLocalChange();
      }
      if (state.mode === 'ready' && window.FiadosModulesSync?.sync) await window.FiadosModulesSync.sync();
    } catch (e) { setStatus('La conexión volvió, pero aún no se pudo sincronizar: ' + e.message, true); }
  };
  const mergeBaseWithoutDeleting = (remote) => {
    const local = localData();
    const clients = new Map(local.clients.map(x => [String(x.id), x]));
    remote.clients.forEach(x => { if (!clients.has(String(x.id))) clients.set(String(x.id), x); });
    const txs = new Map(local.transactions.map(x => [String(x.id), x]));
    remote.transactions.forEach(x => { if (!txs.has(String(x.id))) txs.set(String(x.id), x); });
    const merged = {clients:[...clients.values()], transactions:[...txs.values()]};
    validate(merged);
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(merged.clients));
    localStorage.setItem(TX_KEY, JSON.stringify(merged.transactions));
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };
  const subscribeRealtime = () => {
    if (state.channel) state.client.removeChannel(state.channel);
    if (!state.user) return;
    const uid = state.user.id;
    const refresh = async (label) => {
      if (state.mode !== 'ready') return;
      try { const fresh = await fetchCloud(); mergeBaseWithoutDeleting(fresh); setStatus(label+' sincronizados desde la nube sin borrar datos locales.'); }
      catch (e) { setStatus('No se pudo actualizar la vista: ' + e.message, true); }
    };
    state.channel = state.client.channel('fiados-owner-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: 'owner_id=eq.' + uid }, () => refresh('Clientes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: 'owner_id=eq.' + uid }, () => refresh('Movimientos'))
      .subscribe();
  };
  const loadSupabaseLibrary = () => new Promise((resolve, reject) => {
    if (window.supabase?.createClient) return resolve();
    const existing = document.querySelector('script[data-fiados-supabase-loader]');
    if (existing) { existing.addEventListener('load', resolve, {once:true}); existing.addEventListener('error', reject, {once:true}); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.dataset.fiadosSupabaseLoader = 'true';
    script.onload = resolve; script.onerror = () => reject(new Error('No se pudo descargar el cliente Supabase. La app seguirá funcionando localmente.'));
    document.head.appendChild(script);
  });
  const init = async () => {
    const panel = $('fiados-cloud-panel');
    if (!panel || state.initializing) return;
    state.initializing = true;
    if (!config || !config.url || !config.publishableKey) { setStatus('Configuración de Supabase no disponible. Puedes seguir trabajando sin internet.', true); state.initializing = false; return; }
    if (!window.supabase?.createClient) {
      if (!navigator.onLine) { setStatus('Modo sin conexión activo. Tus datos se guardan en este celular; Supabase se conectará cuando vuelva internet.'); state.initializing = false; return; }
      try { await loadSupabaseLibrary(); } catch (e) { setStatus(e.message, true); state.initializing = false; return; }
    }
    state.client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    $('fiados-auth-form').addEventListener('submit', signIn);
    $('fiados-signup').addEventListener('click', signUp);
    $('fiados-upload-local').addEventListener('click', uploadLocal);
    $('fiados-download-cloud').addEventListener('click', downloadCloud);
    $('fiados-signout').addEventListener('click', signOut);
    let sessionResult;
    try { sessionResult = await state.client.auth.getSession(); }
    catch (e) { setStatus('Sin conexión con Supabase. Los datos locales están disponibles y se sincronizarán al volver internet.', true); state.initializing = false; return; }
    const { data, error } = sessionResult;
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
    const allowedModuleTables = new Set(['payment_plans','expenses','collectors','reward_settings','reward_ledger','receipts','device_registry']);
    window.FiadosCloud = {
      syncAfterLocalSave: syncCurrentLocalChange,
      getStatus: () => ({ signedIn: !!state.user, mode: state.mode }),
      getClient: () => state.client,
      getUser: () => state.user,
      syncModuleTable: async (table, rows) => {
        if (!state.user || !allowedModuleTables.has(table)) throw new Error('Cuenta no conectada o tabla no permitida.');
        if (!Array.isArray(rows)) throw new Error('Datos de sincronización inválidos.');
        if (rows.length) {
          const { error } = await state.client.from(table).upsert(rows.map(row => ({...row, owner_id: state.user.id})), { onConflict: 'owner_id,id' });
          if (error) throw error;
        }
        const { data, error } = await state.client.from(table).select('*').eq('owner_id', state.user.id);
        if (error) throw error;
        return data || [];
      },
      fetchRewardSettings: async () => {
        if (!state.user) throw new Error('Cuenta no conectada.');
        const { data, error } = await state.client.from('reward_settings').select('*').eq('owner_id',state.user.id).maybeSingle();
        if (error) throw error;
        return data;
      },
      saveRewardSettings: async (rate) => {
        if (!state.user) throw new Error('Cuenta no conectada.');
        const { error } = await state.client.from('reward_settings').upsert({owner_id:state.user.id,points_per_hundred:Number(rate)||0},{onConflict:'owner_id'});
        if (error) throw error;
      }
    };
    state.initializing = false;
    if (state.user && localStorage.getItem(PENDING_KEY) === '1' && navigator.onLine && state.mode === 'ready') syncCurrentLocalChange();
  };
  window.addEventListener('online', () => { if (!state.client) init(); else resumeSync(); });
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resumeSync(); });
  document.addEventListener('DOMContentLoaded', init);
})();
