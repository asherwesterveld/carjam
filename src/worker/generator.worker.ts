import { computeStratifiedRanges, generatePuzzle } from '../engine/generator';
import type { PuzzleCard } from '../engine/types';

export interface GenerateRequest {
  type: 'generate';
  requestId: number;
  count: number;
  minMoves: number;
  maxMoves: number;
  pruneRedundant: boolean;
  startCardNumber: number;
  existingKeys: string[];
}

export interface CancelRequest {
  type: 'cancel';
  requestId: number;
}

export type WorkerRequest = GenerateRequest | CancelRequest;

export interface ProgressMessage {
  type: 'progress';
  requestId: number;
  card: PuzzleCard;
  completed: number;
  total: number;
}

export interface DoneMessage {
  type: 'done';
  requestId: number;
  completed: number;
  total: number;
  cancelled: boolean;
  failedCount: number;
}

export type WorkerResponse = ProgressMessage | DoneMessage;

let activeRequestId = 0;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    if (msg.requestId === activeRequestId) {
      activeRequestId = 0;
    }
    return;
  }

  if (msg.type === 'generate') {
    activeRequestId = msg.requestId;
    const seen = new Set<string>(msg.existingKeys);
    const targets = computeStratifiedRanges(msg.count, msg.minMoves, msg.maxMoves);
    let completed = 0;
    let failedCount = 0;

    for (let i = 0; i < msg.count; i++) {
      if (activeRequestId !== msg.requestId) {
        self.postMessage({
          type: 'done',
          requestId: msg.requestId,
          completed,
          total: msg.count,
          cancelled: true,
          failedCount,
        } satisfies DoneMessage);
        return;
      }

      const target = targets[i];
      const isAborted = () => activeRequestId !== msg.requestId;

      // Try the stratified bucket first so range decks span [minMoves, maxMoves] evenly;
      // if a narrow high-move bucket misses, fall back to the full requested range.
      let card = generatePuzzle(
        {
          minMoves: target.min,
          maxMoves: target.max,
          pruneRedundant: msg.pruneRedundant,
        },
        msg.startCardNumber + completed,
        seen,
        isAborted
      );

      if (!card && !isAborted() && (target.min !== msg.minMoves || target.max !== msg.maxMoves)) {
        card = generatePuzzle(
          {
            minMoves: msg.minMoves,
            maxMoves: msg.maxMoves,
            pruneRedundant: msg.pruneRedundant,
          },
          msg.startCardNumber + completed,
          seen,
          isAborted
        );
      }

      if (activeRequestId !== msg.requestId) {
        self.postMessage({
          type: 'done',
          requestId: msg.requestId,
          completed,
          total: msg.count,
          cancelled: true,
          failedCount,
        } satisfies DoneMessage);
        return;
      }

      if (card) {
        completed++;
        self.postMessage({
          type: 'progress',
          requestId: msg.requestId,
          card,
          completed,
          total: msg.count,
        } satisfies ProgressMessage);
      } else {
        failedCount++;
      }
    }

    self.postMessage({
      type: 'done',
      requestId: msg.requestId,
      completed,
      total: msg.count,
      cancelled: false,
      failedCount,
    } satisfies DoneMessage);
  }
};
