// / (home) — Local Car Care. Two steps (service, then contact one field at a time) before the local rate.
// Vehicle, day and time are asked only after the visitor taps "Text me a quote".
const $=s=>document.querySelector(s),app=$('#app'),params=new URLSearchParams(location.search);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const angles={
 trust:{h:'Car care pros you can trust.',sub:'Get quotes from hand-picked, highly rated local shops. One request, and no calling around.',points:['Every shop is checked by us before it’s listed','See the fair local price before anyone texts you','No obligation. You decide.']},
 convenience:{h:'Skip the calling around.',sub:'Tell us what your car needs. A highly rated local shop texts you a price and a time that works for you.',points:['Two quick steps, about a minute','A real price by text, not phone tag','Pick a time that fits your week']},
 quality:{h:'Good work at a fair price.',sub:'Know what local shops actually charge, then get a quote only from shops that do it right.',points:['The low, typical and high local price','Quotes only from highly rated shops','No pressure, no upsell calls']},
 onestop:{h:'One stop for everything your car needs.',sub:'Tint, detailing, ceramic, smog, mechanical work and more, from local shops we’ve checked out ourselves.',points:['One request covers any service','Highly rated shops near you','Your quote by text, your time']}
};
const angle=angles[params.get('angle')]?params.get('angle'):'trust';

let config,step='landing',slide=0,id,report,token='',challengeId,modelRequest=0;
const requestId=crypto.randomUUID();
const state={service:'',firstName:'',email:'',phone:'',year:'',make:'',model:'',desiredDate:'',timeWindow:'',consent:false,source:Object.fromEntries(params)};

async function api(path,data){
 const r=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});
 const b=await r.json();if(!r.ok)throw Error(b.error||'Please try again.');return b;
}
const track=name=>api('/api/events',{name,campaign:state.source.utm_campaign}).catch(()=>null);
const pixel=(name,eventId)=>{if(window.fbq)window.fbq(['ViewContent','Lead'].includes(name)?'track':'trackCustom',name,{},{eventID:eventId});};
const service=()=>config.services.find(s=>s.id===state.service);
const legal='<p class="fine"><a href="/privacy" target="_blank">Privacy</a> and <a href="/terms" target="_blank">Terms</a></p>';

function showError(e){const box=$('#flow-error');if(!box)return;box.hidden=false;box.textContent=e.message;box.scrollIntoView({block:'nearest'});}
function challenge(){
 token='';if(!config.turnstileSiteKey||!$('#challenge'))return;
 if(window.turnstile){challengeId=window.turnstile.render('#challenge',{sitekey:config.turnstileSiteKey,callback:v=>token=v,'expired-callback':()=>token=''});return;}
 if(!document.querySelector('script[data-challenge]')){const s=document.createElement('script');s.dataset.challenge='true';s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=()=>challenge();document.head.append(s);}
}
function resetChallenge(){if(challengeId!==undefined&&window.turnstile)window.turnstile.reset(challengeId);}

// Landing copy is static HTML for a fast first paint; only a non-default angle swaps it.
function applyAngle(){
 const a=angles[angle];if(angle==='trust')return;
 $('#angle-headline').textContent=a.h;$('#angle-sub').textContent=a.sub;
 $('#angle-points').innerHTML=a.points.map(p=>`<li>${esc(p)}</li>`).join('');
}

function shell(top,body,modifier=''){
 if(challengeId!==undefined&&window.turnstile){window.turnstile.remove(challengeId);challengeId=undefined;}
 app.innerHTML=`<section class="flow ${modifier}" id="flow">${top}${body}<div class="error" id="flow-error" role="alert" hidden></div></section>`;
}
function progress(n){
 return `<div class="flow-top"><div class="flow-top-row">${n===1?'<button type="button" class="link" id="back">Back</button>':''}<span>Step ${n} of 2</span></div><div class="bar" aria-hidden="true"><span class="on"></span><span class="${n===2?'on':''}"></span></div></div>`;
}
function focusFirst(){
 const input=$('#flow input:not([type=checkbox])');
 if(input&&step==='contact'){input.focus({preventScroll:true});return;}
 const h=$('#flow h1');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true});}
}

