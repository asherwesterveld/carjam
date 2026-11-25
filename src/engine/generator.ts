import {
  BOARD_SIZE,
  CAR_IDS,
  EXIT_ROW,
  HERO_ID,
  MAX_CARS,
  MAX_TRUCKS,
  TRUCK_IDS,
  getDifficultyTier,
} from './catalog';
import { encodeBoard } from './codec';
import { findComponentTarget, solveBoard } from './solver';
import type {
  Board,
  GenerateOptions,
  Orientation,
  PuzzleCard,
  Vehicle,
  VehicleLength,
} from './types';

interface RawPiece {
  isHero: boolean;
  row: number;
  col: number;
  length: VehicleLength;
  orientation: Orientation;
}

/**
 * Produces a structure-only canonical key (ignoring arbitrary blocking car letters)
 * so bulk generation never emits duplicate layouts with swapped colors.
 */
export function canonicalBoardKey(board: Board): string {
  const parts = board.vehicles.map(
    (v) =>
      `${v.id === HERO_ID ? 'X' : v.length}${v.orientation}${v.row}${v.col}`
  );
  parts.sort();
  return parts.join('|');
}

function assignOfficialIds(pieces: RawPiece[]): Board {
  const hero = pieces.find((p) => p.isHero);
  if (!hero) throw new Error('Missing hero piece');

  const cars = pieces
    .filter((p) => !p.isHero && p.length === 2)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const trucks = pieces
    .filter((p) => !p.isHero && p.length === 3)
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const vehicles: Vehicle[] = [
    {
      id: HERO_ID,
      row: hero.row,
      col: hero.col,
      length: 2,
      orientation: 'H',
    },
  ];

  cars.forEach((p, idx) => {
    vehicles.push({
      id: CAR_IDS[idx],
      row: p.row,
      col: p.col,
      length: 2,
      orientation: p.orientation,
    });
  });

  trucks.forEach((p, idx) => {
    vehicles.push({
      id: TRUCK_IDS[idx],
      row: p.row,
      col: p.col,
      length: 3,
      orientation: p.orientation,
    });
  });

  return { vehicles };
}

function buildOccupancy(pieces: RawPiece[]): Uint8Array {
  const grid = new Uint8Array(36);
  for (const p of pieces) {
    for (let k = 0; k < p.length; k++) {
      const r = p.orientation === 'V' ? p.row + k : p.row;
      const c = p.orientation === 'H' ? p.col + k : p.col;
      grid[r * 6 + c] = 1;
    }
  }
  return grid;
}

function canPlace(
  grid: Uint8Array,
  row: number,
  col: number,
  length: VehicleLength,
  orientation: Orientation,
  heroCol = 0
): boolean {
  if (orientation === 'H') {
    if (col < 0 || col + length > BOARD_SIZE || row < 0 || row >= BOARD_SIZE) {
      return false;
    }
    // Horizontal pieces on EXIT_ROW are only legal strictly to the LEFT of X
    if (row === EXIT_ROW && col + length > heroCol) return false;
    for (let k = 0; k < length; k++) {
      if (grid[row * 6 + col + k] !== 0) return false;
    }
  } else {
    if (row < 0 || row + length > BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return false;
    }
    for (let k = 0; k < length; k++) {
      if (grid[(row + k) * 6 + col] !== 0) return false;
    }
  }
  return true;
}

