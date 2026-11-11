import {mkdirSync,readFileSync} from 'node:fs';
import {options} from './catalog.mjs';
import {loadSeeds} from './seeds.mjs';
let pool,sqlite;
if(process.env.DATABASE_URL){const {default:pg}=await import('pg');pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});}
else {if(process.env.NODE_ENV==='production')throw new Error('DATABASE_URL is required in production');mkdirSync('data',{recursive:true});const {DatabaseSync}=await import('node:sqlite');sqlite=new DatabaseSync(process.env.SQLITE_PATH||'data/local.db');sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');}
export async function query(sql,params=[]){if(pool)return pool.query(sql,params);const statement=sqlite.prepare(sql.replace(/\$\d+/g,'?'));if(/^\s*(SELECT|WITH)|RETURNING/i.test(sql))return {rows:statement.all(...params)};return {rows:[],rowCount:statement.run(...params).changes};}
export async function transaction(fn){if(!pool){sqlite.exec('BEGIN');try{const result=await fn(query);sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}const client=await pool.connect();try{await client.query('BEGIN');const result=await fn((s,p)=>client.query(s,p));await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
export async function init(){const schema=readFileSync(new URL('./schema.sql',import.meta.url),'utf8');if(pool)await pool.query(schema);else sqlite.exec(schema);for(const [i,o] of options.entries())await query('INSERT INTO services(id,name,option_name,sort_order) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=excluded.name,option_name=excluded.option_name,sort_order=excluded.sort_order',[o.id,o.service,o.name,i]);await loadSeeds(query);}
