import pg from "pg";
import { randomUUID } from "node:crypto";
export let pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
export function useTestPool(value) {
  if (process.env.NODE_ENV !== "test")
    throw Error("Test database injection is disabled");
  pool = value;
}
export const query = (sql, params = []) => pool.query(sql, params);
export async function transaction(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const value = await fn(c);
    await c.query("COMMIT");
    return value;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export const audit = (c, entity, id, type, payload = {}) =>
  c.query(
    "INSERT INTO events(id,entity,entity_id,type,payload) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), entity, String(id), type, JSON.stringify(payload)],
  );
export const lock = (c, key) =>
  c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    String(key),
  ]);