function render(){
 if(step==='service')renderService();
 if(step==='contact')renderContact();
 if(step==='rate')renderRate();
 if(step==='quote')renderQuote();
 if(step==='done')renderDone();
 window.scrollTo({top:0,behavior:'auto'});focusFirst();
}

function renderService(){
 void track('ServiceViewed');
 shell(progress(1),`<h1>What does your car need?</h1><div class="svc-grid">${config.services.map((s,i)=>`<button type="button" class="svc" data-service="${esc(s.id)}" aria-pressed="${state.service===s.id}"><img src="${esc(s.image)}" alt="" width="600" height="450" loading="${i<4?'eager':'lazy'}" decoding="async"><span>${esc(s.name)}</span></button>`).join('')}</div>`);
 $('#back').onclick=()=>location.reload();
 document.querySelectorAll('#flow [data-service]').forEach(b=>b.onclick=()=>choose(b.dataset.service));
}
function choose(serviceId){
 if(!config.services.some(s=>s.id===serviceId))return;
 state.service=serviceId;step='contact';slide=0;render();
}

const slides=[
 {key:'firstName',q:()=> 'First, what’s your name?',label:'First name',type:'text',attrs:'autocomplete="given-name" maxlength="80" enterkeyhint="next"',check:v=>v.trim().length>0,err:'Enter your first name.'},
 {key:'email',q:()=>`Thanks, ${state.firstName.trim()}. Where should we email your local rate?`,label:'Email',type:'email',attrs:'autocomplete="email" inputmode="email" maxlength="254" enterkeyhint="next"',check:v=>/^\S+@\S+\.\S+$/.test(v.trim()),err:'Enter a valid email.'},
 {key:'phone',q:()=> 'Last one. What’s your mobile number?',label:'Mobile number',type:'tel',attrs:'autocomplete="tel" inputmode="tel" maxlength="30" enterkeyhint="done"',check:v=>/^(1)?\d{10}$/.test(v.replace(/\D/g,'')),err:'Enter a 10-digit US mobile number.'}
];
function contactSupport(){
 return `<aside class="contact-support" aria-label="Your price check and next steps"><p class="support-eyebrow">Know the price. Pick your next step.</p><h2>Your local price gauge</h2><p>See where local prices sit before you request a quote.</p><span class="support-service">${esc(service().name)}</span><div class="support-gauge" aria-hidden="true"></div><div class="support-ticks" aria-hidden="true"><span>Low</span><span>Typical</span><span>High</span></div><p class="support-range-note">Your estimated range appears after this step. A rough estimate, not a shop quote.</p><hr><h2>What happens next</h2><ol class="support-steps"><li><b>1</b>See your local price range.</li><li><b>2</b>Add your vehicle to request a quote.</li><li><b>3</b>Choose your preferred day and time.</li></ol><p class="support-eyebrow">Scheduling preferences</p><div class="support-schedule"><span>Morning</span><span>Midday</span><span>Evening</span></div><p class="support-schedule-note">Choose after your estimate. The shop confirms availability.</p><div class="support-deals"><strong>Local car care deals, straight to your email.</strong><p>Take advantage of local service deals and price alerts. Unsubscribe anytime.</p></div></aside>`;
}
function renderContact(){
 if(slide===0)void track('GateViewed');
 const s=slides[slide],last=slide===slides.length-1;
 const note=slide===1?`<p class="fine">${esc(config.newsletterConsent)}</p>`:last?`<p class="fine">${esc(config.copy['intake.contact.disclosure'])}</p>${legal}`:'';
 shell('',`<div class="contact-layout"><div class="contact-main">${progress(2)}<div class="dots" aria-hidden="true">${slides.map((_,i)=>`<span class="${i<=slide?'on':''}"></span>`).join('')}</div><form class="slide" id="slide" novalidate><h1>${esc(s.q())}</h1><label class="field">${esc(s.label)}<input name="${s.key}" type="${s.type}" value="${esc(state[s.key])}" required ${s.attrs}></label>${last?'<div id="challenge"></div>':''}<button class="btn">${last?'Show my local rate':'Next'}</button>${note}</form></div>${contactSupport()}</div>`,'contact-flow');
 if(last)challenge();
 $('#slide').onsubmit=async e=>{
  e.preventDefault();const value=$('#slide input').value;
  if(!s.check(value)){showError(Error(s.err));return;}
  state[s.key]=value.trim();
  if(!last){slide++;render();return;}
  const button=$('#slide button');button.disabled=true;
  try{
   const saved=await api('/api/intake',{id:id||requestId,service:state.service,firstName:state.firstName,email:state.email,phone:state.phone,source:state.source,disclosureVersion:'intake-contact-v1-local',turnstileToken:token});
   id=saved.id;pixel('Lead',saved.eventId);
   report=await api('/api/intake/rate',{id});step='rate';render();
  }catch(err){showError(err);button.disabled=false;resetChallenge();}
 };
}

