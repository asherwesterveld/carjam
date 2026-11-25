import React from 'react';
import { DIFFICULTY_META, VEHICLE_CATALOG, formatMove } from '../engine/catalog';
import type { PuzzleCard } from '../engine/types';

interface SolutionCardBackProps {
  card: PuzzleCard;
  onClick?: () => void;
  printMode?: boolean;
}

/**
 * Authentic 56x87 mm solution card back for duplex printing.
 * Uses color-coded ThinkFun vehicle badges so solutions are readable with or without letters.
 */
export const SolutionCardBack: React.FC<SolutionCardBackProps> = ({
  card,
  onClick,
  printMode = false,
}) => {
  const diff = DIFFICULTY_META[card.difficulty];
  const densityClass =
    card.moveCount > 36
      ? 'rh-sol-ultra'
      : card.moveCount > 24
        ? 'rh-sol-compact'
        : 'rh-sol-normal';

  return (
    <div
      className={`rh-card rh-card-back ${printMode ? 'rh-card-print' : 'rh-card-screen'}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{ '--tier-color': diff.color } as React.CSSProperties}
    >
      <div className="rh-card-back-header" style={{ backgroundColor: diff.color }}>
        <span className="rh-card-tier">{diff.label}</span>
        <span className="rh-card-moves">{card.moveCount} MOVES</span>
      </div>

      <div className={`rh-sol-grid ${densityClass}`}>
        {card.moves.map((move, i) => {
          const v = VEHICLE_CATALOG[move.vehicleId];
          return (
            <div key={i} className="rh-sol-step">
              <span className="rh-sol-idx">{i + 1}.</span>
              <span
                className="rh-sol-pill"
                style={{ backgroundColor: v.body, color: v.textColor }}
              >
                {formatMove(move)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rh-card-footer rh-card-footer-center">
        <span className="rh-card-code">{card.code}</span>
      </div>
    </div>
  );
};
