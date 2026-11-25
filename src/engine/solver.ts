import {
  BOARD_SIZE,
  CAR_IDS,
  EXIT_ROW,
  HERO_ID,
  MAX_CARS,
  MAX_TRUCKS,
  TRUCK_IDS,
} from './catalog';
import type { Board, Direction, Move, Solution, Vehicle, VehicleId } from './types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const CAR_SET = new Set<VehicleId>(CAR_IDS);
const TRUCK_SET = new Set<VehicleId>(TRUCK_IDS);

export function validateBoard(board: Board): ValidationResult {
  const seenIds = new Set<VehicleId>();
  const occupied = new Uint8Array(BOARD_SIZE * BOARD_SIZE);
  let heroCount = 0;
  let carCount = 0;
  let truckCount = 0;

  for (const v of board.vehicles) {
    if (seenIds.has(v.id)) {
      return { valid: false, error: `Duplicate vehicle ID: ${v.id}` };
    }
    seenIds.add(v.id);

    if (v.id === HERO_ID) {
      heroCount++;
      if (v.orientation !== 'H' || v.row !== EXIT_ROW || v.length !== 2) {
        return {
          valid: false,
          error: 'Hero car X must be horizontal, length 2, on row 2',
        };
      }
    } else if (CAR_SET.has(v.id)) {
      carCount++;
      if (v.length !== 2) {
        return { valid: false, error: `Car ${v.id} must have length 2` };
      }
    } else if (TRUCK_SET.has(v.id)) {
      truckCount++;
      if (v.length !== 3) {
        return { valid: false, error: `Truck ${v.id} must have length 3` };
      }
    } else {
      return { valid: false, error: `Unknown vehicle ID: ${v.id}` };
    }

    for (let k = 0; k < v.length; k++) {
      const r = v.orientation === 'V' ? v.row + k : v.row;
      const c = v.orientation === 'H' ? v.col + k : v.col;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
        return { valid: false, error: `Vehicle ${v.id} is out of bounds` };
      }
      const idx = r * BOARD_SIZE + c;
      if (occupied[idx] !== 0) {
        return { valid: false, error: `Overlap detected at (${r}, ${c})` };
      }
      occupied[idx] = 1;
    }
  }

  if (heroCount !== 1) {
    return { valid: false, error: 'Board must contain exactly 1 hero car (X)' };
  }
  if (carCount > MAX_CARS) {
    return { valid: false, error: `Too many cars: ${carCount} > ${MAX_CARS}` };
  }
  if (truckCount > MAX_TRUCKS) {
    return { valid: false, error: `Too many trucks: ${truckCount} > ${MAX_TRUCKS}` };
  }

  return { valid: true };
}

/**
 * Packs up to 16 vehicle positions (each 0..4, 3 bits) into a single
 * JS safe integer (max 48 bits < 2^53 - 1) for allocation-free BFS visited checks.
 */
function encodePositions(pos: Uint8Array, n: number): number {
  let lo = 0;
  let hi = 0;
  const split = n < 8 ? n : 8;
  for (let i = 0; i < split; i++) {
    lo |= pos[i] << (i * 3);
  }
  for (let i = 8; i < n; i++) {
    hi |= pos[i] << ((i - 8) * 3);
  }
  return lo + hi * 16777216; // 2^24
}

/**
 * Solves a 6x6 Rush Hour board for the exact minimum number of SLIDE moves.
 * A slide moves one vehicle any number of unobstructed squares in one turn.
 */
