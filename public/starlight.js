// Starlit Interiors — separate-brand quote + checkout page sent to leads 1:1: to-scale star preview, package + extras, install day, $250 deposit.
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'$'+Number(v).toLocaleString('en-US');
const source=Object.fromEntries([...params].filter(([k])=>k.startsWith('utm_')||k==='fbclid'));
const requestId=crypto.randomUUID();
const SW=[{id:'white',name:'Cool white',c:'#EEF2FF'},{id:'warm',name:'Warm white',c:'#FFE3AE'},{id:'blue',name:'Ice blue',c:'#7DB3FF'},{id:'purple',name:'Purple',c:'#B48BFF'},{id:'red',name:'Red',c:'#FF6A6A'}];
const store={get(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
let cfg,token='',state={stars:750,addons:new Set(),color:'white',time:'',code:null};
async function api(path,data){const r=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Please try again.');return b;}
const pixel=(name,data,id)=>{if(window.fbq)window.fbq('track',name,data,id?{eventID:id}:{});};

/* ---------- Sky preview: one fixed set of 1,000 stars; each package shows the first N, so density compares honestly. ---------- */
const canvas=$('#sky'),ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R=rng(20261114),STARS=Array.from({length:1000},()=>({x:R(),y:R(),r:[.9,1.1,1.3,1.6][Math.floor(R()*4)],b:[.55,.7,.85,1,1,1][Math.floor(R()*6)],ph:R()*6.283,sp:.6+R()*1.6,alt:R()<.5}));
let W=0,H=0,dpr=1,shown=750,sprites={},meteor=null,visible=true;
function sprite(color){
 if(sprites[color])return sprites[color];
 const s=document.createElement('canvas'),n=64;s.width=s.height=n;const g=s.getContext('2d'),gr=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);
 gr.addColorStop(0,'#FFFFFF');gr.addColorStop(.12,color);gr.addColorStop(.3,color+'66');gr.addColorStop(1,color+'00');g.fillStyle=gr;g.fillRect(0,0,n,n);return sprites[color]=s;
}
function size(){dpr=Math.min(devicePixelRatio||1,2);W=canvas.clientWidth*dpr;H=canvas.clientHeight*dpr;canvas.width=W;canvas.height=H;}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function draw(t){
 if(!W)return;
 const suede=state.addons.has('suede'),m=Math.round(Math.min(W,H)*.045),px=m,py=m,pw=W-2*m,ph=H-2*m;
 ctx.fillStyle='#07080D';ctx.fillRect(0,0,W,H);
 // headliner panel with a soft dome shade
 const g=ctx.createRadialGradient(W/2,H*.45,0,W/2,H*.45,Math.max(pw,ph)*.7);
 g.addColorStop(0,suede?'#262230':'#1A1E2A');g.addColorStop(1,suede?'#12101A':'#0C0E15');
 roundRect(px,py,pw,ph,m*1.6);ctx.fillStyle=g;ctx.fill();
 if(suede){ctx.save();ctx.clip();ctx.globalAlpha=.05;const n=rng(7);for(let i=0;i<900;i++){ctx.fillStyle=n()<.5?'#FFF':'#000';ctx.fillRect(px+n()*pw,py+n()*ph,dpr*1.5,dpr*1.5);}ctx.restore();}
 ctx.lineWidth=1.5*dpr;ctx.strokeStyle='#262B3A';roundRect(px,py,pw,ph,m*1.6);ctx.stroke();
 const c1=SW.find(s=>s.id===state.color).c,c2=SW[(SW.findIndex(s=>s.id===state.color)+2)%SW.length].c,dual=state.addons.has('dual');
 if(state.addons.has('ambient')){ctx.save();ctx.shadowColor=c1;ctx.shadowBlur=14*dpr;ctx.strokeStyle=c1;ctx.globalAlpha=.85;ctx.lineWidth=2.2*dpr;roundRect(px+m*.55,py+m*.55,pw-m*1.1,ph-m*1.1,m*1.2);ctx.stroke();ctx.restore();}
 const pad=Math.min(pw,ph)*.07,ix=px+pad,iy=py+pad,iw=pw-2*pad,ih=ph-2*pad,unit=pw/360;
 const n=Math.round(shown);ctx.globalCompositeOperation='lighter';
 for(let i=0;i<n;i++){const s=STARS[i],tw=reduce?1:.72+.28*Math.sin(t/1000*s.sp+s.ph),d=s.r*unit*7.5;ctx.globalAlpha=s.b*tw;ctx.drawImage(sprite(dual&&s.alt?c2:c1),ix+s.x*iw-d/2,iy+s.y*ih-d/2,d,d);}
 ctx.globalAlpha=1;
 if(state.addons.has('shooting')){
  const life=1100,now=reduce?600:t;
  if(!meteor||now-meteor.t0>life+1400&&!reduce){const r=rng(Math.floor(now));meteor={t0:now,x:ix+iw*(.15+r()*.55),y:iy+ih*(.1+r()*.35),a:.45+r()*.35};}
  const k=Math.min(1,(now-meteor.t0)/life);
  if(k<1){const len=pw*.22,x=meteor.x+Math.cos(meteor.a)*pw*.35*k,y=meteor.y+Math.sin(meteor.a)*pw*.35*k,lg=ctx.createLinearGradient(x,y,x-Math.cos(meteor.a)*len,y-Math.sin(meteor.a)*len);
   lg.addColorStop(0,'#FFFFFF');lg.addColorStop(.2,c1);lg.addColorStop(1,c1+'00');ctx.globalAlpha=Math.sin(k*Math.PI);ctx.strokeStyle=lg;ctx.lineWidth=2*dpr;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(meteor.a)*len,y-Math.sin(meteor.a)*len);ctx.stroke();ctx.globalAlpha=1;}
 }
 ctx.globalCompositeOperation='source-over';
}
let last=0;
function loop(t){if(visible&&t-last>33){shown+=(state.stars-shown)*.18;if(Math.abs(state.stars-shown)<1)shown=state.stars;draw(t);last=t;}if(!reduce)requestAnimationFrame(loop);}
new ResizeObserver(()=>{size();draw(performance.now());}).observe(canvas);
new IntersectionObserver(e=>visible=e[0].isIntersecting).observe(canvas);
const redraw=()=>{if(reduce){shown=state.stars;draw(0);}};

/* ---------- Configurator ---------- */
function totals(){const tier=cfg.tiers.find(t=>t.stars===state.stars),extras=cfg.addons.filter(a=>state.addons.has(a.id)),list=tier.price+extras.reduce((s,a)=>s+a.price,0),off=state.code?tier.price-state.code.prices[tier.stars]:0,total=list-off;return {tier,extras,list,off,total,balance:total-cfg.deposit};}
function render(){
 const {tier,extras,off,total,balance}=totals();
 document.querySelectorAll('.tier').forEach(b=>b.setAttribute('aria-checked',String(Number(b.dataset.stars)===state.stars)));
 $('#cap-stars').textContent=tier.stars.toLocaleString('en-US')+' stars';
 canvas.setAttribute('aria-label',`Preview of a headliner with ${tier.stars.toLocaleString('en-US')} stars`);
 $('#rows').innerHTML=`<div class="rrow"><span>${tier.stars.toLocaleString('en-US')} star headliner</span><span>${money(tier.price)}</span></div>`+extras.map(a=>`<div class="rrow"><span>${esc(a.name)}</span><span>${money(a.price)}</span></div>`).join('')+(state.code?`<div class="rrow deal"><span>${esc(state.code.label)} <small>${esc(state.code.code)}</small></span><span>−${money(off)}</span></div>`:'')+`<div class="rrow total"><span>Total installed</span><span>${money(total)}</span></div>`;
 $('#deal').hidden=!state.code;if(state.code)$('#deal-text').textContent=`${state.code.label} applied. You save ${money(off)} on ${tier.stars.toLocaleString('en-US')} stars.`;
 document.querySelectorAll('.tier .p').forEach(el=>{const t=cfg.tiers.find(x=>x.stars===Number(el.closest('.tier').dataset.stars));el.innerHTML=state.code?`<s>${money(t.price)}</s> ${money(state.code.prices[t.stars])}`:money(t.price);});
 $('#r-total-h').textContent=money(total);$('#r-dep').textContent=money(cfg.deposit);$('#r-bal').textContent=money(balance);
 $('#bar-total').textContent=money(total);$('#bar-sum').textContent=tier.stars.toLocaleString('en-US')+' stars'+(extras.length?` + ${extras.length} extra${extras.length>1?'s':''}`:'')+` · ${money(cfg.deposit)} today`;
 redraw();
}
// Personal links: ?name=Antoni&email=..&phone=..&year=2026&make=Kia&model=K5&stars=750&addons=shooting,suede&date=2026-11-18&time=Morning
function personalize(){
 const p=k=>(params.get(k)||'').trim().slice(0,120),name=p('name');
 for(const [k,id] of [['name','firstName'],['email','email'],['phone','phone'],['year','year'],['make','make'],['model','model'],['date','date']])if(p(k))$('#'+id).value=p(k);
 if($('#date').value&&$('#date').value<cfg.minDate)$('#date').value='';
 for(const a of p('addons').split(','))if(cfg.addons.some(x=>x.id===a))state.addons.add(a);
 const car=[p('year'),p('make'),p('model')].filter(Boolean).join(' ');
 if(name){$('#eyebrow').textContent='Prepared for '+name+(car?' · '+car:'');$('#hero').textContent=name+', here’s your night sky.';$('#lede').textContent=`This is the package we talked about, drawn to scale. Change anything you like, then lock your install day with a ${money(cfg.deposit)} deposit.`;document.title='Your starlight quote · Starlit Interiors';}
}
function build(){
 const preset=Number(params.get('stars'));if(cfg.tiers.some(t=>t.stars===preset))state.stars=preset;shown=state.stars;
 personalize();
 if(params.get('code'))applyCode(params.get('code'),true);
 $('#tiers').innerHTML=cfg.tiers.map(t=>`<button type="button" class="tier" role="radio" data-stars="${t.stars}"><span class="dot"></span><span><b>${t.stars.toLocaleString('en-US')} stars</b>${t.tag==='Most popular'||t.tag==='Best long-term'?`<em>${esc(t.tag)}</em>`:''}</span><span class="p">${money(t.price)}</span></button>`).join('');
 document.querySelectorAll('.tier').forEach(b=>b.onclick=()=>{state.stars=Number(b.dataset.stars);render();});
 $('#swatches').innerHTML=SW.map(s=>`<button type="button" class="sw" data-c="${s.id}" aria-label="${s.name}" aria-pressed="${s.id===state.color}"></button>`).join('');
 document.querySelectorAll('.sw').forEach(b=>{b.style.setProperty('--c',SW.find(s=>s.id===b.dataset.c).c);});
 document.querySelectorAll('.sw').forEach(b=>b.onclick=()=>{state.color=b.dataset.c;document.querySelectorAll('.sw').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();});
 $('#addons').innerHTML=cfg.addons.map(a=>`<label class="addon"><input type="checkbox" value="${a.id}"><span><b>${esc(a.name)}${a.tag?` <em class="atag">${esc(a.tag)}</em>`:''}</b><span>${esc(a.note)}</span></span><span class="p">+${money(a.price)}</span></label>`).join('');
 document.querySelectorAll('.addon input').forEach(i=>{i.checked=state.addons.has(i.value);});
 document.querySelectorAll('.addon input').forEach(i=>i.onchange=()=>{i.checked?state.addons.add(i.value):state.addons.delete(i.value);meteor=null;render();});
 $('#times').innerHTML=cfg.times.map(t=>`<button type="button" class="chip" aria-pressed="false" data-t="${t}">${t}</button>`).join('');
 const pt=params.get('time');if(cfg.times.includes(pt)){state.time=pt;document.querySelectorAll('#times .chip').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.t===pt)));}
 document.querySelectorAll('#times .chip').forEach(b=>b.onclick=()=>{state.time=b.dataset.t;document.querySelectorAll('#times .chip').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
 $('#date').min=cfg.minDate;$('#year').placeholder=String(new Date().getFullYear());
 $('#consent').textContent=cfg.consent;
 $('#pay').textContent=cfg.onlineDeposit?`Reserve with ${money(cfg.deposit)} deposit`:'Request my install day';
 if(cfg.phone){
  $('#ask-text').textContent='Call or text us. A real person answers.';
  $('#ask-links').hidden=false;$('#ask-links').innerHTML=`<a href="tel:${cfg.phone.tel}">Call ${esc(cfg.phone.display)}</a><a href="sms:${cfg.phone.tel}">Text us</a>`;
  const h=$('#head-call');h.hidden=false;h.href='tel:'+cfg.phone.tel;h.textContent=cfg.phone.display;
 }
 if(cfg.turnstileSiteKey){const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=()=>window.turnstile.render('#challenge',{sitekey:cfg.turnstileSiteKey,callback:v=>token=v,'expired-callback':()=>token=''});document.head.append(s);}
 render();
}
// Mobile buy bar: jumps to the form, hides once the real button is on screen.
$('#bar-go').onclick=()=>{const f=document.querySelector('#year');f.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>f.focus({preventScroll:true}),450);};
new IntersectionObserver(e=>$('#buybar').hidden=e[0].isIntersecting).observe($('#pay'));

