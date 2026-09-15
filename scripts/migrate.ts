import { getSql } from "../src/lib/db";

async function main() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      time_seconds INTEGER NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON leaderboard (score DESC)`;
  console.log("Migration complete: leaderboard table ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
