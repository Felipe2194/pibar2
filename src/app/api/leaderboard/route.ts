import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET() {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, score, time_seconds, created_at
    FROM leaderboard
    ORDER BY score DESC, time_seconds ASC
    LIMIT 20
  `;

  return NextResponse.json({
    entries: rows.map((r) => ({
      id: r.id,
      name: r.name,
      score: r.score,
      timeSeconds: r.time_seconds,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 24) : "";
  const score = Number(body?.score);
  const timeSeconds = Number(body?.timeSeconds);
  const wordCount = Number(body?.wordCount) || 0;

  if (!name || !Number.isFinite(score) || !Number.isFinite(timeSeconds)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const sql = getSql();
  const [row] = await sql`
    INSERT INTO leaderboard (name, score, time_seconds, word_count)
    VALUES (${name}, ${score}, ${timeSeconds}, ${wordCount})
    RETURNING id, name, score, time_seconds, created_at
  `;

  return NextResponse.json({
    entry: {
      id: row.id,
      name: row.name,
      score: row.score,
      timeSeconds: row.time_seconds,
      createdAt: row.created_at,
    },
  });
}
