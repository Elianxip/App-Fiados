/* FIADOS 2.0 — WhatsApp y agenda de cobros.
   Mantiene el almacenamiento histórico y no modifica registros automáticamente. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = n => new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP'}).format(Number(n)||0);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clients = () => DataStore.getClients();
  const txs = () => DataStore.getTransactions();
  const balance = id => DataStore.getClientBalance(id);
  const dateKey = value => {
    if (!value) return '';
    const d = new Date(value);
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  };
  const today = () => dateKey(new Date());
  const dateText = value => value ? new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeZone:'America/Santo_Domingo'}).format(new Date(value)) : 'Sin fecha';
  const dateLabel = key => {
    if (!key) return 'Sin fecha';
    const [y,m,d] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('es-DO',{dateStyle:'full',timeZone:'America/Santo_Domingo'}).format(new Date(Date.UTC(y,m-1,d,16)));
  };
  const phoneForWhatsApp = value => {
    let digits = String(value||'').replace(/\D/g,'');
    if (digits.length === 10) digits = '1'+digits;
    return digits.length >= 11 && digits.length <= 15 ? digits : '';
  };
  const dueItems = () => clients().map(client => {
    const debts = txs().filter(t=>t.clientId===client.id && t.type==='DEBT' && t.dueAt)
      .sort((a,b)=>dateKey(a.dueAt).localeCompare(dateKey(b.dueAt)));
    const owed = balance(client.id);
    if (owed <= 0 || !debts.length) return null;
    const due = debts[0];
    return {client,dueAt:due.dueAt,dueKey:dateKey(due.dueAt),owed};
  }).filter(Boolean).sort((a,b)=>a.dueKey.localeCompare(b.dueKey)||a.client.name.localeCompare(b.client.name));
  const statusOf = item => item.dueKey < today() ? 'overdue' : item.dueKey === today() ? 'today' : 'upcoming';
  const addView = (id,title,desc) => {
    if ($('view-'+id)) return;
    const section=document.createElement('section');
    section.id='view-'+id; section.className='view';
    section.innerHTML='<header class="view-header"><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></header><div id="pro-'+id+'"></div>';
    document.querySelector('.content').appendChild(section);
    const nav=document.createElement('button'); nav.className='nav-item'; nav.dataset.view=id; nav.textContent=title;
    document.querySelector('.nav-links').appendChild(nav);
    nav.addEventListener('click',()=>window.App.navigate(id));
  };
  const card = (label,value,detail='') => '<article class="stat-card glass"><div class="stat-info"><h3>'+esc(label)+'</h3><h2>'+esc(value)+'</h2><p>'+esc(detail)+'</p></div></article>';
  const btn = (label,action,cls='btn-primary') => '<button type="button" class="btn '+cls+'" data-pro-action="'+action+'">'+esc(label)+'</button>';
  let agendaFilter='all';
  let waModal;
  const ensureWhatsAppModal = () => {
    if (waModal) return waModal;
    waModal=document.createElement('div'); waModal.className='fiados-wa-backdrop'; waModal.hidden=true;
    waModal.innerHTML='<section class="fiados-wa-modal glass" role="dialog" aria-modal="true" aria-labelledby="fiados-wa-title"><div class="flex-between"><h2 id="fiados-wa-title">Mensaje de WhatsApp</h2><button type="button" class="btn-secondary fiados-wa-close" aria-label="Cerrar">✕</button></div><p class="fiados-wa-hint">Revisa o edita el mensaje antes de abrir WhatsApp.</p><textarea id="fiados-wa-message" rows="7"></textarea><div class="fiados-wa-actions"><button type="button" class="btn btn-secondary fiados-wa-close">Cancelar</button><a id="fiados-wa-open" class="btn btn-primary" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></div></section>';
    document.body.appendChild(waModal);
    waModal.addEventListener('click',e=>{if(e.target===waModal||e.target.closest('.fiados-wa-close'))waModal.hidden=true;});
    $('fiados-wa-message').addEventListener('input',updateWhatsAppLink);
    return waModal;
  };
  const updateWhatsAppLink = () => {
    const link=$('fiados-wa-open'), area=$('fiados-wa-message');
    if(link&&area&&link.dataset.phone) link.href='https://wa.me/'+link.dataset.phone+'?text='+encodeURIComponent(area.value);
  };
  const openWhatsApp = clientId => {
    const c=clients().find(x=>x.id===clientId); if(!c)return;
    const phone=phoneForWhatsApp(c.phone);
    if(!phone){window.alert('Este cliente no tiene un teléfono válido. Edita su número y vuelve a intentarlo.');return;}
    const item=dueItems().find(x=>x.client.id===clientId);
    const owed=balance(clientId);
    const due=item ? ' La fecha de vencimiento registrada es '+dateText(item.dueAt)+'.' : '';
    const message='Hola '+c.name+', te escribimos para recordarte que tienes un balance pendiente de '+money(owed)+' en Fiados.'+due+' ¿Podrías indicarnos cuándo podrías realizar tu pago? ¡Gracias!';
    ensureWhatsAppModal();
    $('fiados-wa-message').value=message;
    $('fiados-wa-open').dataset.phone=phone;
    $('fiados-wa-open').dataset.clientId=String(client.id);
    updateWhatsAppLink();
    waModal.hidden=false;
    $('fiados-wa-message').focus();
  };
  const renderAgenda = () => {
    const root=$('pro-agenda'); if(!root)return;
    const all=dueItems();
    const overdue=all.filter(x=>statusOf(x)==='overdue');
    const todayItems=all.filter(x=>statusOf(x)==='today');
    const upcoming=all.filter(x=>statusOf(x)==='upcoming');
    const filtered=agendaFilter==='overdue'?overdue:agendaFilter==='today'?todayItems:agendaFilter==='upcoming'?upcoming:all;
    const filters=[['all','Todos ('+all.length+')'],['overdue','Atrasados ('+overdue.length+')'],['today','Hoy ('+todayItems.length+')'],['upcoming','Próximos ('+upcoming.length+')']];
    root.innerHTML='<div class="stats-grid">'+card('Cobros atrasados',String(overdue.length),'Requieren seguimiento')+card('Vencen hoy',String(todayItems.length),'Contactar hoy')+card('Próximos cobros',String(upcoming.length),'Fechas futuras')+'</div>'+
      '<div class="glass fiados-agenda-panel"><div class="fiados-agenda-top"><div><h2>Seguimiento de cobros</h2><p>Saldo actual del cliente y su vencimiento registrado más próximo.</p></div>'+btn('Activar recordatorios','notifications','btn-secondary')+'</div>'+
      '<div class="fiados-agenda-filters">'+filters.map(([key,label])=>'<button type="button" class="fiados-filter '+(agendaFilter===key?'active':'')+'" data-agenda-filter="'+key+'">'+esc(label)+'</button>').join('')+'</div>'+
      (filtered.length?filtered.map(item=>{
        const status=statusOf(item), phone=phoneForWhatsApp(item.client.phone);
        const label=status==='overdue'?'Atrasado':status==='today'?'Vence hoy':'Próximo';
        return '<article class="fiados-due-card"><div class="fiados-due-main"><div class="fiados-due-title"><strong>'+esc(item.client.name)+'</strong><span class="fiados-status '+status+'">'+label+'</span></div><p>'+esc(dateLabel(item.dueKey))+' · '+esc(item.client.phone||'Sin teléfono')+'</p><strong class="fiados-due-balance">'+money(item.owed)+'</strong></div>'+
          (phone?'<button type="button" class="btn btn-primary" data-wa-client="'+esc(item.client.id)+'">WhatsApp</button>':'<span class="fiados-no-phone">Añade un teléfono válido</span>')+'</article>';
      }).join(''):'<p class="fiados-empty">No hay cobros en esta categoría.</p>')+
      '<p class="fiados-agenda-note">Los fiados antiguos sin vencimiento se conservan. Los recordatorios del navegador se revisan cuando abres Fiados; para recibir avisos con la app cerrada hará falta configurar un servicio push en el servidor.</p></div>';
  };
  const notifyDue = async () => {
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    const key=today();
    const sent=JSON.parse(localStorage.getItem('fiados_due_notifications')||'{}');
    dueItems().filter(x=>statusOf(x)!=='upcoming').forEach(item=>{
      const id=key+':'+item.client.id;
      if(sent[id])return;
      try{
        new Notification(statusOf(item)==='overdue'?'Cobro atrasado':'Cobro para hoy',{body:item.client.name+' · '+money(item.owed),tag:id});
        sent[id]=true;
      }catch(e){}
    });
    localStorage.setItem('fiados_due_notifications',JSON.stringify(sent));
  };
  const enableNotifications = async () => {
    if(!('Notification' in window)){alert('Este navegador no admite notificaciones. Puedes seguir usando los avisos dentro de la agenda.');return;}
    if(!window.isSecureContext){alert('Las notificaciones requieren HTTPS.');return;}
    const permission=await Notification.requestPermission();
    if(permission==='granted'){await notifyDue();alert('Recordatorios del navegador activados. Fiados avisará al abrirse si hay cobros para hoy o atrasados.');}
    else alert('No se concedió el permiso. Los avisos seguirán visibles dentro de la agenda.');
  };
  const renderDashboard = () => {
    const all=txs(), cs=clients(), items=dueItems();
    const lent=all.filter(t=>t.type==='DEBT').reduce((s,t)=>s+Number(t.amount),0);
    const paid=all.filter(t=>t.type==='PAYMENT').reduce((s,t)=>s+Number(t.amount),0);
    const pending=cs.reduce((s,c)=>s+Math.max(0,balance(c.id)),0);
    const todayPaid=all.filter(t=>t.type==='PAYMENT'&&dateKey(t.date)===today()).reduce((s,t)=>s+Number(t.amount),0);
    const overdue=items.filter(x=>statusOf(x)==='overdue');
    const target=$('pro-dashboard-extra');if(!target)return;
    target.innerHTML='<div class="stats-grid">'+card('Total fiado',money(lent),'Acumulado histórico')+card('Total recuperado',money(paid),'Abonos registrados')+card('Pendiente por cobrar',money(pending),'Saldo positivo de clientes')+card('Cobrado hoy',money(todayPaid),'Zona horaria Santo Domingo')+card('Cobros atrasados',String(overdue.length),'Clientes con vencimiento')+card('Vencen hoy',String(items.filter(x=>statusOf(x)==='today').length),'Seguimiento de hoy')+'</div>'+
      '<div class="glass fiados-agenda-panel"><h2>Atención de cobros</h2><p>'+overdue.length+' atrasado(s) · '+items.filter(x=>statusOf(x)==='today').length+' vencen hoy</p><div class="fiados-agenda-shortcuts">'+btn('Abrir agenda','agenda')+btn('Enviar recordatorio','agenda-today','btn-secondary')+'</div></div>';
  };
  const renderReports = () => {
    const root=$('pro-reportes');if(!root)return;
    const all=txs(),cs=clients(),debts=all.filter(t=>t.type==='DEBT').reduce((s,t)=>s+Number(t.amount),0),payments=all.filter(t=>t.type==='PAYMENT').reduce((s,t)=>s+Number(t.amount),0);
    const ranking=cs.map(c=>({c,b:balance(c.id)})).sort((a,b)=>b.b-a.b).slice(0,10);
    root.innerHTML='<div class="stats-grid">'+card('Fiados registrados',money(debts))+card('Abonos registrados',money(payments))+card('Saldo cartera',money(cs.reduce((s,c)=>s+Math.max(0,balance(c.id)),0)))+'</div><div class="glass fiados-agenda-panel"><h2>Clientes con mayor saldo</h2>'+(ranking.length?ranking.map(x=>'<div class="transaction-item"><span>'+esc(x.c.name)+'</span><strong>'+money(x.b)+'</strong></div>').join(''):'<p>Sin clientes registrados.</p>')+'<div class="fiados-v2-backup-actions">'+btn('Descargar CSV','csv')+btn('Imprimir / Guardar PDF','print','btn-secondary')+'</div></div>';
  };
  const exportCSV = () => {
    const rows=[['tipo','cliente','descripcion','monto','fecha','vencimiento','saldo_cliente']];
    txs().forEach(t=>{const c=clients().find(x=>x.id===t.clientId);rows.push([t.type,c?.name||'',t.desc||'',t.amount,new Date(t.date).toISOString(),t.dueAt||'',balance(t.clientId)]);});
    const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='fiados-reporte-'+today()+'.csv';a.click();URL.revokeObjectURL(url);
  };
  const addDueDateField = () => {
    const form=$('form-add-debt');if(!form||$('input-debt-due'))return;
    const group=document.createElement('div');group.className='input-group';
    group.innerHTML='<label for="input-debt-due">Fecha de vencimiento (opcional)</label><input type="date" id="input-debt-due">';
    form.insertBefore(group,form.querySelector('button[type="submit"]'));
    const original=DataStore.addTransaction.bind(DataStore);
    DataStore.addTransaction=tx=>{
      if(tx.type==='DEBT'){const due=$('input-debt-due')?.value;if(due)tx.dueAt=new Date(due+'T12:00:00-04:00').toISOString();}
      return original(tx);
    };
  };
  const protectPayments = () => {
    const original=App.handleAddPayment.bind(App);
    App.handleAddPayment=e=>{
      const amount=Number($('input-payment-amount')?.value),owed=balance(App.currentClientId);
      if(!Number.isFinite(amount)||amount<=0){e.preventDefault();alert('Introduce un monto válido.');return;}
      if(amount>owed+0.000001){e.preventDefault();alert('El abono supera el saldo pendiente ('+money(owed)+'). Ajusta el monto.');return;}
      return original(e);
    };
  };
  const renderRisk = () => {
    document.querySelectorAll('#clients-list .client-card').forEach((el,i)=>{
      const c=clients()[i];if(!c)return;
      const item=dueItems().find(x=>x.client.id===c.id);
      el.querySelectorAll('.fiados-risk-label').forEach(n=>n.remove());
      const tag=document.createElement('small');tag.className='fiados-risk-label';
      tag.textContent=item&&statusOf(item)==='overdue'?'Cobro atrasado':balance(c.id)<=0?'Al día':'Saldo pendiente';
      tag.style.cssText='display:block;margin-top:.5rem;color:'+(item&&statusOf(item)==='overdue'?'#f87171':balance(c.id)<=0?'#34d399':'#93c5fd');
      el.appendChild(tag);
    });
  };
  const init = () => {
    addView('agenda','Agenda de cobros','Vencimientos, seguimiento y recordatorios.');
    addView('reportes','Reportes','Resumen financiero y exportación de movimientos.');
    const dashboard=$('view-dashboard');
    if(dashboard&&!$('pro-dashboard-extra')){const x=document.createElement('div');x.id='pro-dashboard-extra';dashboard.appendChild(x);}
    addDueDateField();protectPayments();
    const oldRender=App.render.bind(App);
    App.render=()=>{oldRender();if(App.currentView==='dashboard')renderDashboard();if(App.currentView==='agenda')renderAgenda();if(App.currentView==='reportes')renderReports();if(App.currentView==='clients')renderRisk();};
    const oldDetail=App.renderClientDetail.bind(App);
    App.renderClientDetail=()=>{oldDetail();const client=clients().find(c=>c.id===App.currentClientId);if(!client)return;const actions=document.querySelector('#view-client-detail .actions-row');if(actions&&!$('fiados-client-whatsapp')){const b=document.createElement('button');b.id='fiados-client-whatsapp';b.type='button';b.className='btn btn-primary';b.textContent='Contactar por WhatsApp';b.addEventListener('click',()=>openWhatsApp(client.id));actions.appendChild(b);}};
    document.addEventListener('click',e=>{
      const waOpen=e.target.closest('#fiados-wa-open');
      if(waOpen){const logs=JSON.parse(localStorage.getItem('fiados_whatsapp_logs')||'[]');logs.push({id:crypto.randomUUID(),clientId:waOpen.dataset.clientId||'',phone:waOpen.dataset.phone||'',message:$('fiados-wa-message')?.value||'',openedAt:Date.now(),status:'draft_opened'});localStorage.setItem('fiados_whatsapp_logs',JSON.stringify(logs));if(window.FiadosModulesSync&&window.FiadosCloud?.getStatus?.().signedIn&&window.FiadosCloud.getStatus().mode==='ready')queueMicrotask(()=>window.FiadosModulesSync.sync().catch(()=>{}));}
      const wa=e.target.closest('[data-wa-client]');if(wa){openWhatsApp(wa.dataset.waClient);return;}
      const filter=e.target.closest('[data-agenda-filter]');if(filter){agendaFilter=filter.dataset.agendaFilter;renderAgenda();return;}
      const action=e.target.closest('[data-pro-action]')?.dataset.proAction;if(!action)return;
      if(action==='agenda'||action==='agenda-today'){agendaFilter=action==='agenda-today'?'today':'all';App.navigate('agenda');}
      if(action==='notifications')enableNotifications();
      if(action==='csv')exportCSV();
      if(action==='print')window.print();
    });
    renderDashboard();
    notifyDue();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)notifyDue();});
    window.addEventListener('focus',notifyDue);
  };
  document.addEventListener('DOMContentLoaded',init);
  window.FiadosPro={exportCSV,refresh:()=>{renderDashboard();renderAgenda();renderReports();notifyDue();},openWhatsApp};
})();
