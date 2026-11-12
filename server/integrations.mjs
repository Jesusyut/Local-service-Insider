import {createHash,randomUUID} from 'node:crypto';
import {query} from './db.mjs';
import {syncBrevoContact} from './brevo.mjs';
export const hash=v=>createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
export async function enqueue(kind,payload,id=randomUUID()){await query('INSERT INTO outbox(id,kind,payload,status,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[id,kind,JSON.stringify(payload),'pending',new Date().toISOString()]);return id;}
async function post(url,key,body,id){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`} :{}),...(id?{'Idempotency-Key':id}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`Provider returned HTTP ${r.status}`);}
export async function deliver(job){const p=JSON.parse(job.payload);
 if(job.kind==='report'||job.kind==='lead-email'){
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw new Error('Resend is not configured');
  const mailbox=process.env.EMAIL_FROM.match(/<([^>]+)>/)?.[1]||process.env.EMAIL_FROM;
  await post('https://api.resend.com/emails',process.env.RESEND_API_KEY,{from:p.senderName?`${p.senderName} <${mailbox}>`:process.env.EMAIL_FROM,to:[p.to],subject:p.subject,text:p.text,...(p.html?{html:p.html}:{})},job.id);
 }else if(job.kind==='newsletter'){
  const subscriber=(await query('SELECT * FROM subscribers WHERE email=$1',[p.email])).rows[0];
  const intake=p.intakeId?(await query('SELECT * FROM intake_leads WHERE id=$1',[p.intakeId])).rows[0]:null;
  const quote=intake?(await query('SELECT preferred_time FROM intake_quote_requests WHERE intake_id=$1',[intake.id])).rows[0]:null;
  const field=name=>p.custom_fields?.find(f=>f.name===name)?.value;
  const report=intake?.report?JSON.parse(intake.report):null;
  await syncBrevoContact({email:p.email,firstName:subscriber?.first_name||p.firstName,phone:intake?.phone||p.phone,service:report?.service||p.service||field('service'),serviceId:intake?.service_id||p.subscription_tags?.[0],stage:quote?'quote_requested':report?'estimate_completed':'contact_captured',year:intake?.vehicle_year,make:intake?.make,model:intake?.model,vehicle:intake?undefined:field('vehicle'),desiredDate:intake?.desired_date,timeWindow:quote?.preferred_time,range:report?.range,requestId:intake?.id,capturedAt:intake?.created_at||subscriber?.consent_at,source:JSON.parse(intake?.source||subscriber?.source||'{}')});
 }else if(job.kind==='meta'){
  if(!process.env.META_ACCESS_TOKEN||!process.env.META_PIXEL_ID)throw new Error('Meta is not configured');
  await post(`https://graph.facebook.com/${process.env.META_API_VERSION||'v25.0'}/${process.env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_ACCESS_TOKEN)}`,null,{data:[p]});
 }
}
let busy=false;
export async function drain(){if(busy)return;busy=true;try{const {rows}=await query("SELECT * FROM outbox WHERE status='pending' AND attempts<6 ORDER BY created_at LIMIT 15");for(const j of rows){try{await deliver(j);await query("UPDATE outbox SET status='sent',last_error=NULL WHERE id=$1",[j.id]);}catch(e){await query('UPDATE outbox SET attempts=attempts+1,last_error=$1 WHERE id=$2',[e.message,j.id]);}}}finally{busy=false;}}
export async function meta(name,id,source,user={}){if(!process.env.META_PIXEL_ID)return;await enqueue('meta',{event_name:name,event_id:id,event_time:Math.floor(Date.now()/1000),action_source:'website',event_source_url:source,user_data:user});}
