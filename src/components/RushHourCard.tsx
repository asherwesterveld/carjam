import React, { useRef, useState } from 'react';
import { BOARD_SIZE, DIFFICULTY_META, EXIT_ROW } from '../engine/catalog';
import type { Board, PuzzleCard, Vehicle, VehicleId } from '../engine/types';
import { QrCodeSvg } from './QrCodeSvg';
import { VehicleSvg } from './VehicleSvg';

interface BoardSvgProps {
  board: Board;
  showLetters: boolean;
  highlightedVehicleId?: VehicleId;
  interactive?: boolean;
  onVehicleSlide?: (vehicleId: VehicleId, newPos: number) => void;
  className?: string;
}

interface DragState {
  vehicleId: VehicleId;
  orientation: 'H' | 'V';
  startCoord: number;
  minCoord: number;
  maxCoord: number;
  startClientX: number;
  startClientY: number;
  pxPerCell: number;
  offsetCells: number;
}

function computeSlideBounds(board: Board, target: Vehicle): { min: number; max: number } {
  const occupied = new Uint8Array(BOARD_SIZE * BOARD_SIZE);
  for (const v of board.vehicles) {
    if (v.id === target.id) continue;
    for (let k = 0; k < v.length; k++) {
      const r = v.orientation === 'V' ? v.row + k : v.row;
      const c = v.orientation === 'H' ? v.col + k : v.col;
      occupied[r * BOARD_SIZE + c] = 1;
    }
  }

  if (target.orientation === 'H') {
    let min = target.col;
    while (min > 0 && occupied[target.row * BOARD_SIZE + (min - 1)] === 0) min--;
    let max = target.col;
    while (
      max + target.length < BOARD_SIZE &&
      occupied[target.row * BOARD_SIZE + (max + target.length)] === 0
    ) {
      max++;
    }
    return { min, max };
  } else {
    let min = target.row;
    while (min > 0 && occupied[(min - 1) * BOARD_SIZE + target.col] === 0) min--;
    let max = target.row;
    while (
      max + target.length < BOARD_SIZE &&
      occupied[(max + target.length) * BOARD_SIZE + target.col] === 0
    ) {
      max++;
    }
    return { min, max };
  }
}

