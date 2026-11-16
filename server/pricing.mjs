export function percentile(sorted,p){const i=(sorted.length-1)*p;const lo=Math.floor(i);return sorted[lo]+(sorted[Math.ceil(i)]-sorted[lo])*(i-lo);}
export function computeRange(values,seed=null){
  const sorted=values.filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);
  if(sorted.length<10)return seed?{...seed,source:'seed',samples:sorted.length}:null;
  const trim=Math.max(1,Math.floor(sorted.length*.05)); const clean=sorted.slice(trim,-trim);
  return {low:Math.round(percentile(clean,.2)),typical:Math.round(percentile(clean,.5)),high:Math.round(percentile(clean,.8)),source:'computed',samples:sorted.length};
}
export function verdict(amount,range){if(!range)return {verdict:'No data',explanation:'Not enough local data yet. Your submission helps build a better San Diego area price guide.'};if(amount===null)return {verdict:'Typical range',explanation:'See the current local range for this service and vehicle type.'};if(amount<range.low)return {verdict:'Low',explanation:'Below the local range. Ask what film or product they use and what is included.'};if(amount>range.high)return {verdict:'High',explanation:'Above the local range. Ask about preparation, warranty, and premium products.'};return {verdict:'Fair',explanation:'Your quote falls within the local range for this service and vehicle type.'};}
export function validZip(zip){return /^(919|920|921)\d{2}$/.test(zip);}

// Owner-configured expected add-ons, applied once to starlight base estimates.
// Keep the researched base prices intact; this is not a published shop fee.
export const starlightAddonAllowance=570;
export function withExpectedAddons(option,range){
 if(!range||!option.startsWith('starlight:')||range.addonAllowance===starlightAddonAllowance)return range;
 return {...range,low:Number(range.low)+starlightAddonAllowance,typical:Number(range.typical)+starlightAddonAllowance,high:Number(range.high)+starlightAddonAllowance,addonAllowance:starlightAddonAllowance,source_note:[range.source_note,`Includes owner-configured $${starlightAddonAllowance} expected add-on allowance.`].filter(Boolean).join(' ')};
}
