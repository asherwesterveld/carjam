import React, { Suspense, lazy, useState } from 'react';
import { DIFFICULTY_META, HERO_ID, applyMove } from '../engine/catalog';
import { solveBoard } from '../engine/solver';
import type { Board, DifficultyTier, PuzzleCard, VehicleId } from '../engine/types';
import type { MoveMode } from './GeneratorControls';
import { QrCodeSvg } from './QrCodeSvg';
import { BoardSvg } from './RushHourCard';

const QrScannerModal = lazy(() =>
  import('./QrScannerModal').then((m) => ({ default: m.QrScannerModal }))
);
const ShareCardModal = lazy(() =>
  import('./ShareCardModal').then((m) => ({ default: m.ShareCardModal }))
);

interface SingleCardModeProps {
  card: PuzzleCard | null;
  shareUrl: string;
  moveMode: MoveMode;
  setMoveMode: (m: MoveMode) => void;
  exactMoves: number;
  setExactMoves: (n: number) => void;
  minMoves: number;
  setMinMoves: (n: number) => void;
  maxMoves: number;
  setMaxMoves: (n: number) => void;
  isGenerating: boolean;
  onGenerateOne: () => void;
  onCancel: () => void;
  onOpenSolution: (card: PuzzleCard) => void;
  onLookupCode: (code: string) => string | null;
}

const TIERS: Array<{ tier: DifficultyTier; shortLabel: string }> = [
  { tier: 'beginner', shortLabel: 'Beg' },
  { tier: 'intermediate', shortLabel: 'Interm' },
  { tier: 'advanced', shortLabel: 'Adv' },
  { tier: 'expert', shortLabel: 'Expert' },
  { tier: 'grandmaster', shortLabel: 'Master' },
];