function money(v){const smog=state.service==='smog';return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:smog?2:0,maximumFractionDigits:smog?2:0}).format(v);}
function monthLabel(){const [y,m]=config.localToday.split('-').map(Number);return new Date(Date.UTC(y,m-1,1)).toLocaleString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});}
function renderRate(){
 void track('ResultViewed');
 const r=report.range,name=service().name,lower=name.toLowerCase(),flat=r.low===r.high;
 shell('<p class="wordmark">Local Car Care</p>',`<h1>${esc(state.firstName)}, here’s what ${esc(lower)} runs locally.</h1>
<div class="label"><div class="label-head"><p>Local price label</p><p>${esc(monthLabel())}</p></div>
<div class="label-sec"><p class="k">Service</p><p class="v">${esc(name)}</p></div>
<div class="prices">${flat?`<div class="prices-row"><div></div><div><small>Typical</small><strong>${money(r.typical)}</strong></div><div></div></div>`:`<div class="prices-row"><div><small>Low</small><strong>${money(r.low)}</strong></div><div><small>Typical</small><strong>${money(r.typical)}</strong></div><div><small>High</small><strong>${money(r.high)}</strong></div></div><div class="track" aria-hidden="true"><span id="marker"></span></div>`}</div>
<div class="label-foot"><p>${esc(report.note)}</p><p class="fine">From published prices at local shops. A broad estimate, not a quote.</p></div></div>
<div class="panel"><h2>Get a real quote from a top-rated ${esc(lower)} shop near you.</h2><p class="sub">They text you a price for your car. You pick a time that works. No obligation.</p><button type="button" class="btn" id="want-quote">Text me a quote</button></div>
<p class="fine">We also emailed this to ${esc(state.email)}.</p>`);
 // CSP blocks inline style attributes, so the marker is positioned through the CSSOM.
 if(!flat)$('#marker').style.left=Math.max(0,Math.min(100,(r.typical-r.low)/(r.high-r.low)*100))+'%';
 $('#want-quote').onclick=()=>{step='quote';render();};
}

