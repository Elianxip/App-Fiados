/* FIADOS 2.0 — Etapa 1: planes de pago y estado de cuenta.
   Los planes se guardan aparte de los movimientos históricos: no reescribe ni elimina fiados/abonos. */
(() => {
  'use strict';
  const KEY = 'fiados_payment_plans';
  const $ = id => document.getElementById(id);
  const readPlans = () => {
    try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
  };
  const savePlans = plans => localStorage.setItem(KEY, JSON.stringify(plans));
  const money = n => new Intl.NumberFormat('es-DO', {style:'currency',currency:'DOP'}).format(Number(n)||0);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateKey = value => {
    const d = new Date(value);
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  };
  const dateLabel = value => new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeZone:'America/Santo_Domingo'}).format(new Date(value+'T12:00:00-04:00'));
  const clientById = id => DataStore.getClients().find(c=>c.id===id);
  const paymentsSince = plan => DataStore.getClientTransactions(plan.clientId)
    .filter(t=>t.type==='PAYMENT' && Number(t.date)>=Number(plan.createdAt))
    .reduce((s,t)=>s+Number(t.amount||0),0);
  const installmentsFor = plan => {
    const paid = Math.min(Number(plan.total), paymentsSince(plan));
    let consumed = paid;
    return plan.installments.map((item,index)=>{
      const applied = Math.min(Number(item.amount), Math.max(0,consumed));
      consumed -= applied;
      return {...item,paid:applied,remaining:Math.max(0,Number(item.amount)-applied),status:applied>=Number(item.amount)-0.005?'Pagada':applied>0?'Parcial':'Pendiente',index};
    });
  };
  const createPlan = (clientId, total, count, frequency, firstDate) => {
    const now = Date.now(), amount = Math.floor((total/count)*100)/100;
    let assigned = 0;
    const installments = Array.from({length:count},(_,i)=>{
      const value = i===count-1 ? Math.round((total-assigned)*100)/100 : amount;
      assigned += value;
      const date = new Date(firstDate+'T12:00:00-04:00');
      if(frequency==='weekly') date.setDate(date.getDate()+7*i);
      else if(frequency==='biweekly') date.setDate(date.getDate()+14*i);
      else { const day=date.getDate(); date.setDate(1); date.setMonth(date.getMonth()+i); const last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate(); date.setDate(Math.min(day,last)); }
      return {id:now+'-'+i, dueDate:dateKey(date), amount:value};
    });
    return {id:'plan-'+now+'-'+Math.random().toString(36).slice(2,7),clientId,total,createdAt:now,frequency,installments};
  };
  const ensurePanel = () => {
    const view=$('view-client-detail'); if(!view||$('fiados-plan-panel'))return;
    const panel=document.createElement('section'); panel.id='fiados-plan-panel'; panel.className='glass fiados-plan-panel';
    panel.innerHTML='<div class="fiados-plan-heading"><div><h2>Plan de pago</h2><p>Organiza el saldo en cuotas sin alterar los movimientos registrados.</p></div><div class="fiados-plan-actions"><button class="btn btn-secondary" id="fiados-statement" type="button">Estado de cuenta</button><button class="btn btn-primary" id="fiados-new-plan" type="button">Crear plan</button></div></div><div id="fiados-plan-content"></div>';
    const history=view.querySelector('.history-section');
    if(history) history.after(panel); else view.appendChild(panel);
    $('fiados-new-plan').addEventListener('click',showPlanForm);
    $('fiados-statement').addEventListener('click',printStatement);
  };
  const showPlanForm = () => {
    const client=clientById(App.currentClientId); if(!client)return;
    const balance=Math.max(0,DataStore.getClientBalance(client.id));
    if(balance<=0){alert('Este cliente no tiene saldo pendiente para crear un plan.');return;}
    const content=$('fiados-plan-content');
    content.innerHTML='<form id="fiados-plan-form" class="fiados-plan-form"><label>Saldo a organizar (RD$)<input id="fiados-plan-total" type="number" min="0.01" max="'+balance.toFixed(2)+'" step="0.01" value="'+balance.toFixed(2)+'" required></label><label>Cantidad de cuotas<select id="fiados-plan-count"><option>2</option><option selected>3</option><option>4</option><option>6</option><option>8</option><option>10</option><option>12</option></select></label><label>Frecuencia<select id="fiados-plan-frequency"><option value="weekly">Semanal</option><option value="biweekly">Quincenal</option><option value="monthly" selected>Mensual</option></select></label><label>Primera fecha de pago<input id="fiados-plan-date" type="date" min="'+dateKey(Date.now())+'" value="'+dateKey(Date.now()+86400000)+'" required></label><div class="fiados-plan-actions"><button class="btn btn-primary" type="submit">Guardar plan</button><button class="btn btn-secondary" id="fiados-plan-cancel" type="button">Cancelar</button></div><p class="fiados-plan-note">El plan es una agenda de cuotas. Los abonos siguen registrándose con “Registrar Abono”; se aplicarán al plan por orden de vencimiento.</p></form>';
    $('fiados-plan-cancel').addEventListener('click',renderPlans);
    $('fiados-plan-form').addEventListener('submit',e=>{
      e.preventDefault();
      const total=Number($('fiados-plan-total').value), count=Number($('fiados-plan-count').value), frequency=$('fiados-plan-frequency').value, first=$('fiados-plan-date').value;
      const current=Math.max(0,DataStore.getClientBalance(client.id));
      if(!Number.isFinite(total)||total<=0||total>current+0.005){alert('El monto debe ser mayor que cero y no superar el saldo actual ('+money(current)+').');return;}
      if(!first||dateKey(first+'T12:00:00-04:00')<dateKey(Date.now())){alert('Selecciona una fecha de hoy o futura.');return;}
      const plans=readPlans().filter(p=>p.clientId!==client.id);
      plans.push(createPlan(client.id,total,count,frequency,first));savePlans(plans);renderPlans();
    });
  };
  const renderPlans = () => {
    ensurePanel();
    const client=clientById(App.currentClientId); if(!client)return;
    const root=$('fiados-plan-content'); if(!root)return;
    const plan=readPlans().filter(p=>p.clientId===client.id).sort((a,b)=>b.createdAt-a.createdAt)[0];
    if(!plan){root.innerHTML='<p class="fiados-plan-empty">Todavía no hay un plan de pago para este cliente.</p>';return;}
    const rows=installmentsFor(plan);
    const paid=rows.reduce((s,x)=>s+x.paid,0), remaining=Math.max(0,plan.total-paid);
    root.innerHTML='<div class="fiados-plan-summary"><span>Plan: '+money(plan.total)+'</span><span>Pagado: '+money(paid)+'</span><strong>Restante del plan: '+money(remaining)+'</strong></div><div class="fiados-installments">'+rows.map(x=>'<article class="fiados-installment"><div><strong>Cuota '+(x.index+1)+'</strong><small>'+esc(dateLabel(x.dueDate))+'</small></div><div><strong>'+money(x.amount)+'</strong><small>'+esc(x.status)+(x.remaining>0?' · Restan '+money(x.remaining):'')+'</small></div></article>').join('')+'</div><button type="button" class="btn btn-secondary" id="fiados-plan-remove">Cerrar plan</button>';
    $('fiados-plan-remove').addEventListener('click',()=>{
      if(!confirm('¿Cerrar este plan? No se borrarán clientes, fiados ni abonos.'))return;
      savePlans(readPlans().filter(p=>p.id!==plan.id));renderPlans();
    });
  };
  const printStatement = () => {
    const client=clientById(App.currentClientId); if(!client)return;
    const txs=DataStore.getClientTransactions(client.id), balance=DataStore.getClientBalance(client.id);
    const rows=txs.map(t=>'<tr><td>'+esc(new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeZone:'America/Santo_Domingo'}).format(new Date(t.date)))+'</td><td>'+esc(t.type==='DEBT'?'Fiado':'Abono')+'</td><td>'+esc(t.desc||'')+'</td><td>'+money(t.amount)+'</td></tr>').join('');
    const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Estado de cuenta - '+esc(client.name)+'</title><style>body{font:14px Arial,sans-serif;margin:32px;color:#172033}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.total{font-size:22px;font-weight:bold;margin-top:20px}@media print{button{display:none}}</style></head><body><h1>FIADOS 2.0</h1><p>Estado de cuenta de <b>'+esc(client.name)+'</b></p><p>Teléfono: '+esc(client.phone||'No registrado')+'</p><p>Generado: '+esc(new Date().toLocaleString('es-DO'))+'</p><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Detalle</th><th>Monto</th></tr></thead><tbody>'+rows+'</tbody></table><p class="total">Saldo actual: '+money(balance)+'</p><button onclick="window.print()">Imprimir / Guardar PDF</button></body></html>';
    const w=window.open('','_blank'); if(!w){alert('Permite las ventanas emergentes para generar el estado de cuenta.');return;}
    w.document.open();w.document.write(html);w.document.close();
  };
  const init = () => {
    const oldRender=App.render.bind(App);
    App.render=()=>{oldRender();if(App.currentView==='client-detail')renderPlans();};
    document.addEventListener('DOMContentLoaded',()=>{if(App.currentView==='client-detail')renderPlans();});
    window.FiadosPlans={refresh:renderPlans,exportStatement:printStatement};
  };
  if(window.App&&window.DataStore)init();
})();
