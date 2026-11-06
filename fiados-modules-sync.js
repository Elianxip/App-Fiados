/* Fiados 2.0 — sincronización aditiva de módulos. Nunca elimina filas remotas.
   Requiere fiados-cloud.js y migración 0003. Conflictos por id: gana updatedAt más reciente. */
(() => {
'use strict';
const specs=[
 {key:'fiados_payment_plans',table:'payment_plans',make:x=>({id:String(x.id),client_id:String(x.clientId),payload:x,updated_at:new Date(Number(x.updatedAt||x.createdAt)||Date.now()).toISOString()}),take:r=>({...r.payload,id:r.id,clientId:r.client_id,updatedAt:new Date(r.updated_at).getTime()})},
 {key:'fiados_expenses',table:'expenses',make:x=>({id:String(x.id),description:String(x.description||''),amount:Number(x.amount),category:String(x.category||'Otros'),occurred_on:String(x.date||new Date().toISOString().slice(0,10)),payload:x,updated_at:new Date(Number(x.updatedAt)||Date.now()).toISOString()}),take:r=>({...r.payload,id:r.id,updatedAt:new Date(r.updated_at).getTime()})},
 {key:'fiados_collectors',table:'collectors',make:x=>({id:String(x.id),name:String(x.name||''),active:true,payload:x,updated_at:new Date(Number(x.updatedAt)||Date.now()).toISOString()}),take:r=>({...r.payload,id:r.id,updatedAt:new Date(r.updated_at).getTime()})},
 {key:'fiados_receipts',table:'receipts',make:x=>({id:String(x.id),transaction_id:String(x.transactionId),verification_code:String(x.id),payload:x}),take:r=>({...r.payload,id:r.id,transactionId:r.transaction_id})}
];
const read=(k,d=[])=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??d}catch{throw new Error('No se pudo leer '+k+'. No se modificó nada.')}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const stamp=x=>Number(x.updatedAt||x.createdAt||0);
function merge(local,remote){
 const map=new Map();
 for(const x of remote)map.set(String(x.id),x);
 for(const x of local){const id=String(x.id),old=map.get(id);if(!old||stamp(x)>=stamp(old))map.set(id,x)}
 return [...map.values()];
}
async function sync(){
 const api=window.FiadosCloud,status=api?.getStatus?.();
 if(!status?.signedIn)throw new Error('Inicia sesión en Supabase primero.');
 if(status.mode==='paused-conflict'||status.mode==='sync-error'||status.mode==='pending-upload'||status.mode==='pending-download')throw new Error('Primero resuelve la sincronización de clientes y movimientos desde el panel Supabase.');
 const summary=[];
 for(const s of specs){
  const local=read(s.key,[]);
  if(!Array.isArray(local))throw new Error('El módulo '+s.key+' tiene formato incorrecto.');
  const remoteRows=await api.syncModuleTable(s.table,[]);
  const remote=remoteRows.map(s.take);
  const combined=merge(local,remote);
  const payload=combined.map(s.make);
  await api.syncModuleTable(s.table,payload);
  write(s.key,combined);
  summary.push(s.key+': '+combined.length);
 }
 const rewards=read('fiados_rewards',{rate:1});
 if(!Array.isArray(rewards)&&rewards&&Number.isFinite(Number(rewards.rate))){
  const remote=await api.fetchRewardSettings();
  if(!remote){await api.saveRewardSettings(rewards.rate);summary.push('configuración de puntos subida')}
  else {write('fiados_rewards',{rate:Number(remote.points_per_hundred),updatedAt:new Date(remote.updated_at).getTime()});summary.push('configuración de puntos descargada')}
 }
 const deviceKey='fiados_device_id';
 let deviceId=localStorage.getItem(deviceKey);
 if(!deviceId){deviceId=crypto.randomUUID();localStorage.setItem(deviceKey,deviceId)}
 const devices=await api.syncModuleTable('device_registry',[{id:deviceId,device_label:(navigator.platform||'Dispositivo').slice(0,80),app_version:'2.0',last_seen_at:new Date().toISOString(),payload:{userAgent:navigator.userAgent.slice(0,180)}}]);
 summary.push('dispositivos: '+devices.length);
 window.FiadosSuite?.refresh?.();
 return summary;
}
function install(){
 const panel=document.getElementById('fiados-cloud-panel');if(!panel||document.getElementById('fiados-sync-all-modules'))return;
 const b=document.createElement('button');b.id='fiados-sync-all-modules';b.type='button';b.className='btn btn-primary';b.textContent='Sincronizar todos los módulos';
 const status=document.createElement('p');status.id='fiados-sync-modules-status';status.setAttribute('role','status');
 b.addEventListener('click',async()=>{b.disabled=true;status.textContent='Sincronizando sin borrar registros…';try{const out=await sync();status.textContent='Sincronización completada: '+out.join(' · ')}catch(e){status.textContent='Sincronización detenida: '+e.message}finally{b.disabled=false}});
 const controls=document.getElementById('fiados-sync-controls')||panel;
 controls.append(b,status);
}
document.addEventListener('DOMContentLoaded',install);
window.FiadosModulesSync={sync};
})();