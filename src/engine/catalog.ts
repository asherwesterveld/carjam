import type { Board, DifficultyTier, Move, VehicleId, VehicleLength } from './types';

export const BOARD_SIZE = 6;
export const EXIT_ROW = 2;
export const HERO_ID: VehicleId = 'X';

export const CAR_IDS: readonly VehicleId[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
] as const;

export const TRUCK_IDS: readonly VehicleId[] = ['O', 'P', 'Q', 'R'] as const;

export const ALL_VEHICLE_IDS: readonly VehicleId[] = [
  HERO_ID,
  ...CAR_IDS,
  ...TRUCK_IDS,
] as const;

export const MAX_CARS = CAR_IDS.length; // 11 blocking cars
export const MAX_TRUCKS = TRUCK_IDS.length; // 4 blocking trucks

export interface VehicleAppearance {
  id: VehicleId;
  name: string;
  length: VehicleLength;
  body: string;
  roof: string;
  accent: string;
  window: string;
  textColor: string;
}

/**
 * Authentic ThinkFun Rush Hour physical piece palette.
 */
export const VEHICLE_CATALOG: Record<VehicleId, VehicleAppearance> = {
  X: {
    id: 'X',
    name: 'Red Hero Car',
    length: 2,
    body: '#E11D2E',
    roof: '#B91C1C',
    accent: '#FCA5A5',
    window: '#1E293B',
    textColor: '#FFFFFF',
  },
  A: {
    id: 'A',
    name: 'Light Green Car',
    length: 2,
    body: '#7AC943',
    roof: '#5EA82C',
    accent: '#BEF264',
    window: '#1E293B',
    textColor: '#142905',
  },
  B: {
    id: 'B',
    name: 'Orange Car',
    length: 2,
    body: '#F97316',
    roof: '#C2410C',
    accent: '#FDBA74',
    window: '#1E293B',
    textColor: '#FFFFFF',
  },
  C: {
    id: 'C',
    name: 'Light Blue Car',
    length: 2,
    body: '#38BDF8',
    roof: '#0284C7',
    accent: '#BAE6FD',
    window: '#0F172A',
    textColor: '#082F49',
  },
  D: {
    id: 'D',
    name: 'Pink Car',
    length: 2,
    body: '#F472B6',
    roof: '#DB2777',
    accent: '#FBCFE8',
    window: '#1E293B',
    textColor: '#FFFFFF',
  },
  E: {
    id: 'E',
    name: 'Purple Car',
    length: 2,
    body: '#7C3AED',
    roof: '#5B21B6',
    accent: '#C4B5FD',
    window: '#1E293B',
    textColor: '#FFFFFF',
  },
  F: {
    id: 'F',
    name: 'Dark Green Car',
    length: 2,
    body: '#15803D',
    roof: '#166534',
    accent: '#86EFAC',
    window: '#0F172A',
    textColor: '#FFFFFF',
  },
  G: {
    id: 'G',
    name: 'Charcoal Car',
    length: 2,
    body: '#334155',
    roof: '#1E293B',
    accent: '#94A3B8',
    window: '#0F172A',
    textColor: '#FFFFFF',
  },
  H: {
    id: 'H',
    name: 'Tan Car',
    length: 2,
    body: '#D6B282',
    roof: '#B08956',
    accent: '#F3DFC1',
    window: '#1E293B',
    textColor: '#2E1E0A',
  },
  I: {
    id: 'I',
    name: 'Yellow Car',
    length: 2,
    body: '#FDE047',
    roof: '#CA8A04',
    accent: '#FEF9C3',
    window: '#1E293B',
    textColor: '#3B2F00',
  },
  J: {
    id: 'J',
    name: 'Brown Car',
    length: 2,
    body: '#8B5A2B',
    roof: '#653F1C',
    accent: '#C99A6B',
    window: '#1E293B',
    textColor: '#FFFFFF',
  },
  K: {
    id: 'K',
    name: 'Olive Car',
    length: 2,
    body: '#6B7E32',
    roof: '#4D5C21',
    accent: '#A3B66A',
    window: '#1E293B',
    textColor: '#FFFFFF',
  },
  O: {
    id: 'O',
    name: 'Yellow Truck',
    length: 3,
    body: '#FACC15',
    roof: '#CA8A04',
    accent: '#FEF08A',
    window: '#1E293B',
    textColor: '#3B2F00',
  },
  P: {
    id: 'P',
    name: 'Purple Truck',
    length: 3,
    body: '#9333EA',
    roof: '#6B21A8',
    accent: '#D8B4FE',
    window: '#1E293B',
    textColor: '#FFFFFF',
  },
  Q: {
    id: 'Q',
    name: 'Blue Truck',
    length: 3,
    body: '#2563EB',
    roof: '#1D4ED8',
    accent: '#93C5FD',
    window: '#0F172A',
    textColor: '#FFFFFF',
  },
  R: {
    id: 'R',
    name: 'Teal Truck',
    length: 3,
    body: '#0D9488',
    roof: '#115E59',
    accent: '#5EEAD4',
    window: '#0F172A',
    textColor: '#FFFFFF',
  },
};

export interface DifficultyMeta {
  tier: DifficultyTier;
  label: string;
  color: string;
  accent: string;
  minMoves: number;
  maxMoves: number;
}

export const DIFFICULTY_META: Record<DifficultyTier, DifficultyMeta> = {
  beginner: {
    tier: 'beginner',
    label: 'BEGINNER',
    color: '#16A34A',
    accent: '#DCFCE7',
    minMoves: 4,
    maxMoves: 10,
  },
  intermediate: {
    tier: 'intermediate',
    label: 'INTERMEDIATE',
    color: '#EA580C',
    accent: '#FFEDD5',
    minMoves: 11,
    maxMoves: 18,
  },
  advanced: {
    tier: 'advanced',
    label: 'ADVANCED',
    color: '#2563EB',
    accent: '#DBEAFE',
    minMoves: 19,
    maxMoves: 28,
  },
  expert: {
    tier: 'expert',
    label: 'EXPERT',
    color: '#DC2626',
    accent: '#FEE2E2',
    minMoves: 29,
    maxMoves: 39,
  },
  grandmaster: {
    tier: 'grandmaster',
    label: 'GRAND MASTER',
    color: '#6D28D9',
    accent: '#EDE9FE',
    minMoves: 40,
    maxMoves: 51,
  },
};

export function getDifficultyTier(moveCount: number): DifficultyTier {
  if (moveCount <= 10) return 'beginner';
  if (moveCount <= 18) return 'intermediate';
  if (moveCount <= 28) return 'advanced';
  if (moveCount <= 39) return 'expert';
  return 'grandmaster';
}

const DIRECTION_ARROW = {
  U: '↑',
  D: '↓',
  L: '←',
  R: '→',
} as const;

export function formatMove(move: Move): string {
  if (move.isExit) {
    return `${move.vehicleId}→💨`;
  }
  return `${move.vehicleId}${DIRECTION_ARROW[move.direction]}${move.steps}`;
}

export function applyMove(board: Board, move: Move): Board {
  return {
    vehicles: board.vehicles.map((v) => {
      if (v.id !== move.vehicleId) return v;
      if (move.direction === 'L') return { ...v, col: v.col - move.steps };
      if (move.direction === 'R') return { ...v, col: v.col + move.steps };
      if (move.direction === 'U') return { ...v, row: v.row - move.steps };
      return { ...v, row: v.row + move.steps };
    }),
  };
}
