import {readFileSync} from 'node:fs';
// Creates the "Starlit · new starlight contact" template in Brevo once. It never overwrites
// an existing template, so edits made in Brevo's editor survive deploys.
export const STARLIT_TEMPLATE='Starlit · new starlight contact';
export async function ensureStarlitTemplate({apiKey=process.env.BREVO_API_KEY,fetchImpl=fetch}={}){
 if(!apiKey)return 'skipped';
 const from=process.env.BREVO_SENDER_EMAIL||(process.env.EMAIL_FROM||'').match(/<([^>]+)>/)?.[1]||process.env.EMAIL_FROM;
 if(!from)return 'no-sender';
 const h={'api-key':apiKey,'Content-Type':'application/json',Accept:'application/json'};
 const list=await fetchImpl('https://api.brevo.com/v3/smtp/templates?limit=1000',{headers:h,signal:AbortSignal.timeout(15000)});
 if(!list.ok)throw Error('Brevo templates HTTP '+list.status);
 const {templates=[]}=await list.json();const found=templates.find(t=>t.name===STARLIT_TEMPLATE);
 if(found)return 'exists:'+found.id;
 const body={templateName:STARLIT_TEMPLATE,subject:'{{ contact.FIRSTNAME | default : "Hey" }}, see your car under the stars',sender:{name:process.env.BREVO_SENDER_NAME||'Caesar at Local Car Care',email:from},replyTo:from,isActive:true,htmlContent:readFileSync(new URL('./emails/starlit-new-contact.html',import.meta.url),'utf8')};
 const r=await fetchImpl('https://api.brevo.com/v3/smtp/templates',{method:'POST',headers:h,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Brevo template create HTTP '+r.status+' '+(await r.text()).slice(0,200));
 return 'created:'+(await r.json()).id;
}
