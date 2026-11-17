// /preview — 3-field gate, then straight into the Starlit preview with the car filled in.
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
const source=Object.fromEntries([...params].filter(([k])=>k.startsWith('utm_')||k==='fbclid'));
const requestId=crypto.randomUUID();let token='';
const store={get(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
function previewUrl(u){const p=new URLSearchParams({code:'INSIDER'});if(u.name)p.set('name',u.name);if(u.phone)p.set('phone',u.phone);if(u.car?.year)p.set('year',u.car.year);if(u.car?.make)p.set('make',u.car.make);if(u.car?.model)p.set('model',u.car.model);for(const [k,v] of Object.entries(source))p.set(k,v);return '/starlit?'+p.toString().replace(/\+/g,'%20');}
// Repeat visitors skip the form.
const unlocked=store.get('starlit-unlock');if(unlocked&&!params.has('reset'))location.replace(previewUrl(unlocked));
fetch('/api/config').then(r=>r.json()).then(c=>{window.configureMetaPixel?.(c.metaPixelId);if(window.fbq)window.fbq('track','ViewContent',{content_name:'Starlight preview page'});if(c.turnstileSiteKey){const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=()=>window.turnstile.render('#challenge',{sitekey:c.turnstileSiteKey,callback:v=>token=v,'expired-callback':()=>token=''});document.head.append(s);}}).catch(()=>{});
function err(m){const e=$('#err');e.hidden=!m;e.textContent=m||'';}
$('#pv').onsubmit=async e=>{
 e.preventDefault();err('');
 const name=$('#firstName').value.trim(),phone=$('#phone').value.replace(/\D/g,''),vehicle=$('#vehicle').value.trim();
 if(!name)return err('Enter your first name.');
 if(!/^(1)?\d{10}$/.test(phone))return err('Enter a US mobile number.');
 if(vehicle.length<3)return err('Enter your car’s year, make and model.');
 const btn=$('#go');btn.disabled=true;btn.textContent='Unlocking…';
 try{
  const r=await fetch('/api/starlight-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId,firstName:name,phone,vehicle,source,turnstileToken:token})});
  const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Please try again.');
  if(window.fbq)window.fbq('track','Lead',{content_name:'Starlight preview'},{eventID:b.eventId});
  const u={name,phone:phone.slice(-10),car:b.car};store.set('starlit-unlock',u);
  setTimeout(()=>location.assign(previewUrl(u)),150); // let the pixel fire
 }catch(x){btn.disabled=false;btn.textContent='Preview on my car';err(x.message);window.turnstile?.reset?.();}
};
