import {query} from './db.mjs';
import {tidyLead,priceText} from './starlit-links.mjs';

// Starlit email sequence for starlight inquiries: quote email ~90 min after the welcome email,
// then trust-building follow-ups. Sent through Brevo transactional templates; stops once they book.
// STARLIT_STEPS="templateId@minutesAfterSignup,..." overrides the default schedule.
const DEFAULT_STEPS='15@90,16@1440,17@4320,18@7200,19@11520';
export const steps=()=>(process.env.STARLIT_STEPS||DEFAULT_STEPS).split(',').map((s,i)=>{const [t,m]=s.split('@').map(Number);return {step:i+1,templateId:t,minutes:m};}).filter(s=>s.templateId>0&&s.minutes>=0);
const now=()=>new Date().toISOString();

// Nothing lands overnight: before 9am or after 8pm San Diego time moves to the next 9am.
export function sendTime(at){
 const d=new Date(at),hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',hourCycle:'h23'}).format(d));
 if(hour>=9&&hour<20)return d;
 const ahead=hour>=20?(24-hour+9):(9-hour),t=new Date(d.getTime()+ahead*3600000);t.setUTCMinutes(0,0,0);return t;
}

export async function enrollStarlit(q,{email,firstName,requestId=null,fromStep=1,start=new Date()}){
 email=String(email||'').toLowerCase();if(!email)return;
 for(const s of steps().filter(s=>s.step>=fromStep)){
  const at=sendTime(new Date(start.getTime()+s.minutes*60000)).toISOString();
  await q("INSERT INTO starlit_sequence(id,email,first_name,request_id,step,template_id,send_at,status,attempts,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,'pending',0,$8) ON CONFLICT(id) DO NOTHING",['seq-'+email+'-'+s.step,email,firstName||'',requestId,s.step,s.templateId,at,now()]);
 }
}

async function brevo(path,{method='GET',body,fetchImpl}){
 return fetchImpl('https://api.brevo.com/v3'+path,{method,headers:{'api-key':process.env.BREVO_API_KEY,'Content-Type':'application/json',Accept:'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
}

let running=false;
export async function tickStarlit({fetchImpl=fetch}={}){
 if(running||!process.env.BREVO_API_KEY)return 0;running=true;let sent=0;
 try{
  const due=(await query("SELECT * FROM starlit_sequence WHERE status='pending' AND send_at<=$1 AND attempts<5 ORDER BY send_at LIMIT 20",[now()])).rows;
  for(const row of due){
   // Claim it so two servers never send the same email.
   const claimed=(await query("UPDATE starlit_sequence SET status='sending' WHERE id=$1 AND status='pending' RETURNING id",[row.id])).rows[0];if(!claimed)continue;
   try{
    if((await query('SELECT id FROM starlight_orders WHERE email=$1 LIMIT 1',[row.email])).rows[0]){await query("UPDATE starlit_sequence SET status='cancelled',last_error='booked' WHERE email=$1 AND status IN ('pending','sending')",[row.email]);continue;}
    // Never two emails to one person within 20 hours (e.g. after downtime), keep it for the next tick.
    if((await query("SELECT id FROM starlit_sequence WHERE email=$1 AND status='sent' AND sent_at>$2 LIMIT 1",[row.email,new Date(Date.now()-20*3600000).toISOString()])).rows[0]){await query("UPDATE starlit_sequence SET status='pending' WHERE id=$1",[row.id]);continue;}
    const contact=await brevo('/contacts/'+encodeURIComponent(row.email),{fetchImpl});
    if(contact.ok&&(await contact.json()).emailBlacklisted){await query("UPDATE starlit_sequence SET status='cancelled',last_error='unsubscribed' WHERE email=$1 AND status IN ('pending','sending')",[row.email]);continue;}
    const lead=row.request_id?(await query('SELECT report FROM intake_leads WHERE id=$1',[row.request_id])).rows[0]:null;
    const high=priceText(lead?.report?JSON.parse(lead.report)?.range?.high:undefined);
    const name=tidyLead({firstName:row.first_name}).firstName;
    const r=await brevo('/smtp/email',{method:'POST',fetchImpl,body:{templateId:row.template_id,to:[{email:row.email,...(name?{name}:{})}],params:{...(name?{NAME:name}:{}),...(high?{HIGH:high}:{})},sender:{name:'Caesar at Local Car Care',email:process.env.BREVO_SENDER_EMAIL||'us@localserviceinsider.com'},tags:['starlit','starlit-step-'+row.step]}});
    if(!r.ok)throw Error('Brevo send HTTP '+r.status+' '+(await r.text()).slice(0,200));
    await query("UPDATE starlit_sequence SET status='sent',sent_at=$1,last_error=NULL WHERE id=$2",[now(),row.id]);sent++;
   }catch(e){await query("UPDATE starlit_sequence SET status='pending',attempts=attempts+1,last_error=$1 WHERE id=$2",[e.message,row.id]);console.error('Starlit sequence error:',row.id,e.message);}
  }
 }finally{running=false;}
 return sent;
}
