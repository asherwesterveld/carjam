import React, { useEffect, useMemo, useState } from 'react';
import {
  DIFFICULTY_META,
  VEHICLE_CATALOG,
  applyMove,
  formatMove,
} from '../engine/catalog';
import type { Board, PuzzleCard } from '../engine/types';
import { BoardSvg } from './RushHourCard';

interface SolutionModalProps {
  card: PuzzleCard;
  showLetters: boolean;
  onClose: () => void;
}

export const SolutionModal: React.FC<SolutionModalProps> = ({
  card,
  showLetters,
  onClose,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Precompute all intermediate board states for instant scrubbing
  const states = useMemo<Board[]>(() => {
    const arr: Board[] = [card.board];
    let cur = card.board;
    for (const move of card.moves) {
      cur = applyMove(cur, move);
      arr.push(cur);
    }
    return arr;
  }, [card]);

  useEffect(() => {
    setStepIndex(0);
    setIsPlaying(false);
  }, [card.id]);

  useEffect(() => {
    if (!isPlaying) return;
    if (stepIndex >= card.moves.length) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setStepIndex((s) => Math.min(card.moves.length, s + 1));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isPlaying, stepIndex, card.moves.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') {
        setIsPlaying(false);
        setStepIndex((s) => Math.min(card.moves.length, s + 1));
      }
      if (e.key === 'ArrowLeft') {
        setIsPlaying(false);
        setStepIndex((s) => Math.max(0, s - 1));
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [card.moves.length, onClose]);

  const diff = DIFFICULTY_META[card.difficulty];
  const currentBoard = states[stepIndex] ?? card.board;
  const activeMove = stepIndex > 0 ? card.moves[stepIndex - 1] : undefined;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(card.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="modal-backdrop no-print" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Solution — ${card.moveCount} Optimal Moves`}
      >
        <div className="modal-header" style={{ borderTopColor: diff.color }}>
          <div className="modal-title-group">
            <span className="tier-pill" style={{ background: diff.color }}>
              {diff.label}
            </span>
            <h2>{card.moveCount} Optimal Moves</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close solution viewer"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-board-col">
            <BoardSvg
              board={currentBoard}
              showLetters={showLetters}
              highlightedVehicleId={activeMove?.vehicleId}
              className="modal-board-svg"
            />

            <div className="playback-bar">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsPlaying(false);
                  setStepIndex(0);
                }}
                disabled={stepIndex === 0}
              >
                ⏮ Reset
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsPlaying(false);
                  setStepIndex((s) => Math.max(0, s - 1));
                }}
                disabled={stepIndex === 0}
              >
                ◀ Prev
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (stepIndex >= card.moves.length) {
                    setStepIndex(0);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying((p) => !p);
                  }
                }}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsPlaying(false);
                  setStepIndex((s) => Math.min(card.moves.length, s + 1));
                }}
                disabled={stepIndex >= card.moves.length}
              >
                Next ▶
              </button>
            </div>

            <div className="step-slider-row">
              <span>
                Step <strong>{stepIndex}</strong> / {card.moves.length}
              </span>
              <input
                type="range"
                min={0}
                max={card.moves.length}
                value={stepIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setStepIndex(Number(e.target.value));
                }}
              />
            </div>

            <div className="code-bar">
              <span>Puzzle Code:</span>
              <code>{card.code}</code>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={copyCode}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="modal-moves-col">
            <h3>Step-by-Step Moves</h3>
            <p className="moves-hint">
              Click any move or use ← / → arrow keys to step through.
            </p>
            <div className="modal-move-list">
              {card.moves.map((move, i) => {
                const v = VEHICLE_CATALOG[move.vehicleId];
                const isCurrent = stepIndex === i + 1;
                const isPast = stepIndex > i + 1;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`modal-move-item ${isCurrent ? 'current' : ''} ${
                      isPast ? 'past' : ''
                    }`}
                    onClick={() => {
                      setIsPlaying(false);
                      setStepIndex(i + 1);
                    }}
                  >
                    <span className="move-num">{i + 1}.</span>
                    <span
                      className="move-badge"
                      style={{ backgroundColor: v.body, color: v.textColor }}
                    >
                      {formatMove(move)}
                    </span>
                    <span className="move-desc">{v.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
