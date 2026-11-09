const config=window.CAMPAIGN;
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search),ad=params.get('ad')||'direct';
const leadTracking=window.createLocalInsiderLeadTracking({adSource:ad});
let lang='en';
try{lang=['en','es'].includes(params.get('lang'))?params.get('lang'):(localStorage.getItem('local-insider-language')==='es'?'es':'en');}catch{lang=params.get('lang')==='es'?'es':'en';}
let step=0,answers=[],contact={name:'',phone:'',email:''},website='',view='landing',errorKey='';
const copy=()=>window.LOCAL_INSIDER_COPY[lang];
const questions=[config.serviceQuestion?['What kind of business do you run?',['Home services','Professional services','Other local business'],'service']:['Do you have pets?',['Yes','No'],'pets'],['How many areas do you serve?',['1 service area','2+ service areas'],'areas'],['When would you like more appointments?',['This month','Next month','2+ months out'],'startWhen']];
$('#year').textContent=new Date().getFullYear();
function offer(){return '';}
function buttonText(button,text,arrow='↗'){button.replaceChildren(document.createTextNode(text+' '));const span=document.createElement('span');span.textContent=arrow;button.append(span);}
function localize(){
 const t=copy();document.documentElement.lang=lang;
 $('#headline').innerHTML=t.headline;$('#subheadline').textContent=t.subheadline(config.price,offer());
 document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=t[node.dataset.i18n]);
 document.querySelectorAll('[data-start]').forEach(button=>buttonText(button,t.apply,'→'));
 $('.brand').setAttribute('aria-label',t.home);$('.brand span').textContent=t.brand;
 $('#back').textContent=t.back;
 $('#close-privacy').textContent=t.close;$('#privacy h2').textContent=t.privacyTitle;
 $('#privacy p').replaceChildren(document.createTextNode(t.privacyBefore));

 document.querySelectorAll('[data-language]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.language===lang));});
 if(view==='quiz')render(false);else if(view==='success')success();
}
function setLanguage(next){
 if(leadTracking.busy||!['en','es'].includes(next))return;
 lang=next;try{localStorage.setItem('local-insider-language',lang);}catch{}
 const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);
 // A language choice is an in-page setting, not a route or a new PageView.
 localize();
}
document.querySelectorAll('[data-language]').forEach(button=>button.onclick=()=>setLanguage(button.dataset.language));
function privacy(e){e.preventDefault();if(config.privacyUrl){location.href=config.privacyUrl;return;}$('#privacy').showModal();}
$('#privacy-link').onclick=privacy;$('#close-privacy').onclick=()=>$('#privacy').close();
function render(focus=true){
 const t=copy();
 $('#step-label').textContent=t.step(step+1);$('#progress-fill').style.width=((step+1)*25)+'%';
 const root=$('#quiz-content');root.replaceChildren();
 const kicker=document.createElement('div');kicker.className='question-kicker';kicker.textContent=step<3?t.kicker:t.lastKicker;root.append(kicker);
 const h=document.createElement('h2');h.tabIndex=-1;h.textContent=step<3?t[questions[step][2]]:t.contact;root.append(h);
 if(step<3){
  questions[step][1].forEach(answer=>{const button=document.createElement('button');button.className='answer'+(answers[step]===answer?' selected':'');buttonText(button,t.answers[answer],'→');button.onclick=()=>{answers[step]=answer;step++;errorKey='';render();};root.append(button);});
 }else{
  // Labels are translated; field names and submitted answer values stay canonical.
  root.insertAdjacentHTML('beforeend','<form id="lead-form"><div class="honeypot" aria-hidden="true"><label><span data-field="blank"></span><input name="website" tabindex="-1" autocomplete="off"></label></div><label><span data-field="name"></span><input name="name" autocomplete="name" required maxlength="120"></label><label><span data-field="phone"></span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="(602) 555-0123"></label><label><span data-field="email"></span><input name="email" type="email" autocomplete="email" required maxlength="254"></label><p class="error" role="alert" id="form-error"></p><button class="primary form-submit" type="submit"></button><p class="consent"><span></span> <a href="#privacy" id="form-privacy"></a></p></form>');
  const form=$('#lead-form');form.querySelectorAll('[data-field]').forEach(node=>node.textContent=t[node.dataset.field]);
  form.elements.name.placeholder=t.namePlaceholder;form.elements.email.placeholder=t.emailPlaceholder;
  Object.keys(contact).forEach(key=>{form.elements[key].value=contact[key];form.elements[key].oninput=e=>{contact[key]=e.target.value;e.target.setCustomValidity('');};});
  form.elements.website.value=website;form.elements.website.oninput=e=>website=e.target.value;
  form.addEventListener('invalid',e=>{if(e.target.validity.valueMissing)e.target.setCustomValidity(copy().required);else if(e.target.validity.typeMismatch)e.target.setCustomValidity(copy().emailError);},true);
  buttonText(form.querySelector('button'),t.submit);$('.consent span').textContent=t.consent;$('#form-privacy').textContent=t.privacy;$('#form-privacy').onclick=privacy;
  $('#form-error').textContent=errorKey?t[errorKey]:'';
  form.onsubmit=async e=>{
   e.preventDefault();if(leadTracking.busy||leadTracking.completed)return;
   const digits=contact.phone.replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');
   if(!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)){form.elements.phone.setCustomValidity(copy().phoneError);form.elements.phone.reportValidity();return;}
   if(contact.name.trim().split(/\s+/).length<2){form.elements.name.setCustomValidity(copy().nameError);form.elements.name.reportValidity();return;}
   if(!config.webhook){errorKey='pending';$('#form-error').textContent=copy().pending;return;}
   const button=form.querySelector('button');
   const lead={website:form.elements.website.value,timestamp:new Date().toISOString(),name:contact.name.trim(),phone:'+1'+digits,email:contact.email.trim(),answers:Object.fromEntries(questions.map((q,i)=>[q[0],answers[i]]))};
   errorKey='';$('#form-error').textContent='';button.disabled=true;button.textContent=copy().sending;
   document.querySelectorAll('[data-language]').forEach(b=>b.disabled=true);
   try{await leadTracking.submit(config.webhook,lead);view='success';success();}
   catch{errorKey='failed';$('#form-error').textContent=copy().failed;button.disabled=false;buttonText(button,copy().submit);}
   finally{document.querySelectorAll('[data-language]').forEach(b=>b.disabled=false);}
  };
 }
 if(focus)h.focus({preventScroll:true});
}
function success(){
 const t=copy();$('.quiz-top').hidden=true;$('.progress').hidden=true;
 const root=$('#quiz-content');root.innerHTML='<div class="success-mark">✓</div><h2></h2><p class="success-body"></p><a class="primary calendar"></a>';
 root.querySelector('h2').textContent=t.success;root.querySelector('.success-body').textContent=t.successBody;
 buttonText($('.calendar'),t.book);$('.calendar').href=config.calendarUrl||'./';if(!config.calendarUrl){buttonText($('.calendar'),t.home);}
}
document.querySelectorAll('[data-start]').forEach(button=>button.onclick=()=>{view='quiz';$('#landing').hidden=true;$('#quiz').hidden=false;render();window.scrollTo(0,0);});
$('#back').onclick=()=>{if(step>0){step--;render();}else{view='landing';$('#landing').hidden=false;$('#quiz').hidden=true;}};
localize();
