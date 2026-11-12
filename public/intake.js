export function startIntake(config){
 const $=s=>document.querySelector(s),app=$('#app'),params=new URLSearchParams(location.search);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const C=key=>config.copy[key]||'';
 const state={service:'',firstName:'',email:'',phone:'',year:new Date().getFullYear(),make:'',model:'',desiredDate:'',source:Object.fromEntries(params)};
 let step=0,id,requestId=crypto.randomUUID(),token='',challengeId,report,modelRequest=0;
 const api=async(path,data)=>{const response=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}),value=await response.json();if(!response.ok)throw Error(value.error||'Please try again.');return value;};
 const track=name=>void api('/api/events',{name,campaign:state.source.utm_campaign}).catch(()=>{});
 const save=()=>document.querySelectorAll('#flow [name]').forEach(el=>state[el.name]=el.value);
 const field=(label,name,type='text',extra='')=>`<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(state[name])}" ${extra}></label>`;
 const legal=()=>'<p class="fine legal-links"><a href="/privacy" target="_blank">Privacy</a> · <a href="/terms" target="_blank">Terms</a></p>';
 const showError=e=>{$('#intake-error').hidden=false;$('#intake-error').textContent=e.message;$('#intake-error').scrollIntoView({block:'nearest'});};
 function challenge(){token='';if(!config.turnstileSiteKey)return;if(window.turnstile){challengeId=window.turnstile.render('#intake-challenge',{sitekey:config.turnstileSiteKey,callback:value=>token=value,'expired-callback':()=>token=''});return;}if(!document.querySelector('script[data-intake-challenge]')){const script=document.createElement('script');script.dataset.intakeChallenge='true';script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=()=>{if($('#intake-challenge'))challenge();};document.head.append(script);}}
 async function models(){const version=++modelRequest;try{const names=await api('/api/vehicles?make='+encodeURIComponent(state.make)+'&year='+encodeURIComponent(state.year));if(version===modelRequest&&$('#models'))$('#models').innerHTML=names.map(name=>`<option value="${esc(name)}"></option>`).join('');}catch{}}
 function render(){
  if(challengeId!==undefined&&window.turnstile){window.turnstile.remove(challengeId);challengeId=undefined;}
  document.body.classList.remove('gate-open');document.body.classList.toggle('after-gate',step===3);
  app.innerHTML=`<section class="wizard" id="flow"><div class="step-top"><button class="back" id="intake-back" aria-label="Back">←</button>${step<3?`<span>Step ${step+1} of 3</span>`:''}</div><div class="progress"><span class="campaign-progress-${Math.min(step+1,3)}"></span></div><div id="intake-screen"></div><div class="error" id="intake-error" role="alert" hidden></div></section>`;
  $('#intake-back').onclick=()=>{save();if(step===0){location.href=location.pathname+location.search;return;}step--;render();};
  const screen=$('#intake-screen');
  if(step===0){
   track('ServiceViewed');screen.innerHTML=`<h1>${esc(C('svc.q'))}</h1><div class="service-photo-grid">${config.services.map((service,i)=>`<button type="button" class="service-photo-card" aria-label="${esc(service.name)}" data-service="${esc(service.id)}"><img src="${esc(service.image)}" alt="${esc(service.name)}" width="600" height="450" loading="${i<2?'eager':'lazy'}" decoding="async"><strong>${esc(service.name)}</strong></button>`).join('')}</div>`;
   document.querySelectorAll('[data-service]').forEach(button=>button.onclick=()=>{if(state.service!==button.dataset.service){id=undefined;requestId=crypto.randomUUID();}state.service=button.dataset.service;step=1;render();});
  }
  if(step===1){
   track('GateViewed');screen.innerHTML=`<h1>${esc(C('intake.contact.headline'))}</h1><p class="sub">${esc(config.services.find(s=>s.id===state.service).name)}</p><form id="intake-contact">${field('First name','firstName','text','required autocomplete="given-name" maxlength="80"')}${field('Email','email','email','required autocomplete="email" maxlength="254"')}${field('Phone number','phone','tel','required autocomplete="tel" inputmode="tel" maxlength="30"')}<div id="intake-challenge"></div><button class="primary">${esc(C('intake.contact.cta'))}</button><p class="fine">${esc(C('intake.contact.disclosure'))}</p><p class="fine newsletter-disclosure">${esc(config.newsletterConsent)}</p>${legal()}</form>`;
   challenge();$('#intake-contact').onsubmit=async event=>{event.preventDefault();const oldEmail=state.email;save();const button=event.target.querySelector('button');button.disabled=true;try{if(id&&oldEmail!==state.email){id=undefined;requestId=crypto.randomUUID();}const result=await api('/api/intake',{...state,id:id||requestId,disclosureVersion:'intake-contact-v1-local',turnstileToken:token});id=result.id;if(window.fbq)window.fbq('track','Lead',{},{eventID:result.eventId});step=2;render();}catch(e){showError(e);button.disabled=false;if(challengeId!==undefined&&window.turnstile)window.turnstile.reset(challengeId);}};
  }
  if(step===2){
   track('VehicleViewed');screen.innerHTML=`<h1>${esc(C('veh.q'))}</h1><form id="intake-vehicle"><label class="field">Year<select name="year">${Array.from({length:config.yearMax-1989},(_,i)=>config.yearMax-i).map(year=>`<option ${Number(state.year)===year?'selected':''}>${year}</option>`).join('')}</select></label>${field('Make','make','text','required list="makes" autocomplete="off" maxlength="100"')}<datalist id="makes"></datalist>${field('Model','model','text','required list="models" autocomplete="off" maxlength="100"')}<datalist id="models"></datalist>${field(C('intake.date.label'),'desiredDate','date',`required min="${esc(config.localToday)}"`)}<button class="primary">${esc(C('intake.estimate.cta'))}</button></form>`;
   void api('/api/vehicles').then(names=>{if($('#makes'))$('#makes').innerHTML=names.map(name=>`<option value="${esc(name)}"></option>`).join('');}).catch(()=>{});
   const lookup=()=>{save();void models();};$('[name=make]').onchange=lookup;$('[name=year]').onchange=lookup;if(state.make)void models();
   $('#intake-vehicle').onsubmit=async event=>{event.preventDefault();save();const button=event.target.querySelector('button');button.disabled=true;try{report=await api('/api/intake/estimate',{id,year:state.year,make:state.make,model:state.model,desiredDate:state.desiredDate});step=3;render();}catch(e){showError(e);button.disabled=false;}};
  }
  if(step===3){
   track('ResultViewed');const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:state.service==='smog'?2:0,maximumFractionDigits:state.service==='smog'?2:0}).format(value);
   screen.innerHTML=`<h1>${esc(C('intake.estimate.headline'))}</h1><p class="sub">${esc(report.service)} · ${esc(report.year)} ${esc(report.make)} ${esc(report.model)}</p><div class="range"><div><small>Low</small><strong>${money(report.range.low)}</strong></div><div><small>Typical</small><strong>${money(report.range.typical)}</strong></div><div><small>High</small><strong>${money(report.range.high)}</strong></div></div><p class="sub">${esc(report.note)}</p><p>${esc(C('intake.date.label'))}: <strong>${esc(report.desiredDate)}</strong></p><p class="fine">${esc(C('intake.date.notice'))}</p>`;
  }
  window.scrollTo({top:0,behavior:'auto'});screen.querySelector('h1')?.setAttribute('tabindex','-1');screen.querySelector('h1')?.focus({preventScroll:true});
 }
 render();
}
