const clean=v=>String(v??'').replace(/[\r\n\x00-\x1f]/g,' ').trim().slice(0,500);
export function telegramText(lead){
 const fields={Event:lead.stage,Request:lead.id,Name:lead.firstName,Email:lead.email,Phone:lead.phone,Service:lead.service,Year:lead.year,Make:lead.make,Model:lead.model,'Desired date':lead.desiredDate,'Preferred time':lead.timeWindow};
 const lines=['Local Car Care lead',...Object.entries(fields).filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>k+': '+clean(v))];
 return lines.join('\n');
}
export async function sendTelegramLead(lead,{token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_CHAT_ID,fetchImpl=fetch}={}){
 if(!token||!chatId)throw Error('Telegram is not configured');
 const message=telegramText(lead);
 // No parse_mode: visitor input remains plain text. Never include the bot URL in errors.
 for(let offset=0;offset<message.length;offset+=3500){
  let response;try{response=await fetchImpl('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:message.slice(offset,offset+3500),link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(15000)});}catch{throw Error('Telegram request failed');}
  if(!response.ok)throw Error('Telegram returned HTTP '+response.status);
  const result=await response.json();if(!result.ok)throw Error('Telegram rejected the notification');
 }
}
