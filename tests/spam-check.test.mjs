import test from 'node:test';import assert from 'node:assert/strict';import {createSpamCheck} from '../server/spam-check.mjs';
test('unconfigured or incomplete Turnstile never blocks submissions or displays a broken widget',async()=>{
 for(const keys of [{},{siteKey:'public-only'},{secretKey:'secret-only'}]){
  const check=createSpamCheck({...keys,fetchImpl:()=>assert.fail('Disabled check must not make a network request')});assert.equal(check.siteKey,'');await check.verify();
 }
});
test('fully configured Turnstile verifies tokens and rejects missing or invalid tokens',async()=>{
 let calls=0;const check=createSpamCheck({siteKey:'public',secretKey:'private',fetchImpl:async(url,options)=>{calls++;assert.equal(options.body.get('secret'),'private');return {ok:true,json:async()=>({success:options.body.get('response')==='valid'})};}});
 assert.equal(check.siteKey,'public');await assert.rejects(check.verify(),{status:400});assert.equal(calls,0);await assert.rejects(check.verify('invalid'),{status:400});await check.verify('valid');assert.equal(calls,2);
});
