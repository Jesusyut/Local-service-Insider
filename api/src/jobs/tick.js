import {pool} from '../db.js';
// Scheduler implementation is added in the messaging phase.
await pool.query('SELECT 1');await pool.end();
