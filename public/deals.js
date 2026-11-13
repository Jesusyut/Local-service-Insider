// /deals — email-first signup for the local deals newsletter, then an optional hop into the price check.
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const requestId=crypto.randomUUID(),source=Object.fromEntries(params);
let config,service=params.get('service')||'',token='';
async function api(path,data){const r=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const b=await r.json();if(!r.ok)throw Error(b.error||'Please try again.');return b;}
const pixel=(name,id)=>{if(window.fbq)window.fbq('track',name,{},{eventID:id});};
const C=(k,v={})=>String(config.copy[k]??'').replace(/\{(\w+)\}/g,(_,x)=>v[x]??'');
function showError(e){const box=$('#flow-error');box.hidden=false;box.textContent=e.message;}
function challenge(){
 if(!config.turnstileSiteKey)return;
 const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
 s.onload=()=>window.turnstile.render('#challenge',{sitekey:config.turnstileSiteKey,callback:v=>token=v,'expired-callback':()=>token=''});document.head.append(s);
}
function chips(){
 $('#market').innerHTML=config.services.map(s=>`<button type="button" class="chip" data-service="${esc(s.id)}" aria-pressed="${service===s.id}">${esc(s.name)}</button>`).join('');
 document.querySelectorAll('#market .chip').forEach(b=>b.onclick=()=>{service=b.dataset.service;document.querySelectorAll('#market .chip').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
}
function done(r,name){
 const next='/'+(source.utm_campaign?'?utm_source=deals&utm_campaign='+encodeURIComponent(source.utm_campaign):'');
 $('#flow').innerHTML=`<p class="wordmark">Local Car Care</p><h1>${esc(C('deals.thanks.headline',{name}))}</h1><p class="lede">${esc(C('deals.thanks.sub',{service:r.service.toLowerCase()}))}</p><p class="sub">${esc(C('deals.thanks.next'))}</p><a class="btn" href="${esc(next)}">${esc(C('deals.thanks.cta'))}</a>`;
 window.scrollTo({top:0});
}
async function init(){
 try{config=await api('/api/config');}catch{showError(Error('Signup is temporarily unavailable. Please refresh in a moment.'));return;}
 window.configureMetaPixel?.(config.metaPixelId);
 if(!config.services.some(s=>s.id===service))service='';
 chips();challenge();
 $('#deals').onsubmit=async e=>{
  e.preventDefault();$('#flow-error').hidden=true;
  const firstName=$('#firstName').value.trim(),email=$('#email').value.trim();
  if(!service)return showError(Error('Pick what you’re in the market for.'));
  if(!firstName||!/^\S+@\S+\.\S+$/.test(email))return showError(Error('Enter your first name and a valid email.'));
  const button=$('#submit');button.disabled=true;
  try{const r=await api('/api/deals',{id:requestId,service,firstName,email,disclosureVersion:'deals-v1-local',source,turnstileToken:token});pixel('Lead',r.eventId);done(r,firstName);}
  catch(err){showError(err);button.disabled=false;window.turnstile?.reset?.();}
 };
}
init();