export function solveBoard(board: Board, maxStates = 120000): Solution {
  const n = board.vehicles.length;
  if (n === 0) {
    return { solvable: false, moves: [], moveCount: -1, statesExplored: 0 };
  }

  // Put hero car X at index 0
  const vehicles: Vehicle[] = new Array(n);
  let heroIdx = -1;
  for (let i = 0; i < n; i++) {
    if (board.vehicles[i].id === HERO_ID) {
      heroIdx = i;
      break;
    }
  }
  if (heroIdx === -1) {
    return { solvable: false, moves: [], moveCount: -1, statesExplored: 0 };
  }

  vehicles[0] = board.vehicles[heroIdx];
  let out = 1;
  for (let i = 0; i < n; i++) {
    if (i !== heroIdx) vehicles[out++] = board.vehicles[i];
  }

  const isH = new Uint8Array(n);
  const fixed = new Uint8Array(n);
  const len = new Uint8Array(n);
  const startPos = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const v = vehicles[i];
    isH[i] = v.orientation === 'H' ? 1 : 0;
    fixed[i] = v.orientation === 'H' ? v.row : v.col;
    len[i] = v.length;
    startPos[i] = v.orientation === 'H' ? v.col : v.row;
  }

  // Already at exit
  if (startPos[0] === 4) {
    return { solvable: true, moves: [], moveCount: 0, statesExplored: 1 };
  }

  const visited = new Set<number>();
  const startKey = encodePositions(startPos, n);
  visited.add(startKey);

  // Queue arrays for BFS
  const stateQueue: Uint8Array[] = [startPos];
  const parentIdx: number[] = [-1];
  // Packed move: (vehIdx << 8) | (dirCode << 4) | steps
  // dirCode: 0=L, 1=R, 2=U, 3=D
  const movePacked: number[] = [0];

  const grid = new Uint8Array(36);
  let head = 0;

  while (head < stateQueue.length && visited.size <= maxStates) {
    const cur = stateQueue[head];

    // Fill occupancy grid
    grid.fill(0);
    for (let i = 0; i < n; i++) {
      const p = cur[i];
      const f = fixed[i];
      const l = len[i];
      if (isH[i]) {
        const base = f * 6 + p;
        grid[base] = 1;
        grid[base + 1] = 1;
        if (l === 3) grid[base + 2] = 1;
      } else {
        const base = p * 6 + f;
        grid[base] = 1;
        grid[base + 6] = 1;
        if (l === 3) grid[base + 12] = 1;
      }
    }

    // Generate all valid single-vehicle slides
    for (let i = 0; i < n; i++) {
      const p = cur[i];
      const f = fixed[i];
      const l = len[i];

      if (isH[i]) {
        const rowBase = f * 6;
        // Slide left
        for (let step = 1; p - step >= 0; step++) {
          if (grid[rowBase + p - step] !== 0) break;
          const next = new Uint8Array(cur);
          next[i] = p - step;
          const key = encodePositions(next, n);
          if (!visited.has(key)) {
            visited.add(key);
            stateQueue.push(next);
            parentIdx.push(head);
            movePacked.push((i << 8) | (0 << 4) | step);
          }
        }
        // Slide right
        for (let step = 1; p + l - 1 + step < BOARD_SIZE; step++) {
          if (grid[rowBase + p + l - 1 + step] !== 0) break;
          const newPos = p + step;
          const packed = (i << 8) | (1 << 4) | step;
          if (i === 0 && newPos === 4) {
            // Reached exit! Reconstruct path
            const moves = reconstructMoves(
              vehicles,
              parentIdx,
              movePacked,
              head,
              packed
            );
            return {
              solvable: true,
              moves,
              moveCount: moves.length,
              statesExplored: visited.size,
            };
          }
          const next = new Uint8Array(cur);
          next[i] = newPos;
          const key = encodePositions(next, n);
          if (!visited.has(key)) {
            visited.add(key);
            stateQueue.push(next);
            parentIdx.push(head);
            movePacked.push(packed);
          }
        }
      } else {
        // Slide up
        for (let step = 1; p - step >= 0; step++) {
          if (grid[(p - step) * 6 + f] !== 0) break;
          const next = new Uint8Array(cur);
          next[i] = p - step;
          const key = encodePositions(next, n);
          if (!visited.has(key)) {
            visited.add(key);
            stateQueue.push(next);
            parentIdx.push(head);
            movePacked.push((i << 8) | (2 << 4) | step);
          }
        }
        // Slide down
        for (let step = 1; p + l - 1 + step < BOARD_SIZE; step++) {
          if (grid[(p + l - 1 + step) * 6 + f] !== 0) break;
          const next = new Uint8Array(cur);
          next[i] = p + step;
          const key = encodePositions(next, n);
          if (!visited.has(key)) {
            visited.add(key);
            stateQueue.push(next);
            parentIdx.push(head);
            movePacked.push((i << 8) | (3 << 4) | step);
          }
        }
      }
    }

    head++;
  }

  return {
    solvable: false,
    moves: [],
    moveCount: -1,
    statesExplored: visited.size,
  };
}

const DIR_FROM_CODE: readonly Direction[] = ['L', 'R', 'U', 'D'];

function reconstructMoves(
  vehicles: Vehicle[],
  parentIdx: number[],
  movePacked: number[],
  lastParent: number,
  finalPacked: number
): Move[] {
  const rev: Move[] = [];

  const pushPacked = (packed: number, isExit: boolean) => {
    const vehIdx = packed >> 8;
    const dirCode = (packed >> 4) & 0xf;
    const steps = packed & 0xf;
    rev.push({
      vehicleId: vehicles[vehIdx].id,
      direction: DIR_FROM_CODE[dirCode],
      steps,
      ...(isExit ? { isExit: true } : {}),
    });
  };

  pushPacked(finalPacked, true);
  let idx = lastParent;
  while (idx > 0) {
    pushPacked(movePacked[idx], false);
    idx = parentIdx[idx];
  }

  rev.reverse();
  return rev;
}

