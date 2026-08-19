(function(){
'use strict';
var interest=document.getElementById('campaign_interest'),links=document.querySelectorAll('[data-interest]');
if(interest&&links.length)[].forEach.call(links,function(link){link.addEventListener('click',function(){interest.value=link.getAttribute('data-interest')||'Pricing page inquiry'})});
var form=document.getElementById('quoteForm');if(!form)return;
var state=document.getElementById('formstate'),rules={name:function(v){return v.trim().length>=2},phone:function(v){var d=v.replace(/\D/g,'');return d.length===10||(d.length===11&&d[0]==='1')},website:function(v){return v.trim().length>0}};
function error(input,bad){var message=document.getElementById(input.id+'-error');input.setAttribute('aria-invalid',bad?'true':'false');if(message)message.classList.toggle('show',bad)}
function valid(){var ok=true;Object.keys(rules).forEach(function(id){var input=form.elements[id],good=rules[id](input.value);error(input,!good);if(!good)ok=false});return ok}
form.addEventListener('submit',function(event){event.preventDefault();state.textContent='';if(!valid()){var bad=form.querySelector('[aria-invalid=true]');if(bad)bad.focus();return}var button=form.querySelector('button[type=submit]'),label=button.innerHTML,data=new FormData(form);data.append('submitted_at',new Date().toISOString());data.append('page_url',window.location.href);button.disabled=true;button.textContent='Sending…';fetch(FORM_ENDPOINT,{method:'POST',body:data,mode:'no-cors'}).then(function(){form.reset();state.textContent=form.getAttribute('data-success')||'We received your campaign request. We’ll text next steps within 24 hours.';if(typeof window.fbq==='function')window.fbq('track','Lead')}).catch(function(){state.textContent='We couldn’t send that right now. Check your connection and try again.'}).then(function(){button.disabled=false;button.innerHTML=label})});
})();
