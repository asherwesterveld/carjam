import React from 'react';
import { VEHICLE_CATALOG } from '../engine/catalog';
import type { Vehicle } from '../engine/types';

interface VehicleSvgProps {
  vehicle: Vehicle;
  cellSize: number;
  showLetters: boolean;
  isHighlighted?: boolean;
  interactive?: boolean;
  dragOffsetPx?: { dx: number; dy: number } | null;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>, vehicle: Vehicle) => void;
}

/**
 * Top-down SVG car/truck styled after the physical ThinkFun Rush Hour pieces.
 */
export const VehicleSvg: React.FC<VehicleSvgProps> = ({
  vehicle,
  cellSize,
  showLetters,
  isHighlighted = false,
  interactive = false,
  dragOffsetPx = null,
  onPointerDown,
}) => {
  const appearance = VEHICLE_CATALOG[vehicle.id];
  const isTruck = vehicle.length === 3;
  const isHorizontal = vehicle.orientation === 'H';

  const pad = cellSize * 0.08;
  const x = vehicle.col * cellSize + pad + (dragOffsetPx?.dx ?? 0);
  const y = vehicle.row * cellSize + pad + (dragOffsetPx?.dy ?? 0);
  const isDragging = dragOffsetPx !== null;

  // Canonical horizontal dimensions (length along X, width along Y)
  const canonW = vehicle.length * cellSize - pad * 2;
  const canonH = cellSize - pad * 2;

  const visualW = isHorizontal ? canonW : canonH;
  const visualH = isHorizontal ? canonH : canonW;

  // Inner rotation only (static per vehicle); outer CSS transform animates smoothly on slide!
  const innerTransform = isHorizontal
    ? undefined
    : `translate(${canonH}, 0) rotate(90)`;

  const r = canonH * 0.24;

  return (
    <g
      className={`rh-vehicle ${isHighlighted ? 'rh-vehicle-highlighted' : ''} ${
        interactive ? 'rh-vehicle-interactive' : ''
      }`}
      onPointerDown={
        interactive && onPointerDown ? (e) => onPointerDown(e, vehicle) : undefined
      }
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: isDragging
          ? 'none'
          : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : undefined,
      }}
    >
      <g transform={innerTransform}>
        {/* Subtle drop shadow */}
        <rect
          x={1.5}
          y={2.5}
          width={canonW}
          height={canonH}
          rx={r}
          ry={r}
          fill="rgba(15, 23, 42, 0.32)"
        />

        {/* Wheels peeking subtly from sides */}
        {isTruck ? (
          <>
            <rect x={canonW * 0.1} y={-2} width={canonW * 0.14} height={canonH + 4} rx={2} fill="#0F172A" />
            <rect x={canonW * 0.34} y={-2} width={canonW * 0.14} height={canonH + 4} rx={2} fill="#0F172A" />
            <rect x={canonW * 0.74} y={-2} width={canonW * 0.14} height={canonH + 4} rx={2} fill="#0F172A" />
          </>
        ) : (
          <>
            <rect x={canonW * 0.16} y={-2} width={canonW * 0.2} height={canonH + 4} rx={2} fill="#0F172A" />
            <rect x={canonW * 0.64} y={-2} width={canonW * 0.2} height={canonH + 4} rx={2} fill="#0F172A" />
          </>
        )}

        {isTruck ? (
          /* === 3-TILE THINKFUN TRUCK === */
          <>
            {/* Trailer body (left 68%) */}
            <rect
              x={0}
              y={0}
              width={canonW * 0.69}
              height={canonH}
              rx={r * 0.55}
              ry={r * 0.55}
              fill={appearance.body}
              stroke={appearance.roof}
              strokeWidth={1.6}
            />
            {/* Trailer top panel bevel */}
            <rect
              x={canonW * 0.04}
              y={canonH * 0.12}
              width={canonW * 0.61}
              height={canonH * 0.76}
              rx={r * 0.3}
              fill={appearance.accent}
              fillOpacity={0.28}
              stroke={appearance.roof}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            {/* Trailer rib lines */}
            <line
              x1={canonW * 0.24}
              y1={canonH * 0.15}
              x2={canonW * 0.24}
              y2={canonH * 0.85}
              stroke={appearance.roof}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            <line
              x1={canonW * 0.45}
              y1={canonH * 0.15}
              x2={canonW * 0.45}
              y2={canonH * 0.85}
              stroke={appearance.roof}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            {/* Hitch connector */}
            <rect
              x={canonW * 0.68}
              y={canonH * 0.32}
              width={canonW * 0.06}
              height={canonH * 0.36}
              fill="#334155"
            />
            {/* Cab body (right 28%) */}
            <rect
              x={canonW * 0.72}
              y={canonH * 0.04}
              width={canonW * 0.28}
              height={canonH * 0.92}
              rx={r * 0.75}
              ry={r * 0.75}
              fill={appearance.body}
              stroke={appearance.roof}
              strokeWidth={1.6}
            />
            {/* Cab windshield */}
            <rect
              x={canonW * 0.83}
              y={canonH * 0.14}
              width={canonW * 0.11}
              height={canonH * 0.72}
              rx={r * 0.35}
              fill={appearance.window}
            />
            {/* Windshield glare */}
            <line
              x1={canonW * 0.86}
              y1={canonH * 0.2}
              x2={canonW * 0.91}
              y2={canonH * 0.42}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            {/* Headlights */}
            <rect x={canonW - 2.5} y={canonH * 0.14} width={2.5} height={canonH * 0.18} rx={1} fill="#FEF9C3" />
            <rect x={canonW - 2.5} y={canonH * 0.68} width={2.5} height={canonH * 0.18} rx={1} fill="#FEF9C3" />
            {/* Taillights */}
            <rect x={0} y={canonH * 0.14} width={2.5} height={canonH * 0.16} rx={1} fill="#EF4444" />
            <rect x={0} y={canonH * 0.7} width={2.5} height={canonH * 0.16} rx={1} fill="#EF4444" />
          </>
        ) : (
          /* === 2-TILE THINKFUN CAR === */
          <>
            {/* Main car body */}
            <rect
              x={0}
              y={0}
              width={canonW}
              height={canonH}
              rx={r}
              ry={r}
              fill={appearance.body}
              stroke={appearance.roof}
              strokeWidth={1.6}
            />
            {/* Hood racing highlight for Hero Car X */}
            {vehicle.id === 'X' && (
              <rect
                x={canonW * 0.7}
                y={canonH * 0.38}
                width={canonW * 0.24}
                height={canonH * 0.24}
                rx={2}
                fill="rgba(255,255,255,0.22)"
              />
            )}
            {/* Rear window */}
            <rect
              x={canonW * 0.15}
              y={canonH * 0.15}
              width={canonW * 0.14}
              height={canonH * 0.7}
              rx={r * 0.35}
              fill={appearance.window}
            />
            {/* Front windshield */}
            <rect
              x={canonW * 0.61}
              y={canonH * 0.13}
              width={canonW * 0.16}
              height={canonH * 0.74}
              rx={r * 0.4}
              fill={appearance.window}
            />
            {/* Windshield glare */}
            <line
              x1={canonW * 0.66}
              y1={canonH * 0.2}
              x2={canonW * 0.73}
              y2={canonH * 0.45}
              stroke="rgba(255,255,255,0.38)"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
            {/* Car roof */}
            <rect
              x={canonW * 0.27}
              y={canonH * 0.14}
              width={canonW * 0.36}
              height={canonH * 0.72}
              rx={r * 0.4}
              fill={appearance.roof}
              stroke={appearance.accent}
              strokeOpacity={0.55}
              strokeWidth={1}
            />
            {/* Headlights (right/front) */}
            <rect x={canonW - 2.5} y={canonH * 0.16} width={2.5} height={canonH * 0.2} rx={1} fill="#FEF9C3" />
            <rect x={canonW - 2.5} y={canonH * 0.64} width={2.5} height={canonH * 0.2} rx={1} fill="#FEF9C3" />
            {/* Taillights (left/back) */}
            <rect x={0} y={canonH * 0.16} width={2.5} height={canonH * 0.18} rx={1} fill="#DC2626" />
            <rect x={0} y={canonH * 0.66} width={2.5} height={canonH * 0.18} rx={1} fill="#DC2626" />
          </>
        )}

        {/* Active highlight ring (for hint & solution playback) */}
        {isHighlighted && (
          <rect
            className="rh-vehicle-pulse"
            x={-2.5}
            y={-2.5}
            width={canonW + 5}
            height={canonH + 5}
            rx={r + 2.5}
            ry={r + 2.5}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3}
          />
        )}
      </g>

      {/* Upright letter badge */}
      {showLetters && (
        <g
          transform={`translate(${visualW / 2}, ${visualH / 2})`}
          pointerEvents="none"
        >
          <circle
            r={Math.min(visualW, visualH) * 0.35}
            fill="rgba(15, 23, 42, 0.74)"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFFFFF"
            fontWeight={900}
            fontSize={Math.min(visualW, visualH) * 0.5}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {vehicle.id}
          </text>
        </g>
      )}
    </g>
  );
};
