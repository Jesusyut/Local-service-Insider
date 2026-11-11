import {createHash,randomUUID} from 'node:crypto';
import {query} from './db.mjs';
export const hash=v=>createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
export async function enqueue(kind,payload){await query('INSERT INTO outbox(id,kind,payload,status,created_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),kind,JSON.stringify(payload),'pending',new Date().toISOString()]);}
async function post(url,key,body,id){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`} :{}),...(id?{'Idempotency-Key':id}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`Provider returned HTTP ${r.status}`);}
export async function deliver(job){const p=JSON.parse(job.payload);
 if(job.kind==='report'||job.kind==='lead-email'){
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw new Error('Resend is not configured');
  await post('https://api.resend.com/emails',process.env.RESEND_API_KEY,{from:process.env.EMAIL_FROM,to:[p.to],subject:p.subject,text:p.text},job.id);
 }else if(job.kind==='newsletter'){
  if(!process.env.BEEHIIV_API_KEY||!process.env.BEEHIIV_PUBLICATION_ID)throw new Error('beehiiv is not configured');
  await post(`https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUBLICATION_ID}/subscriptions`,process.env.BEEHIIV_API_KEY,p);
 }else if(job.kind==='meta'){
  if(!process.env.META_ACCESS_TOKEN||!process.env.META_PIXEL_ID)throw new Error('Meta is not configured');
  await post(`https://graph.facebook.com/${process.env.META_API_VERSION||'v25.0'}/${process.env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_ACCESS_TOKEN)}`,null,{data:[p]});
 }
}
let busy=false;
export async function drain(){if(busy)return;busy=true;try{const {rows}=await query("SELECT * FROM outbox WHERE status='pending' AND attempts<6 ORDER BY created_at LIMIT 15");for(const j of rows){try{await deliver(j);await query("UPDATE outbox SET status='sent',last_error=NULL WHERE id=$1",[j.id]);}catch(e){await query('UPDATE outbox SET attempts=attempts+1,last_error=$1 WHERE id=$2',[e.message,j.id]);}}}finally{busy=false;}}
export async function meta(name,id,source,user={}){if(!process.env.META_PIXEL_ID)return;await enqueue('meta',{event_name:name,event_id:id,event_time:Math.floor(Date.now()/1000),action_source:'website',event_source_url:source,user_data:user});}
