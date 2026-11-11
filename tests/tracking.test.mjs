import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('Meta queues initial events and dispatches later conversions after the SDK loads',()=>{
 const scripts=[],context={window:{},document:{createElement:()=>({}),head:{append:s=>scripts.push(s)}}};vm.runInNewContext(readFileSync(new URL('../public/tracking.js',import.meta.url),'utf8'),context);
 context.window.configureMetaPixel('123456789');const fbq=context.window.fbq;assert.equal(scripts[0].src,'https://connect.facebook.net/en_US/fbevents.js');assert.equal(fbq.queue[0][0],'init');fbq('track','ViewContent',{},{eventID:'view-id'});assert.equal(fbq.queue[1][3].eventID,'view-id');
 const calls=[];fbq.callMethod=(...args)=>calls.push(args);fbq('track','Lead',{},{eventID:'lead-id'});fbq('trackCustom','QuoteRequest',{},{eventID:'quote-id'});assert.equal(calls[0][1],'Lead');assert.equal(calls[0][3].eventID,'lead-id');assert.equal(calls[1][1],'QuoteRequest');assert.equal(calls[1][3].eventID,'quote-id');assert.equal(fbq.queue.length,2);
});
