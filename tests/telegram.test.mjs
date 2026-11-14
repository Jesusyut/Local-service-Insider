import test from 'node:test';
import assert from 'node:assert/strict';
import {telegramText,sendTelegramLead} from '../server/telegram.mjs';
test('Telegram alert includes the shown price range with concise lead fields as plain text',async()=>{
 const lead={id:'fixture',stage:'Quote requested',firstName:'Test',email:'driver@example.test',phone:'6195550100',service:'Window tint',year:2024,make:'Honda',model:'Civic',desiredDate:'2026-12-01',timeWindow:'morning',contactConsent:'Agreed',newsletterConsent:'Weekly deals',range:{low:100,typical:200,high:300},source:{utm_campaign:'test'}};
 const message=telegramText(lead);assert.equal(message,['Local Car Care lead','Event: Quote requested','Request: fixture','Name: Test','Email: driver@example.test','Phone: 6195550100','Service: Window tint','Year: 2024','Make: Honda','Model: Civic','Desired date: 2026-12-01','Preferred time: morning','Estimate low: $100','Estimate typical: $200','Estimate high: $300'].join('\n'));
 let payload;await sendTelegramLead(lead,{token:'fixture-token',chatId:'fixture-chat',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.telegram.org/botfixture-token/sendMessage');payload=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true})};}});assert.equal(payload.chat_id,'fixture-chat');assert.equal(payload.parse_mode,undefined);assert.equal(payload.link_preview_options.is_disabled,true);
});
test('Telegram omits unavailable ranges and matches displayed smog precision',()=>{
 for(const range of [undefined,{low:null,high:100},{low:100,high:NaN},{low:300,high:100}])assert.ok(!telegramText({range}).includes('Estimate low:'));
 assert.match(telegramText({service:'Smog check',range:{low:58,typical:58,high:98}}),/Estimate low: \$58\.00\nEstimate typical: \$58\.00\nEstimate high: \$98\.00/);
 assert.match(telegramText({range:{low:60,typical:60,high:60}}),/Estimate low: \$60\nEstimate typical: \$60\nEstimate high: \$60/);
});
test('Telegram errors never expose credential-bearing URLs or provider messages',async()=>{
 await assert.rejects(sendTelegramLead({firstName:'Test'},{token:'secret',chatId:'chat',fetchImpl:async()=>{throw Error('https://api.telegram.org/botsecret/sendMessage');}}),{message:'Telegram request failed'});
 await assert.rejects(sendTelegramLead({},{token:'secret',chatId:'chat',fetchImpl:async()=>({ok:false,status:401})}),{message:'Telegram returned HTTP 401'});
});
