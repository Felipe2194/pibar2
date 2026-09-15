"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateCrossword, type CrosswordPuzzle, type Direction, type PlacedWord } from "@/lib/crossword/generator";
import Leaderboard from "./Leaderboard";

const LETTER_REGEX = /^[A-ZÑ]$/;

interface Cell {
  row: number;
  col: number;
}

function sameCell(a: Cell | null, b: Cell): boolean {
  return !!a && a.row === b.row && a.col === b.col;
}

function wordContains(word: PlacedWord, row: number, col: number): boolean {
  if (word.direction === "across") {
    return row === word.row && col >= word.col && col < word.col + word.word.length;
  }
  return col === word.col && row >= word.row && row < word.row + word.word.length;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CrosswordGame() {
  const [puzzle, setPuzzle] = useState<CrosswordPuzzle>(() => generateCrossword({ wordCount: 10 }));
  const [userInput, setUserInput] = useState<string[][]>(() =>
    Array.from({ length: puzzle.rows }, () => Array.from({ length: puzzle.cols }, () => ""))
  );
  const [selected, setSelected] = useState<Cell | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  const [startTime, setStartTime] = useState<number>(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [solved, setSolved] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [leaderboardVersion, setLeaderboardVersion] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

  const resetPuzzle = useCallback(() => {
    const next = generateCrossword({ wordCount: 10 });
    setPuzzle(next);
    setUserInput(Array.from({ length: next.rows }, () => Array.from({ length: next.cols }, () => "")));
    setSelected(null);
    setDirection("across");
    setStartTime(Date.now());
    setElapsedSeconds(0);
    setSolved(false);
    setPlayerName("");
    setSubmitStatus("idle");
  }, []);

  useEffect(() => {
    if (solved) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, solved]);

  const isBlocked = useCallback((row: number, col: number) => puzzle.solution[row]?.[col] == null, [puzzle]);

  const activeWord = useMemo(() => {
    if (!selected) return null;
    return (
      puzzle.words.find((w) => w.direction === direction && wordContains(w, selected.row, selected.col)) ??
      puzzle.words.find((w) => wordContains(w, selected.row, selected.col)) ??
      null
    );
  }, [selected, direction, puzzle.words]);

  const highlighted = useMemo(() => {
    const set = new Set<string>();
    if (activeWord) {
      for (let i = 0; i < activeWord.word.length; i++) {
        const r = activeWord.direction === "down" ? activeWord.row + i : activeWord.row;
        const c = activeWord.direction === "across" ? activeWord.col + i : activeWord.col;
        set.add(`${r},${c}`);
      }
    }
    return set;
  }, [activeWord]);

  const focusCell = useCallback((row: number, col: number) => {
    inputRefs.current[row]?.[col]?.focus();
  }, []);

  const selectCell = useCallback(
    (row: number, col: number, forcedDirection?: Direction) => {
      if (isBlocked(row, col)) return;
      setSelected((prev) => {
        const isSame = sameCell(prev, { row, col });
        if (isSame && !forcedDirection) {
          const hasAcross = puzzle.words.some((w) => w.direction === "across" && wordContains(w, row, col));
          const hasDown = puzzle.words.some((w) => w.direction === "down" && wordContains(w, row, col));
          if (hasAcross && hasDown) {
            setDirection((d) => (d === "across" ? "down" : "across"));
          }
        } else if (forcedDirection) {
          setDirection(forcedDirection);
        } else {
          const hasAcross = puzzle.words.some((w) => w.direction === "across" && wordContains(w, row, col));
          const hasDown = puzzle.words.some((w) => w.direction === "down" && wordContains(w, row, col));
          setDirection((d) => (d === "across" && hasAcross ? "across" : d === "down" && hasDown ? "down" : hasAcross ? "across" : "down"));
        }
        return { row, col };
      });
      focusCell(row, col);
    },
    [isBlocked, puzzle.words, focusCell]
  );

  const step = useCallback(
    (row: number, col: number, dr: number, dc: number): Cell | null => {
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < puzzle.rows && c >= 0 && c < puzzle.cols) {
        if (!isBlocked(r, c)) return { row: r, col: c };
        r += dr;
        c += dc;
      }
      return null;
    },
    [puzzle.rows, puzzle.cols, isBlocked]
  );

  const handleLetter = useCallback(
    (row: number, col: number, raw: string) => {
      const letter = raw.slice(-1).toUpperCase();
      if (!LETTER_REGEX.test(letter)) return;
      setUserInput((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = letter;
        return next;
      });
      const dr = direction === "down" ? 1 : 0;
      const dc = direction === "across" ? 1 : 0;
      const nextCell = step(row, col, dr, dc);
      if (nextCell) selectCell(nextCell.row, nextCell.col, direction);
    },
    [direction, step, selectCell]
  );

  const handleBackspace = useCallback(
    (row: number, col: number) => {
      setUserInput((prev) => {
        const next = prev.map((r) => [...r]);
        if (next[row][col]) {
          next[row][col] = "";
          return next;
        }
        const dr = direction === "down" ? -1 : 0;
        const dc = direction === "across" ? -1 : 0;
        const prevCell = step(row, col, dr, dc);
        if (prevCell) {
          next[prevCell.row][prevCell.col] = "";
          queueMicrotask(() => selectCell(prevCell.row, prevCell.col, direction));
        }
        return next;
      });
    },
    [direction, step, selectCell]
  );

  const handleArrow = useCallback(
    (row: number, col: number, key: string) => {
      const map: Record<string, [number, number, Direction]> = {
        ArrowLeft: [0, -1, "across"],
        ArrowRight: [0, 1, "across"],
        ArrowUp: [-1, 0, "down"],
        ArrowDown: [1, 0, "down"],
      };
      const entry = map[key];
      if (!entry) return;
      const [dr, dc, dir] = entry;
      const nextCell = step(row, col, dr, dc);
      if (nextCell) selectCell(nextCell.row, nextCell.col, dir);
    },
    [step, selectCell]
  );

  useEffect(() => {
    if (solved) return;
    let allFilled = true;
    let allCorrect = true;
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const solutionLetter = puzzle.solution[r][c];
        if (solutionLetter === null) continue;
        const value = userInput[r]?.[c] ?? "";
        if (!value) allFilled = false;
        if (value !== solutionLetter) allCorrect = false;
      }
    }
    if (allFilled && allCorrect) {
      setSolved(true);
    }
  }, [userInput, puzzle, solved]);

  const score = useMemo(() => Math.max(100, 1000 - elapsedSeconds * 4), [elapsedSeconds]);

  const acrossClues = puzzle.words.filter((w) => w.direction === "across");
  const downClues = puzzle.words.filter((w) => w.direction === "down");

  const submitScore = async () => {
    if (!playerName.trim()) return;
    setSubmitStatus("sending");
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playerName.trim().slice(0, 24),
          score,
          timeSeconds: elapsedSeconds,
          wordCount: puzzle.words.length,
        }),
      });
      if (!res.ok) throw new Error("bad status");
      setSubmitStatus("done");
      setLeaderboardVersion((v) => v + 1);
    } catch {
      setSubmitStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full items-center justify-between gap-4 rounded-lg bg-emerald-50 px-4 py-2 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <span className="font-mono text-lg tabular-nums">⏱ {formatTime(elapsedSeconds)}</span>
          <span className="font-mono text-lg tabular-nums">⭐ {score}</span>
          <button
            onClick={resetPuzzle}
            className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Nueva partida
          </button>
        </div>

        <div
          className="grid touch-manipulation gap-[2px] rounded-md bg-zinc-800 p-[2px] dark:bg-zinc-700"
          style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(1.6rem, 2.2rem))` }}
        >
          {Array.from({ length: puzzle.rows }).map((_, r) =>
            Array.from({ length: puzzle.cols }).map((_, c) => {
              const blocked = isBlocked(r, c);
              const number = puzzle.numbers[r][c];
              const isHighlighted = highlighted.has(`${r},${c}`);
              const isSelected = sameCell(selected, { row: r, col: c });

              if (blocked) {
                return <div key={`${r}-${c}`} className="aspect-square bg-transparent" />;
              }

              return (
                <div
                  key={`${r}-${c}`}
                  className={`relative aspect-square ${
                    isSelected ? "bg-yellow-300 dark:bg-yellow-400" : isHighlighted ? "bg-emerald-100 dark:bg-emerald-900" : "bg-white dark:bg-zinc-900"
                  }`}
                >
                  {number && <span className="pointer-events-none absolute left-0.5 top-0 text-[0.55rem] leading-none text-zinc-500">{number}</span>}
                  <input
                    ref={(el) => {
                      inputRefs.current[r] ??= [];
                      inputRefs.current[r][c] = el;
                    }}
                    value={userInput[r]?.[c] ?? ""}
                    onChange={(e) => handleLetter(r, c, e.target.value)}
                    onFocus={() => selectCell(r, c)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace") {
                        e.preventDefault();
                        handleBackspace(r, c);
                      } else if (e.key === " ") {
                        e.preventDefault();
                        selectCell(r, c, direction === "across" ? "down" : "across");
                      } else if (e.key.startsWith("Arrow")) {
                        e.preventDefault();
                        handleArrow(r, c, e.key);
                      }
                    }}
                    maxLength={1}
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    className="h-full w-full bg-transparent text-center font-mono text-base font-semibold uppercase text-zinc-900 outline-none dark:text-zinc-50"
                  />
                </div>
              );
            })
          )}
        </div>

        {solved && (
          <div className="flex w-full flex-col items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-950">
            <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
              ¡Crucigrama completo! Tiempo: {formatTime(elapsedSeconds)} · Puntaje: {score}
            </p>
            {submitStatus !== "done" ? (
              <div className="flex w-full max-w-xs gap-2">
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Tu apodo"
                  className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  maxLength={24}
                />
                <button
                  onClick={submitScore}
                  disabled={!playerName.trim() || submitStatus === "sending"}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitStatus === "sending" ? "Enviando…" : "Anotarme"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">¡Listo, ya estás en la tabla de posiciones!</p>
            )}
            {submitStatus === "error" && <p className="text-sm text-red-600">No se pudo enviar el puntaje, probá de nuevo.</p>}
          </div>
        )}
      </div>

      <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
        <ClueColumn title="Horizontales" clues={acrossClues} onSelect={(w) => selectCell(w.row, w.col, "across")} />
        <ClueColumn title="Verticales" clues={downClues} onSelect={(w) => selectCell(w.row, w.col, "down")} />
      </div>

      <Leaderboard refreshKey={leaderboardVersion} />
    </div>
  );
}

function ClueColumn({ title, clues, onSelect }: { title: string; clues: PlacedWord[]; onSelect: (w: PlacedWord) => void }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">{title}</h3>
      <ol className="flex flex-col gap-1 text-sm">
        {clues.map((w) => (
          <li key={`${w.direction}-${w.number}`}>
            <button onClick={() => onSelect(w)} className="text-left hover:text-emerald-600">
              <span className="font-semibold">{w.number}.</span> {w.clue}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
