/* FIADOS 2.0 PRO — módulos locales iniciales.
   Compatible con el modelo histórico fiado_clients / fiado_txs.
   No elimina ni migra registros existentes. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (n) => new Intl.NumberFormat('es-DO', {style:'currency',currency:'DOP'}).format(Number(n)||0);
  const dateText = (value) => value ? new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeZone:'America/Santo_Domingo'}).format(new Date(value)) : 'Sin fecha';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clients = () => DataStore.getClients();
  const txs = () => DataStore.getTransactions();
  const balance = (id) => DataStore.getClientBalance(id);
  const todayKey = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo'}).format(new Date());
  const localDateKey = (v) => v ? new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo'}).format(new Date(v)) : '';
  const isToday = (v) => localDateKey(v) === todayKey();
  const dueItems = () => txs().filter(t => t.type === 'DEBT' && t.dueAt && balance(t.clientId) > 0)
    .map(t => ({...t, client:clients().find(c=>c.id===t.clientId)}))
    .filter(t=>t.client).sort((a,b)=>Number(a.dueAt)-Number(b.dueAt));
  const addView = (id,title,desc) => {
    if ($('view-'+id)) return;
    const section = document.createElement('section');
    section.id='view-'+id; section.className='view';
    section.innerHTML='<header class="view-header"><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></header><div id="pro-'+id+'"></div>';
    document.querySelector('.content').appendChild(section);
    const nav=document.createElement('button'); nav.className='nav-item'; nav.dataset.view=id;
    nav.textContent=title; document.querySelector('.nav-links').appendChild(nav);
    nav.addEventListener('click',()=>window.App.navigate(id));
  };
  const card = (label,value,detail='') => '<article class="stat-card glass"><div class="stat-info"><h3>'+esc(label)+'</h3><h2>'+esc(value)+'</h2><p>'+esc(detail)+'</p></div></article>';
  const btn = (label,action,cls='btn-primary') => '<button class="btn '+cls+'" data-pro-action="'+action+'">'+esc(label)+'</button>';
  const renderDashboard = () => {
    const all=txs(), cs=clients();
    const lent=all.filter(t=>t.type==='DEBT').reduce((s,t)=>s+Number(t.amount),0);
    const paid=all.filter(t=>t.type==='PAYMENT').reduce((s,t)=>s+Number(t.amount),0);
    const pending=cs.reduce((s,c)=>s+Math.max(0,balance(c.id)),0);
    const todayPaid=all.filter(t=>t.type==='PAYMENT'&&isToday(t.date)).reduce((s,t)=>s+Number(t.amount),0);
    const overdue=dueItems().filter(t=>new Date(t.dueAt).getTime()<Date.now());
    const target=$('pro-dashboard-extra'); if(!target)return;
    target.innerHTML='<div class="stats-grid">'+
      card('Total fiado',money(lent),'Acumulado histórico')+
      card('Total recuperado',money(paid),'Abonos registrados')+
      card('Pendiente por cobrar',money(pending),'Saldo positivo de clientes')+
      card('Cobrado hoy',money(todayPaid),'Zona horaria Santo Domingo')+
      card('Clientes atrasados',String(overdue.length),'Según vencimientos registrados')+
      card('Clientes activos',String(cs.length),'Cartera total')+
      '</div><div class="glass" style="padding:1.25rem;margin:1rem 0"><h2>Accesos rápidos</h2><div class="fiados-v2-backup-actions">'+
      btn('Ver agenda','agenda')+btn('Ver reportes','reportes','btn-secondary')+btn('Exportar CSV','csv','btn-secondary')+
      '</div></div>';
  };
  const renderAgenda = () => {
    const root=$('pro-agenda'); if(!root)return;
    const items=dueItems();
    root.innerHTML='<div class="glass" style="padding:1rem"><p>Los registros históricos sin vencimiento se conservan sin fecha. Añade vencimientos al crear nuevos fiados.</p>'+
      (items.length?items.map(t=>{
        const overdue=new Date(t.dueAt).getTime()<Date.now();
        const phone=String(t.client.phone||'').replace(/\D/g,'');
        const msg=encodeURIComponent('Hola '+t.client.name+', te recordamos cordialmente que tienes un balance pendiente de '+money(balance(t.clientId))+' en Fiados. ¿Podrías confirmarnos cuándo realizarás tu pago?');
        return '<article class="transaction-item"><div class="tx-details"><h3>'+esc(t.client.name)+'</h3><p>Vencimiento: '+esc(dateText(t.dueAt))+' · '+(overdue?'Atrasado':'Pendiente')+'</p><strong>'+money(balance(t.clientId))+'</strong></div>'+(phone?'<a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/'+esc(phone)+'?text='+msg+'">WhatsApp</a>':'<span>Sin teléfono</span>')+'</article>';
      }).join(''):'<p>No hay vencimientos registrados. Puedes añadir una fecha al crear un nuevo fiado.')+'</div>';
  };
  const renderReports = () => {
    const root=$('pro-reportes'); if(!root)return;
    const all=txs(), cs=clients();
    const debts=all.filter(t=>t.type==='DEBT').reduce((s,t)=>s+Number(t.amount),0);
    const payments=all.filter(t=>t.type==='PAYMENT').reduce((s,t)=>s+Number(t.amount),0);
    const ranking=cs.map(c=>({c,b:balance(c.id)})).sort((a,b)=>b.b-a.b).slice(0,10);
    root.innerHTML='<div class="stats-grid">'+card('Fiados registrados',money(debts))+card('Abonos registrados',money(payments))+card('Saldo cartera',money(cs.reduce((s,c)=>s+Math.max(0,balance(c.id)),0)))+'</div>'+
      '<div class="glass" style="padding:1rem"><h2>Clientes con mayor saldo</h2>'+(ranking.length?ranking.map(x=>'<div class="transaction-item"><span>'+esc(x.c.name)+'</span><strong>'+money(x.b)+'</strong></div>').join(''):'<p>Sin clientes registrados.</p>')+
      '<div class="fiados-v2-backup-actions">'+btn('Descargar CSV','csv')+btn('Imprimir / Guardar PDF','print','btn-secondary')+'</div></div>';
  };
  const exportCSV = () => {
    const rows=[['tipo','cliente','descripcion','monto','fecha','vencimiento','saldo_cliente']];
    txs().forEach(t=>{const c=clients().find(x=>x.id===t.clientId);rows.push([t.type,c?.name||'',t.desc||'',t.amount,new Date(t.date).toISOString(),t.dueAt||'',balance(t.clientId)]);});
    const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='fiados-reporte-'+todayKey()+'.csv';a.click();URL.revokeObjectURL(url);
  };
  const openAssistant = () => {
    const total=clients().reduce((s,c)=>s+Math.max(0,balance(c.id)),0);
    const overdue=dueItems().filter(t=>new Date(t.dueAt).getTime()<Date.now()).length;
    const paidToday=txs().filter(t=>t.type==='PAYMENT'&&isToday(t.date)).reduce((s,t)=>s+Number(t.amount),0);
    const question=window.prompt('Asistente Fiados (respuestas basadas en los datos de este dispositivo).\nPregunta: ¿Cuánto tengo pendiente, cuánto cobré hoy o cuántos vencidos tengo?');
    if(!question)return;
    const q=question.toLowerCase();
    let answer=q.includes('hoy')?'Hoy has registrado '+money(paidToday)+' en abonos.':q.includes('venc')||q.includes('atras')?'Tienes '+overdue+' vencimientos atrasados registrados.':'Tu cartera pendiente suma '+money(total)+'.';
    window.alert(answer+'\n\nEste asistente usa reglas locales; no es una predicción ni asesoría financiera.');
  };
  const addDueDateField = () => {
    const form=$('form-add-debt'); if(!form||$('input-debt-due'))return;
    const group=document.createElement('div');group.className='input-group';
    group.innerHTML='<label for="input-debt-due">Fecha de vencimiento (opcional)</label><input type="date" id="input-debt-due">';
    form.insertBefore(group,form.querySelector('button[type="submit"]'));
    const original=DataStore.addTransaction.bind(DataStore);
    DataStore.addTransaction=(tx)=>{
      if(tx.type==='DEBT'){
        const due=$('input-debt-due')?.value;
        if(due)tx.dueAt=new Date(due+'T12:00:00-04:00').toISOString();
      }
      return original(tx);
    };
  };
  const protectPayments = () => {
    const original=App.handleAddPayment.bind(App);
    App.handleAddPayment=(e)=>{
      const amount=Number($('input-payment-amount')?.value);
      const owed=balance(App.currentClientId);
      if(!Number.isFinite(amount)||amount<=0){e.preventDefault();alert('Introduce un monto válido.');return;}
      if(amount>owed+0.000001){e.preventDefault();alert('El abono supera el saldo pendiente ('+money(owed)+'). Ajusta el monto para evitar un saldo negativo.');return;}
      return original(e);
    };
  };
  const renderRisk = () => {
    document.querySelectorAll('#clients-list .client-card').forEach((el,i)=>{
      const c=clients()[i];if(!c)return;
      const b=balance(c.id);const due=dueItems().filter(t=>t.clientId===c.id);
      const overdue=due.some(t=>new Date(t.dueAt).getTime()<Date.now());
      el.querySelectorAll('.fiados-risk-label').forEach(n=>n.remove()); const tag=document.createElement('small');tag.className='fiados-risk-label';tag.textContent=overdue?'Riesgo: revisar vencimiento':b<=0?'Al día':'Saldo pendiente';
      tag.style.display='block';tag.style.marginTop='.5rem';tag.style.color=overdue?'#f87171':b<=0?'#34d399':'#93c5fd';el.appendChild(tag);
    });
  };
  const init = () => {
    addView('agenda','Agenda de cobros','Próximos vencimientos y seguimiento de pagos.');
    addView('reportes','Reportes','Resumen financiero y exportación de movimientos.');
    addView('asistente','Asistente IA','Consultas rápidas sobre los datos disponibles localmente.');
    const dashboard=$('view-dashboard');
    if(dashboard&&!$('pro-dashboard-extra')){const x=document.createElement('div');x.id='pro-dashboard-extra';dashboard.appendChild(x);}
    addDueDateField();protectPayments();
    const oldRender=App.render.bind(App);
    App.render=()=>{oldRender();if(App.currentView==='dashboard')renderDashboard();if(App.currentView==='agenda')renderAgenda();if(App.currentView==='reportes')renderReports();if(App.currentView==='clients')renderRisk();};
    document.addEventListener('click',(e)=>{
      const action=e.target.closest('[data-pro-action]')?.dataset.proAction;if(!action)return;
      if(action==='agenda')App.navigate('agenda');
      if(action==='reportes')App.navigate('reportes');
      if(action==='csv')exportCSV();
      if(action==='print')window.print();
    });
    const assistantNav=[...document.querySelectorAll('.nav-item')].find(n=>n.dataset.view==='asistente');
    assistantNav?.addEventListener('click',()=>openAssistant());
    renderDashboard();
  };
  document.addEventListener('DOMContentLoaded',init);
  window.FiadosPro={exportCSV,refresh:()=>{renderDashboard();renderAgenda();renderReports();}};
})();