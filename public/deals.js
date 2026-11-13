// /deals — name + email first (one screen), then one tap for what they're in the market for, then the thank-you.
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const requestId=crypto.randomUUID(),source=Object.fromEntries(params);
let config,token='',firstName='';
async function api(path,data){const r=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const b=await r.json();if(!r.ok)throw Error(b.error||'Please try again.');return b;}
const pixel=(name,id)=>{if(window.fbq)window.fbq('track',name,{},{eventID:id});};
const C=(k,v={})=>String(config?.copy?.[k]??'').replace(/\{(\w+)\}/g,(_,x)=>v[x]??'');
function showError(e){const box=$('#flow-error');if(!box)return;box.hidden=false;box.textContent=e.message;}
function view(html){$('#flow').innerHTML=`<p class="wordmark">Local Car Care</p>${html}<div class="error" id="flow-error" role="alert" hidden></div>`;window.scrollTo({top:0});const h=$('#flow h1');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}
function challenge(){
 if(!config.turnstileSiteKey)return;
 const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
 s.onload=()=>window.turnstile.render('#challenge',{sitekey:config.turnstileSiteKey,callback:v=>token=v,'expired-callback':()=>token=''});document.head.append(s);
}
function market(){
 view(`<h1>${esc(C('deals.market.headline',{name:firstName}))}</h1><p class="sub">${esc(C('deals.market.sub'))}</p><div class="chips" id="market">${config.services.map(s=>`<button type="button" class="chip" data-service="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>`);
 document.querySelectorAll('#market .chip').forEach(b=>b.onclick=()=>{
  const s=config.services.find(x=>x.id===b.dataset.service);
  // Advance instantly; the tag saves in the background and retries once.
  void api('/api/deals/interest',{id:requestId,service:s.id}).catch(()=>api('/api/deals/interest',{id:requestId,service:s.id}).catch(()=>null));
  done(s.name);
 });
}
function done(service){
 const next='/'+(source.utm_campaign?'?utm_source=deals&utm_campaign='+encodeURIComponent(source.utm_campaign):'');
 view(`<h1>${esc(C('deals.thanks.headline',{name:firstName}))}</h1><p class="lede">${esc(C('deals.thanks.sub',{service:service.toLowerCase()}))}</p><ul class="points">${config.copy['deals.points'].map(p=>`<li>${esc(p)}</li>`).join('')}</ul><p class="sub">${esc(C('deals.thanks.next'))}</p><a class="btn" href="${esc(next)}">${esc(C('deals.thanks.cta'))}</a>`);
}
const ready=api('/api/config').then(c=>{config=c;window.configureMetaPixel?.(c.metaPixelId);challenge();}).catch(()=>{});
$('#deals').onsubmit=async e=>{
 e.preventDefault();$('#flow-error').hidden=true;
 firstName=$('#firstName').value.trim();const email=$('#email').value.trim();
 if(!firstName||!/^\S+@\S+\.\S+$/.test(email))return showError(Error('Enter your first name and a valid email.'));
 const button=$('#submit');button.disabled=true;button.textContent='One sec…';
 await ready;if(!config){button.disabled=false;button.textContent='Send Me the Best Deals';return showError(Error('Signup is temporarily unavailable. Please try again in a moment.'));}
 const preset=config.services.find(s=>s.id===params.get('service'));
 try{
  const r=await api('/api/deals',{id:requestId,firstName,email,service:preset?.id,disclosureVersion:'deals-v1-local',source,turnstileToken:token});
  pixel('Lead',r.eventId);preset?done(preset.name):market();
 }catch(err){showError(err);button.disabled=false;button.textContent='Send Me the Best Deals';window.turnstile?.reset?.();}
};
