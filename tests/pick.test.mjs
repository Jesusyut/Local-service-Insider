import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
let proc,dir;const base='http://127.0.0.1:3198';
before(async()=>{dir=await mkdtemp(join(tmpdir(),'pick-test-'));proc=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',PORT:'3198',ADMIN_PASSWORD:'x',RESEND_API_KEY:'',EMAIL_FROM:'',BEEHIIV_API_KEY:'',META_PIXEL_ID:'',META_ACCESS_TOKEN:'',TURNSTILE_SECRET_KEY:'',SQLITE_PATH:join(dir,'t.db')},stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(base+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('server did not start');});
after(async()=>{proc?.kill();await new Promise(r=>setTimeout(r,300));await rm(dir,{recursive:true,force:true});});
test('shop-pick landing page is served with its own copy',async()=>{
 const r=await fetch(base+'/pick');assert.equal(r.status,200);const html=await r.text();
 assert.match(html,/Car care pros you can trust\./);assert.match(html,/Get my local price check/);assert.match(html,/\/pick\.js/);assert.match(html,/google-stars\.png/);
 for(const asset of ['/pick.js','/pick.css','/images/google-stars.png','/fonts/barlow-latin-400-normal.woff2','/fonts/barlow-semi-condensed-latin-700-normal.woff2'])assert.equal((await fetch(base+asset)).status,200,asset);
 const {copy}=await (await fetch(base+'/api/config')).json();
 for(const k of ['pick.gate.headline','pick.gate.cta','pick.contact.headline','pick.thanks','pick.none'])assert.ok(copy[k],k);
 assert.match(copy['pick.contact.headline'],/\{shop\}/);
 const post=async(path,data,cookie='')=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});assert.equal(r.status,200,await r.clone().text());return {r,data:await r.json()};};
 const vehicle={year:2024,make:'Toyota',model:'Camry',vehicleType:'sedan',option:'tint:all',noQuote:true,source:{utm_campaign:'shop-pick'}};
 const check=(await post('/api/check',vehicle)).data;
 const report=(await post('/api/report',{id:check.id,firstName:'Pick',email:'pick@example.test',disclosureVersion:'weekly-deals-alerts-v5-local'})).data;
 assert.equal(report.quoteRequestsAvailable,false);assert.ok(report.range.low>0);
 const login=await post('/api/admin/login',{password:'x'}),cookie=login.r.headers.get('set-cookie').split(';')[0];
 for(const name of ['Chosen Shop','Other Shop'])await post('/api/admin/shop',{name,contact:name.replaceAll(' ','')+'@example.test',services:['tint'],zips:['85001'],deal:'',active:true,vetted:true,paid:false},cookie);
 const partners=(await post('/api/partners',{id:check.id,zip:'85001'})).data.partners;assert.equal(partners.length,2);
 assert.deepEqual((await post('/api/partners',{id:check.id,zip:'85002'})).data.partners,[]);
 await post('/api/lead',{id:check.id,zip:'85001',phone:'6025550100',timing:'month',consent:true,partnerIds:[partners[0].id]});
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(dir,'t.db'));
 const consent=db.prepare('SELECT consent_text FROM leads').get().consent_text;assert.ok(consent.includes('Partners: '+partners[0].name));assert.ok(!consent.includes(partners[1].name));
 const jobs=db.prepare("SELECT payload FROM outbox WHERE kind='lead-email'").all();assert.equal(jobs.length,1);
 assert.equal(db.prepare("SELECT campaign FROM events WHERE name='QuoteRequest'").get().campaign,'shop-pick');db.close();

});

test('pick flow shows the local rate after contact, then takes vehicle, day and time with consent',async()=>{
 const post=async(path,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
 const config=await (await fetch(base+'/api/config')).json();assert.ok(config.copy['pick.quote.consent']);assert.equal(config.services.find(s=>s.id==='oil').name,'Mechanical work');
 const id=crypto.randomUUID();
 assert.equal((await post('/api/intake',{id,service:'tint',firstName:'Maria',email:'maria-pick@example.test',phone:'6025550123',disclosureVersion:'intake-contact-v1-local',source:{utm_campaign:'pick-v2'}})).status,200);
 const quoteFirst=await post('/api/intake/quote',{id,year:2021,make:'Toyota',model:'Camry',desiredDate:config.localToday,timeWindow:'morning',consent:true,consentVersion:'pick-quote-v1'});assert.equal(quoteFirst.status,409);
 const rate=await post('/api/intake/rate',{id});assert.equal(rate.status,200);assert.ok(rate.data.range.low>0&&rate.data.range.low<=rate.data.range.typical&&rate.data.range.typical<=rate.data.range.high);assert.equal(rate.data.make,undefined);
 assert.deepEqual((await post('/api/intake/rate',{id})).data,rate.data);
 const good={id,year:2021,make:'Toyota',model:'Camry',desiredDate:config.localToday,timeWindow:'morning',consent:true,consentVersion:'pick-quote-v1'};
 assert.equal((await post('/api/intake/quote',{...good,consent:false})).status,400);
 assert.equal((await post('/api/intake/quote',{...good,timeWindow:'midnight'})).status,400);
 assert.equal((await post('/api/intake/quote',{...good,desiredDate:'2000-01-01'})).status,400);
 const sent=await post('/api/intake/quote',good);assert.equal(sent.status,200,JSON.stringify(sent.data));assert.equal(sent.data.timeWindow,'Morning');
 assert.equal((await post('/api/intake/quote',{...good,timeWindow:'evening'})).status,200);
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(dir,'t.db'));
 const row=db.prepare('SELECT i.make,i.desired_date,q.preferred_time,q.consent_text FROM intake_leads i JOIN intake_quote_requests q ON q.intake_id=i.id WHERE i.id=?').get(id);
 assert.equal(row.make,'Toyota');assert.equal(row.desired_date,config.localToday);assert.equal(row.preferred_time,'evening');assert.equal(row.consent_text,config.copy['pick.quote.consent']);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE id=? AND name='QuoteRequest'").get('quote-'+id).n,1);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE kind='report' AND id LIKE 'rate-%'").get().n,1);db.close();
});
