import test from 'node:test';import assert from 'node:assert/strict';import {reportEmail,diffLine} from '../server/report-copy.mjs';
test('smog email keeps the exact fee and state-station explanation',()=>{
 const explanation='Emissions tests at state test stations cost one set state fee. A higher quote is a shop markup, so you can test at a state station instead.';
 const report={verdict:'High',range:{low:16.15,typical:16.15,high:16.15},explanation},p={year:2024,model:'Camry',amount:40,option:'smog:obd'};
 const mail=reportEmail({name:'Test',email:'smog@example.test',p,report,service:'Smog check',link:'https://example.com/'});
 assert.match(mail.text,/Low: \$16\.15 Typical: \$16\.15 High: \$16\.15/);assert.ok(mail.text.includes(explanation));assert.ok(!mail.text.includes('film or product'));
});
test('campaign report email uses verdict, difference, sender and safe return button',()=>{
 const report={verdict:'High',range:{low:200,typical:350,high:500}},p={year:2024,model:'Camry',amount:849};
 const mail=reportEmail({name:'<Caesar>',email:'fixture@example.com',p,report,service:'Ceramic tint',link:'https://example.com/#request=token'});
 assert.equal(mail.senderName,'Caesar from Local Price Check');assert.equal(diffLine(report,849),"That's $499 more than the typical local price.");assert.match(mail.text,/Your quote: \$849 \(HIGH\)/);assert.match(mail.html,/&lt;Caesar&gt;/);assert.ok(!mail.html.includes('<Caesar>'));assert.match(mail.html,/Your quote came back HIGH/);
});
