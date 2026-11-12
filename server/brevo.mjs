import {createHash} from 'node:crypto';

export const brevoAttributes={FIRSTNAME:'text',LPC_PHONE:'text',LPC_SERVICE:'text',LPC_SERVICE_ID:'text',LPC_STAGE:'text',LPC_VEHICLE:'text',LPC_YEAR:'float',LPC_MAKE:'text',LPC_MODEL:'text',LPC_DESIRED_DATE:'date',LPC_TIME_WINDOW:'text',LPC_CAMPAIGN:'text',LPC_REQUEST_ID:'text',LPC_CAPTURED_AT:'text',LPC_ESTIMATE_LOW:'float',LPC_ESTIMATE_TYPICAL:'float',LPC_ESTIMATE_HIGH:'float'};
const listId=value=>{const number=Number(value);if(!Number.isSafeInteger(number)||number<=0)throw Error('Set a valid Brevo list ID');return number;};
export function brevoPayload(contact,{leadListId,completeListId}={}){
 const lists=[listId(leadListId)];if(['estimate_completed','quote_requested'].includes(contact.stage)&&completeListId)lists.push(listId(completeListId));
 const phone=String(contact.phone||'').replace(/\D/g,'');
 const attributes={FIRSTNAME:contact.firstName||'',LPC_SERVICE:contact.service||'',LPC_SERVICE_ID:contact.serviceId||'',LPC_STAGE:contact.stage||'contact_captured',LPC_CAMPAIGN:contact.source?.utm_campaign||'Direct'};
 if(phone)attributes.LPC_PHONE='+'+(phone.length===10?'1'+phone:phone);
 for(const [field,value]of Object.entries({LPC_VEHICLE:contact.vehicle||[contact.year,contact.make,contact.model].filter(Boolean).join(' '),LPC_YEAR:contact.year?Number(contact.year):undefined,LPC_MAKE:contact.make,LPC_MODEL:contact.model,LPC_DESIRED_DATE:contact.desiredDate,LPC_TIME_WINDOW:contact.timeWindow,LPC_REQUEST_ID:contact.requestId,LPC_CAPTURED_AT:contact.capturedAt,LPC_ESTIMATE_LOW:contact.range?.low,LPC_ESTIMATE_TYPICAL:contact.range?.typical,LPC_ESTIMATE_HIGH:contact.range?.high}))if(value!==undefined&&value!==null&&value!=='')attributes[field]=value;
 // Phone is a custom contact field, not enrollment in SMS marketing.
 // Never reset email/SMS blocklists or force-merge conflicting identifiers.
 return {email:contact.email,attributes,listIds:[...new Set(lists)],updateEnabled:true,forceMerge:false};
}

const attributeCache=new Map();
async function request(path,{apiKey,fetchImpl,method='GET',body,allowNotFound=false}){
 const response=await fetchImpl('https://api.brevo.com/v3'+path,{method,headers:{'api-key':apiKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(!response.ok&&!(allowNotFound&&response.status===404))throw Error('Brevo returned HTTP '+response.status);
 return response;
}
async function ensureAttributes(options){
 const key=createHash('sha256').update(options.apiKey).digest('hex');
 if(attributeCache.get(key)>Date.now())return;
 const {attributes=[]}=await(await request('/contacts/attributes',options)).json();
 for(const [name,type]of Object.entries(brevoAttributes)){
  const current=attributes.find(a=>a.name===name);
  if(current){if(current.type!==type)throw Error('Brevo attribute type mismatch: '+name);continue;}
  try{await request('/contacts/attributes/normal/'+name,{...options,method:'POST',body:{type}});}
  catch(error){const latest=await(await request('/contacts/attributes',options)).json();if(!latest.attributes?.some(a=>a.name===name&&a.type===type))throw error;}
 }
 attributeCache.set(key,Date.now()+600000);
}
export async function syncBrevoContact(contact,{apiKey=process.env.BREVO_API_KEY,leadListId=process.env.BREVO_LEAD_LIST_ID,completeListId=process.env.BREVO_COMPLETE_LIST_ID,fetchImpl=fetch}={}){
 if(!apiKey)throw Error('Brevo is not configured: set BREVO_API_KEY and BREVO_LEAD_LIST_ID');
 const payload=brevoPayload(contact,{leadListId,completeListId}),options={apiKey,fetchImpl};
 await ensureAttributes(options);
 const path='/contacts/'+encodeURIComponent(contact.email),existing=await request(path,{...options,allowNotFound:true});
 const update=()=>request(path,{...options,method:'PUT',body:{attributes:payload.attributes,listIds:payload.listIds}});
 if(existing.status!==404){await update();return;}
 try{await request('/contacts',{...options,method:'POST',body:{...payload,updateEnabled:false}});}
 catch(error){const concurrent=await request(path,{...options,allowNotFound:true});if(concurrent.status===404)throw error;await update();}
}
