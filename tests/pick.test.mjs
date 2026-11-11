import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
let proc,dir;const base='http://127.0.0.1:3198';
before(async()=>{dir=await mkdtemp(join(tmpdir(),'pick-test-'));proc=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',PORT:'3198',ADMIN_PASSWORD:'x',RESEND_API_KEY:'',EMAIL_FROM:'',BEEHIIV_API_KEY:'',META_PIXEL_ID:'',META_ACCESS_TOKEN:'',TURNSTILE_SECRET_KEY:'',SQLITE_PATH:join(dir,'t.db')},stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(base+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('server did not start');});
after(async()=>{proc?.kill();await new Promise(r=>setTimeout(r,300));await rm(dir,{recursive:true,force:true});});
test('shop-pick landing page is served with its own copy',async()=>{
 const r=await fetch(base+'/pick');assert.equal(r.status,200);const html=await r.text();
 assert.match(html,/No time to shop around\? We'll pick for you\./);assert.match(html,/Get My Shop Pick/);assert.match(html,/\/app\.js/);
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
