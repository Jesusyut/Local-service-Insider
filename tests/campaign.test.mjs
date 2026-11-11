import test from 'node:test';import assert from 'node:assert/strict';import {services,types,copy} from '../server/catalog.mjs';import {seedRanges,seedFallbacks} from '../server/seeds.mjs';import {readFileSync,statSync} from 'node:fs';
test('seven ordered photo services match the deck, and all options have positive exact or service-fallback seeds',()=>{
 assert.deepEqual(services.map(s=>s.name),['Window tint','Mobile detailing','Ceramic coating','Body shop','Starlight headliner','Oil change','Custom lighting']);
 for(const s of services){assert.equal(s.name,copy['svc.card.'+s.copyId]);assert.equal(s.question,copy['svc.opt.'+s.copyId]);for(const [option]of s.options)for(const type of types){const r=seedRanges.find(r=>r.option===s.id+':'+option&&r.type===type)||seedFallbacks.find(r=>r.service===s.id&&r.type===type);assert.ok(r,`${s.id}:${option}/${type}`);assert.ok(r.low>0&&r.low<=r.typical&&r.typical<=r.high);}}
 assert.equal(copy['gate.disclosure'],"You'll also get our free weekly Phoenix deals. Unsubscribe anytime.");
});
test('all service images are local compressed WebP assets',()=>{
 for(const s of services){const p=new URL('../public'+s.image,import.meta.url);const bytes=readFileSync(p);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(statSync(p).size<60000);}
});
