import test from 'node:test';import assert from 'node:assert/strict';import {reportEmail,diffLine} from '../server/report-copy.mjs';
test('smog email keeps the San Diego range and variable-fee explanation',()=>{
 const explanation='California shop fees vary; ask what is included.';
 const report={verdict:'High',range:{low:58,typical:58,high:78},explanation},p={year:2024,model:'Camry',amount:40,option:'smog:obd'};
 const mail=reportEmail({name:'Test',email:'smog@example.test',p,report,service:'Smog check',link:'https://example.com/'});
 assert.match(mail.text,/Low: \$58\.00 Typical: \$58\.00 High: \$78\.00/);assert.ok(mail.text.includes(explanation));assert.ok(!mail.text.includes('film or product'));
});
test('campaign report email uses verdict, difference, sender and safe return button',()=>{
 const report={verdict:'High',range:{low:200,typical:350,high:500}},p={year:2024,model:'Camry',amount:849};
 const mail=reportEmail({name:'<Caesar>',email:'fixture@example.com',p,report,service:'Ceramic tint',link:'https://example.com/#request=token'});
 assert.equal(mail.senderName,'Caesar from Local Price Check');assert.equal(diffLine(report,849),"That's $499 more than the typical local price.");assert.match(mail.text,/Your quote: \$849 \(HIGH\)/);assert.match(mail.html,/&lt;Caesar&gt;/);assert.ok(!mail.html.includes('<Caesar>'));assert.match(mail.html,/Your quote came back HIGH/);
});