export interface ComponentTargetResult {
  solvable: boolean;
  maxDepth: number;
  matchedBoard: Board | null;
  matchedMoves: number;
}

/**
 * Explores the board's reachable component and runs multi-source Reverse BFS
 * from ALL winning states (X.col === 4) in that component.
 * Because Rush Hour slides are symmetric, this computes the exact optimal move
 * count for every state in the component in one pass—allowing rapid discovery
 * of 40–51 move Grand Master puzzles.
 */
export function findComponentTarget(
  board: Board,
  minMoves: number,
  maxMoves: number,
  maxStates = 35000
): ComponentTargetResult {
  const n = board.vehicles.length;
  if (n === 0) {
    return { solvable: false, maxDepth: -1, matchedBoard: null, matchedMoves: -1 };
  }

  const vehicles: Vehicle[] = new Array(n);
  let heroIdx = -1;
  for (let i = 0; i < n; i++) {
    if (board.vehicles[i].id === HERO_ID) {
      heroIdx = i;
      break;
    }
  }
  if (heroIdx === -1) {
    return { solvable: false, maxDepth: -1, matchedBoard: null, matchedMoves: -1 };
  }

  vehicles[0] = board.vehicles[heroIdx];
  let out = 1;
  for (let i = 0; i < n; i++) {
    if (i !== heroIdx) vehicles[out++] = board.vehicles[i];
  }

  const isH = new Uint8Array(n);
  const fixed = new Uint8Array(n);
  const len = new Uint8Array(n);
  const startPos = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const v = vehicles[i];
    isH[i] = v.orientation === 'H' ? 1 : 0;
    fixed[i] = v.orientation === 'H' ? v.row : v.col;
    len[i] = v.length;
    startPos[i] = v.orientation === 'H' ? v.col : v.row;
  }

  // Pass 1: Forward BFS to discover reachable states & winning states
  const keyToIdx = new Map<number, number>();
  const states: Uint8Array[] = [startPos];
  keyToIdx.set(encodePositions(startPos, n), 0);

  const winIndices: number[] = [];
  if (startPos[0] === 4) winIndices.push(0);

  const grid = new Uint8Array(36);
  const temp = new Uint8Array(n);
  let head = 0;

  while (head < states.length && states.length < maxStates) {
    const cur = states[head];
    grid.fill(0);
    for (let i = 0; i < n; i++) {
      const p = cur[i];
      const f = fixed[i];
      const l = len[i];
      temp[i] = p;
      if (isH[i]) {
        const base = f * 6 + p;
        grid[base] = 1;
        grid[base + 1] = 1;
        if (l === 3) grid[base + 2] = 1;
      } else {
        const base = p * 6 + f;
        grid[base] = 1;
        grid[base + 6] = 1;
        if (l === 3) grid[base + 12] = 1;
      }
    }

    for (let i = 0; i < n && states.length < maxStates; i++) {
      const p = cur[i];
      const f = fixed[i];
      const l = len[i];

      if (isH[i]) {
        const rowBase = f * 6;
        for (let step = 1; p - step >= 0; step++) {
          if (grid[rowBase + p - step] !== 0) break;
          temp[i] = p - step;
          const key = encodePositions(temp, n);
          if (!keyToIdx.has(key)) {
            const idx = states.length;
            keyToIdx.set(key, idx);
            states.push(new Uint8Array(temp));
            if (temp[0] === 4) winIndices.push(idx);
            if (states.length >= maxStates) break;
          }
        }
        for (let step = 1; p + l - 1 + step < BOARD_SIZE; step++) {
          if (grid[rowBase + p + l - 1 + step] !== 0) break;
          temp[i] = p + step;
          const key = encodePositions(temp, n);
          if (!keyToIdx.has(key)) {
            const idx = states.length;
            keyToIdx.set(key, idx);
            states.push(new Uint8Array(temp));
            if (temp[0] === 4) winIndices.push(idx);
            if (states.length >= maxStates) break;
          }
        }
        temp[i] = p;
      } else {
        for (let step = 1; p - step >= 0; step++) {
          if (grid[(p - step) * 6 + f] !== 0) break;
          temp[i] = p - step;
          const key = encodePositions(temp, n);
          if (!keyToIdx.has(key)) {
            const idx = states.length;
            keyToIdx.set(key, idx);
            states.push(new Uint8Array(temp));
            if (states.length >= maxStates) break;
          }
        }
        for (let step = 1; p + l - 1 + step < BOARD_SIZE; step++) {
          if (grid[(p + l - 1 + step) * 6 + f] !== 0) break;
          temp[i] = p + step;
          const key = encodePositions(temp, n);
          if (!keyToIdx.has(key)) {
            const idx = states.length;
            keyToIdx.set(key, idx);
            states.push(new Uint8Array(temp));
            if (states.length >= maxStates) break;
          }
        }
        temp[i] = p;
      }
    }
    head++;
  }

  if (winIndices.length === 0) {
    return { solvable: false, maxDepth: -1, matchedBoard: null, matchedMoves: -1 };
  }

  // Fast reject: if the entire component has fewer states than minMoves, it can never reach minMoves
  if (states.length <= minMoves) {
    return { solvable: true, maxDepth: Math.max(0, states.length - 1), matchedBoard: null, matchedMoves: -1 };
  }

  // Pass 2: Multi-source Reverse BFS from all winning states in this component
  const dist = new Int16Array(states.length);
  dist.fill(-1);
  const rQueue = new Int32Array(states.length);
  let rHead = 0;
  let rTail = 0;

  for (const wIdx of winIndices) {
    dist[wIdx] = 0;
    rQueue[rTail++] = wIdx;
  }

  let maxDepth = 0;
  const matchedIndices: number[] = [];

  while (rHead < rTail) {
    const u = rQueue[rHead++];
    const uDist = dist[u];
    const cur = states[u];

    if (uDist > maxDepth) maxDepth = uDist;
    if (uDist >= minMoves && uDist <= maxMoves) {
      matchedIndices.push(u);
    }

    grid.fill(0);
    for (let i = 0; i < n; i++) {
      const p = cur[i];
      const f = fixed[i];
      const l = len[i];
      temp[i] = p;
      if (isH[i]) {
        const base = f * 6 + p;
        grid[base] = 1;
        grid[base + 1] = 1;
        if (l === 3) grid[base + 2] = 1;
      } else {
        const base = p * 6 + f;
        grid[base] = 1;
        grid[base + 6] = 1;
        if (l === 3) grid[base + 12] = 1;
      }
    }

    const nextDist = uDist + 1;

    for (let i = 0; i < n; i++) {
      const p = cur[i];
      const f = fixed[i];
      const l = len[i];

      if (isH[i]) {
        const rowBase = f * 6;
        for (let step = 1; p - step >= 0; step++) {
          if (grid[rowBase + p - step] !== 0) break;
          temp[i] = p - step;
          const v = keyToIdx.get(encodePositions(temp, n));
          if (v !== undefined && dist[v] === -1) {
            dist[v] = nextDist;
            rQueue[rTail++] = v;
          }
        }
        for (let step = 1; p + l - 1 + step < BOARD_SIZE; step++) {
          if (grid[rowBase + p + l - 1 + step] !== 0) break;
          temp[i] = p + step;
          const v = keyToIdx.get(encodePositions(temp, n));
          if (v !== undefined && dist[v] === -1) {
            dist[v] = nextDist;
            rQueue[rTail++] = v;
          }
        }
        temp[i] = p;
      } else {
        for (let step = 1; p - step >= 0; step++) {
          if (grid[(p - step) * 6 + f] !== 0) break;
          temp[i] = p - step;
          const v = keyToIdx.get(encodePositions(temp, n));
          if (v !== undefined && dist[v] === -1) {
            dist[v] = nextDist;
            rQueue[rTail++] = v;
          }
        }
        for (let step = 1; p + l - 1 + step < BOARD_SIZE; step++) {
          if (grid[(p + l - 1 + step) * 6 + f] !== 0) break;
          temp[i] = p + step;
          const v = keyToIdx.get(encodePositions(temp, n));
          if (v !== undefined && dist[v] === -1) {
            dist[v] = nextDist;
            rQueue[rTail++] = v;
          }
        }
        temp[i] = p;
      }
    }
  }

  if (matchedIndices.length === 0) {
    return { solvable: true, maxDepth, matchedBoard: null, matchedMoves: -1 };
  }

  // Prefer matched states where Hero Car X starts further left (col <= 2)
  const leftHero = matchedIndices.filter((idx) => states[idx][0] <= 2);
  const pool = leftHero.length > 0 ? leftHero : matchedIndices;
  const chosenIdx = pool[Math.floor(Math.random() * pool.length)];
  const chosenPos = states[chosenIdx];

  const matchedBoard: Board = {
    vehicles: vehicles.map((v, i) => ({
      ...v,
      row: v.orientation === 'V' ? chosenPos[i] : v.row,
      col: v.orientation === 'H' ? chosenPos[i] : v.col,
    })),
  };

  return {
    solvable: true,
    maxDepth,
    matchedBoard,
    matchedMoves: dist[chosenIdx],
  };
}
