export const types=['sedan','coupe','suv','truck','van'];
export const services=[
 {id:'tint',name:'Window tint',icon:'◐',question:'Which windows?',options:[['all','Sides and back'],['full-strip','Full car with windshield strip'],['windshield','Windshield only']]},
 {id:'ceramic-tint',name:'Ceramic tint',icon:'☀',question:'Which windows?',options:[['all','Sides and back'],['full-strip','Full car with windshield strip'],['windshield','Windshield only']]},
 {id:'coating',name:'Ceramic coating',icon:'✧',question:'How long should it last?',options:[['1-year','1 year'],['3-year','3 years'],['5-year','5+ years'],['unsure','Not sure']]},
 {id:'ppf',name:'Paint protection film',icon:'◇',question:'How much coverage?',options:[['partial','Partial front'],['front','Full front'],['body','Full body']]},
 {id:'wrap',name:'Wrap',icon:'↗',question:'What kind of wrap?',options:[['full-color','Full color change'],['partial-color','Partial'],['full-commercial','Business wrap']]},
 {id:'detail',name:'Detailing',icon:'✺',question:'What kind of detail?',options:[['interior','Interior'],['exterior','Exterior'],['full','Full']]}
];
export const options=services.flatMap(s=>s.options.map(([id,name])=>({id:`${s.id}:${id}`,name,service:s.name,serviceId:s.id})));
export const drivers=['Vehicle size','Film or product brand','Warranty length','Prep work'];
export const newsletterConsent="You'll also get our free weekly San Diego deals. Unsubscribe anytime.";
export const leadConsent="By tapping Get My Quotes, I agree that up to 3 local car care shops may contact me by call or text about my request, including by automated means. Consent isn't required to buy. Msg and data rates may apply.";
