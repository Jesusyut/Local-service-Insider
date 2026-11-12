import copy from './campaign-copy.json' with {type:'json'};
export {copy};
export const types=['sedan','coupe','suv','truck','van'];
export const services=[
 {id:'tint',name:copy['svc.card.tint'],image:'/images/tint.webp',copyId:'tint',question:copy['svc.opt.tint'],options:[['all','Sides and back'],['full-strip','Full car with windshield strip'],['windshield','Windshield only']]},
 {id:'detail',name:copy['svc.card.detail'],image:'/images/detail.webp',copyId:'detail',question:copy['svc.opt.detail'],options:[['interior','Interior'],['exterior','Exterior'],['full','Full detail']]},
 {id:'coating',name:copy['svc.card.coat'],image:'/images/ceramic.webp',copyId:'coat',question:copy['svc.opt.coat'],options:[['1-year','1 year'],['3-year','3 years'],['5-year','5+ years'],['unsure','Not sure']]},
 {id:'body',name:copy['svc.card.body'],image:'/images/body.webp',copyId:'body',question:copy['svc.opt.body'],options:[['dent','Dent or scratch'],['bumper','Bumper'],['collision','Collision damage'],['paint','Full paint']]},
 {id:'starlight',name:copy['svc.card.starlight'],image:'/images/starlight.webp',copyId:'starlight',question:copy['svc.opt.starlight'],options:[['standard','Standard stars'],['dense','Dense stars'],['shooting','With shooting stars']]},
 {id:'oil',name:copy['svc.card.oil'],image:'/images/oil.webp',copyId:'oil',question:copy['svc.opt.oil'],options:[['conventional','Conventional'],['blend','Synthetic blend'],['synthetic','Full synthetic'],['unsure','Not sure']]},
 {id:'smog',name:copy['svc.card.smog'],image:'/images/smog.webp',copyId:'smog',question:copy['svc.opt.smog'],options:[['obd','1996 or newer']]},
 {id:'lighting',name:copy['svc.card.lighting'],image:'/images/lighting.webp',copyId:'lighting',question:copy['svc.opt.lighting'],options:[['ambient','Interior ambient'],['headlight','Headlight upgrade'],['exterior','Exterior accents']]}
];
export const options=services.flatMap(s=>s.options.map(([id,name])=>({id:`${s.id}:${id}`,name,service:s.name,serviceId:s.id})));
export const drivers=copy['result.drivers'].split(' · ');
export const newsletterConsent=copy['gate.disclosure'];
export const leadConsent=copy['quotes.consent'];
