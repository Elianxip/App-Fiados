/* FIADOS 2.0 — módulos adicionales locales.
 * Los datos históricos fiado_clients / fiado_txs nunca se reescriben.
 * Funciones que requieren backend se identifican como pendientes de conexión segura.
 */
(() => {
'use strict';
const K={expenses:'fiados_expenses',collectors:'fiados_collectors',rewards:'fiados_rewards',receipts:'fiados_receipts',devices:'fiados_devices',settings:'fiados_suite_settings'};
const read=(k,d=[])=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v===null?d:v}catch{return d}};
const save=(k,v)=>{localStorage.setItem(k,JSON.stringify(v));if(window.FiadosModulesSync&&window.FiadosCloud?.getStatus?.().signedIn&&window.FiadosCloud.getStatus().mode==='ready')queueMicrotask(()=>window.FiadosModulesSync.sync().catch(()=>{}));};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP'}).format(Number(n)||0);
const clients=()=>DataStore.getClients();
const txs=()=>DataStore.getTransactions();
const balance=()=>clients().reduce((s,c)=>s+Math.max(0,DataStore.getClientBalance(c.id)),0);
const date=()=>new Date().toISOString().slice(0,10);
const todayTotal=()=>txs().filter(t=>t.type==='PAYMENT'&&new Date(t.date).toISOString().slice(0,10)===date()).reduce((s,t)=>s+Number(t.amount),0);
const settings=()=>read(K.settings,{});
const setStatus=(root,msg)=>{const el=root.querySelector('[data-status]');if(el)el.textContent=msg};
const addNav=(id,label)=>{if(document.querySelector('[data-view="'+id+'"]'))return;const b=document.createElement('button');b.className='nav-item';b.dataset.view=id;b.textContent=label;document.querySelector('.nav-links').append(b)};
const addView=(id,title,desc)=>{if(document.getElementById('view-'+id))return;const s=document.createElement('section');s.id='view-'+id;s.className='view';s.innerHTML='<header class="view-header"><h1>'+title+'</h1><p>'+desc+'</p></header><div id="suite-'+id+'"></div>';document.querySelector('.content').append(s)};
const card=(title,value,sub='')=>'<article class="stat-card glass"><div class="stat-info"><h3>'+title+'</h3><h2>'+value+'</h2><p>'+sub+'</p></div></article>';
const panel=(title,body)=>'<section class="glass fiados-suite-panel"><h2>'+title+'</h2>'+body+'</section>';
const btn=(action,label,cls='btn btn-primary')=>'<button type="button" class="'+cls+'" data-action="'+action+'">'+label+'</button>';
const field=(label,name,type='text',extra='')=>'<label class="suite-field">'+label+'<input name="'+name+'" type="'+type+'" '+extra+' required></label>';
function ensureViews(){
 [['gastos','Gastos','Registra gastos y calcula utilidad neta.'],['finanzas','Finanzas','Proyección de cobros e ingresos.'],['recibos','Recibos','Comprobantes imprimibles de abonos.'],['equipo','Cobradores','Asigna responsables y consulta estadísticas.'],['recompensas','Recompensas','Puntos por abonos confirmados.'],['seguridad','Seguridad','Bloqueo local con PIN y biometría compatible.'],['dispositivos','Dispositivos','Estado de este dispositivo y sincronización.']].forEach(x=>{addNav(x[0],x[0][0].toUpperCase()+x[0].slice(1));addView(...x)});
}
function renderExpenses(){
 const root=document.getElementById('suite-gastos');if(!root)return;
 const rows=read(K.expenses),sum=rows.reduce((s,x)=>s+Number(x.amount),0);
 root.innerHTML=card('Gastos registrados',money(sum),rows.length+' registros')+panel('Nuevo gasto','<form data-form="expense" class="suite-form">'+field('Concepto','description')+field('Monto RD$','amount','number','min="0.01" step="0.01"')+'<label class="suite-field">Categoría<select name="category"><option>Mercancía</option><option>Transporte</option><option>Servicios</option><option>Alquiler</option><option>Personal</option><option>Otros</option></select></label>'+field('Fecha','date','date','value="'+date()+'"')+'<button class="btn btn-primary">Guardar gasto</button></form>')+panel('Historial','<div class="suite-list">'+(rows.length?rows.slice().reverse().map(x=>'<article><b>'+esc(x.description)+'</b><span>'+esc(x.category)+' · '+esc(x.date)+' · '+money(x.amount)+'</span>'+btn('delete-expense:'+x.id,'Eliminar','btn btn-secondary')+'</article>').join(''):'<p>No hay gastos todavía.</p>')+'</div>');
}
function renderFinance(){
 const root=document.getElementById('suite-finanzas');if(!root)return;
 const expenses=read(K.expenses).reduce((s,x)=>s+Number(x.amount),0),income=txs().filter(t=>t.type==='PAYMENT').reduce((s,t)=>s+Number(t.amount),0),debt=balance();
 const upcoming=read('fiados_payment_plans').flatMap(p=>(p.installments||[]).map(i=>({date:i.dueDate,amount:Number(i.amount)}))).filter(x=>x.date>=date()).sort((a,b)=>a.date.localeCompare(b.date));
 const next30=upcoming.filter(x=>(new Date(x.date+'T12:00:00')-new Date())/86400000<=30).reduce((s,x)=>s+x.amount,0);
 root.innerHTML='<div class="stats-grid">'+card('Abonos históricos',money(income))+card('Gastos',money(expenses))+card('Resultado neto',money(income-expenses))+card('Cartera pendiente',money(debt))+card('Cuotas próximas (30 días)',money(next30))+'</div>'+panel('Proyección','<p>La proyección de cuotas usa los planes guardados. Los clientes sin fecha de vencimiento no se inventan ni se incluyen.</p><p><b>Saldo actual de cartera:</b> '+money(debt)+'</p><p><b>Cuotas planificadas próximos 30 días:</b> '+money(next30)+'</p><p class="suite-muted">Es una estimación, no una promesa de cobro. Los pagos reales pueden variar.</p>');
}
function renderReceipts(){
 const root=document.getElementById('suite-recibos');if(!root)return;
 const payments=txs().filter(t=>t.type==='PAYMENT').slice().sort((a,b)=>b.date-a.date);
 root.innerHTML=panel('Recibos de abonos','<p>Selecciona un abono para generar un comprobante imprimible con código único verificable dentro de esta copia local.</p><div class="suite-list">'+(payments.length?payments.map(t=>{const c=clients().find(x=>x.id===t.clientId);return '<article><b>'+esc(c?.name||'Cliente')+' · '+money(t.amount)+'</b><span>'+esc(new Date(t.date).toLocaleString('es-DO'))+' · '+esc(t.desc||'Abono')+'</span>'+btn('receipt:'+t.id,'Generar recibo','btn btn-secondary')+'</article>'}).join(''):'<p>No hay abonos registrados.</p>')+'</div><p class="suite-muted">El QR verificable en línea requiere un endpoint seguro; no se generará un QR falso ni se enviarán datos del cliente a terceros.</p>');
}
function renderTeam(){
 const root=document.getElementById('suite-equipo');if(!root)return;
 const team=read(K.collectors),all=txs().filter(t=>t.type==='PAYMENT'),rows=team.map(p=>({p,total:all.filter(t=>t.collectorId===p.id).reduce((s,t)=>s+Number(t.amount),0),count:all.filter(t=>t.collectorId===p.id).length}));
 const active=settings().activeCollectorId||'';const selector='<label class="suite-field">Cobrador para próximos abonos<select id="fiados-active-collector"><option value="">Sin asignar</option>'+team.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===active?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>';root.innerHTML=panel('Registrar cobrador','<form data-form="collector" class="suite-form">'+field('Nombre del cobrador','name')+'<button class="btn btn-primary">Agregar cobrador</button></form>'+selector)+panel('Rendimiento','<p class="suite-muted">Los abonos nuevos se atribuyen al cobrador seleccionado. Los movimientos antiguos quedan sin atribución.</p><div class="suite-list">'+(rows.length?rows.map(x=>'<article><b>'+esc(x.p.name)+'</b><span>'+x.count+' abonos · '+money(x.total)+'</span>'+btn('delete-collector:'+x.p.id,'Quitar','btn btn-secondary')+'</article>').join(''):'<p>No hay cobradores registrados.</p>')+'</div>');const sel=root.querySelector('#fiados-active-collector');if(sel)sel.onchange=()=>save(K.settings,{...settings(),activeCollectorId:sel.value});
}
function renderRewards(){
 const root=document.getElementById('suite-recompensas');if(!root)return;
 const cfg=read(K.rewards,{rate:1}),payments=txs().filter(t=>t.type==='PAYMENT'),total=payments.reduce((s,t)=>s+Number(t.amount),0),points=Math.floor(total/100*Number(cfg.rate||1));
 root.innerHTML=panel('Reglas de puntos','<form data-form="rewards" class="suite-form"><label class="suite-field">Puntos por cada RD$100 abonados<input name="rate" type="number" min="0" step="0.1" value="'+Number(cfg.rate||1)+'" required></label><button class="btn btn-primary">Guardar regla</button></form>')+card('Puntos acumulados estimados',points,'Calculados sobre abonos históricos')+panel('Recompensas','<p>Los puntos son un programa promocional y no reducen automáticamente las deudas. La redención y el historial por cliente se añadirán al habilitar reglas de canje.</p>');
}
async function hashPin(pin,salt){const enc=new TextEncoder();const key=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:120000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function lockScreen(){
 if(document.getElementById('fiados-pin-overlay'))return;
 const o=document.createElement('div');o.id='fiados-pin-overlay';o.className='fiados-pin-overlay';o.innerHTML='<form id="fiados-unlock" class="glass"><h2>Fiados 2.0 bloqueado</h2><p>Introduce tu PIN para continuar.</p><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" required placeholder="PIN"><button class="btn btn-primary">Desbloquear</button><p data-status></p></form>';document.body.append(o);
 o.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const p=e.target.pin.value,s=settings();if(await hashPin(p,s.salt)===s.pinHash){o.remove();}else{e.target.reset();o.querySelector('[data-status]').textContent='PIN incorrecto.'}});
}
function renderSecurity(){
 const root=document.getElementById('suite-seguridad');if(!root)return;const s=settings();
 root.innerHTML=panel('Bloqueo con PIN','<form data-form="pin" class="suite-form"><p>El PIN se guarda como hash PBKDF2, nunca en texto plano. El bloqueo es local a este navegador.</p>'+field(s.pinHash?'Cambiar PIN':'Crear PIN','pin','password','minlength="4" maxlength="8" pattern="[0-9]{4,8}" inputmode="numeric"')+'<button class="btn btn-primary">Guardar PIN</button></form>'+(s.pinHash?btn('lock-now','Bloquear ahora','btn btn-secondary'):'')+'<p class="suite-muted">La biometría WebAuthn necesita un servidor que emita y valide desafíos criptográficos; no se activará con una simulación local.</p>');
}
function renderDevices(){
 const root=document.getElementById('suite-dispositivos');if(!root)return;
 const status=window.FiadosCloud?.getStatus?.()||{signedIn:false,mode:'local'};
 root.innerHTML=panel('Este dispositivo','<p><b>Navegador:</b> '+esc(navigator.userAgent.slice(0,110))+'</p><p><b>Conexión:</b> '+(navigator.onLine?'En línea':'Sin conexión')+'</p><p><b>Supabase:</b> '+(status.signedIn?'Cuenta conectada':'No conectado')+' · '+esc(status.mode)+'</p><p><b>Último respaldo:</b> '+esc(read(K.devices,{}).backupAt||'No registrado')+'</p>'+btn('device-backup','Registrar respaldo descargado','btn btn-secondary')+'<p class="suite-muted">La sincronización real de gastos, cobradores, puntos, planes y recibos requiere tablas nuevas con RLS y pruebas de aislamiento. No se compartirán datos entre cuentas desde el navegador.</p>');
}
function renderModuleLauncher(){
 const dashboard=document.getElementById('view-dashboard');if(!dashboard||document.getElementById('fiados-module-launcher'))return;
 const items=[
  ['agenda','Agenda de cobros','Vencimientos y seguimiento'],
  ['reportes','Reportes','Cartera y exportaciones'],
  ['gastos','Gastos','Registra egresos'],
  ['finanzas','Finanzas','Ingresos y proyección'],
  ['recibos','Recibos','Comprobantes de abonos'],
  ['equipo','Cobradores','Responsables y rendimiento'],
  ['recompensas','Recompensas','Puntos promocionales'],
  ['seguridad','Seguridad','Bloqueo con PIN'],
  ['dispositivos','Dispositivo','Conexión y respaldo']
 ];
 const section=document.createElement('section');section.id='fiados-module-launcher';section.className='glass module-launcher';
 section.innerHTML='<h2>Todas las funciones de Fiados 2.0</h2><p>Entra directamente a cada herramienta. Desliza el menú inferior para recorrer las secciones.</p><div class="module-launcher-grid">'+items.map(([id,name,desc])=>'<button type="button" class="module-shortcut" data-module-view="'+id+'"><strong>'+name+'</strong><span>'+desc+'</span></button>').join('')+'</div>';
 dashboard.appendChild(section);
 section.addEventListener('click',e=>{const b=e.target.closest('[data-module-view]');if(b&&window.App?.navigate)window.App.navigate(b.dataset.moduleView)});
}
function renderAll(){renderExpenses();renderFinance();renderReceipts();renderTeam();renderRewards();renderSecurity();renderDevices()}
function receipt(id){
 const t=txs().find(x=>x.id===id),c=t&&clients().find(x=>x.id===t.clientId);if(!t||!c)return;
 const code='F2-'+String(t.id).replace(/[^a-z0-9]/gi,'').slice(-12).toUpperCase();
 const w=window.open('','_blank');if(!w){alert('Permite ventanas emergentes para imprimir.');return}
 w.document.write('<!doctype html><html lang="es"><meta charset="utf-8"><title>Recibo '+code+'</title><style>body{font:15px Arial;margin:35px;color:#111}h1{margin-bottom:5px}.box{border:1px solid #ddd;padding:20px;max-width:600px}.amount{font-size:28px;font-weight:bold}small{color:#555}</style><div class="box"><h1>FIADOS 2.0</h1><small>Comprobante de abono · '+code+'</small><hr><p>Recibimos de: <b>'+esc(c.name)+'</b></p><p>Fecha: '+esc(new Date(t.date).toLocaleString('es-DO'))+'</p><p>Concepto: '+esc(t.desc||'Abono')+'</p><p class="amount">'+money(t.amount)+'</p><p>Saldo restante: '+money(DataStore.getClientBalance(c.id))+'</p><hr><small>Código local del movimiento: '+esc(code)+'. Este documento no sustituye una factura fiscal.</small><p><button onclick="print()">Imprimir / Guardar PDF</button></p></div></html>');w.document.close();
 save(K.receipts,[...read(K.receipts),{id:code,transactionId:id,createdAt:Date.now()}]);
}
let scannerStream=null;
async function scanBarcode(){
 if(!('BarcodeDetector'in window)){alert('Este navegador no incluye BarcodeDetector. Prueba Chrome/Edge actualizado en Android o usa entrada manual.');return}
 try{const detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','qr_code']});const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});scannerStream=stream;const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.srcObject=stream;const o=document.createElement('div');o.className='fiados-pin-overlay';o.innerHTML='<div class="glass scanner-box"><h2>Escanear código</h2><video autoplay playsinline></video><p data-status>Apunta la cámara al código.</p><button type="button" class="btn btn-secondary" data-stop>Cerrar</button></div>';document.body.append(o);const video=o.querySelector('video');video.srcObject=stream;const stop=()=>{stream.getTracks().forEach(t=>t.stop());o.remove();scannerStream=null};o.querySelector('[data-stop]').onclick=stop;await video.play();const tick=async()=>{if(!o.isConnected)return;try{const found=await detector.detect(video);if(found.length){const code=found[0].rawValue;stop();const input=document.getElementById('input-debt-desc');if(input)input.value=(input.value?input.value+' · ':'')+'Código '+code;else alert('Código leído: '+code+' (abre Anotar Fiado para usarlo).');return}}catch{}requestAnimationFrame(tick)};tick()}catch(e){alert('No se pudo abrir la cámara: '+e.message)}
}
function bind(){
 document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(a.startsWith('receipt:'))receipt(a.split(':')[1]);
 else if(a.startsWith('delete-expense:')){if(confirm('¿Eliminar este gasto?')){save(K.expenses,read(K.expenses).filter(x=>x.id!==a.split(':')[1]));renderAll()}}
 else if(a.startsWith('delete-collector:')){save(K.collectors,read(K.collectors).filter(x=>x.id!==a.split(':')[1]));renderAll()}
 else if(a==='lock-now')lockScreen();else if(a==='scan')scanBarcode();
 else if(a==='device-backup'){save(K.devices,{...read(K.devices,{}),backupAt:new Date().toLocaleString('es-DO')});renderDevices()}
 });
 document.addEventListener('submit',async e=>{const f=e.target;if(!f.dataset.form)return;e.preventDefault();const d=Object.fromEntries(new FormData(f));
 if(f.dataset.form==='expense'){const amount=Number(d.amount);if(!(amount>0))return;save(K.expenses,[...read(K.expenses),{id:crypto.randomUUID(),description:d.description,amount,category:d.category,date:d.date}])}
 if(f.dataset.form==='collector')save(K.collectors,[...read(K.collectors),{id:crypto.randomUUID(),name:d.name}]);
 if(f.dataset.form==='rewards')save(K.rewards,{rate:Math.max(0,Number(d.rate)),updatedAt:Date.now()});
 if(f.dataset.form==='pin'){if(!/^\d{4,8}$/.test(d.pin))return;const salt=crypto.randomUUID();save(K.settings,{salt,pinHash:await hashPin(d.pin,salt)});alert('PIN guardado. Se bloqueará al cerrar y volver a abrir la app.')}
 renderAll();
 });
 // Atribución de nuevos abonos: no modifica los movimientos ya existentes.
 const original=DataStore.addTransaction.bind(DataStore);
 DataStore.addTransaction=function(tx){if(tx.type==='PAYMENT'){const selected=read(K.settings,{}).activeCollectorId;if(selected)tx={...tx,collectorId:selected}}return original(tx)};
}
function init(){
 if(!window.App||!window.DataStore)return;
 ensureViews();
 renderModuleLauncher();
 const nav=document.querySelector('.nav-links');
 nav.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;const id=b.dataset.view;if(!document.getElementById('view-'+id))return;document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+id));document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===b));if(id!=='dashboard'&&id!=='clients'&&id!=='client-detail')renderAll()});
 bind();
 const detail=document.getElementById('view-client-detail');if(detail&&!document.getElementById('fiados-scan-entry')){const b=document.createElement('button');b.id='fiados-scan-entry';b.className='btn btn-secondary';b.textContent='Escanear código de barras';b.onclick=scanBarcode;detail.querySelector('.actions-row')?.append(b)}
 // Selector de cobrador para registrar la atribución de nuevos pagos.
 const team=read(K.collectors);if(team.length){const select=document.createElement('select');select.id='fiados-active-collector';select.innerHTML='<option value="">Sin asignar cobrador</option>'+team.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');select.value=read(K.settings,{}).activeCollectorId||'';select.onchange=()=>save(K.settings,{...settings(),activeCollectorId:select.value});document.getElementById('view-dashboard')?.append(select)}
 if(settings().pinHash){let idle=0;['click','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,()=>{idle=0},{passive:true}));document.addEventListener('visibilitychange',()=>{if(document.hidden)lockScreen()});setInterval(()=>{idle++;if(idle>=30&&!document.getElementById('fiados-pin-overlay'))lockScreen()},60000)}
 renderAll();
}
document.addEventListener('DOMContentLoaded',init);
window.FiadosSuite={refresh:renderAll};
})();