import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
let proc,dir,config;const base='http://127.0.0.1:3196';
const api=async(path,data)=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),r};};
before(async()=>{dir=await mkdtemp(join(tmpdir(),'intake-test-'));proc=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',PORT:'3196',ADMIN_PASSWORD:'test-owner',META_PIXEL_ID:'',META_ACCESS_TOKEN:'',TURNSTILE_SECRET_KEY:'',RESEND_API_KEY:'',EMAIL_FROM:'',BEEHIIV_API_KEY:'',SQLITE_PATH:join(dir,'test.db')},stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(base+'/healthz')).ok){config=(await api('/api/config')).data;return;}}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('intake test server did not start');});
after(async()=>{if(proc&&proc.exitCode===null){await new Promise(r=>{proc.once('exit',r);proc.kill();});}await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
const contact=service=>({id:randomUUID(),service,firstName:'Driver',email:randomUUID()+'@example.test',phone:'6195550100',disclosureVersion:'intake-contact-v1-local',source:{utm_campaign:'service-first'}});
test('contact is persisted before vehicle details; phone validation and retries are safe',async()=>{
 const body=contact('oil');assert.equal((await api('/api/intake',{...body,phone:'123'})).status,400);assert.equal((await api('/api/intake',{...body,disclosureVersion:'old'})).status,400);
 const saved=await api('/api/intake',body);assert.equal(saved.status,200);assert.equal(saved.data.id,body.id);assert.equal((await api('/api/intake',body)).data.eventId,saved.data.eventId);
 const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(dir,'test.db'));const row=db.prepare('SELECT * FROM intake_leads WHERE id=?').get(body.id);assert.equal(row.phone,'6195550100');assert.equal(row.make,null);assert.equal(row.report,null);assert.equal(row.contact_text,config.copy['intake.contact.disclosure']);assert.equal(row.newsletter_text,config.newsletterConsent);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE id=? AND name='Lead'").get(body.id).n,1);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE kind='lead-email'").get().n,0);db.close();
 assert.equal((await api('/api/intake',{...body,email:'someoneelse@example.test'})).status,409);assert.equal((await api('/api/intake/estimate',{id:randomUUID()})).status,404);
});
test('every service completes without package or vehicle-type questions; date validation and California smog pricing are checked',async()=>{
 for(const service of config.services){
  const body=contact(service.id);assert.equal((await api('/api/intake',body)).status,200);
  const vehicle={id:body.id,year:2024,make:'Honda',model:'Civic',desiredDate:config.localToday};
  if(service.id===config.services[0].id){assert.equal((await api('/api/intake/estimate',{...vehicle,desiredDate:'2000-01-01'})).status,400);assert.equal((await api('/api/intake/estimate',{...vehicle,desiredDate:'2099-02-30'})).status,400);}
  if(service.id==='smog')vehicle.year=1995;
  const completed=await api('/api/intake/estimate',vehicle);assert.equal(completed.status,200,JSON.stringify(completed.data));assert.ok(completed.data.range.low>0);assert.ok(completed.data.range.low<=completed.data.range.typical&&completed.data.range.typical<=completed.data.range.high);assert.equal(completed.data.desiredDate,config.localToday);assert.equal(completed.data.make,'Honda');if(service.id==='smog')assert.equal(completed.data.range.typical,58);
  assert.deepEqual((await api('/api/intake/estimate',vehicle)).data,completed.data);
 }
 const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(dir,'test.db'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM intake_leads WHERE report IS NOT NULL').get().n,8);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE kind='report'").get().n,8);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM leads').get().n,0);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE name='QuoteRequest'").get().n,0);db.close();
});
test('owner dashboard exposes early leads only after authentication',async()=>{
 assert.equal((await api('/api/admin/data')).status,401);const login=await api('/api/admin/login',{password:'test-owner'});const response=await fetch(base+'/api/admin/data',{headers:{Cookie:login.r.headers.get('set-cookie').split(';')[0]}});const data=await response.json();assert.equal(response.status,200);assert.equal(data.intakes.length,9);assert.ok(data.intakes.some(i=>!i.report&&i.phone==='6195550100'));assert.ok(data.intakes.some(i=>i.model==='Civic'&&i.desired_date===config.localToday));
});

test('submission rate limits still reject repeated attempts',async()=>{let limited=false;for(let i=0;i<16;i++){const response=await api('/api/intake',{...contact('oil'),phone:'invalid'});if(response.status===429){limited=true;break;}assert.equal(response.status,400);}assert.equal(limited,true);});
