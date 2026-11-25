import { ALL_VEHICLE_IDS, BOARD_SIZE, VEHICLE_CATALOG } from './catalog';
import { validateBoard } from './solver';
import type { Board, Orientation, Vehicle, VehicleId } from './types';

const ID_TO_INDEX = new Map<VehicleId, number>(
  ALL_VEHICLE_IDS.map((id, i) => [id, i])
);

/**
 * Encodes a board into a compact, human-typable puzzle code with checksum.
 * Preserves exact vehicle IDs (colors), orientations, and coordinates.
 * Format: XXXX-XXXX-... (decoder also accepts legacy RH-XXXX-... codes).
 */
export function encodeBoard(board: Board): string {
  // Sort deterministically for canonical codes
  const sorted = [...board.vehicles].sort((a, b) => {
    const ai = ID_TO_INDEX.get(a.id) ?? 0;
    const bi = ID_TO_INDEX.get(b.id) ?? 0;
    return ai - bi;
  });

  // Pack 11 bits per vehicle: [idIdx: 4b][orient: 1b][cell(0..35): 6b]
  // Header: 5 bits for vehicle count (1..16)
  let bits = BigInt(sorted.length);
  for (const v of sorted) {
    const idIdx = ID_TO_INDEX.get(v.id);
    if (idIdx === undefined) throw new Error(`Invalid vehicle ID: ${v.id}`);
    const orientBit = v.orientation === 'V' ? 1 : 0;
    const cell = v.row * BOARD_SIZE + v.col;
    const packed = (idIdx << 7) | (orientBit << 6) | cell;
    bits = (bits << 11n) | BigInt(packed);
  }

  // Append 5-bit checksum
  const checksum = Number(bits % 31n);
  bits = (bits << 5n) | BigInt(checksum);

  const raw = bits.toString(36).toUpperCase();
  const grouped = raw.match(/.{1,4}/g)?.join('-') ?? raw;
  return grouped;
}

/**
 * Decodes a puzzle code back into a validated Board, or returns null if invalid.
 */
export function decodeBoard(code: string): Board | null {
  const cleaned = code.trim().toUpperCase().replace(/^RH-?/, '').replace(/[^0-9A-Z]/g, '');
  if (!cleaned) return null;

  let bits = 0n;
  for (const ch of cleaned) {
    const digit = parseInt(ch, 36);
    if (Number.isNaN(digit)) return null;
    bits = bits * 36n + BigInt(digit);
  }

  const checksum = Number(bits & 31n);
  const payload = bits >> 5n;
  if (Number(payload % 31n) !== checksum) {
    return null;
  }

  // Extract vehicles from LSB up; top 5 bits hold count
  // Try finding vehicle count by inspecting bit length
  let temp = payload;
  const vehiclesRev: Vehicle[] = [];

  while (temp >= 32n) {
    const packed = Number(temp & 0x7ffn);
    temp >>= 11n;
    const idIdx = (packed >> 7) & 0xf;
    const orientBit = (packed >> 6) & 0x1;
    const cell = packed & 0x3f;

    if (idIdx >= ALL_VEHICLE_IDS.length || cell >= BOARD_SIZE * BOARD_SIZE) {
      return null;
    }

    const id = ALL_VEHICLE_IDS[idIdx];
    const orientation: Orientation = orientBit === 1 ? 'V' : 'H';
    const row = Math.floor(cell / BOARD_SIZE);
    const col = cell % BOARD_SIZE;

    vehiclesRev.push({
      id,
      row,
      col,
      length: VEHICLE_CATALOG[id].length,
      orientation,
    });

    if (vehiclesRev.length > 16) return null;
  }

  const expectedCount = Number(temp);
  if (expectedCount !== vehiclesRev.length || expectedCount === 0) {
    return null;
  }

  vehiclesRev.reverse();
  const board: Board = { vehicles: vehiclesRev };
  return validateBoard(board).valid ? board : null;
}