function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function createRandomBoard(targetPieces: number, heroColOverride?: number): RawPiece[] {
  // Place hero car X at col 0, 1, or 2 (or col 4 for Reverse-BFS guaranteed-solvable seeding)
  const heroCol = heroColOverride ?? randInt(3);
  const pieces: RawPiece[] = [
    {
      isHero: true,
      row: EXIT_ROW,
      col: heroCol,
      length: 2,
      orientation: 'H',
    },
  ];
  const grid = buildOccupancy(pieces);
  let cars = 0;
  let trucks = 0;

  let tries = 0;
  while (pieces.length < targetPieces && tries < 140) {
    tries++;
    const wantTruck =
      trucks < MAX_TRUCKS && (cars >= MAX_CARS || Math.random() < 0.3);
    const length: VehicleLength = wantTruck ? 3 : 2;
    const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V';
    const maxR = orientation === 'V' ? BOARD_SIZE - length : BOARD_SIZE - 1;
    const maxC = orientation === 'H' ? BOARD_SIZE - length : BOARD_SIZE - 1;
    const row = randInt(maxR + 1);
    const col = randInt(maxC + 1);

    if (canPlace(grid, row, col, length, orientation, heroCol)) {
      pieces.push({ isHero: false, row, col, length, orientation });
      for (let k = 0; k < length; k++) {
        const r = orientation === 'V' ? row + k : row;
        const c = orientation === 'H' ? col + k : col;
        grid[r * 6 + c] = 1;
      }
      if (length === 3) trucks++;
      else cars++;
    }
  }

  return pieces;
}

function mutatePieces(pieces: RawPiece[], lockHero = false): RawPiece[] {
  const next = pieces.map((p) => ({ ...p }));
  const heroCol = next[0].col;
  let cars = 0;
  let trucks = 0;
  for (const p of next) {
    if (!p.isHero) {
      if (p.length === 2) cars++;
      else trucks++;
    }
  }

  const action = Math.random();

  if (action < 0.34 && next.length < 16 && (cars < MAX_CARS || trucks < MAX_TRUCKS)) {
    // Add a piece
    const grid = buildOccupancy(next);
    const wantTruck =
      trucks < MAX_TRUCKS && (cars >= MAX_CARS || Math.random() < 0.3);
    const length: VehicleLength = wantTruck ? 3 : 2;
    for (let t = 0; t < 24; t++) {
      const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V';
      const maxR = orientation === 'V' ? BOARD_SIZE - length : BOARD_SIZE - 1;
      const maxC = orientation === 'H' ? BOARD_SIZE - length : BOARD_SIZE - 1;
      const row = randInt(maxR + 1);
      const col = randInt(maxC + 1);
      if (canPlace(grid, row, col, length, orientation, heroCol)) {
        next.push({ isHero: false, row, col, length, orientation });
        return next;
      }
    }
  } else if (action < 0.54 && next.length > (lockHero ? 9 : 5)) {
    // Remove a random non-hero piece
    const idx = 1 + randInt(next.length - 1);
    next.splice(idx, 1);
    return next;
  } else if ((lockHero || action < 0.9) && next.length > 1) {
    // Relocate (and occasionally resize) a random non-hero piece
    const idx = 1 + randInt(next.length - 1);
    const removed = next.splice(idx, 1)[0];
    if (removed.length === 2) cars--;
    else trucks--;

    const grid = buildOccupancy(next);
    let targetLen: VehicleLength = removed.length;
    if (Math.random() < 0.25) {
      if (targetLen === 2 && trucks < MAX_TRUCKS) targetLen = 3;
      else if (targetLen === 3 && cars < MAX_CARS) targetLen = 2;
    }

    for (let t = 0; t < 24; t++) {
      const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V';
      const maxR = orientation === 'V' ? BOARD_SIZE - targetLen : BOARD_SIZE - 1;
      const maxC = orientation === 'H' ? BOARD_SIZE - targetLen : BOARD_SIZE - 1;
      const row = randInt(maxR + 1);
      const col = randInt(maxC + 1);
      if (canPlace(grid, row, col, targetLen, orientation, heroCol)) {
        next.push({ isHero: false, row, col, length: targetLen, orientation });
        return next;
      }
    }
    next.push(removed);
  } else if (!lockHero) {
    // Shift hero car col
    const hero = next[0];
    const withoutHero = next.slice(1);
    const grid = buildOccupancy(withoutHero);
    const candidateCols = [0, 1, 2, 3].filter((c) => c !== hero.col);
    const newCol = candidateCols[randInt(candidateCols.length)];
    if (grid[EXIT_ROW * 6 + newCol] === 0 && grid[EXIT_ROW * 6 + newCol + 1] === 0) {
      hero.col = newCol;
    }
  }

  return next;
}

function distanceToRange(val: number, min: number, max: number): number {
  if (val < min) return min - val;
  if (val > max) return val - max;
  return 0;
}