async function applyCode(c,quiet){
 const msg=$('#code-msg');
 try{state.code=await api('/api/starlight-code?code='+encodeURIComponent(c.trim()));msg.hidden=true;$('#code-box').hidden=true;$('#code-open').hidden=true;}
 catch(e){if(!quiet){msg.hidden=false;msg.textContent=e.message;}}
 render();
}
$('#code-open').onclick=()=>{$('#code-box').hidden=false;$('#code-open').hidden=true;$('#code').focus();};
$('#code-apply').onclick=()=>applyCode($('#code').value);
$('#code').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();applyCode($('#code').value);}};
/* ---------- Gallery: arrows, swipe hint, edge fade ---------- */
(()=>{const reel=$('#reel'),frame=$('#reel-frame');if(!reel)return;
 const step=()=>Math.max(200,reel.clientWidth*.8);
 $('#reel-next').onclick=()=>reel.scrollBy({left:step(),behavior:'smooth'});
 $('#reel-prev').onclick=()=>reel.scrollBy({left:-step(),behavior:'smooth'});
 const update=()=>{const max=reel.scrollWidth-reel.clientWidth-4;frame.classList.toggle('at-start',reel.scrollLeft<=4);frame.classList.toggle('at-end',reel.scrollLeft>=max);$('#reel-prev').disabled=reel.scrollLeft<=4;$('#reel-next').disabled=reel.scrollLeft>=max;if(reel.scrollLeft>30)frame.classList.add('seen');};
 reel.addEventListener('scroll',update,{passive:true});new ResizeObserver(update).observe(reel);update();
})();
/* ---------- Checkout ---------- */
const dayName=d=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
function showError(m){const e=$('#err');e.hidden=false;e.textContent=m;e.scrollIntoView({behavior:'smooth',block:'center'});}
function finish(html){$('#buybar').hidden=true;$('#app').innerHTML=`<header class="store-head"><p class="wordmark brand">Starlit<span>Interiors</span></p></header><section class="done">${html}</section>`;window.scrollTo({top:0});}
function receiptHtml(o){return `<div class="receipt"><div class="receipt-head"><span>Your order</span><span>${money(o.total)}</span></div><div class="receipt-rows">${o.rows.map(([a,b])=>`<div class="rrow"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}</div><div class="due"><div><small>Deposit</small><strong>${money(o.deposit)}</strong></div><div><small>At drop-off</small><strong>${money(o.balance)}</strong></div></div></div>`;}
$('#book').onsubmit=async e=>{
 e.preventDefault();$('#err').hidden=true;
 const v=id=>$('#'+id).value.trim(),year=Number(v('year')),phone=v('phone').replace(/\D/g,'');
 if(!Number.isInteger(year)||year<1990||!v('make')||!v('model'))return showError('Enter your car’s year, make and model.');
 if(!v('date')||v('date')<cfg.minDate)return showError('Pick an install day from tomorrow on.');
 if(!state.time)return showError('Pick a drop-off time.');
 if(!v('firstName')||!/^\S+@\S+\.\S+$/.test(v('email'))||!/^(1)?\d{10}$/.test(phone))return showError('Enter your name, a valid email and a US mobile number.');
 const btn=$('#pay'),label=btn.textContent;btn.disabled=true;btn.textContent='Saving your day…';
 const {tier,extras,off}=totals();
 try{
  const r=await api('/api/starlight-order',{id:requestId,stars:state.stars,addons:[...state.addons],year,make:v('make'),model:v('model'),date:v('date'),time:state.time,firstName:v('firstName'),email:v('email'),phone,notes:v('notes'),disclosureVersion:cfg.disclosureVersion,code:state.code?.code,source,turnstileToken:token});
  const order={id:r.id,name:v('firstName'),car:`${year} ${v('make')} ${v('model')}`,date:v('date'),time:state.time,total:r.total,deposit:r.deposit,balance:r.balance,rows:[[`${tier.stars.toLocaleString('en-US')} star headliner`,money(tier.price)],...extras.map(a=>[a.name,money(a.price)]),...(state.code?[[state.code.label,'−'+money(off)]]:[]),['Install',`${dayName(v('date'))}, ${state.time.toLowerCase()}`],['Car',`${year} ${v('make')} ${v('model')}`]]};
  store.set('starlight-order',order);
  pixel('Lead',{value:r.total,currency:'USD',content_name:'Starlight headliner'},r.eventId);
  if(r.checkoutUrl){pixel('InitiateCheckout',{value:r.deposit,currency:'USD'});btn.textContent='Opening secure checkout…';location.href=r.checkoutUrl;return;}
  finish(`<h1>You’re on the calendar, ${esc(order.name)}.</h1><p class="lede">We’re confirming ${esc(dayName(order.date))} (${esc(order.time.toLowerCase())}) with the installer now. Watch for a text with your secure ${money(order.deposit)} deposit link. Your day locks once it’s paid.</p>${receiptHtml(order)}<p class="fine">Questions? ${cfg.phone?`Call or text ${esc(cfg.phone.display)}.`:'Reply to the confirmation email and a real person gets back to you.'}</p>`);
 }catch(err){btn.disabled=false;btn.textContent=label;showError(err.message);window.turnstile?.reset?.();}
};

/* ---------- Return from Stripe: /starlight?paid=1 ---------- */
function paidView(){
 const o=store.get('starlight-order');
 if(o&&!store.get('starlight-paid-'+o.id)){pixel('Purchase',{value:o.deposit,currency:'USD',content_name:'Starlight deposit'},'paid-'+o.id);store.set('starlight-paid-'+o.id,true);}
 finish(`<h1>Deposit received. Your day is locked${o?', '+esc(o.name):''}.</h1><p class="lede">${o?`See you ${esc(dayName(o.date))} (${esc(o.time.toLowerCase())}). `:''}We’ll text you the shop address and a reminder the day before. The balance is due at drop-off, before work starts.</p>${o?receiptHtml(o):''}<p class="fine">Questions? ${cfg?.phone?`Call or text ${esc(cfg.phone.display)}.`:'Reply to your confirmation email.'}</p>`);
}
api('/api/starlight').then(c=>{cfg=c;if(params.get('paid')==='1')return paidView();build();if(!reduce)requestAnimationFrame(loop);}).catch(()=>showError('The store is loading slowly. Refresh in a moment.'));
