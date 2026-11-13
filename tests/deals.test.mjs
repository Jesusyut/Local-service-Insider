import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
let proc,dir;const base='http://127.0.0.1:3195';
const api=async(path,data)=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};};
before(async()=>{dir=await mkdtemp(join(tmpdir(),'deals-test-'));proc=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',PORT:'3195',ADMIN_PASSWORD:'x',META_PIXEL_ID:'',META_ACCESS_TOKEN:'',TURNSTILE_SECRET_KEY:'',RESEND_API_KEY:'',EMAIL_FROM:'',BEEHIIV_API_KEY:'',SQLITE_PATH:join(dir,'t.db')},stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(base+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('server did not start');});
after(async()=>{if(proc&&proc.exitCode===null){await new Promise(r=>{proc.once('exit',r);proc.kill();});}await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
test('deals page is served with email-first copy',async()=>{
 const r=await fetch(base+'/deals');assert.equal(r.status,200);const html=await r.text();
 assert.match(html,/The best local car deals, sent when you’re ready\./);assert.doesNotMatch(html,/in the market for\?/);assert.match(html,/Send Me the Best Deals/);assert.match(html,/\/deals\.js/);assert.doesNotMatch(html,/type="tel"/);
 assert.equal((await fetch(base+'/deals.js')).headers.get('content-type'),'text/javascript');
});
test('signup needs only name and email; service is tagged in a second tap; retries do not duplicate',async()=>{
 const body={id:randomUUID(),service:'starlight',firstName:'Ana',email:'ana@example.test',disclosureVersion:'deals-v1-local',source:{utm_campaign:'starlight-luxury',utm_content:'l4-deals'}};
 assert.equal((await api('/api/deals',{...body,service:'nope'})).status,400);
 const {service,...noService}=body;
 assert.equal((await api('/api/deals',{...body,email:'bad'})).status,400);
 assert.equal((await api('/api/deals',{...body,disclosureVersion:'old'})).status,400);
 assert.equal((await api('/api/deals/interest',{id:body.id,service:'starlight'})).status,404);
 const ok=await api('/api/deals',noService);assert.equal(ok.status,200);assert.equal(ok.data.eventId,body.id);assert.equal(ok.data.service,'');
 assert.equal((await api('/api/deals',noService)).status,200);
 assert.equal((await api('/api/deals/interest',{id:body.id,service:'nope'})).status,400);
 const tagged=await api('/api/deals/interest',{id:body.id,service:'starlight'});assert.equal(tagged.status,200);assert.equal(tagged.data.service,'Starlight headliner');
 assert.equal((await api('/api/deals/interest',{id:body.id,service:'starlight'})).status,200);
 const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(dir,'t.db'));
 const s=db.prepare('SELECT * FROM subscribers WHERE email=?').get('ana@example.test');assert.equal(s.first_name,'Ana');assert.match(s.consent_text,/deals email/);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE name='Lead' AND campaign='starlight-luxury'").get().n,1);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'newsletter-deals-%'").get().n,2);assert.equal(db.prepare('SELECT service_id FROM deals_signups WHERE id=?').get(body.id).service_id,'starlight');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'telegram-deals-%'").get().n,2);
});
