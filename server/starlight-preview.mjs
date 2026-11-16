import {query,transaction} from './db.mjs';
import {meta,hash} from './integrations.mjs';

// /preview — 3-field gate (first name, phone, car) that unlocks the Starlit online preview.
const now=()=>new Date().toISOString();
const text=(v,n=100)=>String(v??'').trim().slice(0,n);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const sourceOf=s=>Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].map(k=>[k,text(s?.[k],200)]));
const job=(q,id,kind,payload)=>q("INSERT INTO outbox(id,kind,payload,status,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",[id,kind,JSON.stringify(payload),'pending',now()]);

// "2023 Tesla Model Y" -> {year:2023, make:'Tesla', model:'Model Y'}
export function parseVehicle(v){
 const s=text(v,80).replace(/\s+/g,' '),y=s.match(/\b(19[89]\d|20[0-3]\d)\b/),rest=s.replace(y?.[0]||'','').trim().split(' ').filter(Boolean);
 return {year:y?Number(y[0]):null,make:rest[0]||'',model:rest.slice(1).join(' ')};
}

export async function capturePreview(b,{turnstile}){
 await turnstile(b.turnstileToken);
 const id=text(b.id,36),name=text(b.firstName,80),phone=text(b.phone,30).replace(/\D/g,''),vehicle=text(b.vehicle,80),source=sourceOf(b.source);
 if(!/^[0-9a-f-]{36}$/i.test(id))fail('Please refresh and try again.');
 if(!name||!/^(1)?\d{10}$/.test(phone))fail('Enter your first name and a US mobile number.');
 if(vehicle.length<3)fail('Enter your car’s year, make and model.');
 const car=parseVehicle(vehicle);let fresh=false;
 await transaction(async q=>{
  if((await q('SELECT id FROM starlight_preview_leads WHERE id=$1',[id])).rows[0])return;
  const stamp=now();
  await q('INSERT INTO events(id,name,campaign,created_at) VALUES($1,$2,$3,$4)',[id,'Lead',source.utm_campaign,stamp]);
  await q('INSERT INTO starlight_preview_leads(id,first_name,phone,vehicle,source,created_at) VALUES($1,$2,$3,$4,$5,$6)',[id,name,phone.slice(-10),vehicle,JSON.stringify(source),stamp]);
  await job(q,'telegram-preview-'+id,'telegram',{id,stage:'Starlight preview unlocked · follow up by text',firstName:name,phone:phone.slice(-10),service:'Starlight headliner',vehicle,year:car.year,make:car.make,model:car.model,notes:'Car as typed: '+vehicle});
  fresh=true;
 });
 if(fresh)await meta('Lead',id,process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'http://localhost:3000',{ph:[hash('1'+phone.slice(-10))]});
 return {id,eventId:id,car};
}
