import { FOOTBALL_WORD_BANK, WordClue } from "./wordBank";

export type Direction = "across" | "down";

export interface PlacedWord {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: Direction;
  number: number;
}

export interface CrosswordPuzzle {
  rows: number;
  cols: number;
  /** solution[r][c] is the correct uppercase letter, or null if the cell is blocked */
  solution: (string | null)[][];
  /** clue number shown in the top-left of a cell that starts a word, or null */
  numbers: (number | null)[][];
  words: PlacedWord[];
  seed: string;
}

function normalizeWord(raw: string): string {
  return raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents but keep Ñ (handled below)
    .replace(/N~/g, "Ñ");
}

interface SparseCell {
  letter: string;
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function canPlace(
  grid: Map<string, SparseCell>,
  word: string,
  row: number,
  col: number,
  dir: Direction
): boolean {
  const len = word.length;

  // Cell immediately before the start and after the end must be empty.
  const beforeR = dir === "down" ? row - 1 : row;
  const beforeC = dir === "across" ? col - 1 : col;
  if (grid.has(key(beforeR, beforeC))) return false;

  const afterR = dir === "down" ? row + len : row;
  const afterC = dir === "across" ? col + len : col;
  if (grid.has(key(afterR, afterC))) return false;

  let hasIntersection = false;

  for (let i = 0; i < len; i++) {
    const r = dir === "down" ? row + i : row;
    const c = dir === "across" ? col + i : col;
    const existing = grid.get(key(r, c));

    if (existing) {
      if (existing.letter !== word[i]) return false;
      hasIntersection = true;
    } else {
      // Perpendicular neighbors must be empty so words don't touch illegally.
      if (dir === "across") {
        if (grid.has(key(r - 1, c)) || grid.has(key(r + 1, c))) return false;
      } else {
        if (grid.has(key(r, c - 1)) || grid.has(key(r, c + 1))) return false;
      }
    }
  }

  return grid.size === 0 || hasIntersection;
}

function place(
  grid: Map<string, SparseCell>,
  word: string,
  row: number,
  col: number,
  dir: Direction
) {
  for (let i = 0; i < word.length; i++) {
    const r = dir === "down" ? row + i : row;
    const c = dir === "across" ? col + i : col;
    grid.set(key(r, c), { letter: word[i] });
  }
}

interface Placement {
  row: number;
  col: number;
  direction: Direction;
  score: number;
}

function getBoundingBox(grid: Map<string, SparseCell>) {
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const k of grid.keys()) {
    const [r, c] = k.split(",").map(Number);
    minRow = Math.min(minRow, r);
    minCol = Math.min(minCol, c);
    maxRow = Math.max(maxRow, r);
    maxCol = Math.max(maxCol, c);
  }
  return { minRow, minCol, maxRow, maxCol };
}

function boundingBoxGrowth(
  grid: Map<string, SparseCell>,
  word: string,
  row: number,
  col: number,
  dir: Direction
): number {
  if (grid.size === 0) return 0;
  const current = getBoundingBox(grid);
  const endRow = dir === "down" ? row + word.length - 1 : row;
  const endCol = dir === "across" ? col + word.length - 1 : col;

  const newMinRow = Math.min(current.minRow, row);
  const newMinCol = Math.min(current.minCol, col);
  const newMaxRow = Math.max(current.maxRow, endRow);
  const newMaxCol = Math.max(current.maxCol, endCol);

  const currentArea = (current.maxRow - current.minRow + 1) * (current.maxCol - current.minCol + 1);
  const newArea = (newMaxRow - newMinRow + 1) * (newMaxCol - newMinCol + 1);
  return newArea - currentArea;
}

function findPlacements(
  grid: Map<string, SparseCell>,
  word: string
): Placement[] {
  const placements: Placement[] = [];

  for (const [k, cell] of grid.entries()) {
    const [gr, gc] = k.split(",").map(Number);
    for (let i = 0; i < word.length; i++) {
      if (word[i] !== cell.letter) continue;

      // Try placing across: intersection at column gc, row gr.
      const acrossRow = gr;
      const acrossCol = gc - i;
      if (canPlace(grid, word, acrossRow, acrossCol, "across")) {
        const intersections = countIntersections(grid, word, acrossRow, acrossCol, "across");
        const growth = boundingBoxGrowth(grid, word, acrossRow, acrossCol, "across");
        placements.push({
          row: acrossRow,
          col: acrossCol,
          direction: "across",
          score: intersections * 20 - growth,
        });
      }

      // Try placing down: intersection at row gr, column gc.
      const downRow = gr - i;
      const downCol = gc;
      if (canPlace(grid, word, downRow, downCol, "down")) {
        const intersections = countIntersections(grid, word, downRow, downCol, "down");
        const growth = boundingBoxGrowth(grid, word, downRow, downCol, "down");
        placements.push({
          row: downRow,
          col: downCol,
          direction: "down",
          score: intersections * 20 - growth,
        });
      }
    }
  }

  return placements;
}

