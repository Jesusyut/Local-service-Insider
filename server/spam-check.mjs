// Optional Turnstile: enabling it requires both the public site key and secret.
export function createSpamCheck({siteKey='',secretKey='',fetchImpl=fetch}={}){
 const enabled=Boolean(siteKey&&secretKey);
 const reject=()=>{throw Object.assign(Error('Please complete the spam check again.'),{status:400});};
 return {siteKey:enabled?siteKey:'',async verify(token){
  if(!enabled)return;
  if(!token)reject();
  const response=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:secretKey,response:token}),signal:AbortSignal.timeout(10000)});
  if(!response.ok||!(await response.json()).success)reject();
 }};
}
