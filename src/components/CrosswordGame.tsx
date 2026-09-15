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

  // Refs mirror `selected`/`direction`/`puzzle`/`userInput` so the single hidden
  // input's event handlers always read the latest value synchronously, without
  // needing to resubscribe the DOM focus target for every keystroke.
  const selectedRef = useRef<Cell | null>(null);
  const directionRef = useRef<Direction>("across");
  const puzzleRef = useRef(puzzle);
  const userInputRef = useRef(userInput);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    puzzleRef.current = puzzle;
  }, [puzzle]);
  useEffect(() => {
    userInputRef.current = userInput;
  }, [userInput]);

  const resetPuzzle = useCallback(() => {
    const next = generateCrossword({ wordCount: 10 });
    setPuzzle(next);
    setUserInput(Array.from({ length: next.rows }, () => Array.from({ length: next.cols }, () => "")));
    selectedRef.current = null;
    directionRef.current = "across";
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

  const wordDirectionsAt = useCallback((row: number, col: number) => {
    const p = puzzleRef.current;
    const hasAcross = p.words.some((w) => w.direction === "across" && wordContains(w, row, col));
    const hasDown = p.words.some((w) => w.direction === "down" && wordContains(w, row, col));
    return { hasAcross, hasDown };
  }, []);

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

  const isWordSolved = useCallback(
    (w: PlacedWord) => {
      for (let i = 0; i < w.word.length; i++) {
        const r = w.direction === "down" ? w.row + i : w.row;
        const c = w.direction === "across" ? w.col + i : w.col;
        if ((userInput[r]?.[c] ?? "") !== w.word[i]) return false;
      }
      return true;
    },
    [userInput]
  );

  const focusHiddenInput = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

  const isBlockedAt = useCallback(
    (row: number, col: number) => puzzleRef.current.solution[row]?.[col] == null,
    []
  );

  const step = useCallback((row: number, col: number, dr: number, dc: number): Cell | null => {
    const p = puzzleRef.current;
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < p.rows && c >= 0 && c < p.cols) {
      if (!isBlockedAt(r, c)) return { row: r, col: c };
      r += dr;
      c += dc;
    }
    return null;
  }, [isBlockedAt]);

  // The only place that changes which cell/direction is active. Never toggles
  // direction on its own — that's reserved for an explicit click on the cell
  // that was already selected (see handleCellMouseDown).
  const moveTo = useCallback(
    (row: number, col: number, forcedDirection?: Direction) => {
      if (isBlockedAt(row, col)) return;
      let nextDir = forcedDirection ?? directionRef.current;
      if (!forcedDirection) {
        const { hasAcross, hasDown } = wordDirectionsAt(row, col);
        if (nextDir === "across" && !hasAcross) nextDir = hasDown ? "down" : "across";
        else if (nextDir === "down" && !hasDown) nextDir = hasAcross ? "across" : "down";
      }
      directionRef.current = nextDir;
      selectedRef.current = { row, col };
      setDirection(nextDir);
      setSelected({ row, col });
      focusHiddenInput();
    },
    [isBlockedAt, wordDirectionsAt, focusHiddenInput]
  );

  const handleCellMouseDown = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      e.preventDefault();
      if (isBlockedAt(row, col)) return;
      const isSame = sameCell(selectedRef.current, { row, col });
      if (isSame) {
        const { hasAcross, hasDown } = wordDirectionsAt(row, col);
        if (hasAcross && hasDown) {
          const toggled: Direction = directionRef.current === "across" ? "down" : "across";
          directionRef.current = toggled;
          setDirection(toggled);
        }
        focusHiddenInput();
        return;
      }
      moveTo(row, col);
    },
    [isBlockedAt, wordDirectionsAt, moveTo, focusHiddenInput]
  );

  const handleLetterInput = useCallback(
    (raw: string) => {
      const cell = selectedRef.current;
      if (!cell) return;
      const letter = raw.slice(-1).toUpperCase();
      if (!LETTER_REGEX.test(letter)) return;
      const { row, col } = cell;
      setUserInput((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = letter;
        return next;
      });
      const dir = directionRef.current;
      const dr = dir === "down" ? 1 : 0;
      const dc = dir === "across" ? 1 : 0;
      const nextCell = step(row, col, dr, dc);
      if (nextCell) moveTo(nextCell.row, nextCell.col, dir);
    },
    [step, moveTo]
  );

  const handleBackspace = useCallback(() => {
    const cell = selectedRef.current;
    if (!cell) return;
    const { row, col } = cell;
    if (userInputRef.current[row]?.[col]) {
      setUserInput((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = "";
        return next;
      });
      return;
    }
    const dir = directionRef.current;
    const dr = dir === "down" ? -1 : 0;
    const dc = dir === "across" ? -1 : 0;
    const prevCell = step(row, col, dr, dc);
    if (prevCell) {
      setUserInput((prev) => {
        const next = prev.map((r) => [...r]);
        next[prevCell.row][prevCell.col] = "";
        return next;
      });
      moveTo(prevCell.row, prevCell.col, dir);
    }
  }, [step, moveTo]);

  const handleArrowKey = useCallback(
    (key: string) => {
      const cell = selectedRef.current;
      if (!cell) return;
      const map: Record<string, [number, number, Direction]> = {
        ArrowLeft: [0, -1, "across"],
        ArrowRight: [0, 1, "across"],
        ArrowUp: [-1, 0, "down"],
        ArrowDown: [1, 0, "down"],
      };
      const entry = map[key];
      if (!entry) return;
      const [dr, dc, dir] = entry;
      const nextCell = step(cell.row, cell.col, dr, dc);
      if (nextCell) moveTo(nextCell.row, nextCell.col, dir);
    },
    [step, moveTo]
  );

  const toggleDirectionInPlace = useCallback(() => {
    const cell = selectedRef.current;
    if (!cell) return;
    const { hasAcross, hasDown } = wordDirectionsAt(cell.row, cell.col);
    if (hasAcross && hasDown) {
      const toggled: Direction = directionRef.current === "across" ? "down" : "across";
      directionRef.current = toggled;
      setDirection(toggled);
    }
  }, [wordDirectionsAt]);

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

  // Much gentler decay than a raw per-second countdown: about a third of a
  // point per second, so a few minutes of play barely dents the score.
  const score = useMemo(() => Math.max(200, 1000 - Math.floor(elapsedSeconds / 3)), [elapsedSeconds]);

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
        <div className="flex w-full items-center justify-between gap-4 rounded-lg bg-violet-100 px-4 py-2 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100">
          <span className="font-mono text-lg tabular-nums">⏱ {formatTime(elapsedSeconds)}</span>
          <span className="font-mono text-lg tabular-nums">⭐ {score}</span>
          <button
            onClick={resetPuzzle}
            className="rounded-full bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700"
          >
            Nueva partida
          </button>
        </div>

        <div className="relative w-full overflow-x-auto">
          {/* Single always-focused input driving all keyboard entry. Grid cells
              below are plain divs — no per-cell input, so focus never bounces
              between elements and can't fight with our own selection state. */}
          <input
            ref={hiddenInputRef}
            value=""
            onChange={(e) => {
              const val = e.target.value;
              e.currentTarget.value = "";
              if (val) handleLetterInput(val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                handleBackspace();
              } else if (e.key === " ") {
                e.preventDefault();
                toggleDirectionInPlace();
              } else if (e.key.startsWith("Arrow")) {
                e.preventDefault();
                handleArrowKey(e.key);
              }
            }}
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoCapitalize="characters"
            aria-hidden="true"
            className="sr-only"
          />

          <div
            className="mx-auto grid w-fit touch-manipulation gap-[3px] rounded-md bg-violet-200 p-[3px] dark:bg-violet-800/70"
            style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(1.9rem, 3.4rem))` }}
          >
            {Array.from({ length: puzzle.rows }).map((_, r) =>
              Array.from({ length: puzzle.cols }).map((_, c) => {
                const blocked = isBlocked(r, c);
                const number = puzzle.numbers[r][c];
                const isHighlighted = highlighted.has(`${r},${c}`);
                const isSelected = sameCell(selected, { row: r, col: c });
                const value = userInput[r]?.[c] ?? "";
                const isWrong = value !== "" && value !== puzzle.solution[r]?.[c];

                if (blocked) {
                  return <div key={`${r}-${c}`} className="aspect-square bg-transparent" />;
                }

                return (
                  <div
                    key={`${r}-${c}`}
                    onMouseDown={(e) => {
                      handleCellMouseDown(r, c, e);
                    }}
                    className={`relative aspect-square cursor-pointer select-none ${
                      isSelected
                        ? "bg-violet-500 ring-2 ring-inset ring-violet-900 dark:bg-violet-400 dark:ring-violet-100"
                        : isWrong
                          ? "bg-rose-100 dark:bg-rose-900/50"
                          : isHighlighted
                            ? "bg-violet-100 dark:bg-violet-800/60"
                            : "bg-white dark:bg-zinc-900"
                    }`}
                  >
                    {number && (
                      <span
                        className={`pointer-events-none absolute left-0.5 top-0 text-[0.6rem] leading-none ${
                          isSelected ? "text-violet-950 dark:text-violet-950" : "text-zinc-400"
                        }`}
                      >
                        {number}
                      </span>
                    )}
                    <span
                      className={`flex h-full w-full items-center justify-center font-mono text-xl font-bold uppercase sm:text-2xl ${
                        isSelected
                          ? "text-white dark:text-violet-950"
                          : isWrong
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-zinc-900 dark:text-zinc-50"
                      }`}
                    >
                      {value}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {solved && (
          <div className="flex w-full flex-col items-center gap-3 rounded-lg border border-violet-300 bg-violet-50 p-4 text-center dark:border-violet-700 dark:bg-violet-950">
            <p className="text-lg font-semibold text-violet-800 dark:text-violet-200">
              ¡Crucigrama completo! Tiempo: {formatTime(elapsedSeconds)} · Puntaje: {score}
            </p>
            {submitStatus !== "done" ? (
              <div className="flex w-full max-w-xs gap-2">
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Tu apodo"
                  className="flex-1 rounded border border-violet-300 px-3 py-1.5 text-sm dark:border-violet-700 dark:bg-violet-950"
                  maxLength={24}
                />
                <button
                  onClick={submitScore}
                  disabled={!playerName.trim() || submitStatus === "sending"}
                  className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitStatus === "sending" ? "Enviando…" : "Anotarme"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-violet-700 dark:text-violet-300">¡Listo, ya estás en la tabla de posiciones!</p>
            )}
            {submitStatus === "error" && <p className="text-sm text-red-600">No se pudo enviar el puntaje, probá de nuevo.</p>}
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
        <div className="rounded-lg border border-violet-200 bg-white p-4 dark:border-violet-800 dark:bg-violet-950/40">
          <ClueColumn
            title="Horizontales"
            clues={acrossClues}
            activeWord={activeWord}
            isWordSolved={isWordSolved}
            onSelect={(w) => moveTo(w.row, w.col, "across")}
          />
          <div className="my-4 border-t border-violet-100 dark:border-violet-800" />
          <ClueColumn
            title="Verticales"
            clues={downClues}
            activeWord={activeWord}
            isWordSolved={isWordSolved}
            onSelect={(w) => moveTo(w.row, w.col, "down")}
          />
        </div>

        <Leaderboard refreshKey={leaderboardVersion} />
      </div>
    </div>
  );
}

function ClueColumn({
  title,
  clues,
  activeWord,
  isWordSolved,
  onSelect,
}: {
  title: string;
  clues: PlacedWord[];
  activeWord: PlacedWord | null;
  isWordSolved: (w: PlacedWord) => boolean;
  onSelect: (w: PlacedWord) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-violet-500 dark:text-violet-400">{title}</h3>
      <ol className="flex flex-col gap-1 text-sm">
        {clues.map((w) => {
          const isActive = !!activeWord && activeWord.direction === w.direction && activeWord.row === w.row && activeWord.col === w.col;
          const solved = isWordSolved(w);
          return (
            <li key={`${w.direction}-${w.number}`}>
              <button
                onClick={() => onSelect(w)}
                className={`flex w-full items-start gap-1.5 rounded px-2 py-1 text-left transition-colors ${
                  isActive
                    ? "bg-violet-100 font-semibold text-violet-700 dark:bg-violet-900/60 dark:text-violet-200"
                    : solved
                      ? "text-zinc-400 line-through decoration-violet-400 dark:text-zinc-500"
                      : "text-zinc-700 hover:bg-violet-50 dark:text-zinc-300 dark:hover:bg-violet-900/30"
                }`}
              >
                <span className="font-semibold">{w.number}.</span>
                <span>{w.clue}</span>
                {solved && <span className="ml-auto shrink-0 text-violet-500">✓</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