function days(){
 const [y,m,d]=config.localToday.split('-').map(Number);
 return Array.from({length:6},(_,i)=>{const t=new Date(Date.UTC(y,m-1,d+i));return {value:t.toISOString().slice(0,10),label:i===0?'Today':t.toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'})+' '+t.getUTCDate()};});
}
const windows=[['morning','Morning'],['midday','Midday'],['evening','Evening']];
async function loadMakes(){try{const names=await api('/api/vehicles');if($('#makes'))$('#makes').innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join('');}catch{}}
async function loadModels(){const v=++modelRequest;if(!state.make||!state.year)return;try{const names=await api('/api/vehicles?make='+encodeURIComponent(state.make)+'&year='+encodeURIComponent(state.year));if(v===modelRequest&&$('#models'))$('#models').innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join('');}catch{}}
function renderQuote(){
 void track('QuoteContactViewed');
 const years=Array.from({length:config.yearMax-1989},(_,i)=>config.yearMax-i);
 shell('<div class="flow-top-row"><button type="button" class="link" id="back">Back</button></div>',`<h1>Tell the shop about your car and when you’re free.</h1>
<form id="quote" novalidate>
<div class="row"><label class="field">Year<select name="year" required><option value="">Year</option>${years.map(y=>`<option ${String(y)===String(state.year)?'selected':''}>${y}</option>`).join('')}</select></label>
<label class="field">Make<input name="make" value="${esc(state.make)}" list="makes" autocomplete="off" maxlength="100" required></label></div>
<label class="field">Model<input name="model" value="${esc(state.model)}" list="models" autocomplete="off" maxlength="100" required></label><datalist id="makes"></datalist><datalist id="models"></datalist>
<fieldset><legend>Which day works?</legend><div class="chips">${days().map(d=>`<button type="button" class="chip" data-day="${d.value}" aria-pressed="${state.desiredDate===d.value}">${esc(d.label)}</button>`).join('')}</div></fieldset>
<fieldset><legend>What time of day?</legend><div class="chips">${windows.map(([v,l])=>`<button type="button" class="chip" data-time="${v}" aria-pressed="${state.timeWindow===v}">${l}</button>`).join('')}</div></fieldset>
<label class="check"><input type="checkbox" name="consent" ${state.consent?'checked':''} required>${esc(config.copy['pick.quote.consent'])}</label>
<div id="challenge"></div>
<button class="btn">Send to the shop</button>
<p class="fine">This is a request, not a booking. The shop confirms your time by text.</p>
</form>`);
 challenge();void loadMakes();if(state.make)void loadModels();
 const sync=()=>document.querySelectorAll('#quote [name]').forEach(el=>state[el.name]=el.type==='checkbox'?el.checked:el.value);
 $('#back').onclick=()=>{sync();step='rate';render();};
 $('[name=make]').onchange=()=>{sync();void loadModels();};$('[name=year]').onchange=()=>{sync();void loadModels();};
 const pickChip=(attr,key)=>document.querySelectorAll(`[data-${attr}]`).forEach(b=>b.onclick=()=>{state[key]=b.dataset[attr];document.querySelectorAll(`[data-${attr}]`).forEach(o=>o.setAttribute('aria-pressed',String(o===b)));});
 pickChip('day','desiredDate');pickChip('time','timeWindow');
 $('#quote').onsubmit=async e=>{
  e.preventDefault();sync();
  if(!state.year||!state.make.trim()||!state.model.trim()){showError(Error('Enter your car’s year, make and model.'));return;}
  if(!state.desiredDate){showError(Error('Choose a day that works.'));return;}
  if(!state.timeWindow){showError(Error('Choose a time of day.'));return;}
  if(!state.consent){showError(Error('Check the box so the shop can text you.'));return;}
  const button=$('#quote .btn');button.disabled=true;
  try{
   const result=await api('/api/intake/quote',{id,year:Number(state.year),make:state.make,model:state.model,desiredDate:state.desiredDate,timeWindow:state.timeWindow,consent:true,consentVersion:'pick-quote-v1',turnstileToken:token});
   pixel('QuoteRequest',result.eventId);step='done';render();
  }catch(err){showError(err);button.disabled=false;resetChallenge();}
 };
}

function renderDone(){
 void track('QuoteThanksViewed');
 const day=days().find(d=>d.value===state.desiredDate)?.label||state.desiredDate;
 shell('<p class="wordmark">Local Car Care</p>',`<h1>Sent. Watch for a text.</h1><p class="sub">We’re matching your ${esc(state.year)} ${esc(state.make)} ${esc(state.model)} with a top-rated local ${esc(service().name.toLowerCase())} shop. They’ll text ${esc(state.phone)} with a price and confirm ${esc(day==='Today'?'today':day)} ${esc({morning:'in the morning',midday:'around midday',evening:'in the evening'}[state.timeWindow]||'')}.</p><p class="fine">Your weekly local deals email is on its way too.</p>`);
}

async function init(){
 // Report emails from the older price checker link to /#request=; that flow now lives at /price-check.
 if(location.hash.startsWith('#request=')){location.replace('/price-check'+location.search+location.hash);return;}
 applyAngle();
 try{
  config=await api('/api/config');
  window.configureMetaPixel?.(config.metaPixelId);
  void api('/api/events',{name:'ViewContent',campaign:state.source.utm_campaign}).then(e=>pixel('ViewContent',e.eventId)).catch(()=>{});
  $('#start').onclick=()=>{void track('CheckStarted');step='service';render();};
  document.querySelectorAll('#landing [data-service]').forEach(b=>b.onclick=()=>{void track('CheckStarted');choose(b.dataset.service);});
 }catch(e){app.insertAdjacentHTML('afterbegin',`<p class="error">${esc(e.message||'This page is temporarily unavailable. Please refresh in a moment.')}</p>`);}
}
init();
