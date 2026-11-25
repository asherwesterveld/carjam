import React, { useState } from 'react';
import { DIFFICULTY_META } from '../engine/catalog';
import type { DifficultyTier } from '../engine/types';

export type MoveMode = 'exact' | 'range';
export type PrintMode = 'fronts' | 'duplex' | 'answer-key';
export type DuplexFlip = 'long-edge' | 'short-edge';
export type PaperSize = 'letter' | 'a4';

interface GeneratorControlsProps {
  moveMode: MoveMode;
  setMoveMode: (m: MoveMode) => void;
  exactMoves: number;
  setExactMoves: (n: number) => void;
  minMoves: number;
  setMinMoves: (n: number) => void;
  maxMoves: number;
  setMaxMoves: (n: number) => void;
  count: number;
  setCount: (n: number) => void;
  pruneRedundant: boolean;
  setPruneRedundant: (b: boolean) => void;
  sortByMoves: boolean;
  setSortByMoves: (b: boolean) => void;
  showLetters: boolean;
  setShowLetters: (b: boolean) => void;
  isGenerating: boolean;
  progress: { completed: number; total: number };
  onGenerate: () => void;
  onAppend: () => void;
  onCancel: () => void;
  onLookupCode: (code: string) => string | null;
}

const TIERS: DifficultyTier[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
  'grandmaster',
];

