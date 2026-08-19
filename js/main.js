const FORM_ENDPOINT = "https://hooks.zapier.com/hooks/catch/22797974/4tdcudh/";
const SLOTS_REMAINING = 4;
const NEXT_DROP_DATE = "September 15, 2026";
const FALLBACK_PHONE = "";
const SERVICE_ZIPS = ["85224", "85225", "85226"];

(function(){
  "use strict";
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const progress=document.getElementById("readingProgress");
  const article=document.getElementById("guide");
  let framePending=false;

  function drawProgress(){
    framePending=false;
    if(!progress||!article||reduced.matches)return;
    const start=article.offsetTop;
    const distance=Math.max(1,article.offsetHeight-window.innerHeight);
    const value=Math.min(1,Math.max(0,(window.scrollY-start)/distance));
    progress.style.transform="scaleX("+value.toFixed(4)+")";
  }
  function requestProgress(){if(!framePending){framePending=true;window.requestAnimationFrame(drawProgress)}}
  if(progress&&article&&!reduced.matches){window.addEventListener("scroll",requestProgress,{passive:true});window.addEventListener("resize",requestProgress,{passive:true});requestProgress()}

  const reveals=document.querySelectorAll(".reveal");
  if(reduced.matches||!("IntersectionObserver" in window)){reveals.forEach(function(el){el.classList.add("is-visible")})}
  else{const observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target)}})},{threshold:.08,rootMargin:"0px 0px -7%"});reveals.forEach(function(el){observer.observe(el)})}

  const slotCount=document.getElementById("slotCount");
  const dropDate=document.getElementById("dropDate");
  if(slotCount)slotCount.textContent=SLOTS_REMAINING+" exclusive slots remain";
  if(dropDate){dropDate.textContent=NEXT_DROP_DATE;dropDate.setAttribute("datetime","2026-09-15")}

  const form=document.getElementById("offerForm");
  if(!form)return;
  form.action=FORM_ENDPOINT;
  const status=document.getElementById("formStatus");
  const messages={
    name:"Add your name so we know who the mockup is for.",
    phone:"Enter a 10-digit mobile number.",
    website:"Add your website or Facebook page.",
    trade:"Choose the trade you want the piece built for.",
    zipCodes:"Add at least one 5-digit ZIP code."
  };
  const rules={
    name:function(v){return v.trim().length>=2},
    phone:function(v){const d=v.replace(/\D/g,"");return d.length===10||(d.length===11&&d.charAt(0)==="1")},
    website:function(v){return v.trim().length>0},
    trade:function(v){return v.trim().length>0},
    zipCodes:function(v){return /(?:^|[\s,])\d{5}(?:-\d{4})?(?=$|[\s,])/.test(v.trim())}
  };
  function showError(input,invalid){
    const target=document.getElementById(input.id+"Error");
    input.setAttribute("aria-invalid",invalid?"true":"false");
    if(target)target.textContent=invalid?messages[input.id]:"";
  }
  function validate(){
    let valid=true;
    Object.keys(rules).forEach(function(id){const input=document.getElementById(id);const good=rules[id](input.value);showError(input,!good);if(!good)valid=false});
    return valid;
  }
  Object.keys(rules).forEach(function(id){const input=document.getElementById(id);input.addEventListener("blur",function(){showError(input,!rules[id](input.value))});input.addEventListener("input",function(){if(rules[id](input.value))showError(input,false)})});
  form.addEventListener("submit",function(event){
    event.preventDefault();status.textContent="";
    if(!validate()){const first=form.querySelector("[aria-invalid=true]");if(first)first.focus();return}
    const button=form.querySelector("button[type=submit]"),label=button.innerHTML,data=new FormData(form);
    data.append("submitted_at",new Date().toISOString());data.append("page_url",window.location.href);data.append("slots_remaining",String(SLOTS_REMAINING));data.append("next_drop_date",NEXT_DROP_DATE);
    button.disabled=true;button.textContent="Sending…";
    fetch(FORM_ENDPOINT,{method:"POST",body:data,mode:"no-cors"}).then(function(){
      form.reset();status.textContent="Received. Your free mockup and custom order size will arrive by text within 24 hours.";
      if(typeof window.fbq==="function")window.fbq("track","Lead");
    }).catch(function(){
      status.textContent=FALLBACK_PHONE?"We couldn’t send that. Text "+FALLBACK_PHONE+" and we’ll handle it directly.":"We couldn’t send that right now. Check your connection and try again.";
    }).then(function(){button.disabled=false;button.innerHTML=label});
  });
})();
