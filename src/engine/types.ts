export type Orientation = 'H' | 'V';
export type VehicleLength = 2 | 3;

export type VehicleId =
  | 'X'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'O'
  | 'P'
  | 'Q'
  | 'R';

export interface Vehicle {
  id: VehicleId;
  row: number;
  col: number;
  length: VehicleLength;
  orientation: Orientation;
}

export interface Board {
  vehicles: Vehicle[];
}

export type Direction = 'U' | 'D' | 'L' | 'R';

export interface Move {
  vehicleId: VehicleId;
  direction: Direction;
  steps: number;
  isExit?: boolean;
}

export interface Solution {
  solvable: boolean;
  moves: Move[];
  moveCount: number;
  statesExplored: number;
}

export type DifficultyTier =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert'
  | 'grandmaster';

export interface PuzzleCard {
  id: string;
  cardNumber: number;
  code: string;
  board: Board;
  moves: Move[];
  moveCount: number;
  difficulty: DifficultyTier;
}

export interface GenerateOptions {
  minMoves: number;
  maxMoves: number;
  pruneRedundant?: boolean;
  maxAttempts?: number;
}
