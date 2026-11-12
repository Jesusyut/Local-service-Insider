import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pg from 'pg';

const tables=['services','subscribers','shops','quotes','leads','checks','events','outbox','service_content','price_ranges','market_price_ranges','market_service_ranges','partner_placements'];
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const digest=rows=>createHash('sha256').update(JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex');

// Opt-in, private-network migration. Never runs during ordinary startup.
export async function migrateDatabase(){
 if(process.env.DATABASE_MIGRATION!=='copy')return;
 if(process.env.MAINTENANCE_MODE!=='true')throw Error('Migration requires maintenance mode');
 const sourceUrl=new URL(process.env.MIGRATION_SOURCE_URL),adminUrl=new URL(process.env.MIGRATION_ADMIN_URL),targetUrl=new URL(process.env.DATABASE_URL);
 if(sourceUrl.hostname===targetUrl.hostname||targetUrl.hostname!==adminUrl.hostname||targetUrl.pathname!=='/local_price_check'||targetUrl.username!=='local_price_check')throw Error('Unexpected migration endpoints');
 const source=new pg.Client({connectionString:sourceUrl.href}),admin=new pg.Client({connectionString:adminUrl.href}),target=new pg.Client({connectionString:targetUrl.href});
 const migrationId=createHash('sha256').update(sourceUrl.hostname+sourceUrl.pathname).digest('hex');
 let sourceTx=false,targetTx=false;
 try{
  await admin.connect();
  if(!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',['local_price_check'])).rowCount){
   const password=decodeURIComponent(targetUrl.password).replaceAll("'","''");
   await admin.query(`CREATE ROLE local_price_check LOGIN PASSWORD '${password}'`);
  }
  const existing=await admin.query('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1',['local_price_check']);
  if(!existing.rowCount)await admin.query('CREATE DATABASE local_price_check OWNER local_price_check');
  else if(existing.rows[0].owner!=='local_price_check')throw Error('Target database has an unexpected owner');
  await target.connect();
  const marker=await target.query("SELECT to_regclass('public._database_migration') AS marker");
  if(marker.rows[0].marker){
   const saved=await target.query('SELECT source_id FROM _database_migration');
   if(saved.rowCount!==1||saved.rows[0].source_id!==migrationId)throw Error('Unexpected migration marker');
   console.log('Database migration already verified');return;
  }
  const occupied=await target.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  if(occupied.rowCount)throw Error('Refusing to overwrite a nonempty target database');
  await source.connect();await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ');sourceTx=true;
  await source.query('SET LOCAL lock_timeout = \'30s\'');
  await source.query('LOCK TABLE '+tables.map(quote).join(',')+' IN SHARE MODE');
  const actual=(await source.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
  if(actual.some(name=>!tables.includes(name))||tables.some(name=>!actual.includes(name)))throw Error('Source schema differs from reviewed schema');
  await target.query('BEGIN');targetTx=true;
  await target.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
  const manifest={};
  for(const table of tables){
   const {rows}=await source.query('SELECT * FROM '+quote(table));
   if(rows.length){const columns=Object.keys(rows[0]);for(let offset=0;offset<rows.length;offset+=100){const batch=rows.slice(offset,offset+100),values=batch.flatMap(row=>columns.map(c=>row[c]));const placeholders=batch.map((_,i)=>'('+columns.map((_,j)=>'$'+(i*columns.length+j+1)).join(',')+')').join(',');await target.query('INSERT INTO '+quote(table)+' ('+columns.map(quote).join(',')+') VALUES '+placeholders,values);}}
   const copied=(await target.query('SELECT * FROM '+quote(table))).rows;
   if(rows.length!==copied.length||digest(rows)!==digest(copied))throw Error('Copy verification failed for '+table);
   manifest[table]={rows:rows.length,sha256:digest(rows)};
  }
  await target.query('CREATE TABLE _database_migration(source_id TEXT PRIMARY KEY,manifest TEXT NOT NULL,verified_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  await target.query('INSERT INTO _database_migration(source_id,manifest) VALUES($1,$2)',[migrationId,JSON.stringify(manifest)]);
  await target.query('COMMIT');targetTx=false;await source.query('ROLLBACK');sourceTx=false;
  console.log('Database migration verified',JSON.stringify(Object.fromEntries(Object.entries(manifest).map(([name,v])=>[name,v.rows]))));
 }finally{
  if(targetTx)await target.query('ROLLBACK').catch(()=>{});
  if(sourceTx)await source.query('ROLLBACK').catch(()=>{});
  await Promise.allSettled([source.end(),admin.end(),target.end()]);
 }
}
