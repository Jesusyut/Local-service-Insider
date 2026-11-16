import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
let proc,dir;const base='http://127.0.0.1:3196';
const api=async(path,data)=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};};
before(async()=>{dir=await mkdtemp(join(tmpdir(),'starlight-test-'));proc=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',PORT:'3196',ADMIN_PASSWORD:'x',META_PIXEL_ID:'',META_ACCESS_TOKEN:'',TURNSTILE_SECRET_KEY:'',RESEND_API_KEY:'',EMAIL_FROM:'',BEEHIIV_API_KEY:'',SQLITE_PATH:join(dir,'t.db'),STRIPE_WEBHOOK_SECRET:'whsec_test',PUBLIC_URL:'https://localserviceinsider.com'},stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(base+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('server did not start');});
after(async()=>{if(proc&&proc.exitCode===null){await new Promise(r=>{proc.once('exit',r);proc.kill();});}await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
const tomorrow=()=>{const d=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date())+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};
test('starlight store page and config are served',async()=>{
 const r=await fetch(base+'/starlit');assert.equal(r.status,200);const html=await r.text();
 assert.match(html,/Starlit/);assert.doesNotMatch(html,/Local Car Care|tracking\.js/);assert.match(html,/noindex/);assert.match(html,/\/starlight\.js/);
 assert.equal((await fetch(base+'/starlight.js')).headers.get('content-type'),'text/javascript');
 const c=(await api('/api/starlight')).data;
 assert.deepEqual(c.tiers.map(t=>[t.stars,t.price]),[[500,1195],[600,1350],[750,1550],[850,1695],[1000,1895]]);
 assert.equal(c.deposit,250);assert.equal(c.minDate,tomorrow());assert.equal(c.onlineDeposit,false);assert.equal(c.phone,null);
});
test('order totals are computed on the server, validated, and retries do not duplicate',async()=>{
 const body={id:randomUUID(),stars:750,addons:['shooting','suede','shooting'],year:2026,make:'Kia',model:'K5 GT Line',date:tomorrow(),time:'Morning',firstName:'Antoni',email:'antoni@example.test',phone:'(619) 555-0134',notes:'',total:1,disclosureVersion:'starlit-v1',source:{utm_campaign:'starlight-luxury'}};
 assert.equal((await api('/api/starlight-order',{...body,stars:700})).status,400);
 assert.equal((await api('/api/starlight-order',{...body,addons:['free']})).status,400);
 assert.equal((await api('/api/starlight-order',{...body,date:'2020-01-01'})).status,400);
 assert.equal((await api('/api/starlight-order',{...body,time:'Midnight'})).status,400);
 assert.equal((await api('/api/starlight-order',{...body,phone:'123'})).status,400);
 assert.equal((await api('/api/starlight-order',{...body,disclosureVersion:'old'})).status,400);
 const ok=await api('/api/starlight-order',body);assert.equal(ok.status,200);
 assert.equal(ok.data.total,1550+295+495);assert.equal(ok.data.deposit,250);assert.equal(ok.data.balance,2340-250);assert.equal(ok.data.checkoutUrl,'');
 assert.equal((await api('/api/starlight-order',body)).status,200);
 const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(dir,'t.db'));
 const o=db.prepare('SELECT * FROM starlight_orders WHERE id=?').get(body.id);assert.equal(o.total,2340);assert.equal(o.stars,750);assert.equal(o.phone,'6195550134');assert.equal(o.status,'awaiting-deposit');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'telegram-starlight-%'").get().n,1);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'newsletter-starlight-%'").get().n,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE email=?').get('antoni@example.test').n,0);
 const t=JSON.parse(db.prepare("SELECT payload FROM outbox WHERE id=?").get('telegram-starlight-'+body.id).payload);assert.equal(t.total,'$2,340');assert.match(t.addons,/Shooting stars \$295/);
 const {telegramText}=await import('../server/telegram.mjs');assert.match(telegramText(t),/Balance at drop-off: \$2,090/);
});
test('member code takes a real discount off list, server-side only',async()=>{
 assert.equal((await api('/api/starlight-code?code=nope')).status,404);
 const c=await api('/api/starlight-code?code=insider');assert.equal(c.status,200);assert.equal(c.data.prices[750],1225);
 assert.equal((await api('/api/starlight')).data.codes,undefined);
 const body={id:randomUUID(),stars:1000,addons:[],year:2025,make:'Nissan',model:'Altima',date:tomorrow(),time:'Midday',firstName:'Angelina',email:'ang@example.test',phone:'6265550134',code:'INSIDER',disclosureVersion:'starlit-v1'};
 assert.equal((await api('/api/starlight-order',{...body,code:'FAKE'})).status,400);
 const ok=await api('/api/starlight-order',body);assert.equal(ok.status,200);assert.equal(ok.data.total,1499);assert.equal(ok.data.balance,1249);
 const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(dir,'t.db'));
 assert.deepEqual({...db.prepare('SELECT code,discount,list_total FROM starlight_order_codes WHERE order_id=?').get(body.id)},{code:'INSIDER',discount:396,list_total:1895});
});
test('Stripe webhook marks the deposit paid once, rejects bad signatures',async()=>{
 const {createHmac}=await import('node:crypto');
 const id=randomUUID();
 const order={id,stars:500,addons:[],year:2024,make:'Tesla',model:'Model 3',date:tomorrow(),time:'Afternoon',firstName:'Maya',email:'maya@example.test',phone:'6195550199',code:'INSIDER',disclosureVersion:'starlit-v1'};
 assert.equal((await api('/api/starlight-order',order)).status,200);
 const raw=JSON.stringify({type:'checkout.session.completed',data:{object:{id:'cs_test_1',client_reference_id:id,payment_status:'paid',amount_total:25000}}});
 const send=async sig=>(await fetch(base+'/api/stripe-webhook',{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':sig},body:raw})).status;
 const t=Math.floor(Date.now()/1000),good=`t=${t},v1=`+createHmac('sha256','whsec_test').update(t+'.'+raw).digest('hex');
 assert.equal(await send(`t=${t},v1=deadbeef`),400);
 assert.equal(await send(good),200);assert.equal(await send(good),200);
 const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(dir,'t.db'));
 assert.equal(db.prepare('SELECT status FROM starlight_orders WHERE id=?').get(id).status,'deposit-paid');
 assert.equal(db.prepare('SELECT amount FROM starlight_payments WHERE order_id=?').get(id).amount,250);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id=?").get('telegram-starlight-paid-'+id).n,1);
 const paid=JSON.parse(db.prepare('SELECT payload FROM outbox WHERE id=?').get('telegram-starlight-paid-'+id).payload);assert.equal(paid.package,'500 stars');assert.equal(paid.addons,'None');
});
test('starlight contacts get a personal Starlit link in Brevo',async()=>{
 const {brevoPayload}=await import('../server/brevo.mjs');
 process.env.PUBLIC_URL='https://localserviceinsider.com';
 const p=brevoPayload({email:'a@b.co',firstName:'Antoni',serviceId:'starlight',year:2026,make:'Kia',model:'K5 GT Line',desiredDate:'2026-11-18',timeWindow:'morning',phone:'6195550134',range:{low:750,typical:1500,high:2000}},{leadListId:'3'});
 assert.equal(p.attributes.LPC_STARLIT_URL,'https://localserviceinsider.com/starlit?code=INSIDER');
 assert.equal(brevoPayload({email:'a@b.co',serviceId:'starlight',requestId:'3bb09784-06f0-4a73-8624-b7f876f701e5'},{leadListId:'3'}).attributes.LPC_STARLIT_URL,'https://localserviceinsider.com/q/3bb09784');
 const {starlitLink}=await import('../server/starlit-links.mjs');
 assert.equal(starlitLink({firstName:'Antoni (Salim)',year:2026,make:'Kia GT Line K5',model:'K5 GT Line',desiredDate:'2026-11-18',timeWindow:'morning'}),'https://localserviceinsider.com/starlit?name=Antoni&year=2026&make=Kia&model=K5%20GT%20Line&date=2026-11-18&time=Morning&stars=750&code=INSIDER');
 assert.match(starlitLink({firstName:'angelina'}),/name=Angelina/);
 assert.equal(p.attributes.LPC_EST_HIGH_TEXT,'$2,000');
 assert.equal(brevoPayload({email:'a@b.co',serviceId:'tint'},{leadListId:'3'}).attributes.LPC_STARLIT_URL,undefined);
});
test('short /q/ link redirects to the personal Starlit page',async()=>{
 const r=await fetch(base+'/q/00000000',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/starlit?code=INSIDER');
 assert.equal((await fetch(base+'/q/xyz',{redirect:'manual'})).status,404);
});
test('starlit sequence: quiet hours, schedule, stop on booking, one send per step',async()=>{
 const {sendTime,steps}=await import('../server/starlit-sequence.mjs');
 assert.deepEqual(steps().map(s=>[s.templateId,s.minutes]),[[15,25],[16,1440],[17,4320],[18,7200],[19,11520]]);
 assert.equal(sendTime(new Date('2026-11-15T20:00:00Z')).toISOString(),'2026-11-15T20:00:00.000Z'); // noon PT stays
 assert.equal(sendTime(new Date('2026-11-15T06:30:00Z')).toISOString(),'2026-11-15T17:00:00.000Z'); // 10:30pm PT -> 9am PT
 assert.equal(sendTime(new Date('2026-11-15T13:00:00Z')).toISOString(),'2026-11-15T17:00:00.000Z'); // 5am PT -> 9am PT
});
test('starlit gallery media is served, video supports byte ranges',async()=>{
 const html=await (await fetch(base+'/starlit')).text();assert.match(html,/\/media\/starlit-install\.mp4/);
 const full=await fetch(base+'/media/starlit-install.mp4');assert.equal(full.status,200);assert.equal(full.headers.get('content-type'),'video/mp4');
 const part=await fetch(base+'/media/starlit-install.mp4',{headers:{Range:'bytes=0-99'}});assert.equal(part.status,206);assert.equal((await part.arrayBuffer()).byteLength,100);assert.match(part.headers.get('content-range'),/^bytes 0-99\//);
 assert.equal((await fetch(base+'/media/starlit-install-5-poster.jpg')).headers.get('content-type'),'image/jpeg');
 assert.equal((await fetch(base+'/media/other.jpg')).status,404);
 for(const f of ['starlit-install-5.mp4','starlit-install-4.mp4','starlit-install-2.mp4','starlit-install-3.mp4','starlit-install-3-poster.jpg'])assert.equal((await fetch(base+'/media/'+f)).status,200);
 assert.equal((await fetch(base+'/media/starlit-3.jpg')).status,404);assert.equal((await fetch(base+'/media/starlit-1.jpg')).status,404);
});
test('preview gate: 3 fields, lead saved once, car parsed for the preview',async()=>{
 const {parseVehicle}=await import('../server/starlight-preview.mjs');
 assert.deepEqual(parseVehicle('2023 Tesla Model Y'),{year:2023,make:'Tesla',model:'Model Y'});
 assert.deepEqual(parseVehicle('kia k5 2026'),{year:2026,make:'kia',model:'k5'});
 const html=await (await fetch(base+'/preview')).text();assert.match(html,/Unlock your free preview/);
 const body={id:randomUUID(),firstName:'Jay',phone:'(619) 555-0111',vehicle:'2023 Tesla Model Y'};
 assert.equal((await api('/api/starlight-preview',{...body,phone:'12'})).status,400);
 assert.equal((await api('/api/starlight-preview',{...body,vehicle:''})).status,400);
 const ok=await api('/api/starlight-preview',body);assert.equal(ok.status,200);assert.equal(ok.data.car.make,'Tesla');
 assert.equal((await api('/api/starlight-preview',body)).status,200);
 const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(dir,'t.db'));
 assert.equal(db.prepare("SELECT COUNT(*) n FROM starlight_preview_leads WHERE id=?").get(body.id).n,1);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM outbox WHERE id=?").get('telegram-preview-'+body.id).n,1);
});
test('BOOK takes $100 off the total and stacks on the member price',async()=>{
 const c=await api('/api/starlight-code?code=book');assert.equal(c.status,200);assert.equal(c.data.off,100);assert.equal(c.data.promo,true);
 const base0={stars:750,addons:['shooting'],year:2024,make:'Kia',model:'K5',date:tomorrow(),time:'Morning',firstName:'Bo',email:'bo@example.test',phone:'6195550177',disclosureVersion:'starlit-v1'};
 const solo=await api('/api/starlight-order',{...base0,id:randomUUID(),code:'BOOK'});assert.equal(solo.data.total,1550+295-100);
 const both=await api('/api/starlight-order',{...base0,id:randomUUID(),code:'INSIDER',promo:'BOOK'});assert.equal(both.data.total,1225+295-100);
 assert.equal((await api('/api/starlight-order',{...base0,id:randomUUID(),code:'INSIDER',promo:'NOPE'})).status,400);
});