export const GeneratorControls: React.FC<GeneratorControlsProps> = ({
  moveMode,
  setMoveMode,
  exactMoves,
  setExactMoves,
  minMoves,
  setMinMoves,
  maxMoves,
  setMaxMoves,
  count,
  setCount,
  pruneRedundant,
  setPruneRedundant,
  sortByMoves,
  setSortByMoves,
  showLetters,
  setShowLetters,
  isGenerating,
  progress,
  onGenerate,
  onAppend,
  onCancel,
  onLookupCode,
}) => {
  const [lookupInput, setLookupInput] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const applyPreset = (tier: DifficultyTier) => {
    const meta = DIFFICULTY_META[tier];
    setMoveMode('range');
    setMinMoves(meta.minMoves);
    setMaxMoves(meta.maxMoves);
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupInput.trim()) return;
    const err = onLookupCode(lookupInput);
    if (err) {
      setLookupError(err);
    } else {
      setLookupError(null);
      setLookupInput('');
    }
  };

  return (
    <aside className="controls-panel no-print">
      <div className="controls-brand">
        <img src="./logo.svg" alt="Car Jam logo" className="brand-logo" />
        <div>
          <h1>Car Jam</h1>
          <p>6×6 Traffic Card Studio</p>
        </div>
      </div>

      {/* Difficulty Presets */}
      <section className="control-section">
        <label className="section-label">Difficulty Presets</label>
        <div className="preset-grid">
          {TIERS.map((tier) => {
            const meta = DIFFICULTY_META[tier];
            const active =
              moveMode === 'range' &&
              minMoves === meta.minMoves &&
              maxMoves === meta.maxMoves;
            return (
              <button
                key={tier}
                type="button"
                className={`preset-btn ${active ? 'active' : ''}`}
                style={{ '--preset-color': meta.color } as React.CSSProperties}
                onClick={() => applyPreset(tier)}
                disabled={isGenerating}
              >
                <span className="preset-dot" style={{ background: meta.color }} />
                <span className="preset-name">{meta.label}</span>
                <span className="preset-range">
                  {meta.minMoves}–{meta.maxMoves}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Move Target */}
      <section className="control-section">
        <label className="section-label">Optimal Moves (Slides)</label>
        <div className="segmented">
          <button
            type="button"
            className={moveMode === 'exact' ? 'active' : ''}
            onClick={() => setMoveMode('exact')}
            disabled={isGenerating}
          >
            Exact
          </button>
          <button
            type="button"
            className={moveMode === 'range' ? 'active' : ''}
            onClick={() => setMoveMode('range')}
            disabled={isGenerating}
          >
            Range
          </button>
        </div>

        {moveMode === 'exact' ? (
          <div className="input-row single">
            <label>
              <span>Moves</span>
              <input
                type="number"
                min={1}
                max={51}
                value={exactMoves}
                onChange={(e) =>
                  setExactMoves(Math.max(1, Math.min(51, Number(e.target.value) || 1)))
                }
                disabled={isGenerating}
              />
            </label>
            <input
              type="range"
              min={1}
              max={51}
              value={Math.min(51, exactMoves)}
              onChange={(e) => setExactMoves(Number(e.target.value))}
              disabled={isGenerating}
            />
          </div>
        ) : (
          <div className="input-row dual">
            <label>
              <span>Min</span>
              <input
                type="number"
                min={1}
                max={51}
                value={minMoves}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(51, Number(e.target.value) || 1));
                  setMinMoves(v);
                  if (v > maxMoves) setMaxMoves(v);
                }}
                disabled={isGenerating}
              />
            </label>
            <span className="range-sep">to</span>
            <label>
              <span>Max</span>
              <input
                type="number"
                min={1}
                max={51}
                value={maxMoves}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(51, Number(e.target.value) || 1));
                  setMaxMoves(v);
                  if (v < minMoves) setMinMoves(v);
                }}
                disabled={isGenerating}
              />
            </label>
          </div>
        )}
      </section>

      {/* Deck Size */}
      <section className="control-section">
        <div className="label-split">
          <label className="section-label">Cards to Generate</label>
          <span className="hint-text">
            {Math.ceil(count / 9)} sheet{Math.ceil(count / 9) === 1 ? '' : 's'} (3×3)
          </span>
        </div>
        <div className="quick-counts">
          {[1, 9, 18, 36].map((n) => (
            <button
              key={n}
              type="button"
              className={`chip-btn ${count === n ? 'active' : ''}`}
              onClick={() => setCount(n)}
              disabled={isGenerating}
            >
              {n}
            </button>
          ))}
          <input
            type="number"
            className="count-input"
            min={1}
            max={90}
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(90, Number(e.target.value) || 1)))
            }
            disabled={isGenerating}
            aria-label="Custom card count"
          />
        </div>
      </section>

      {/* Options */}
      <section className="control-section">
        <label className="section-label">Card Options</label>
        <div className="toggle-list">
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={showLetters}
              onChange={(e) => setShowLetters(e.target.checked)}
            />
            <span>Show vehicle letters (A–K, O–R, X)</span>
          </label>
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={pruneRedundant}
              onChange={(e) => setPruneRedundant(e.target.checked)}
              disabled={isGenerating}
            />
            <span>Prune redundant pieces</span>
          </label>
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={sortByMoves}
              onChange={(e) => setSortByMoves(e.target.checked)}
            />
            <span>Sort deck easiest → hardest</span>
          </label>
        </div>
      </section>

      {/* Generate Actions */}
      <section className="control-section actions-section">
        {isGenerating ? (
          <div className="progress-box">
            <div className="progress-header">
              <span>Generating live puzzles…</span>
              <strong>
                {progress.completed} / {progress.total}
              </strong>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    progress.total > 0
                      ? Math.round((progress.completed / progress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-danger full-width"
              onClick={onCancel}
            >
              Stop Generation
            </button>
          </div>
        ) : (
          <div className="action-buttons">
            <button
              type="button"
              className="btn btn-primary full-width"
              onClick={onGenerate}
            >
              Generate New Deck ({count})
            </button>
            <button
              type="button"
              className="btn btn-secondary full-width"
              onClick={onAppend}
            >
              + Add {count} to Current Deck
            </button>
          </div>
        )}
      </section>

      {/* Lookup by Code */}
      <section className="control-section">
        <label className="section-label">Load Card by Puzzle Code</label>
        <form onSubmit={handleLookupSubmit} className="lookup-form">
          <input
            type="text"
            placeholder="XXXX-XXXX-XXXX..."
            value={lookupInput}
            onChange={(e) => {
              setLookupInput(e.target.value);
              if (lookupError) setLookupError(null);
            }}
          />
          <button type="submit" className="btn btn-secondary">
            Load
          </button>
        </form>
        {lookupError && <p className="error-text">{lookupError}</p>}
      </section>
    </aside>
  );
};
