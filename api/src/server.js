import express from 'express';
import {fileURLToPath} from 'node:url';
import {pool} from './db.js';
export function createApp(){const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','X-Frame-Options':'DENY'});const allowed=process.env.PUBLIC_SITE_URL;if(req.headers.origin&&req.headers.origin!==allowed)return res.status(403).json({error:'Origin not allowed'});if(req.headers.origin){res.set({'Access-Control-Allow-Origin':allowed,'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS'});}if(req.method==='OPTIONS')return res.sendStatus(204);next();});
 app.use(express.json({limit:'32kb'}));app.use(express.urlencoded({extended:false,limit:'16kb'}));
 app.get('/healthz',async(req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true});}catch{res.status(503).json({ok:false});}});
 return app;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=createApp();const server=app.listen(process.env.PORT||3001,'0.0.0.0',()=>console.log('Turf API ready'));process.on('SIGTERM',()=>server.close(async()=>{await pool.end();process.exit(0);}));}
