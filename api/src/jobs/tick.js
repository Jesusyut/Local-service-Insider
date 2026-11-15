// Foundation health probe; phase 4 adds authenticated scheduling.
if(!process.env.API_BASE_URL)throw Error('API_BASE_URL is required');
const r=await fetch(process.env.API_BASE_URL.replace(/\/$/,'')+'/healthz',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('API health check failed: '+r.status);console.log('API healthy');