/**
 * Removes blocking pieces that do not change the optimal move count,
 * keeping generated cards crisp and uncluttered like official ThinkFun cards.
 */
function pruneRedundantPieces(pieces: RawPiece[], targetMoves: number): RawPiece[] {
  let current = pieces.map((p) => ({ ...p }));
  let changed = true;

  while (changed) {
    changed = false;
    for (let i = current.length - 1; i >= 1; i--) {
      const candidate = current.filter((_, idx) => idx !== i);
      const sol = solveBoard(assignOfficialIds(candidate), 40000);
      if (sol.solvable && sol.moveCount === targetMoves) {
        current = candidate;
        changed = true;
      }
    }
  }

  return current;
}

/**
 * Parses a 36-char row-major Rush Hour layout string ('o'/'.' = empty, 'A' = hero X)
 * into RawPiece[] for high-depth structural mutation seeding.
 */
function parseLayoutSeed(layout: string): RawPiece[] {
  const seen = new Set<string>();
  const pieces: RawPiece[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const ch = layout[r * 6 + c];
      if (!ch || ch === 'o' || ch === '.' || seen.has(ch)) continue;
      seen.add(ch);
      let length = 1;
      let orientation: Orientation = 'H';
      if (c + 1 < 6 && layout[r * 6 + (c + 1)] === ch) {
        orientation = 'H';
        while (c + length < 6 && layout[r * 6 + (c + length)] === ch) length++;
      } else {
        orientation = 'V';
        while (r + length < 6 && layout[(r + length) * 6 + c] === ch) length++;
      }
      if (length === 2 || length === 3) {
        pieces.push({
          isHero: ch === 'A',
          row: r,
          col: c,
          length,
          orientation,
        });
      }
    }
  }
  // Ensure hero is at index 0
  const heroIdx = pieces.findIndex((p) => p.isHero);
  if (heroIdx > 0) {
    const [hero] = pieces.splice(heroIdx, 1);
    pieces.unshift(hero);
  }
  return pieces;
}

// High-depth structural seed (Fogleman 51-move 6x6 cluster) used as a live mutation
// starting basin when generating rare 35–51 move Expert/Grand Master puzzles.
const HIGH_DEPTH_SEEDS: RawPiece[][] = [
  parseLayoutSeed('GBBoLoGHIoLMGHIAAMCCCKoMooJKDDEEJFFo'),
];

/**
 * Computes evenly distributed target buckets across [minMoves, maxMoves]
 * so range generation spans the entire requested range instead of clustering at minMoves.
 */
export function computeStratifiedRanges(
  count: number,
  minMoves: number,
  maxMoves: number
): Array<{ min: number; max: number }> {
  const lo = Math.max(1, Math.min(51, Math.floor(minMoves)));
  const hi = Math.max(lo, Math.min(51, Math.floor(maxMoves)));

  if (lo === hi) {
    return Array.from({ length: count }, () => ({ min: lo, max: hi }));
  }

  if (count <= 1) {
    const pick = lo + randInt(hi - lo + 1);
    return [{ min: pick, max: pick }];
  }

  const ranges: Array<{ min: number; max: number }> = [];
  for (let i = 0; i < count; i++) {
    const center = Math.round(lo + (i / (count - 1)) * (hi - lo));
    // For extreme 46–51 targets, allow a ±1 cushion so rare move counts still hit fast
    const pad = center >= 46 ? 1 : 0;
    ranges.push({
      min: Math.max(lo, center - pad),
      max: Math.min(hi, center + pad),
    });
  }
  return ranges;
}

/**
 * Live-generates a unique Rush Hour puzzle matching [minMoves, maxMoves].
 * Uses fast single-state sampling for easy puzzles, and Component Reverse-BFS
 * hill-climbing for medium/hard/Grand Master (40–51 move) puzzles.
 */
