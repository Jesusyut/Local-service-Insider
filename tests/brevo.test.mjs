import test from 'node:test';import assert from 'node:assert/strict';import {brevoAttributes,brevoPayload,syncBrevoContact} from '../server/brevo.mjs';
const contact={email:'driver@example.test',firstName:'Driver',phone:'6195550100',service:'Oil change',serviceId:'oil',stage:'contact_captured',source:{utm_campaign:'test'}};
test('Brevo contact payload adds the lead list without resubscribing or enrolling in SMS',()=>{
 const p=brevoPayload(contact,{leadListId:'12',completeListId:'13'});assert.deepEqual(p.listIds,[12]);assert.equal(p.updateEnabled,true);assert.equal(p.forceMerge,false);assert.equal(p.attributes.LPC_PHONE,'+16195550100');assert.equal(p.attributes.SMS,undefined);assert.equal(p.emailBlacklisted,undefined);assert.equal(p.smsBlacklisted,undefined);assert.equal(p.attributes.LPC_SERVICE,'Oil change');assert.equal(p.attributes.LPC_STAGE,'contact_captured');
 assert.throws(()=>brevoPayload(contact,{leadListId:'bad'}));assert.throws(()=>brevoPayload(contact,{leadListId:'0'}));
});
test('completed estimate enriches the same contact and optional completion list',()=>{
 const p=brevoPayload({...contact,stage:'estimate_completed',year:2024,make:'Honda',model:'Civic',desiredDate:'2026-12-01',range:{low:45,typical:70,high:130}},{leadListId:12,completeListId:13});assert.equal(p.email,contact.email);assert.deepEqual(p.listIds,[12,13]);assert.equal(p.attributes.LPC_VEHICLE,'2024 Honda Civic');assert.equal(p.attributes.LPC_DESIRED_DATE,'2026-12-01');assert.equal(p.attributes.LPC_ESTIMATE_TYPICAL,70);
});
test('Brevo sync creates missing fields, uses api-key authentication, and upserts once per call',async()=>{
 const calls=[],attributes=[];const fetchImpl=async(url,options)=>{calls.push({url,options});assert.equal(options.headers['api-key'],'fixture-key');assert.equal(options.headers.Authorization,undefined);if(options.method==='GET'&&!url.endsWith('/contacts/attributes'))return {ok:false,status:404};if(options.method==='GET')return {ok:true,json:async()=>({attributes:[...attributes]})};if(url.includes('/contacts/attributes/normal/')){attributes.push({name:url.split('/').at(-1),type:JSON.parse(options.body).type});}return {ok:true,status:201};};
 await syncBrevoContact(contact,{apiKey:'fixture-key',leadListId:12,fetchImpl});assert.equal(attributes.length,Object.keys(brevoAttributes).length);assert.equal(calls.at(-1).url,'https://api.brevo.com/v3/contacts');assert.equal(JSON.parse(calls.at(-1).options.body).email,contact.email);
 const before=calls.length;await syncBrevoContact(contact,{apiKey:'fixture-key',leadListId:12,fetchImpl});assert.equal(calls.length,before+2);
});
test('Brevo errors do not expose keys or contact details',async()=>{
 await assert.rejects(syncBrevoContact(contact,{apiKey:'secret-fixture',leadListId:12,fetchImpl:async()=>({ok:false,status:401})}),{message:'Brevo returned HTTP 401'});
});

test('existing contacts use attribute-only updates so unsubscribe settings remain unchanged',async()=>{let saved;await syncBrevoContact(contact,{apiKey:'existing-contact-fixture',leadListId:12,fetchImpl:async(url,options)=>{if(url.endsWith('/contacts/attributes'))return {ok:true,json:async()=>({attributes:Object.entries(brevoAttributes).map(([name,type])=>({name,type}))})};if(options.method==='GET')return {ok:true,status:200,json:async()=>({emailBlacklisted:true})};assert.equal(options.method,'PUT');saved=JSON.parse(options.body);return {ok:true,status:204};}});assert.deepEqual(Object.keys(saved).sort(),['attributes','listIds']);});
