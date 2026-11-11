import test from 'node:test';import assert from 'node:assert/strict';import {reportEmail,diffLine} from '../server/report-copy.mjs';
test('campaign report email uses verdict, difference, sender and safe return button',()=>{
 const report={verdict:'High',range:{low:200,typical:350,high:500}},p={year:2024,model:'Camry',amount:849};
 const mail=reportEmail({name:'<Caesar>',email:'fixture@example.com',p,report,service:'Ceramic tint',link:'https://example.com/#request=token'});
 assert.equal(mail.senderName,'Caesar from San Diego Car Care Deals');assert.equal(diffLine(report,849),"That's $499 more than the typical San Diego price.");assert.match(mail.text,/Your quote: \$849 \(HIGH\)/);assert.match(mail.html,/&lt;Caesar&gt;/);assert.ok(!mail.html.includes('<Caesar>'));assert.match(mail.html,/Your quote came back HIGH/);
});