export const BoardSvg: React.FC<BoardSvgProps> = ({
  board,
  showLetters,
  highlightedVehicleId,
  interactive = false,
  onVehicleSlide,
  className,
}) => {
  const cellSize = 44;
  const boardPx = BOARD_SIZE * cellSize;
  const framePad = 14;
  const exitWidth = 18;
  const totalW = framePad * 2 + boardPx + exitWidth;
  const totalH = framePad * 2 + boardPx;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const handleVehiclePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    vehicle: Vehicle
  ) => {
    if (!interactive || !svgRef.current) return;
    e.preventDefault();
    svgRef.current.setPointerCapture(e.pointerId);

    const rect = svgRef.current.getBoundingClientRect();
    const pxPerCell = (rect.width / totalW) * cellSize;
    const { min, max } = computeSlideBounds(board, vehicle);

    setDrag({
      vehicleId: vehicle.id,
      orientation: vehicle.orientation,
      startCoord: vehicle.orientation === 'H' ? vehicle.col : vehicle.row,
      minCoord: min,
      maxCoord: max,
      startClientX: e.clientX,
      startClientY: e.clientY,
      pxPerCell,
      offsetCells: 0,
    });
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const rawDeltaPx =
      drag.orientation === 'H'
        ? e.clientX - drag.startClientX
        : e.clientY - drag.startClientY;
    const rawCells = rawDeltaPx / drag.pxPerCell;
    const minOffset = drag.minCoord - drag.startCoord;
    const maxOffset = drag.maxCoord - drag.startCoord;
    const clamped = Math.max(minOffset, Math.min(maxOffset, rawCells));
    setDrag((prev) => (prev ? { ...prev, offsetCells: clamped } : null));
  };

  const finishDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    const snapped = Math.round(drag.startCoord + drag.offsetCells);
    const clamped = Math.max(drag.minCoord, Math.min(drag.maxCoord, snapped));
    const movedId = drag.vehicleId;
    const didMove = clamped !== drag.startCoord;
    setDrag(null);
    if (didMove && onVehicleSlide) {
      onVehicleSlide(movedId, clamped);
    }
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={`${className ?? ''} ${interactive ? 'rh-board-interactive' : ''}`}
      onPointerMove={interactive ? handleSvgPointerMove : undefined}
      onPointerUp={interactive ? finishDrag : undefined}
      onPointerCancel={interactive ? finishDrag : undefined}
      role="img"
      aria-label="Rush Hour 6 by 6 puzzle board"
    >
      {/* Outer ThinkFun gray plastic frame */}
      <rect
        x={0}
        y={0}
        width={boardPx + framePad * 2}
        height={totalH}
        rx={12}
        fill="#475569"
        stroke="#1E293B"
        strokeWidth={2}
      />

      {/* Recessed parking lot surface */}
      <rect
        x={framePad - 2}
        y={framePad - 2}
        width={boardPx + 4}
        height={boardPx + 4}
        rx={6}
        fill="#334155"
      />

      {/* Exit opening notch in right curb on row 2 */}
      <rect
        x={framePad + boardPx}
        y={framePad + EXIT_ROW * cellSize + 3}
        width={framePad + 4}
        height={cellSize - 6}
        fill="#334155"
      />

      {/* EXIT arrow badge */}
      <g
        transform={`translate(${framePad + boardPx + framePad + 2}, ${
          framePad + EXIT_ROW * cellSize + cellSize / 2
        })`}
      >
        <polygon points="0,-10 13,0 0,10" fill="#EF4444" />
      </g>

      {/* 6x6 parking lot tiles */}
      <g transform={`translate(${framePad}, ${framePad})`}>
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, idx) => {
          const r = Math.floor(idx / BOARD_SIZE);
          const c = idx % BOARD_SIZE;
          const isExitLane = r === EXIT_ROW;
          return (
            <rect
              key={idx}
              x={c * cellSize + 2}
              y={r * cellSize + 2}
              width={cellSize - 4}
              height={cellSize - 4}
              rx={4}
              fill={isExitLane ? '#94A3B8' : '#CBD5E1'}
              fillOpacity={isExitLane ? 0.36 : 0.25}
              stroke="#64748B"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          );
        })}

        {/* Vehicles */}
        {board.vehicles.map((vehicle) => {
          const isThisDragging = drag?.vehicleId === vehicle.id;
          const dragOffsetPx = isThisDragging
            ? {
                dx: drag.orientation === 'H' ? drag.offsetCells * cellSize : 0,
                dy: drag.orientation === 'V' ? drag.offsetCells * cellSize : 0,
              }
            : null;
          return (
            <VehicleSvg
              key={vehicle.id}
              vehicle={vehicle}
              cellSize={cellSize}
              showLetters={showLetters}
              isHighlighted={vehicle.id === highlightedVehicleId}
              interactive={interactive}
              dragOffsetPx={dragOffsetPx}
              onPointerDown={handleVehiclePointerDown}
            />
          );
        })}
      </g>
    </svg>
  );
};

interface RushHourCardProps {
  card: PuzzleCard;
  showLetters: boolean;
  qrUrl?: string;
  onClick?: () => void;
  printMode?: boolean;
}

/**
 * Authentic ThinkFun-style Rush Hour Challenge Card (exact 56x87 mm ratio).
 */
export const RushHourCard: React.FC<RushHourCardProps> = ({
  card,
  showLetters,
  qrUrl,
  onClick,
  printMode = false,
}) => {
  const diff = DIFFICULTY_META[card.difficulty];

  return (
    <div
      className={`rh-card ${printMode ? 'rh-card-print' : 'rh-card-screen'}`}
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
      {/* 6x6 Grid at top on crisp white */}
      <div className="rh-card-board-wrap">
        <BoardSvg
          board={card.board}
          showLetters={showLetters}
          className="rh-card-svg"
        />
      </div>

      {/* Option B: Unified colored footer holding Level, Moves, Pieces, Code & QR */}
      <div
        className="rh-card-unified-footer"
        style={{ backgroundColor: diff.color }}
      >
        <div className="rh-card-unified-left">
          <span className="rh-card-tier-name">{diff.label}</span>
          <span className="rh-card-unified-stats">
            {card.moveCount} MOVES · {card.board.vehicles.length} pcs
          </span>
          <span className="rh-card-unified-code">{card.code}</span>
        </div>
        {qrUrl && (
          <div className="rh-card-qr-box">
            <QrCodeSvg value={qrUrl} className="rh-card-qr" />
          </div>
        )}
      </div>
    </div>
  );
};
