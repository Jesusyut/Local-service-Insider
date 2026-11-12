import {createHash,randomUUID} from 'node:crypto';
import {query,transaction} from './db.mjs';
import {services,types,copy,newsletterConsent} from './catalog.mjs';
import {meta,hash} from './integrations.mjs';

const now=()=>new Date().toISOString();
const text=(v,n=100)=>String(v??'').trim().slice(0,n);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const sourceOf=s=>Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].map(k=>[k,text(s?.[k],200)]));
export const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Phoenix',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const job=async(q,id,kind,payload)=>q("INSERT INTO outbox(id,kind,payload,status,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",[id,kind,JSON.stringify(payload),'pending',now()]);

export async function captureIntake(b,{turnstile}){
 await turnstile(b.turnstileToken);
 if(b.disclosureVersion!=='intake-contact-v1-local')fail('Please refresh to view the current contact disclosure.');
 const service=services.find(s=>s.id===b.service),name=text(b.firstName,80),email=text(b.email,254).toLowerCase(),phone=text(b.phone,30).replace(/\D/g,''),id=b.id||randomUUID(),source=sourceOf(b.source);
 if(!service||!name||!/^\S+@\S+\.\S+$/.test(email)||!/^(1)?\d{10}$/.test(phone)||!/^[0-9a-f-]{36}$/i.test(id))fail('Enter your name, a valid email and a US phone number.');
 let fresh=false;
 await transaction(async q=>{
  // A browser-generated request ID makes retries idempotent, including lost responses.
  if(process.env.DATABASE_URL)await q('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
  const previous=(await q('SELECT i.*,s.email FROM intake_leads i JOIN subscribers s ON s.id=i.subscriber_id WHERE i.id=$1',[id])).rows[0];
  if(previous){if(previous.email!==email||previous.service_id!==service.id)fail('Start a new request to change the email or service.',409);await q('UPDATE intake_leads SET phone=$1,updated_at=$2 WHERE id=$3',[phone,now(),id]);await q('UPDATE subscribers SET first_name=$1 WHERE id=$2',[name,previous.subscriber_id]);return;}
  const subscriberId=randomUUID(),stamp=now();
  const saved=(await q('INSERT INTO subscribers(id,first_name,email,zip,consent_at,consent_text,source,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(email) DO UPDATE SET first_name=excluded.first_name,consent_at=excluded.consent_at,consent_text=excluded.consent_text RETURNING id',[subscriberId,name,email,'',stamp,newsletterConsent,JSON.stringify(source),stamp])).rows[0];
  await q('INSERT INTO intake_leads(id,subscriber_id,service_id,phone,contact_text,newsletter_text,consent_at,source,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,saved.id,service.id,phone,copy['intake.contact.disclosure'],newsletterConsent,stamp,JSON.stringify(source),stamp,stamp]);
  await q('INSERT INTO events(id,name,campaign,created_at) VALUES($1,$2,$3,$4)',[id,'Lead',source.utm_campaign,stamp]);
  await job(q,'newsletter-intake-'+id,'newsletter',{email,reactivate_existing:false,send_welcome_email:false,utm_source:source.utm_source,utm_medium:source.utm_medium,utm_campaign:source.utm_campaign,custom_fields:[{name:'service',value:service.name}],subscription_tags:[service.id]});
  fresh=true;
 });
 if(fresh)await meta('Lead',id,process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'http://localhost:3000',{em:[hash(email)],ph:[hash(phone.length===10?'1'+phone:phone)]});
 return {id,eventId:id};
}

export async function completeIntake(b,{rangeFor}){
 const row=(await query('SELECT i.*,s.first_name,s.email FROM intake_leads i JOIN subscribers s ON s.id=i.subscriber_id WHERE i.id=$1',[text(b.id,36)])).rows[0];
 if(!row||Date.now()-Date.parse(row.created_at)>30*86400000)fail('Start a new estimate request.',404);
 const year=Number(b.year),make=text(b.make),model=text(b.model),date=text(b.desiredDate,10),parsed=new Date(date+'T00:00:00Z');
 if(!Number.isInteger(year)||year<1990||year>new Date().getFullYear()+1||!make||!model)fail('Enter the vehicle year, make and model.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date<localToday())fail('Choose today or a future completion date.');
 if(row.service_id==='smog'&&year<1996)fail('This OBD test is for 1996 or newer vehicles. Choose another service for an older vehicle.');
 const service=services.find(s=>s.id===row.service_id),ranges=(await Promise.all(service.options.flatMap(([option])=>types.map(type=>rangeFor(service.id+':'+option,type))))).filter(Boolean);
 if(!ranges.length)fail('This service estimate is temporarily unavailable.',409);
 const typical=ranges.map(r=>r.typical).sort((a,b)=>a-b),middle=Math.floor(typical.length/2);
 const report={range:{low:Math.min(...ranges.map(r=>r.low)),typical:typical.length%2?typical[middle]:(typical[middle-1]+typical[middle])/2,high:Math.max(...ranges.map(r=>r.high))},service:service.name,serviceId:service.id,firstName:row.first_name,year,make,model,desiredDate:date,note:copy[service.id==='smog'?'result.smog.fair':'intake.estimate.note']};
 const key=createHash('sha256').update(JSON.stringify(report)).digest('hex');
 await transaction(async q=>{
  const current=(await q('SELECT report_key FROM intake_leads WHERE id=$1'+(process.env.DATABASE_URL?' FOR UPDATE':''),[row.id])).rows[0];
  if(current.report_key===key)return;
  await q('UPDATE intake_leads SET vehicle_year=$1,make=$2,model=$3,desired_date=$4,report=$5,report_key=$6,updated_at=$7 WHERE id=$8',[year,make,model,date,JSON.stringify(report),key,now(),row.id]);
  const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:service.id==='smog'?2:0,maximumFractionDigits:service.id==='smog'?2:0}).format(v);
  await job(q,'estimate-'+row.id+'-'+key,'report',{to:row.email,senderName:'Caesar from Local Price Check',subject:`Your ${service.name} estimate`,text:`Hi ${row.first_name},\n\n${service.name} estimate for your ${year} ${make} ${model}:\nLow: ${money(report.range.low)}\nTypical: ${money(report.range.typical)}\nHigh: ${money(report.range.high)}\n\n${report.note}\n\nDesired completion date: ${date}\nThis is your requested date, not a confirmed booking.\n\nCaesar`});
 });
 return report;
}