function countIntersections(
  grid: Map<string, SparseCell>,
  word: string,
  row: number,
  col: number,
  dir: Direction
): number {
  let count = 0;
  for (let i = 0; i < word.length; i++) {
    const r = dir === "down" ? row + i : row;
    const c = dir === "across" ? col + i : col;
    if (grid.has(key(r, c))) count++;
  }
  return count;
}

export interface GenerateOptions {
  wordCount?: number;
  bank?: WordClue[];
}

export function generateCrossword(options: GenerateOptions = {}): CrosswordPuzzle {
  const { wordCount = 11, bank = FOOTBALL_WORD_BANK } = options;

  const candidates = shuffle(bank)
    .map((entry) => ({ ...entry, word: normalizeWord(entry.word) }))
    .filter((entry) => entry.word.length >= 3 && entry.word.length <= 12);

  // Bias toward longer words first so the grid has good crossing spines,
  // but keep some randomness by shuffling within length buckets.
  candidates.sort((a, b) => b.word.length - a.word.length);

  const grid = new Map<string, SparseCell>();
  const placedWords: { word: string; clue: string; row: number; col: number; direction: Direction }[] = [];
  const usedWords = new Set<string>();

  for (const candidate of candidates) {
    if (placedWords.length >= wordCount) break;
    if (usedWords.has(candidate.word)) continue;

    if (placedWords.length === 0) {
      place(grid, candidate.word, 0, 0, "across");
      placedWords.push({ word: candidate.word, clue: candidate.clue, row: 0, col: 0, direction: "across" });
      usedWords.add(candidate.word);
      continue;
    }

    const placements = findPlacements(grid, candidate.word);
    if (placements.length === 0) continue;

    placements.sort((a, b) => b.score - a.score);
    const topTier = placements.filter((p) => p.score >= placements[0].score - 10).slice(0, 4);
    const best = topTier[Math.floor(Math.random() * topTier.length)];
    place(grid, candidate.word, best.row, best.col, best.direction);
    placedWords.push({
      word: candidate.word,
      clue: candidate.clue,
      row: best.row,
      col: best.col,
      direction: best.direction,
    });
    usedWords.add(candidate.word);
  }

  // Normalize coordinates so the top-left of the bounding box is (0, 0).
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;

  for (const w of placedWords) {
    const endRow = w.direction === "down" ? w.row + w.word.length - 1 : w.row;
    const endCol = w.direction === "across" ? w.col + w.word.length - 1 : w.col;
    minRow = Math.min(minRow, w.row);
    minCol = Math.min(minCol, w.col);
    maxRow = Math.max(maxRow, endRow);
    maxCol = Math.max(maxCol, endCol);
  }

  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  const solution: (string | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );

  const shifted = placedWords.map((w) => ({
    ...w,
    row: w.row - minRow,
    col: w.col - minCol,
  }));

  for (const w of shifted) {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.direction === "down" ? w.row + i : w.row;
      const c = w.direction === "across" ? w.col + i : w.col;
      solution[r][c] = w.word[i];
    }
  }

  // Assign standard crossword numbering (top-to-bottom, left-to-right scan).
  const numbers: (number | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
  let nextNumber = 1;
  const startNumberFor = new Map<string, number>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (solution[r][c] === null) continue;
      const startsAcross =
        solution[r][c] !== null &&
        (c === 0 || solution[r][c - 1] === null) &&
        c + 1 < cols &&
        solution[r][c + 1] !== null;
      const startsDown =
        solution[r][c] !== null &&
        (r === 0 || solution[r - 1][c] === null) &&
        r + 1 < rows &&
        solution[r + 1][c] !== null;

      if (startsAcross || startsDown) {
        numbers[r][c] = nextNumber;
        startNumberFor.set(key(r, c), nextNumber);
        nextNumber++;
      }
    }
  }

  const words: PlacedWord[] = shifted
    .map((w) => ({
      word: w.word,
      clue: w.clue,
      row: w.row,
      col: w.col,
      direction: w.direction,
      number: startNumberFor.get(key(w.row, w.col)) ?? 0,
    }))
    .sort((a, b) => a.number - b.number || a.direction.localeCompare(b.direction));

  return {
    rows,
    cols,
    solution,
    numbers,
    words,
    seed: Math.random().toString(36).slice(2, 10),
  };
}
