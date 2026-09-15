import { neon } from "@neondatabase/serverless";

function createSql() {
  return neon(process.env.DATABASE_URL!);
}

let _sql: ReturnType<typeof createSql> | null = null;

export function getSql() {
  if (!_sql) _sql = createSql();
  return _sql;
}