export const SingleCardMode: React.FC<SingleCardModeProps> = ({
  card,
  shareUrl,
  moveMode,
  setMoveMode,
  exactMoves,
  setExactMoves,
  minMoves,
  setMinMoves,
  maxMoves,
  setMaxMoves,
  isGenerating,
  onGenerateOne,
  onCancel,
  onOpenSolution,
  onLookupCode,
}) => {
  const [playBoard, setPlayBoard] = useState<Board | null>(null);
  const [playerMoves, setPlayerMoves] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [viewedSolution, setViewedSolution] = useState(false);
  const [highlightedId, setHighlightedId] = useState<VehicleId | undefined>(
    undefined
  );
  const [lastCardId, setLastCardId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [solvedCopied, setSolvedCopied] = useState(false);
  const [solvedDismissed, setSolvedDismissed] = useState(false);

  if (card && card.id !== lastCardId) {
    setLastCardId(card.id);
    setPlayBoard(card.board);
    setPlayerMoves(0);
    setHintsUsed(0);
    setViewedSolution(false);
    setHighlightedId(undefined);
    setSolvedCopied(false);
    setSolvedDismissed(false);
  }

  const displayedBoard = playBoard ?? card?.board ?? null;
  const heroCar = displayedBoard?.vehicles.find((v) => v.id === HERO_ID);
  const isSolved = heroCar?.col === 4;
  const isOptimalSolve = Boolean(card && isSolved && playerMoves === card.moveCount);

  const diff = card ? DIFFICULTY_META[card.difficulty] : null;

  const applyPreset = (tier: DifficultyTier) => {
    const meta = DIFFICULTY_META[tier];
    setMoveMode('range');
    setMinMoves(meta.minMoves);
    setMaxMoves(meta.maxMoves);
  };

  const stepExact = (delta: number) => {
    setExactMoves(Math.max(1, Math.min(51, exactMoves + delta)));
  };

  const handleResetBoard = () => {
    if (!card) return;
    setPlayBoard(card.board);
    setPlayerMoves(0);
    setHintsUsed(0);
    setViewedSolution(false);
    setHighlightedId(undefined);
    setSolvedDismissed(false);
  };

  const handleVehicleSlide = (vehicleId: VehicleId, newPos: number) => {
    if (!displayedBoard || isSolved) return;
    const nextBoard: Board = {
      vehicles: displayedBoard.vehicles.map((v) => {
        if (v.id !== vehicleId) return v;
        return v.orientation === 'H'
          ? { ...v, col: newPos }
          : { ...v, row: newPos };
      }),
    };
    setPlayBoard(nextBoard);
    setPlayerMoves((m) => m + 1);
    setHighlightedId(undefined);
  };

  const handleHint = () => {
    if (!card || !displayedBoard || isSolved) return;
    const nextMove =
      playerMoves === 0 ? card.moves[0] : solveBoard(displayedBoard).moves[0];
    if (!nextMove) return;

    setPlayBoard(applyMove(displayedBoard, nextMove));
    setPlayerMoves((m) => m + 1);
    setHintsUsed((h) => h + 1);
    setHighlightedId(nextMove.vehicleId);
  };

  const handleOpenSolutionClick = () => {
    if (!card) return;
    setViewedSolution(true);
    onOpenSolution(card);
  };

  const getSolvedScreenNote = (): string | null => {
    if (viewedSolution && hintsUsed > 0) {
      return `👀 Peeked at solution · 💡 ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} used`;
    }
    if (viewedSolution) {
      return `👀 Peeked at the solution first`;
    }
    if (hintsUsed > 0) {
      return `💡 Used ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}`;
    }
    return null;
  };

  const getSneakyRemark = (): string | null => {
    if (viewedSolution && hintsUsed > 0) {
      return `don't worry, I cheated and looked at the solution first (and used ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}) 👀`;
    }
    if (viewedSolution) {
      return `don't worry, I cheated and looked at the solution first 👀`;
    }
    if (hintsUsed > 0) {
      return `and don't tell anybody I used ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} 🤫`;
    }
    return null;
  };

  const copyFallback = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setSolvedCopied(true);
        window.setTimeout(() => setSolvedCopied(false), 1800);
        return;
      }
    } catch {
      // Fall through to execCommand fallback for iOS / HTTP contexts
    }
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    document.execCommand('copy');
    document.body.removeChild(el);
    setSolvedCopied(true);
    window.setTimeout(() => setSolvedCopied(false), 1800);
  };

  const handleSolvedShare = async () => {
    if (!card || !diff) return;
    const remark = getSneakyRemark();
    const shareText = remark
      ? `I solved this ${diff.label} Car Jam puzzle in ${playerMoves} moves (optimal: ${card.moveCount}) — ${remark}. Try to beat it:`
      : `I solved this ${diff.label} Car Jam puzzle in ${playerMoves} moves (optimal: ${card.moveCount})! Try to beat it:`;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Car Jam (${card.moveCount} Moves)`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // Only stop silently if the user deliberately cancelled the share sheet
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    await copyFallback(`${shareText} ${shareUrl}`);
  };

  return (
    <main className="single-mode no-print">
      <div className="single-container">
        {/* Controls (top on mobile, left sidebar on laptop/landscape iPad) */}
        <section className="single-controls-card">
          <div
            className="single-presets"
            role="group"
            aria-label="Difficulty presets"
          >
            {TIERS.map(({ tier, shortLabel }) => {
              const meta = DIFFICULTY_META[tier];
              const active =
                moveMode === 'range' &&
                minMoves === meta.minMoves &&
                maxMoves === meta.maxMoves;
              return (
                <button
                  key={tier}
                  type="button"
                  className={`single-preset-pill ${active ? 'active' : ''}`}
                  style={{ '--preset-color': meta.color } as React.CSSProperties}
                  onClick={() => applyPreset(tier)}
                  title={`${meta.label} (${meta.minMoves}–${meta.maxMoves} moves)`}
                >
                  <span
                    className="preset-dot"
                    style={{ background: meta.color }}
                  />
                  <span className="preset-full">
                    {meta.label === 'GRAND MASTER'
                      ? 'Grand Master'
                      : meta.label[0] + meta.label.slice(1).toLowerCase()}
                  </span>
                  <span className="preset-short">{shortLabel}</span>
                </button>
              );
            })}
          </div>

          <div className="single-move-row">
            <div className="segmented compact">
              <button
                type="button"
                className={moveMode === 'exact' ? 'active' : ''}
                onClick={() => setMoveMode('exact')}
              >
                Exact
              </button>
              <button
                type="button"
                className={moveMode === 'range' ? 'active' : ''}
                onClick={() => setMoveMode('range')}
              >
                Range
              </button>
            </div>

            {moveMode === 'exact' ? (
              <div className="exact-stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => stepExact(-1)}
                  disabled={exactMoves <= 1}
                  aria-label="Decrease exact moves"
                >
                  ▼
                </button>
                <input
                  type="number"
                  min={1}
                  max={51}
                  value={exactMoves}
                  onChange={(e) =>
                    setExactMoves(
                      Math.max(1, Math.min(51, Number(e.target.value) || 1))
                    )
                  }
                  aria-label="Exact moves"
                />
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => stepExact(1)}
                  disabled={exactMoves >= 51}
                  aria-label="Increase exact moves"
                >
                  ▲
                </button>
                <span className="range-unit">moves</span>
              </div>
            ) : (
              <div className="single-range-fields">
                <input
                  type="number"
                  min={1}
                  max={51}
                  value={minMoves}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Math.min(51, Number(e.target.value) || 1)
                    );
                    setMinMoves(v);
                    if (v > maxMoves) setMaxMoves(v);
                  }}
                  aria-label="Minimum moves"
                />
                <span className="range-sep">–</span>
                <input
                  type="number"
                  min={1}
                  max={51}
                  value={maxMoves}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Math.min(51, Number(e.target.value) || 1)
                    );
                    setMaxMoves(v);
                    if (v < minMoves) setMinMoves(v);
                  }}
                  aria-label="Maximum moves"
                />
                <span className="range-unit">moves</span>
              </div>
            )}
          </div>
        </section>

        {/* Card Difficulty & Move Counter Banner */}
        <section
          className="single-card-banner"
          style={{ backgroundColor: diff?.color ?? '#334155' }}
        >
          {card && diff ? (
            <>
              <div className="single-banner-left">
                <span className="single-tier-label">{diff.label}</span>
                <span className="single-pieces-tag">
                  {card.board.vehicles.length} pcs
                </span>
              </div>
              <div className="single-moves-badge">
                {playerMoves > 0
                  ? `${playerMoves} / ${card.moveCount} MOVES`
                  : `${card.moveCount} MOVES`}
              </div>
            </>
          ) : (
            <span className="single-tier-label">CAR JAM</span>
          )}
        </section>

        {/* Main Playable 6x6 Board (fills full vertical space on laptop/iPad) */}
        <section className="single-board-area">
          {isGenerating && (
            <div className="single-loading-overlay">
              <span>Generating live puzzle…</span>
            </div>
          )}

          {card && displayedBoard ? (
            <BoardSvg
              board={displayedBoard}
              showLetters={false}
              highlightedVehicleId={highlightedId}
              interactive={!isGenerating && !isSolved}
              onVehicleSlide={handleVehicleSlide}
              className="single-board-svg"
            />
          ) : (
            <div className="single-placeholder">
              <p>
                {isGenerating
                  ? 'Generating your Car Jam board…'
                  : 'Tap New Game to generate a puzzle.'}
              </p>
            </div>
          )}
        </section>

        {/* Actions + Code Bar (bottom on mobile, left sidebar on laptop/landscape iPad) */}
        <section className="single-bottom-panel">
          <div className="single-action-bar">
            <button
              type="button"
              className="btn btn-secondary action-icon-btn"
              onClick={handleResetBoard}
              disabled={!card || isGenerating || playerMoves === 0}
              title="Reset board"
              aria-label="Reset board"
            >
              ↺
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleHint}
              disabled={!card || isGenerating || isSolved}
            >
              💡 Hint
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleOpenSolutionClick}
              disabled={!card || isGenerating}
            >
              ▶ Solution
            </button>
            {isGenerating ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={onCancel}
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onGenerateOne}
              >
                New Game
              </button>
            )}
          </div>

          {card && (
            <div className="single-card-meta">
              <code>{card.code}</code>
              <div className="single-meta-actions">
                <button
                  type="button"
                  className="link-btn-muted"
                  onClick={() => setShowShare(true)}
                >
                  Share / QR
                </button>
                <span className="meta-dot">·</span>
                <button
                  type="button"
                  className="link-btn-muted"
                  onClick={() => setShowScanner(true)}
                >
                  Load Code
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {card && isSolved && !isGenerating && !solvedDismissed && (
        <div
          className="modal-backdrop no-print"
          onClick={() => setSolvedDismissed(true)}
          role="dialog"
          aria-modal="true"
          aria-label="Puzzle solved"
        >
          <div className="solved-card" onClick={(e) => e.stopPropagation()}>
            <div className="solved-header">
              <span className="solved-emoji">🎉</span>
              <div>
                <h3>
                  Solved in {playerMoves} move
                  {playerMoves === 1 ? '' : 's'}!
                </h3>
                <p className="solved-sub">
                  Optimal: {card.moveCount} moves
                  {isOptimalSolve && !viewedSolution && hintsUsed === 0 && (
                    <span className="solved-optimal-pill">★ Optimal!</span>
                  )}
                </p>
                {(hintsUsed > 0 || viewedSolution) && (
                  <div className="solved-sneaky-pill">
                    {getSolvedScreenNote()}
                  </div>
                )}
              </div>
            </div>

            {shareUrl && (
              <div className="solved-qr-section">
                <div className="solved-qr-frame">
                  <QrCodeSvg value={shareUrl} className="solved-qr-svg" />
                </div>
                <span className="solved-qr-caption">
                  Challenge a friend — scan to try this board!
                </span>
              </div>
            )}

            <div className="solved-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetBoard}
              >
                ↺ Replay
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSolvedShare}
              >
                {solvedCopied ? '✓ Copied' : 'Share'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onGenerateOne}
              >
                New Game
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <Suspense fallback={null}>
          <QrScannerModal
            onDecoded={(raw) => onLookupCode(raw)}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      )}

      {showShare && card && (
        <Suspense fallback={null}>
          <ShareCardModal
            card={card}
            shareUrl={shareUrl}
            onClose={() => setShowShare(false)}
          />
        </Suspense>
      )}
    </main>
  );
};
