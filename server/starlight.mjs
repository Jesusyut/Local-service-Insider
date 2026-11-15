import {query,transaction} from './db.mjs';
import {meta,hash} from './integrations.mjs';
import {localToday} from './intake.mjs';

// Starlit Interiors (separate brand, not linked from Local Car Care) — quote + checkout: pick a star count, add-ons, a date, then pay a deposit.
// Prices live here only; the browser shows them but the server computes every total.
export const starlightCatalog={
 tiers:[
  {stars:500,price:1195,tag:'Starter'},
  {stars:600,price:1350,tag:''},
  {stars:750,price:1550,tag:'Most popular'},
  {stars:850,price:1695,tag:''},
  {stars:1000,price:1895,tag:'Full sky'}],
 addons:[
  {id:'shooting',name:'Shooting stars',price:295,note:'Moving meteor streaks across the sky.'},
  {id:'dual',name:'Dual color',price:295,note:'Two star colors at once, set from the app.'},
  {id:'ambient',name:'Ambient trim lighting',price:495,note:'Matching light lines in the doors and dash.'},
  {id:'suede',name:'Suede headliner',price:495,note:'New suede-wrapped liner behind the stars.'}],
 times:['Morning','Midday','Afternoon'],
 // Member price per package (list is the walk-in price). Wholesale is 499/599/699/799/899,
 // so members still leave $450-$600 margin per job.
 codes:{INSIDER:{label:'Local Insider member price',prices:{500:949,600:1079,750:1225,850:1349,1000:1499}}},
 deposit:250,
 consent:'We’ll only text and email you about this booking.',
 disclosureVersion:'starlit-v1'
};
const now=()=>new Date().toISOString();
const text=(v,n=100)=>String(v??'').trim().slice(0,n);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const money=v=>'$'+Number(v).toLocaleString('en-US');
const sourceOf=s=>Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].map(k=>[k,text(s?.[k],200)]));
const job=(q,id,kind,payload)=>q("INSERT INTO outbox(id,kind,payload,status,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",[id,kind,JSON.stringify(payload),'pending',now()]);
const tomorrow=()=>{const d=new Date(localToday()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};
const phoneDigits=()=>String(process.env.BUSINESS_PHONE||'').replace(/\D/g,'');
const prettyPhone=d=>{const t=d.length===11&&d[0]==='1'?d.slice(1):d;return t.length===10?`(${t.slice(0,3)}) ${t.slice(3,6)}-${t.slice(6)}`:'';};

export function findCode(code){const c=String(code??'').trim().toUpperCase();const hit=starlightCatalog.codes[c];return hit?{code:c,...hit}:null;}

export function priceOrder(stars,addonIds,codeText){
 const tier=starlightCatalog.tiers.find(t=>t.stars===Number(stars));
 if(!tier)fail('Pick a star package.');
 const ids=[...new Set(Array.isArray(addonIds)?addonIds:[])];
 const addons=ids.map(id=>starlightCatalog.addons.find(a=>a.id===id)||fail('Pick add-ons from the list.'));
 const code=codeText?findCode(codeText):null;if(codeText&&!code)fail('That code isn’t valid.');
 const off=code?tier.price-code.prices[tier.stars]:0,list=tier.price+addons.reduce((s,a)=>s+a.price,0),total=list-off,deposit=starlightCatalog.deposit;
 return {tier,addons,code,off,list,total,deposit,balance:total-deposit};
}

export function starlightConfig(){
 const d=phoneDigits();
 const {codes,...pub}=starlightCatalog;
 return {...pub,minDate:tomorrow(),phone:prettyPhone(d)?{display:prettyPhone(d),tel:'+'+(d.length===10?'1'+d:d)}:null,onlineDeposit:Boolean(process.env.STARLIGHT_DEPOSIT_URL)};
}

function checkoutUrl(id,email){
 const base=process.env.STARLIGHT_DEPOSIT_URL;if(!base)return '';
 // Stripe Payment Links accept these to prefill the email and tie the payment to the order.
 const u=new URL(base);u.searchParams.set('prefilled_email',email);u.searchParams.set('client_reference_id',id);return u.toString();
}

export async function placeStarlightOrder(b,{turnstile}){
 await turnstile(b.turnstileToken);
 if(b.disclosureVersion!==starlightCatalog.disclosureVersion)fail('Please refresh to see the current booking terms.');
 const {tier,addons,code,off,list,total,deposit,balance}=priceOrder(b.stars,b.addons,b.code);
 const id=text(b.id,36),name=text(b.firstName,80),email=text(b.email,254).toLowerCase(),phone=text(b.phone,30).replace(/\D/g,'');
 const year=Number(b.year),make=text(b.make,40),model=text(b.model,60),date=text(b.date,10),time=text(b.time,20),notes=text(b.notes,500),source=sourceOf(b.source);
 if(!/^[0-9a-f-]{36}$/i.test(id))fail('Please refresh and try again.');
 if(!Number.isInteger(year)||year<1990||year>new Date().getFullYear()+2||!make||!model)fail('Enter your car’s year, make and model.');
 const parsed=new Date(date+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date<tomorrow())fail('Pick an install day from tomorrow on.');
 if(!starlightCatalog.times.includes(time))fail('Pick a drop-off time.');
 if(!name||!/^\S+@\S+\.\S+$/.test(email)||!/^(1)?\d{10}$/.test(phone))fail('Enter your name, a valid email and a US phone number.');
 let fresh=false;
 await transaction(async q=>{
  // The browser-generated ID makes a retried submit a no-op.
  if((await q('SELECT id FROM starlight_orders WHERE id=$1',[id])).rows[0])return;
  const stamp=now();
  await q('INSERT INTO events(id,name,campaign,created_at) VALUES($1,$2,$3,$4)',[id,'Lead',source.utm_campaign,stamp]);
  await q('INSERT INTO starlight_orders(id,first_name,email,phone,year,make,model,stars,addons,total,deposit,desired_date,time_window,notes,status,source,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',[id,name,email,phone,year,make,model,tier.stars,JSON.stringify(addons.map(a=>a.id)),total,deposit,date,time,notes,'awaiting-deposit',JSON.stringify(source),stamp]);
  if(code)await q('INSERT INTO starlight_order_codes(order_id,code,discount,list_total,created_at) VALUES($1,$2,$3,$4,$5)',[id,code.code,off,list,stamp]);
  await job(q,'telegram-starlight-'+id,'telegram',{id,stage:'Starlit order (awaiting $'+deposit+' deposit)',firstName:name,email,phone,service:'Starlight headliner',year,make,model,desiredDate:date,timeWindow:time,package:`${tier.stars.toLocaleString('en-US')} stars (${money(tier.price)})`,addons:addons.map(a=>`${a.name} ${money(a.price)}`).join(', ')||'None',total:money(total)+(code?` (${code.code} −${money(off)} off ${money(list)})`:''),balance:money(balance),notes});
  fresh=true;
 });
 if(fresh)await meta('Lead',id,process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'http://localhost:3000',{em:[hash(email)],ph:[hash(phone.length===10?'1'+phone:phone)]});
 const row=(await query('SELECT total,deposit FROM starlight_orders WHERE id=$1',[id])).rows[0];
 return {id,eventId:id,total:Number(row.total),deposit:Number(row.deposit),balance:Number(row.total)-Number(row.deposit),checkoutUrl:checkoutUrl(id,email)};
}
