// Published California asking prices, not verified transactions or guaranteed ceilings.
export const market='san-diego-ca-v2';
export const estimateNotes={
 tint:'San Diego published tint packages across film tiers. Glass coverage, film, removal and tax affect the final quote.',
 detail:'San Diego published detailing packages, from basic cleaning to deep detail. Size, condition and scope affect the final quote.',
 coating:'San Diego published ceramic-coating packages across protection terms. Paint correction and vehicle size affect the final quote.',
 body:'San Diego published dent, bumper and repaint references. Structural collision repairs are excluded; damage inspection is required.',
 starlight:'Broader California reference from Lancaster, not a San Diego price survey. Star count, roof fitment and fabric affect the final quote.',
 oil:'San Diego oil-change reference only, up to five quarts. Other mechanical repairs require diagnosis and a written quote; extra oil, filters and tax may cost more.',
 smog:'San Diego published inspection prices include the $8.25 certificate. Shop fees vary; older or heavy-duty vehicles may cost more. Check your DMV notice for testing and STAR requirements.',
 lighting:'Broader California ambient-lighting reference from Ripon, not a San Diego price survey. Headlight upgrades and exterior lighting are excluded; fitment and extras need a quote.'
};
const S={tint:'https://www.sbmobiledetailing.com/services/mobile-window-tint',coastal:'https://coastaltintsd.com/pricing',detail:'https://awesomeguys-sd.com/pricing/',reflection:'https://reflectiondetailingsd.com/pricing/',coating:'https://www.adonisdetail.com/ceramic-coating-san-diego',body:'https://www.autopaintsd.com/pricing.html',paint:'https://www.autopaintsd.com/',dent:'https://bumperfixers.com/',stars:'https://www.starluxautos.com/',oil:'https://www.dualtoneauto.com/oil-change',smog:'https://www.montezumasmog.com/pricing',ambient:'https://interstellarinteriors.com/upgrade'};
export const seedRanges=[],seedFallbacks=[];
function note(service,urls,scope){return 'California research checked 2026-11-13. '+estimateNotes[service]+' '+scope+' Low/high are published reference points, not guaranteed limits; typical is a reference estimate, not a statistical median. '+urls.join(' ');}
function add(option,type,band,urls,scope){seedRanges.push({option,type,low:band[0],typical:band[1],high:band[2],sourceNote:note(option.split(':')[0],urls,scope)});}
function fallback(service,type,band,urls,scope){seedFallbacks.push({service,type,low:band[0],typical:band[1],high:band[2],sourceNote:note(service,urls,scope)});}
for(const type of ['sedan','coupe','suv','truck','van']){
 const car=['sedan','coupe'].includes(type),large=['truck','van'].includes(type),size=car?0:large?2:1;
 const tint=type==='coupe'?[189,349,549]:type==='sedan'?[219,399,599]:type==='truck'?[329,449,649]:[329,499,699];
 const fit=type==='van'?'Broader large-vehicle reference; no van-specific tint quote.':'Published side/back packages across carbon, dyed and ceramic film.';
 add('tint:all',type,tint,[S.tint,S.coastal],fit);
 add('tint:full-strip',type,tint.map(v=>v+79),[S.tint,S.coastal],'Composite side/back reference plus Coastal Tint posted $79 visor strip. '+fit);
 add('tint:windshield',type,[249,large?399:299,large?499:399],[S.tint,S.coastal],'Full windshield ceramic packages; van uses broader large-vehicle reference.');
 add('detail:interior',type,[[90,180,180],[90,220,220],[100,260,260]][size],[S.detail],'Basic and full interior starting packages; middle uses full interior. SUV uses medium size; large SUVs may cost more.');
 add('detail:exterior',type,[169,[180,210,240][size],285],[S.detail,S.reflection],'Exterior detail packages, excluding basic wash-only services.');
 add('detail:full',type,[[215,350,425],[215,400,510],[250,460,510]][size],[S.detail,S.reflection],'Combined interior/exterior packages vary in depth; large class includes full-size SUV/truck/van.');
 add('coating:1-year',type,[700,[700,800,900][size],900],[S.detail],'Awesome Guys 1-year S/M/L package references.');
 add('coating:3-year',type,[1100,[1100,1250,1400][size],1400],[S.detail],'Awesome Guys 3-year S/M/L package references.');
 add('coating:5-year',type,[1299,[1600,1800,2000][size],2000],[S.detail,S.coating],'Adonis 5-year starting package and Awesome Guys 5-year S/M/L references.');
 fallback('coating',type,[700,[1100,1250,1400][size],2000],[S.detail,S.coating],'Unspecified protection duration across 1/3/5-year packages.');
 for(const [option,band]of Object.entries({dent:[150,300,750],bumper:[350,475,600],paint:[1620,3240,4725]}))add('body:'+option,type,band,[S.body,S.paint,S.dent],'Broad damage/package reference reused across body types without invented size multipliers. Paint high is a premium-tier starting point, not a maximum. Bumper middle is the midpoint of the posted band.');
 for(const [option,band]of Object.entries({standard:[625,775,925],dense:[1150,1350,1600],shooting:[800,950,1100]}))add('starlight:'+option,type,band,[S.stars],'Lancaster installed packages: standard 500–900 stars, dense 1000–1500; shooting is standard plus posted $175 add-on. No invented body-size multiplier.');
 add('oil:blend',type,[59.95,59.95,59.95],[S.oil],'One shop posted synthetic-blend package, not a fixed market fee.');
 add('oil:synthetic',type,[79.95,79.95,79.95],[S.oil],'One shop posted full-synthetic package, not a fixed market fee.');
 fallback('oil',type,[59.95,69.95,79.95],[S.oil],'Blend/high-mileage/full-synthetic posted packages; formulation unspecified.');
 add('smog:obd',type,[58,58,type==='truck'?98:78],[S.smog],'Regular light-duty initial inspection plus certificate; spans 2000+ and older rates. Excludes coupons, RVs, reinspection, diesel-specific and heavy-duty charges.');
 add('lighting:ambient',type,[995,1195,1195],[S.ambient],'Ripon coupe/two-door and four-door base packages. Van uses broader large-vehicle reference; upgrades and extras are not included.');
}
export async function loadSeeds(query){for(const r of seedRanges)await query('INSERT INTO market_price_ranges(market,service_option_id,vehicle_type,low,typical,high,source_note,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(market,service_option_id,vehicle_type) DO NOTHING',[market,r.option,r.type,r.low,r.typical,r.high,r.sourceNote,'2026-11-13']);for(const r of seedFallbacks)await query('INSERT INTO market_service_ranges(market,service_id,vehicle_type,low,typical,high,source_note,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(market,service_id,vehicle_type) DO NOTHING',[market,r.service,r.type,r.low,r.typical,r.high,r.sourceNote,'2026-11-13']);}
