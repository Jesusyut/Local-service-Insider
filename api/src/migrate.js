import {readdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pool,transaction,lock} from './db.js';
export async function migrate(){await transaction(async c=>{await lock(c,'turf-migrations');await c.query('CREATE TABLE IF NOT EXISTS migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()){if((await c.query('SELECT name FROM migrations WHERE name=$1',[name])).rows.length)continue;await c.query(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));await c.query('INSERT INTO migrations(name) VALUES($1)',[name]);}});}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{await migrate();console.log('Migrations complete');}finally{await pool.end();}}
