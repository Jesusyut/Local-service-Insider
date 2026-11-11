import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
let proc,dir,cookie;const base='http://127.0.0.1:3199';
async function api(path,body,auth=false){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();return {r,data};}
before(async()=>{dir=await mkdtemp(join(tmpdir(),'phoenix-test-'));proc=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',PORT:'3199',ADMIN_PASSWORD:'test-owner-password',SQLITE_PATH:join(dir,'test.db')},stdio:['ignore','pipe','pipe']});let logs='';proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);for(let i=0;i<60;i++){try{if((await fetch(base+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(logs);});
after(async()=>{proc?.kill();await new Promise(r=>setTimeout(r,300));await rm(dir,{recursive:true,force:true});});
test('complete flow preserves private ranges, consent and admin boundaries',async()=>{
 assert.equal((await api('/api/admin/data')).r.status,401);
 const login=await api('/api/admin/login',{password:'test-owner-password'});assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];
 assert.equal((await api('/api/admin/range',{option:'ceramic-tint:all',type:'sedan',low:200,typical:350,high:500,sourceNote:'Test fixture'},true)).r.status,200);
 const p={year:2024,make:'Toyota',model:'Camry',vehicleType:'sedan',option:'ceramic-tint:all',amount:400,source:{utm_campaign:'test'}};
 const c=await api('/api/check',p);assert.equal(c.data.verdict,'Fair');assert.equal(c.data.range,undefined);
 assert.equal((await api('/api/check',{...p,amount:-1})).r.status,400);
 assert.equal((await api('/api/report',{id:c.data.id,firstName:'Test',email:'test@example.com',zip:'85001',newsletterConsent:false})).r.status,400);
 assert.equal((await api('/api/report',{id:c.data.id,firstName:'Test',email:'test@example.com',zip:'9021',newsletterConsent:true})).r.status,400);
 const report=await api('/api/report',{id:c.data.id,firstName:'Test',email:'test@example.com',zip:'85001',newsletterConsent:true});assert.equal(report.r.status,200);assert.equal(report.data.range.typical,350);
 const repeated=await api('/api/report',{id:c.data.id,firstName:'Test',email:'test@example.com',zip:'85001',newsletterConsent:true});assert.equal(repeated.data.quoteId,report.data.quoteId);
 const shop=await api('/api/admin/shop',{name:'Test Partner',contact:'shop@example.com',services:['ceramic-tint'],zips:['85001'],deal:'Test only',active:true,vetted:true},true);assert.equal(shop.r.status,200);
 assert.equal((await api('/api/lead',{id:c.data.id,phone:'6025550100',timing:'month',consent:false})).r.status,400);
 const resumed=(await api('/api/resume?id='+c.data.id)).data;assert.equal(resumed.firstName,'Test');assert.equal(resumed.vehicle.model,'Camry');
 const lead=await api('/api/lead',{id:c.data.id,phone:'6025550100',timing:'month',consent:true,partnerIds:resumed.partners.map(s=>s.id)});assert.equal(lead.r.status,200);
 const d=(await api('/api/admin/data',null,true)).data;assert.equal(d.quotes.length,1);assert.equal(d.leads.length,1);assert.match(d.leads[0].consent_text,/Test Partner/);assert.ok(d.leads[0].consent_at);assert.equal(d.outbox.filter(j=>j.kind==='report').length,1);
 assert.equal((await fetch(base+'/api/admin/export',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await fetch(base+'/server/schema.sql')).status,404);
});
test('campaign routing caps shops, excludes subscriber emails and retains reports outside coverage',async()=>{
 for(let i=0;i<4;i++)assert.equal((await api('/api/admin/shop',{name:'Partner '+i,contact:'partner'+i+'@example.com',services:['ceramic-tint'],zips:['*'],deal:'Fixture',active:true,vetted:true},true)).r.status,200);
 const p={year:2024,make:'Toyota',model:'Camry',vehicleType:'sedan',option:'ceramic-tint:all',noQuote:true};
 const c=(await api('/api/check',p)).data;
 const b={id:c.id,firstName:'Outside',email:'outside@example.com',zip:'90210',newsletterConsent:true};
 const outside=(await api('/api/report',b)).data;assert.match(outside.zipNotice,/We'll still email your report/);assert.equal(outside.partners.length,0);
 const local=(await api('/api/report',{...b,zip:'85001'})).data;assert.equal(local.partners.length,3);
 const more=[...local.partners.map(s=>s.id),'extra'];assert.equal((await api('/api/lead',{id:c.id,phone:'6025550101',timing:'week',consent:true,partnerIds:more})).r.status,409);
 assert.equal((await api('/api/lead',{id:c.id,phone:'6025550101',timing:'week',consent:true,partnerIds:local.partners.map(s=>s.id)})).r.status,200);
 assert.equal((await api('/api/admin/drivers',{service:'ceramic-tint',drivers:['Film brand','Heat rejection']},true)).r.status,200);
 assert.deepEqual((await api('/api/resume?id='+c.id)).data.drivers,['Film brand','Heat rejection']);
 assert.equal((await api('/api/events',{name:'GateViewed',campaign:'campaign-test'})).r.status,200);
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(dir,'test.db'));
 const jobs=db.prepare("SELECT payload FROM outbox WHERE kind='lead-email'").all();assert.equal(jobs.length,4);for(const j of jobs){assert.ok(!JSON.parse(j.payload).text.includes('test@example.com'));assert.ok(!JSON.parse(j.payload).text.includes('outside@example.com'));}
 const mail=JSON.parse(db.prepare("SELECT payload FROM outbox WHERE id=?").get('report-'+c.id).payload);assert.match(mail.text,/#request=/);assert.match(mail.subject,/Your Ceramic tint price report for the 2024 Camry/);assert.match(mail.html,/Get My Quotes/);db.close();
 const csv=await (await fetch(base+'/api/admin/export',{headers:{Cookie:cookie}})).text();assert.ok(!csv.includes('outside@example.com'));
});
