// Public, server-rendered San Diego service guide. No Phoenix price data is used.
export const seoServices=[
  {
    "id": "tint",
    "slug": "window-tint",
    "name": "Window tint",
    "image": "tint",
    "intro": "Compare window tint installers in San Diego by the glass covered, the film product and the installation warranty. A two-window job and a full-vehicle package are different scopes, even when both are advertised as tint.",
    "factors": "Windows covered, existing-film removal, film specification and difficult glass shapes.",
    "ask": [
      "Which windows and film product are included?",
      "Is removal of old film included?",
      "What does the installation warranty cover?"
    ]
  },
  {
    "id": "detail",
    "slug": "mobile-detailing",
    "name": "Mobile detailing",
    "image": "detail",
    "intro": "A mobile detailer comes to your location, but the package still matters. Describe whether you need interior cleaning, exterior care or both, and mention pet hair, stains or heavy buildup before comparing offers.",
    "factors": "Vehicle size, interior condition, cleaning depth and access at your location.",
    "ask": [
      "Is this maintenance cleaning or a deep detail?",
      "Are pet hair, stain treatment and extraction included?",
      "What parking, water or power access is needed?"
    ]
  },
  {
    "id": "coating",
    "slug": "ceramic-coating",
    "name": "Ceramic coating",
    "image": "ceramic",
    "intro": "Compare ceramic coating quotes by the preparation work as well as the coating. Ask what washing, decontamination and paint correction are included, which surfaces are treated and how the warranty is maintained.",
    "factors": "Paint condition, correction stages, surfaces covered, coating product and preparation time.",
    "ask": [
      "How much paint correction is included?",
      "Which coating and surfaces are specified?",
      "What curing and maintenance instructions apply?"
    ]
  },
  {
    "id": "body",
    "slug": "body-shop",
    "name": "Body shop & collision repair",
    "image": "body",
    "intro": "For a dent, damaged bumper or collision repair, ask for a written description of the repair rather than comparing a single headline price. Photos help start a conversation; an inspection may be needed to identify hidden damage.",
    "factors": "Damage extent, repair versus replacement, parts, paint blending and additional work found during inspection.",
    "ask": [
      "Does the estimate identify parts, labor and paint work?",
      "How will additional damage be approved?",
      "What are the estimated repair time and warranty terms?"
    ]
  },
  {
    "id": "starlight",
    "slug": "starlight-headliner",
    "name": "Starlight headliner",
    "image": "starlight",
    "intro": "For a starlight headliner installation in San Diego, compare the star count, pattern, controls and trim work. Shooting-star effects and new headliner material should be described separately so the finished result matches the quote.",
    "factors": "Headliner size and condition, star count, effects, material changes and installation complexity.",
    "ask": [
      "What star count, pattern and effects are included?",
      "Will the existing headliner material be reused?",
      "How are wiring, controls and interior trim handled?"
    ]
  },
  {
    "id": "oil",
    "slug": "mechanical-work",
    "name": "Mechanical work & oil changes",
    "image": "oil",
    "intro": "Describe the maintenance task or symptoms and provide your vehicle details when speaking with a repair shop. For an oil change, compare the required oil specification, oil quantity, filter and any additional fees.",
    "factors": "Diagnosis, required parts, labor, vehicle specifications and the scope of authorized repairs.",
    "ask": [
      "Is diagnosis charged separately from the repair?",
      "Which parts or fluid specifications are included?",
      "Will I receive a written estimate before work starts?"
    ]
  },
  {
    "id": "smog",
    "slug": "smog-check",
    "name": "Smog check",
    "image": "smog",
    "intro": "San Diego vehicles follow California’s Smog Check program. Check your DMV notice before booking and ask whether the station performs the inspection your vehicle needs. Use the California Bureau of Automotive Repair resources below to check a station.",
    "factors": "Vehicle and inspection requirements, station charges, certificate charges and any retest policy.",
    "ask": [
      "Does my notice require a STAR station?",
      "Does the advertised amount include certificate and other charges?",
      "What happens if the vehicle does not pass?"
    ]
  },
  {
    "id": "lighting",
    "slug": "custom-lighting",
    "name": "Custom lighting",
    "image": "lighting",
    "intro": "For ambient lighting, headlight work or exterior accents, define the components and desired result before requesting a quote. Interior appearance upgrades and road-use lighting need different conversations about fitment, wiring and suitable products.",
    "factors": "Components, wiring, trim access, controls, fitment and installation labor.",
    "ask": [
      "What components and installation work are included?",
      "How are wiring, fusing and controls handled?",
      "Is the proposed setup suitable for its intended use?"
    ]
  }
];
export const seoPath='/san-diego/car-care';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function siteOrigin(){const url=new URL(process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'https://phoenix-car-care-bvyc.onrender.com');if(!['https:','http:'].includes(url.protocol))throw Error('Invalid public URL');return url.origin;}
export function renderSearchPage(origin=siteOrigin()){
 const canonical=origin+seoPath;
 const schema={'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':canonical+'#publisher',name:'Local Service Insider',url:canonical},{'@type':'CollectionPage','@id':canonical,name:'Car Care Services in San Diego',url:canonical,inLanguage:'en-US',description:'Compare car care job scopes, questions to ask and service options in the San Diego area.',publisher:{'@id':canonical+'#publisher'},about:{'@type':'City',name:'San Diego'},mainEntity:{'@type':'ItemList',itemListElement:seoServices.map((s,i)=>({'@type':'ListItem',position:i+1,name:s.name,url:canonical+'#'+s.slug}))}}]};
 const cards=seoServices.map(s=>`<a class="service-card" href="#${s.slug}"><img src="/images/${s.image}.webp" width="600" height="450" alt="${s.name}" loading="lazy" decoding="async"><span>${s.name}<b aria-hidden="true">↗</b></span></a>`).join('');
 const guides=seoServices.map((s,i)=>`<article class="guide" id="${s.slug}"><div class="guide-label">0${i+1} / SERVICE GUIDE</div><div><h3>${s.name} in San Diego</h3><p>${s.intro}</p><h4>What changes the quote?</h4><p>${s.factors}</p><h4>Ask before you book</h4><ul>${s.ask.map(q=>'<li>'+q+'</li>').join('')}</ul>${s.id==='smog'?'<p class="source-note">Official guidance: <a href="https://www.bar.ca.gov/smog-check">California Smog Check program</a> and <a href="https://www.bar.ca.gov/locator">BAR shop locator</a>.</p>':''}<a class="text-link" href="#request" data-pick-service="${s.id}">Ask about ${s.name.toLowerCase()} <span aria-hidden="true">→</span></a></div></article>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Car Care Services in San Diego | Local Service Insider</title><meta name="description" content="Compare San Diego car care services: window tint, mobile detailing, ceramic coating, body repair, starlight headliners, smog checks and more. Know what to ask before booking."><meta name="theme-color" content="#173c36"><meta name="robots" content="index,follow"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="San Diego car care, without the guesswork."><meta property="og:description" content="Service guides, smarter questions and local follow-up from Local Service Insider."><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(origin)}/images/detail.webp"><link rel="preload" href="/fonts/barlow-semi-condensed-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/insider.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\u003c')}</script><script src="/insider.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="${seoPath}">Local Service<span>Insider.</span></a><nav aria-label="Main navigation"><a href="#services">Services</a><a href="#guides">Buying guides</a><a href="#questions">Questions</a><a class="nav-cta" href="#request">Get in touch ↗</a></nav></header><main id="main"><section class="hero"><div class="hero-copy"><p class="eyebrow">SAN DIEGO / CAR CARE</p><h1>Car care in<br>San Diego.</h1><p class="intro">Explore car care services in San Diego. Know what’s included, what changes a quote and what to ask before choosing a shop.</p><div class="hero-actions"><a class="button" href="#services">Find your service <span aria-hidden="true">↓</span></a><a class="text-link" href="#request">Tell us what you need ↗</a></div><div class="hero-note"><span>01 &nbsp; Compare the scope</span><span>02 &nbsp; Ask better questions</span><span>03 &nbsp; Plan your next step</span></div></div><div class="hero-photo"><img src="/images/detail.webp" width="600" height="450" alt="Car detailing service" fetchpriority="high"><div class="photo-caption"><span>THE SAN DIEGO GUIDE</span><strong>From everyday upkeep<br>to custom details.</strong></div></div></section><section id="services" class="section"><div class="section-heading"><div><p class="eyebrow">START WITH WHAT YOUR CAR NEEDS</p><h2>Eight ways to care for your car.</h2></div><p>Explore the service, then compare the details that make one quote different from another.</p></div><div class="service-grid">${cards}</div></section><section class="scope section"><p class="eyebrow">A SMARTER WAY TO COMPARE</p><h2>Same service name.<br>Different job.</h2><div class="scope-grid"><div><span>01</span><h3>Define the work.</h3><p>List the windows, surfaces, parts or repairs you want included. A clearly described job makes quotes easier to compare.</p></div><div><span>02</span><h3>Check the total.</h3><p>Ask about preparation, removal, materials, certificate charges and any additional fees before comparing offers.</p></div><div><span>03</span><h3>Confirm the handoff.</h3><p>Ask about appointment length, vehicle access, curing time and who confirms the final price and booking.</p></div></div></section><section id="guides" class="section"><div class="section-heading"><div><p class="eyebrow">THE DETAILS THAT MATTER</p><h2>San Diego car care service guides.</h2></div><p>Useful starting points for a conversation with an installer, detailer or repair shop. Read the guide without signing up.</p></div>${guides}</section><section class="local section"><div><p class="eyebrow">SAN DIEGO AREA</p><h2>Your neighborhood.<br>Your next step.</h2></div><div><p>Looking in central San Diego, La Jolla, Chula Vista, La Mesa, El Cajon or North County? Start with the kind of work you need. When we follow up, tell us your neighborhood so location and provider availability can be checked.</p><p>For mobile services, describe the parking or work area. For shop visits, ask about drop-off, pickup and how long the vehicle needs to stay.</p><p class="small">Submitting an inquiry does not confirm provider coverage, a quote or an appointment.</p></div></section><section id="request" class="request section"><div><p class="eyebrow">LET’S MAKE THE NEXT STEP EASIER</p><h2>What does your<br>car need?</h2><p>Send a San Diego service inquiry. We’ll use your contact details to follow up about your request.</p><p class="small">Local Service Insider is a service-information and inquiry platform, not a repair shop. This page does not publish verified San Diego price ranges or guarantee a provider match.</p><div class="request-benefit"><strong>Keep good local deals on your radar.</strong><p>You’ll also get price alerts and our weekly local deals. Unsubscribe anytime.</p></div></div><form id="insider-inquiry" method="post" action="/api/intake"><label>Service<select name="service" required><option value="">Choose a service</option>${seoServices.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('')}</select></label><label>First name<input name="firstName" autocomplete="given-name" maxlength="80" required></label><label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>Mobile number<input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" required></label><div id="insider-challenge"></div><button class="button" type="submit" disabled>Send my inquiry ↗</button><p class="small" id="contact-disclosure">We’ll use your number to follow up about this request. We won’t share it with shops unless you ask.</p><p class="small">You’ll also get price alerts and our weekly local deals. Unsubscribe anytime.</p><p class="small"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p><p id="inquiry-status" role="status" aria-live="polite">Loading the secure inquiry form…</p><noscript><p>Enable JavaScript to send an inquiry. All service guides remain available above.</p></noscript></form></section><section id="questions" class="section faq"><p class="eyebrow">BEFORE YOU BOOK</p><h2>A few useful answers.</h2><details><summary>How do I compare car care prices in San Diego?</summary><p>Compare written quotes for the same work: preparation, products or parts, labor, additional fees and warranty terms. Ask each provider to identify anything excluded. This guide explains the questions to ask; it does not present a verified local price database.</p></details><details><summary>Can I read the guides without giving my email?</summary><p>Yes. Every service guide and comparison checklist on this page is public. Contact details are only requested when you submit an inquiry.</p></details><details><summary>Will submitting the form book an appointment?</summary><p>No. It sends an inquiry to Local Service Insider. Provider availability, the final price and any appointment must be confirmed separately.</p></details><details><summary>Do I need a STAR smog check station?</summary><p>Check your California DMV notice to see whether a STAR station is required, then confirm with the station before booking. <a href="https://www.bar.ca.gov/smog-check">Read California’s official Smog Check guide.</a></p></details><details><summary>How can I check an auto repair shop?</summary><p>Ask for a written description of the work and warranty terms, and check the relevant business credentials. For California automotive repair and Smog Check businesses, start with the <a href="https://www.bar.ca.gov/locator">Bureau of Automotive Repair shop locator</a>.</p></details></section><section class="editorial section"><p class="eyebrow">ABOUT THIS GUIDE</p><h2>Local information. Clear expectations.</h2><p>Prepared by Local Service Insider. Updated November 13, 2026. The comparison checklists are general buying guidance, not inspections, quotes or endorsements. Official California resources are linked where inspection requirements are discussed.</p></section></main><footer><a class="brand" href="${seoPath}">Local Service<span>Insider.</span></a><p>San Diego car care guides &amp; service inquiries.</p><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="#request">Contact</a></div></footer></body></html>`;
}
