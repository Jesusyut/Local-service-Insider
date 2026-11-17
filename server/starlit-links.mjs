// Personal Starlit checkout links for starlight contacts (used in Brevo emails and texts).
const times={morning:'Morning',midday:'Midday',evening:'Afternoon',afternoon:'Afternoon'};
export const starlitBase=()=>(process.env.STARLIGHT_PUBLIC_URL||((process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'http://localhost:3000').replace(/\/$/,'')+'/starlit'));
export function starlitLink(raw={}){
 const c=tidyLead(raw),p=new URLSearchParams();
 const set=(k,v)=>{if(v!==undefined&&v!==null&&String(v).trim())p.set(k,String(v).trim());};
 set('name',c.firstName);set('year',c.year);set('make',c.make);set('model',c.model);
 set('email',c.email);set('phone',String(c.phone||'').replace(/\D/g,'').slice(-10));
 if(/^\d{4}-\d{2}-\d{2}$/.test(c.desiredDate||''))set('date',c.desiredDate);
 set('time',times[String(c.timeWindow||'').toLowerCase()]);
 p.set('stars',String(c.stars||500));p.set('code','INSIDER');
 return starlitBase()+'?'+p.toString().replace(/\+/g,'%20');
}
const usd=v=>Number.isFinite(Number(v))&&Number(v)>0?'$'+Math.round(Number(v)).toLocaleString('en-US'):'';
export const priceText=usd;

// Tidy hand-typed lead fields: "Antoni (Salim)" -> "Antoni", "angelina" -> "Angelina",
// make "Kia GT Line K5" with model "K5 GT Line" -> "Kia".
export function tidyLead(c={}){
 const name=String(c.firstName||'').replace(/\(.*?\)/g,'').trim().split(/\s+/)[0]||'';
 const model=String(c.model||'').trim(),makeWords=String(c.make||'').trim().split(/\s+/).filter(Boolean);
 const modelWords=new Set(model.toLowerCase().split(/\s+/));
 const make=makeWords.length>1&&makeWords.slice(1).every(w=>modelWords.has(w.toLowerCase()))?makeWords[0]:makeWords.join(' ');
 return {...c,firstName:name?name[0].toUpperCase()+name.slice(1):'',make,model};
}
export const starlitOrigin=()=>new URL(starlitBase()).origin;
