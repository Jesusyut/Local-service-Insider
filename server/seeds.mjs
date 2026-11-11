// Published asking prices checked 2026-11-11. These are research seeds, not customer quotes.
export const market='san-diego';
const sources={
 tint:'https://coastaltintsd.com/blog/window-tint-cost-san-diego-2026',
 windshield:'https://sandiegoautomotivewindowtint.com/book',
 coating:'https://carbixautodetailing.com/guides/ceramic-coating-cost-san-diego',
 fresh:'https://www.fresh-layer.com/ceramic-coating-san-diego',
 alchemy:'https://autoalchemymobiledetailing.com/services/ceramic-coating-san-diego/',
 detail:'https://www.drivendetailers.org/',
 delmar:'https://delmardetailing.com/detailing',
 zs:'https://www.zscleansandiego.com/pricing'
};
export const seedRanges=[];
function add(option,type,prices,urls,note){const p=[...prices].sort((a,b)=>a-b),mid=(p.length-1)/2;seedRanges.push({option,type,low:p[0],typical:Math.round((p[Math.floor(mid)]+p[Math.ceil(mid)])/2),high:p.at(-1),sourceNote:`San Diego; checked 2026-11-11. ${note} Published asking/starting prices; typical is the sample median, not a market survey. ${urls.join(' ')}`});}
// Installer's published local bands span body sizes. Do not invent body-size multipliers.
for(const type of ['sedan','coupe','suv','truck'])add('tint:all',type,[189,279,279,399],[sources.tint],'Dyed/carbon side-and-rear coverage; broad installer guide, not size-specific.');
for(const type of ['sedan','suv','truck']){
 add('ceramic-tint:all',type,[350,429,699],[sources.windshield,sources.tint],'Side/rear ceramic: $350 booking plus installer $429–699 band. Broad guide includes multiple film tiers.');
 add('ceramic-tint:windshield',type,[180,199],[sources.windshield,sources.tint],'Ceramic windshield: $180 booking and guide starting price $199.');
}
for(const type of ['sedan','coupe','suv','truck']){
 const small=type==='sedan'||type==='coupe',suv=type==='suv';
 // Coupe has explicitly published Carbix values; no Fresh Layer sedan values are assigned to it.
 if(type!=='coupe')add('coating:1-year',type,small?(type==='coupe'?[250,350]:[250,599]):suv?[350,430,649]:[430,530,699],[sources.coating,...(type==='coupe'?[]:[sources.fresh])],'Exterior paint coating. Body-size categories and preparation differ; correction can cost extra. Coupe band includes optional full-body scope.');
 add('coating:3-year',type,small?(type==='coupe'?[499.99,799]:[499.99,799,799]):suv?[599.99,799.99,849,899]:[799.99,899,899],[sources.coating,sources.alchemy,...(type==='coupe'?[]:[sources.fresh])],'Exterior coating; small/large SUV and truck categories span listed sizes. Correction/preparation varies.');
 add('coating:5-year',type,small?[649.99,1099]:suv?[749.99,849.99,1199]:[849.99,1149.99,1199],[sources.coating,sources.alchemy],'Five-year exterior coating; advertised preparation varies.');
 const full=type==='coupe'?[200,225,299]:type==='sedan'?[225,230,299]:suv?[250,275,290,339]:[275,290,339];
 add('detail:full',type,full,[sources.detail,sources.delmar,sources.zs],'Full interior/exterior detail. Excludes maintenance-only packages, restoration and coating bundles.');
}
export const seedFallbacks=['sedan','coupe','suv','truck'].map(type=>{const r=seedRanges.filter(r=>r.type===type&&r.option.startsWith('coating:'));const p=r.map(r=>r.typical).sort((a,b)=>a-b);return {service:'coating',type,low:Math.min(...r.map(r=>r.low)),typical:Math.round((p[Math.floor((p.length-1)/2)]+p[Math.ceil((p.length-1)/2)])/2),high:Math.max(...r.map(r=>r.high)),sourceNote:'San Diego coating seed ranges pooled across 1/3/5-year duration. Broad fallback for unspecified duration. See individual seed source notes.'};});
export async function loadSeeds(query){for(const r of seedRanges)await query('INSERT INTO market_price_ranges(market,service_option_id,vehicle_type,low,typical,high,source_note,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(market,service_option_id,vehicle_type) DO NOTHING',[market,r.option,r.type,r.low,r.typical,r.high,r.sourceNote,'2026-11-11']);for(const r of seedFallbacks)await query('INSERT INTO market_service_ranges(market,service_id,vehicle_type,low,typical,high,source_note,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(market,service_id,vehicle_type) DO NOTHING',[market,r.service,r.type,r.low,r.typical,r.high,r.sourceNote,'2026-11-11']);}
