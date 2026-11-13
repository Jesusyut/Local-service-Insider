import {randomUUID} from 'node:crypto';
import {query,transaction} from './db.mjs';
import {services,dealsConsent} from './catalog.mjs';
import {meta,hash} from './integrations.mjs';

// /deals — email-first signup for the local deals newsletter. No phone, no vehicle.
const now=()=>new Date().toISOString();
const text=(v,n=100)=>String(v??'').trim().slice(0,n);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const sourceOf=s=>Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].map(k=>[k,text(s?.[k],200)]));
const job=(q,id,kind,payload)=>q("INSERT INTO outbox(id,kind,payload,status,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",[id,kind,JSON.stringify(payload),'pending',now()]);

export async function captureDeals(b,{turnstile}){
 await turnstile(b.turnstileToken);
 if(b.disclosureVersion!=='deals-v1-local')fail('Please refresh to view the current email disclosure.');
 const service=b.service?services.find(s=>s.id===b.service):null,name=text(b.firstName,80),email=text(b.email,254).toLowerCase(),id=b.id||randomUUID(),source=sourceOf(b.source);
 if(b.service&&!service)fail('Pick what you’re in the market for.');
 if(!name||!/^\S+@\S+\.\S+$/.test(email)||!/^[0-9a-f-]{36}$/i.test(id))fail('Enter your first name and a valid email.');
 let fresh=false;
 await transaction(async q=>{
  // The browser-generated ID makes a retried submit (lost response, double tap) a no-op.
  const seen=(await q("SELECT id FROM events WHERE id=$1",[id])).rows[0];
  if(seen)return;
  const stamp=now();
  await q('INSERT INTO subscribers(id,first_name,email,zip,consent_at,consent_text,source,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(email) DO UPDATE SET first_name=excluded.first_name,consent_at=excluded.consent_at,consent_text=excluded.consent_text',[randomUUID(),name,email,'',stamp,dealsConsent,JSON.stringify(source),stamp]);
  await q('INSERT INTO events(id,name,campaign,created_at) VALUES($1,$2,$3,$4)',[id,'Lead',source.utm_campaign,stamp]);
  await q('INSERT INTO deals_signups(id,email,first_name,service_id,created_at) VALUES($1,$2,$3,$4,$5)',[id,email,name,service?.id||null,stamp]);
  await job(q,'telegram-deals-'+id,'telegram',{id,stage:'Deals newsletter signup',firstName:name,email,service:service?.name});
  await job(q,'newsletter-deals-'+id,'newsletter',{email,firstName:name,...(service?{service:service.name,custom_fields:[{name:'service',value:service.name}],subscription_tags:[service.id,'deals']}:{subscription_tags:['deals']})});
  fresh=true;
 });
 if(fresh)await meta('Lead',id,process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'http://localhost:3000',{em:[hash(email)]});
 return {id,eventId:id,service:service?.name||''};
}

// Step 2: what they're in the market for. Tags the subscriber in the newsletter list.
export async function dealsInterest(b){
 const id=text(b.id,36),service=services.find(s=>s.id===b.service);
 if(!service)fail('Pick what you’re in the market for.');
 const row=(await query('SELECT * FROM deals_signups WHERE id=$1',[id])).rows[0];
 if(!row)fail('Sign up first.',404);
 if(row.service_id===service.id)return {service:service.name};
 await transaction(async q=>{
  await q('UPDATE deals_signups SET service_id=$1 WHERE id=$2',[service.id,id]);
  await job(q,'newsletter-deals-svc-'+id+'-'+service.id,'newsletter',{email:row.email,firstName:row.first_name,service:service.name,custom_fields:[{name:'service',value:service.name}],subscription_tags:[service.id,'deals']});
  await job(q,'telegram-deals-svc-'+id,'telegram',{id,stage:'Deals signup: in the market for',firstName:row.first_name,service:service.name});
 });
 return {service:service.name};
}
