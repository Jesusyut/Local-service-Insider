// Builds a personal /starlit link for one customer. Nothing is saved.
const $=s=>document.querySelector(s),money=v=>'$'+Number(v).toLocaleString('en-US');
const cfg=await (await fetch('/api/starlight')).json(),code=await (await fetch('/api/starlight-code?code=INSIDER')).json().catch(()=>null);
let stars=750;const extras=new Set();
$('#stars').innerHTML=cfg.tiers.map(t=>`<button type="button" class="chip" data-s="${t.stars}">${t.stars}</button>`).join('');
$('#addons').innerHTML=cfg.addons.map(a=>`<button type="button" class="chip" data-a="${a.id}">${a.name}</button>`).join('');
$('#date').min=cfg.minDate;
function link(){
 const p=new URLSearchParams(),v=id=>$('#'+id).value.trim();
 for(const k of ['name','year','make','model','phone','email','date','time'])if(v(k))p.set(k,v(k));
 p.set('stars',stars);if(extras.size)p.set('addons',[...extras].join(','));if($('#code').checked&&code?.code)p.set('code',code.code);
 return location.origin+'/starlit?'+p.toString().replace(/\+/g,'%20');
}
function update(){
 document.querySelectorAll('#stars .chip').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.s)===stars)));
 document.querySelectorAll('#addons .chip').forEach(b=>b.setAttribute('aria-pressed',String(extras.has(b.dataset.a))));
 const t=cfg.tiers.find(x=>x.stars===stars),base=$('#code').checked&&code?code.prices[stars]:t.price;
 $('#price').textContent=money(base+cfg.addons.filter(a=>extras.has(a.id)).reduce((s,a)=>s+a.price,0));
 const l=link();$('#out').textContent=l;$('#open').href=l;
}
$('#stars').onclick=e=>{const b=e.target.closest('[data-s]');if(b){stars=Number(b.dataset.s);update();}};
$('#addons').onclick=e=>{const b=e.target.closest('[data-a]');if(b){extras.has(b.dataset.a)?extras.delete(b.dataset.a):extras.add(b.dataset.a);update();}};
$('#f').oninput=update;$('#f').onchange=update;
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(link());$('#msg').textContent='Copied. Paste it into your text or email.';}catch{$('#msg').textContent='Press and hold the link above to copy it.';}};
update();