export function generatePuzzle(
  options: GenerateOptions,
  cardNumber = 1,
  existingKeys?: Set<string>,
  shouldAbort?: () => boolean
): PuzzleCard | null {
  const minMoves = Math.max(1, Math.min(51, Math.floor(options.minMoves)));
  const maxMoves = Math.max(minMoves, Math.min(51, Math.floor(options.maxMoves)));
  const prune = options.pruneRedundant ?? true;

  // Use Component Reverse-BFS whenever targeting 15+ moves (dramatically faster for Expert & Grand Master)
  if (minMoves >= 15) {
    return generateWithReverseBfs(
      minMoves,
      maxMoves,
      prune,
      cardNumber,
      existingKeys,
      shouldAbort,
      options.maxAttempts
    );
  }

  const maxAttempts = options.maxAttempts ?? 2500;

  const desiredPieceCount = () => {
    if (maxMoves <= 8) return 6 + randInt(4); // 6..9
    return 8 + randInt(5); // 8..12
  };

  let currentPieces = createRandomBoard(desiredPieceCount());
  let currentSol = solveBoard(assignOfficialIds(currentPieces), 60000);
  let currentDist = currentSol.solvable
    ? distanceToRange(currentSol.moveCount, minMoves, maxMoves)
    : 999;

  let stagnant = 0;
  const restartLimit = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (shouldAbort?.()) return null;

    if (currentSol.solvable && currentDist === 0) {
      const card = finalizeCandidate(
        currentPieces,
        currentSol.moveCount,
        minMoves,
        maxMoves,
        prune,
        cardNumber,
        existingKeys
      );
      if (card) return card;
      stagnant = restartLimit;
    }

    if (!currentSol.solvable || stagnant >= restartLimit) {
      currentPieces = createRandomBoard(desiredPieceCount());
      currentSol = solveBoard(assignOfficialIds(currentPieces), 60000);
      currentDist = currentSol.solvable
        ? distanceToRange(currentSol.moveCount, minMoves, maxMoves)
        : 999;
      stagnant = 0;
      continue;
    }

    const candidatePieces = mutatePieces(currentPieces);
    const candidateSol = solveBoard(assignOfficialIds(candidatePieces), 60000);

    if (!candidateSol.solvable || candidateSol.moveCount === 0) {
      stagnant++;
      continue;
    }

    const candidateDist = distanceToRange(
      candidateSol.moveCount,
      minMoves,
      maxMoves
    );

    const accept =
      candidateDist < currentDist ||
      (candidateDist === currentDist && Math.random() < 0.5) ||
      (candidateDist <= currentDist + 3 && Math.random() < 0.08);

    if (accept) {
      if (candidateDist < currentDist) stagnant = 0;
      else stagnant++;
      currentPieces = candidatePieces;
      currentSol = candidateSol;
      currentDist = candidateDist;
    } else {
      stagnant++;
    }
  }

  return null;
}

function boardToRawPieces(board: Board): RawPiece[] {
  return board.vehicles.map((v) => ({
    isHero: v.id === HERO_ID,
    row: v.row,
    col: v.col,
    length: v.length,
    orientation: v.orientation,
  }));
}

function finalizeCandidate(
  pieces: RawPiece[],
  expectedMoves: number,
  minMoves: number,
  maxMoves: number,
  prune: boolean,
  cardNumber: number,
  existingKeys?: Set<string>
): PuzzleCard | null {
  const finalPieces = prune
    ? pruneRedundantPieces(pieces, expectedMoves)
    : pieces;
  const finalBoard = assignOfficialIds(finalPieces);
  const key = canonicalBoardKey(finalBoard);

  if (existingKeys?.has(key)) return null;

  const finalSol = solveBoard(finalBoard, 150000);
  if (
    !finalSol.solvable ||
    finalSol.moveCount < minMoves ||
    finalSol.moveCount > maxMoves
  ) {
    return null;
  }

  existingKeys?.add(key);
  const code = encodeBoard(finalBoard);
  return {
    id: `${code}-${cardNumber}`,
    cardNumber,
    code,
    board: finalBoard,
    moves: finalSol.moves,
    moveCount: finalSol.moveCount,
    difficulty: getDifficultyTier(finalSol.moveCount),
  };
}

