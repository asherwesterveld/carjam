import { describe, expect, it } from 'vitest';
import { applyMove, formatMove, MAX_CARS, MAX_TRUCKS } from './catalog';
import { decodeBoard, encodeBoard } from './codec';
import { canonicalBoardKey, computeStratifiedRanges, generatePuzzle } from './generator';
import { solveBoard, validateBoard } from './solver';
import type { Board } from './types';

// Classic ThinkFun Rush Hour Card #1 (optimal: 8 slide moves)
const CLASSIC_CARD_1: Board = {
  vehicles: [
    { id: 'A', row: 0, col: 0, length: 2, orientation: 'H' },
    { id: 'O', row: 0, col: 5, length: 3, orientation: 'V' },
    { id: 'P', row: 1, col: 0, length: 3, orientation: 'V' },
    { id: 'Q', row: 1, col: 3, length: 3, orientation: 'V' },
    { id: 'X', row: 2, col: 1, length: 2, orientation: 'H' },
    { id: 'B', row: 4, col: 0, length: 2, orientation: 'V' },
    { id: 'C', row: 4, col: 4, length: 2, orientation: 'H' },
    { id: 'R', row: 5, col: 2, length: 3, orientation: 'H' },
  ],
};

describe('Rush Hour Engine', () => {
  it('validates physical board constraints properly', () => {
    expect(validateBoard(CLASSIC_CARD_1).valid).toBe(true);

    // Overlapping pieces should fail
    const overlapping: Board = {
      vehicles: [
        { id: 'X', row: 2, col: 1, length: 2, orientation: 'H' },
        { id: 'A', row: 1, col: 2, length: 2, orientation: 'V' },
      ],
    };
    expect(validateBoard(overlapping).valid).toBe(false);

    // Out of bounds should fail
    const oob: Board = {
      vehicles: [
        { id: 'X', row: 2, col: 5, length: 2, orientation: 'H' },
      ],
    };
    expect(validateBoard(oob).valid).toBe(false);
  });

  it('solves Classic Card #1 in exactly 8 slide moves and replays validly', () => {
    const sol = solveBoard(CLASSIC_CARD_1);
    expect(sol.solvable).toBe(true);
    expect(sol.moveCount).toBe(8);
    expect(sol.moves).toHaveLength(8);
    expect(sol.moves[sol.moves.length - 1].vehicleId).toBe('X');
    expect(sol.moves[sol.moves.length - 1].isExit).toBe(true);
    expect(formatMove(sol.moves[sol.moves.length - 1])).toBe('X→💨');

    // Replay every move and verify board stays valid and ends with X at col 4
    let current = CLASSIC_CARD_1;
    for (const move of sol.moves) {
      current = applyMove(current, move);
      expect(validateBoard(current).valid).toBe(true);
    }
    const hero = current.vehicles.find((v) => v.id === 'X');
    expect(hero?.col).toBe(4);
  });

  it('round-trips board codes losslessly and rejects corrupted codes', () => {
    const code = encodeBoard(CLASSIC_CARD_1);
    expect(code.startsWith('RH-')).toBe(false);
    expect(code).toMatch(/^[0-9A-Z-]+$/);

    const decoded = decodeBoard(code);
    expect(decoded).not.toBeNull();
    expect(canonicalBoardKey(decoded!)).toBe(canonicalBoardKey(CLASSIC_CARD_1));
    expect(solveBoard(decoded!).moveCount).toBe(8);

    // Backward-compatible decoding of legacy RH- prefixed codes
    expect(decodeBoard(`RH-${code}`)).not.toBeNull();

    // Corrupted checksum should fail
    const badCode = code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A');
    expect(decodeBoard(badCode)).toBeNull();
  });

  it('live-generates valid puzzles for exact move counts within physical limits', () => {
    const card = generatePuzzle({ minMoves: 10, maxMoves: 10 }, 1);
    expect(card).not.toBeNull();
    expect(card!.moveCount).toBe(10);
    expect(validateBoard(card!.board).valid).toBe(true);

    const cars = card!.board.vehicles.filter((v) => v.id !== 'X' && v.length === 2);
    const trucks = card!.board.vehicles.filter((v) => v.length === 3);
    expect(cars.length).toBeLessThanOrEqual(MAX_CARS);
    expect(trucks.length).toBeLessThanOrEqual(MAX_TRUCKS);

    // Verify independent re-solve matches moveCount
    expect(solveBoard(card!.board).moveCount).toBe(10);
  });

  it('live-generates unique puzzles across a move range', () => {
    const seen = new Set<string>();
    const cards = [];
    for (let i = 1; i <= 5; i++) {
      const card = generatePuzzle({ minMoves: 12, maxMoves: 20 }, i, seen);
      expect(card).not.toBeNull();
      expect(card!.moveCount).toBeGreaterThanOrEqual(12);
      expect(card!.moveCount).toBeLessThanOrEqual(20);
      cards.push(card!);
    }
    expect(seen.size).toBe(5);
  });

  it('live-generates harder puzzles (24+ moves)', () => {
    const card = generatePuzzle({ minMoves: 24, maxMoves: 32 }, 1);
    expect(card).not.toBeNull();
    expect(card!.moveCount).toBeGreaterThanOrEqual(24);
    expect(card!.moveCount).toBeLessThanOrEqual(32);
    expect(solveBoard(card!.board).moveCount).toBe(card!.moveCount);
  });

  it('stratifies range targets evenly from min to max', () => {
    const buckets = computeStratifiedRanges(9, 8, 18);
    expect(buckets).toHaveLength(9);
    expect(buckets[0].min).toBe(8);
    expect(buckets[8].max).toBe(18);
    // Middle card should target the midpoint (~13)
    expect(buckets[4].min).toBe(13);
  });

  it('live-generates 9 unique Grand Master puzzles (40–51 moves) reliably', () => {
    const seen = new Set<string>();
    const buckets = computeStratifiedRanges(9, 40, 51);
    const moveCounts: number[] = [];

    for (let i = 0; i < 9; i++) {
      let card = generatePuzzle(
        { minMoves: buckets[i].min, maxMoves: buckets[i].max },
        i + 1,
        seen
      );
      if (!card) {
        card = generatePuzzle({ minMoves: 40, maxMoves: 51 }, i + 1, seen);
      }
      expect(card).not.toBeNull();
      expect(card!.moveCount).toBeGreaterThanOrEqual(40);
      expect(card!.moveCount).toBeLessThanOrEqual(51);
      expect(validateBoard(card!.board).valid).toBe(true);
      expect(solveBoard(card!.board).moveCount).toBe(card!.moveCount);
      moveCounts.push(card!.moveCount);
    }
    expect(seen.size).toBe(9);
    // Verify spread reaches into the upper Grand Master range (45+)
    expect(Math.max(...moveCounts)).toBeGreaterThanOrEqual(45);
  }, 30000);
});
