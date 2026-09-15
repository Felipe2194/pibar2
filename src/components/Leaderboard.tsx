"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  timeSeconds: number;
  createdAt: string;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Leaderboard({ refreshKey }: { refreshKey: number }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard")
      .then((res) => {
        if (!res.ok) throw new Error("bad status");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="w-full rounded-lg border border-violet-200 bg-white p-4 dark:border-violet-800 dark:bg-violet-950/40">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-violet-500 dark:text-violet-400">Tabla de posiciones</h3>
      {error && <p className="text-sm text-zinc-500">No se pudo cargar la tabla.</p>}
      {!error && entries === null && <p className="text-sm text-zinc-500">Cargando…</p>}
      {entries && entries.length === 0 && <p className="text-sm text-zinc-500">Todavía nadie anotó un puntaje. ¡Sé el primero!</p>}
      {entries && entries.length > 0 && (
        <ol className="flex flex-col gap-1.5 text-sm">
          {entries.map((entry, i) => (
            <li key={entry.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 truncate">
                <span className="w-5 text-right font-mono text-violet-400">{i + 1}.</span>
                <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">{entry.name}</span>
              </span>
              <span className="flex shrink-0 gap-2 font-mono text-xs text-zinc-500">
                <span>{formatTime(entry.timeSeconds)}</span>
                <span className="font-semibold text-violet-600 dark:text-violet-300">{entry.score}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