function generateWithReverseBfs(
  minMoves: number,
  maxMoves: number,
  prune: boolean,
  cardNumber: number,
  existingKeys?: Set<string>,
  shouldAbort?: () => boolean,
  maxAttemptsOverride?: number
): PuzzleCard | null {
  const isGrandMaster = minMoves >= 34;
  const maxAttempts = maxAttemptsOverride ?? (isGrandMaster ? 1500 : 1600);
  const restartLimit = isGrandMaster ? 45 : 40;
  // Tight 12–15 piece boards have compact, deep components (usually 150–6,000 states),
  // so capping at 8,000 keeps every Reverse-BFS evaluation ~0.5–2ms!
  const stateCap = 8000;

  // For rare 34–51 move puzzles (or as a fallback after fresh attempts for 22–33 moves),
  // seed via live random mutations of high-depth structural basins so every card is distinct and fast.
  const seedBoard = (attempt: number) => {
    const useBasin =
      HIGH_DEPTH_SEEDS.length > 0 &&
      (isGrandMaster || (minMoves >= 22 && attempt >= 60));

    if (useBasin) {
      const base = HIGH_DEPTH_SEEDS[randInt(HIGH_DEPTH_SEEDS.length)].map((p) => ({
        ...p,
      }));
      const numMutations =
        minMoves >= 48
          ? attempt < 3
            ? randInt(2)
            : 1 + randInt(2)
          : isGrandMaster
            ? 1 + randInt(3)
            : 3 + randInt(4); // Heavy 3–6 piece mutations for 22–33 move variety
      let mutated = base;
      for (let m = 0; m < numMutations; m++) {
        mutated = mutatePieces(mutated, false);
      }
      return mutated;
    }
    const targetPieces = 10 + randInt(4); // 10..13
    return createRandomBoard(targetPieces, 4);
  };

  let currentPieces = seedBoard(0);
  let currentRes = findComponentTarget(
    assignOfficialIds(currentPieces),
    minMoves,
    maxMoves,
    stateCap
  );
  let bestPieces = currentPieces;
  let bestDepth = currentRes.maxDepth;
  let stagnant = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (shouldAbort?.()) return null;

    if (currentRes.matchedBoard) {
      const matchedRaw = boardToRawPieces(currentRes.matchedBoard);
      const card = finalizeCandidate(
        matchedRaw,
        currentRes.matchedMoves,
        minMoves,
        maxMoves,
        prune,
        cardNumber,
        existingKeys
      );
      if (card) return card;
      stagnant = restartLimit;
    }

    if (!currentRes.solvable || stagnant >= restartLimit) {
      if (bestDepth >= Math.min(28, minMoves - 5) && Math.random() < 0.3) {
        currentPieces = mutatePieces(mutatePieces(bestPieces, !isGrandMaster), !isGrandMaster);
      } else {
        currentPieces = seedBoard(attempt);
      }
      currentRes = findComponentTarget(
        assignOfficialIds(currentPieces),
        minMoves,
        maxMoves,
        stateCap
      );
      stagnant = 0;
      continue;
    }

    const candidatePieces = mutatePieces(currentPieces, !isGrandMaster);
    const candidateRes = findComponentTarget(
      assignOfficialIds(candidatePieces),
      minMoves,
      maxMoves,
      stateCap
    );

    if (!candidateRes.solvable) {
      stagnant++;
      continue;
    }

    if (candidateRes.matchedBoard) {
      currentPieces = candidatePieces;
      currentRes = candidateRes;
      continue;
    }

    if (candidateRes.maxDepth > bestDepth) {
      bestDepth = candidateRes.maxDepth;
      bestPieces = candidatePieces;
    }

    const curGap = Math.max(0, minMoves - currentRes.maxDepth);
    const candGap = Math.max(0, minMoves - candidateRes.maxDepth);

    const accept =
      candGap < curGap ||
      (candGap === curGap && candidateRes.maxDepth > 0 && Math.random() < 0.35);

    if (accept) {
      if (candGap < curGap) stagnant = 0;
      else stagnant++;
      currentPieces = candidatePieces;
      currentRes = candidateRes;
    } else {
      stagnant++;
    }
  }

  return null;
}
