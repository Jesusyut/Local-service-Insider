import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
let proc,dir,cookie,reportId;const base='http://127.0.0.1:3199';
async function api(path,body,auth=false){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {r,data:await r.json()};}
before(async()=>{dir=await mkdtemp(join(tmpdir(),'sd-test-'));proc=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',PORT:'3199',ADMIN_PASSWORD:'test-owner-password',RESEND_API_KEY:'',EMAIL_FROM:'',BEEHIIV_API_KEY:'',META_PIXEL_ID:'123456789',META_ACCESS_TOKEN:'',TURNSTILE_SECRET_KEY:'',SQLITE_PATH:join(dir,'test.db')},stdio:['ignore','pipe','pipe']});let logs='';proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);for(let i=0;i<60;i++){try{if((await fetch(base+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error(logs);});
after(async()=>{proc?.kill();await new Promise(r=>setTimeout(r,300));await rm(dir,{recursive:true,force:true});});
const vehicle={year:2024,make:'Toyota',model:'Camry',vehicleType:'sedan',option:'tint:all',amount:500};
test('smog check uses the fixed OBD fee and rejects pre-1996 vehicles',async()=>{
 const smog={...vehicle,option:'smog:obd',amount:40};
 assert.equal((await api('/api/check',{...smog,year:1995})).r.status,400);
 const high=await api('/api/check',smog);assert.equal(high.r.status,200);assert.equal(high.data.verdict,'High');assert.match(high.data.explanation,/state fee.*shop markup/);
 const fair=await api('/api/check',{...smog,amount:16.15});assert.equal(fair.data.verdict,'Fair');
 const result=await api('/api/report',{id:high.data.id,firstName:'Smog',email:'smog@example.test',disclosureVersion:'weekly-deals-alerts-v5-local'});
 assert.equal(result.r.status,200);assert.equal(result.data.range.low,16.15);assert.equal(result.data.range.typical,16.15);assert.equal(result.data.range.high,16.15);assert.equal(result.data.explanation,high.data.explanation);
 assert.equal((await fetch(base+'/images/smog.webp')).headers.get('content-type'),'image/webp');
});
test('only seeded services are advertised; private pricing and service fallback work',async()=>{
 const {data:c}=await api('/api/config');assert.equal(c.services.length,8);assert.equal(Object.values(c.availability).reduce((n,a)=>n+a.length,0),125);assert.ok(c.services.some(s=>s.id==='coating'));assert.ok(!c.services.some(s=>['ppf','wrap'].includes(s.id)));assert.ok(c.types.includes('van'));assert.equal(c.ranges,undefined);
 const check=await api('/api/check',vehicle);assert.equal(check.r.status,200);assert.equal(check.data.range,undefined);assert.notEqual(check.data.verdict,'No data');reportId=check.data.id;
 assert.equal((await api('/api/check',{...vehicle,option:'ppf:body'})).r.status,400);
 const fallback=(await api('/api/check',{...vehicle,option:'coating:unsure',noQuote:true})).data;assert.notEqual(fallback.verdict,'No data');
 const result=await api('/api/report',{id:fallback.id,firstName:'Fallback',email:'fallback@example.com',disclosureVersion:'weekly-deals-alerts-v5-local'});assert.equal(result.data.range.source,'service-fallback');
});
test('two-field email gate records disclosure with no ZIP or required checkbox',async()=>{
 assert.equal((await api('/api/admin/data')).r.status,401);const login=await api('/api/admin/login',{password:'test-owner-password'});cookie=login.r.headers.get('set-cookie').split(';')[0];
 assert.equal((await api('/api/report',{id:reportId,firstName:'Test',email:'test@example.com'})).r.status,400);
 const gate={id:reportId,firstName:'Test',email:'test@example.com',disclosureVersion:'weekly-deals-alerts-v5-local'};
 assert.equal((await api('/api/report',{...gate,disclosureVersion:'weekly-deals-v4-local'})).r.status,400);
 const result=await api('/api/report',gate);assert.equal(result.r.status,200);assert.deepEqual(result.data.shops,[]);assert.equal(result.data.range.low,150);
 assert.equal((await api('/api/report',gate)).data.quoteId,result.data.quoteId);
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(dir,'test.db'));const s=db.prepare('SELECT * FROM subscribers WHERE email=?').get('test@example.com');assert.equal(s.zip,'');assert.equal(s.consent_text,"You'll also get price alerts and our weekly local deals. Unsubscribe anytime.");assert.ok(s.consent_at);db.close();
});
test('paid deals require two real offers; ZIP and partner consent are collected only at quote request',async()=>{
 async function shop(name,paid){assert.equal((await api('/api/admin/shop',{name,contact:name+'@example.com',services:['tint'],zips:['85001'],deal:'Actual paid offer '+name,active:true,vetted:true,paid},true)).r.status,200);}
 await shop('one',true);assert.equal((await api('/api/resume?id='+reportId)).data.shops.length,0);
 await shop('two',false);assert.equal((await api('/api/resume?id='+reportId)).data.shops.length,0);
 await shop('three',true);const resumed=(await api('/api/resume?id='+reportId)).data;assert.equal(resumed.shops.length,2);assert.equal(resumed.quoteRequestsAvailable,true);assert.deepEqual(resumed.partners,[]);
 assert.equal((await api('/api/partners',{id:reportId,zip:'92101'})).r.status,400);
 const partners=(await api('/api/partners',{id:reportId,zip:'85001'})).data.partners;assert.equal(partners.length,3);
 const lead={id:reportId,zip:'85001',phone:'6195550100',timing:'month',consent:true,partnerIds:partners.map(s=>s.id)};
 assert.equal((await api('/api/lead',{...lead,consent:false})).r.status,400);assert.equal((await api('/api/lead',{...lead,zip:'92101'})).r.status,400);assert.equal((await api('/api/lead',{...lead,partnerIds:[...lead.partnerIds,'extra']})).r.status,409);assert.equal((await api('/api/lead',lead)).r.status,200);
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(dir,'test.db'));assert.equal(db.prepare('SELECT zip FROM subscribers WHERE email=?').get('test@example.com').zip,'85001');const jobs=db.prepare("SELECT payload FROM outbox WHERE kind='lead-email'").all();assert.equal(jobs.length,3);for(const j of jobs)assert.ok(!JSON.parse(j.payload).text.includes('test@example.com'));const mail=JSON.parse(db.prepare('SELECT payload FROM outbox WHERE id=?').get('report-'+reportId).payload);assert.match(mail.text,/#request=/);assert.ok(!mail.text.includes('San Diego'));db.close();
 const csv=await(await fetch(base+'/api/admin/export',{headers:{Cookie:cookie}})).text();assert.ok(!csv.includes('test@example.com'));
});
test('admin seed updates override bundled research and price factors remain editable',async()=>{
 assert.equal((await api('/api/admin/range',{option:'tint:all',type:'sedan',low:200,typical:350,high:500,sourceNote:'Verified owner research'},true)).r.status,200);
 assert.equal((await api('/api/check',{...vehicle,amount:600})).data.verdict,'High');
 assert.equal((await api('/api/admin/drivers',{service:'tint',drivers:['Film brand','Preparation']},true)).r.status,200);assert.deepEqual((await api('/api/resume?id='+reportId)).data.drivers,['Film brand','Preparation']);assert.equal((await api('/api/events',{name:'QuoteZipViewed'})).r.status,200);
 assert.equal((await fetch(base+'/server/seeds.mjs')).status,404);
});
test('Meta events preserve browser/server deduplication IDs without sending test events externally',async()=>{
 const landing=await api('/api/events',{name:'ViewContent'});assert.equal(landing.r.status,200);
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(dir,'test.db'));const jobs=db.prepare("SELECT payload FROM outbox WHERE kind='meta'").all().map(j=>JSON.parse(j.payload));
 assert.ok(jobs.some(j=>j.event_name==='ViewContent'&&j.event_id===landing.data.eventId));assert.ok(jobs.some(j=>j.event_name==='Lead'&&j.event_id===reportId));assert.ok(jobs.some(j=>j.event_name==='QuoteRequest'));db.close();
});
