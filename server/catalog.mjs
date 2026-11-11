export const types = ['sedan','coupe','suv','truck','van'];
export const services = [
  {id:'tint',name:'Window tint',description:'A cooler cabin. A cleaner look.',icon:'◐',options:[['front','Front two windows'],['all','All side & rear windows'],['windshield','Windshield only']]},
  {id:'ceramic-tint',name:'Ceramic tint',description:'Beat the Valley heat.',icon:'☀',options:[['front','Front two windows'],['all','All side & rear windows'],['windshield','Windshield only']]},
  {id:'coating',name:'Ceramic coating',description:'Gloss that goes the distance.',icon:'✧',options:[['1-year','1 year protection'],['3-year','3 years protection'],['5-year','5 years protection']]},
  {id:'ppf',name:'Paint protection film',description:'Keep the road off your paint.',icon:'◇',options:[['partial','Partial front'],['front','Full front'],['body','Full body']]},
  {id:'wrap',name:'Vinyl wrap',description:'Give your car a new identity.',icon:'↗',options:[['partial-color','Partial color change'],['full-color','Full color change'],['partial-commercial','Partial commercial'],['full-commercial','Full commercial']]},
  {id:'detail',name:'Detailing',description:'That fresh-car feeling, again.',icon:'✺',options:[['interior','Interior detail'],['exterior','Exterior detail'],['full','Full detail']]}
];
export const options=services.flatMap(s=>s.options.map(([id,name])=>({id:`${s.id}:${id}`,name,service:s.name,serviceId:s.id})));
export const newsletterConsent='Email me my price report and the Phoenix Car Care newsletter with local deals. I can unsubscribe at any time.';
export const leadConsent='I agree that Phoenix Car Care may share my contact details and vehicle/service request with the partner shops named here, and those shops may call or text me about this request. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to opt out.';
