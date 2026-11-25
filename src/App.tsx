import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AboutModal } from './components/AboutModal';
import {
  GeneratorControls,
  type DuplexFlip,
  type MoveMode,
  type PaperSize,
  type PrintMode,
} from './components/GeneratorControls';
import { PrintSheet, buildCardQrUrl } from './components/PrintSheet';
import { RushHourCard } from './components/RushHourCard';
import { SingleCardMode } from './components/SingleCardMode';
import { SolutionCardBack } from './components/SolutionCardBack';
import { SolutionModal } from './components/SolutionModal';
import { DIFFICULTY_META, getDifficultyTier } from './engine/catalog';
import { decodeBoard, encodeBoard } from './engine/codec';
import { canonicalBoardKey } from './engine/generator';
import { solveBoard } from './engine/solver';
import type { PuzzleCard } from './engine/types';
import type { WorkerRequest, WorkerResponse } from './worker/generator.worker';

type AppMode = 'single' | 'bulk';

// Hardcoded production base URL encoded into QR codes and share links.
const QR_BASE_URL = 'https://carjam.asherwesterveld.com';
const PRINT_PREFS_STORAGE_KEY = 'carjam_print_prefs_v1';

interface StoredPrintPrefs {
  printMode?: PrintMode;
  duplexFlip?: DuplexFlip;
  duplexOffsetYmm?: number;
  paperSize?: PaperSize;
  count?: number;
  showLetters?: boolean;
  showQrCodes?: boolean;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function loadStoredPrintPrefs(): StoredPrintPrefs {
  try {
    const raw = window.localStorage.getItem(PRINT_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredPrintPrefs;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildPrintUrl(opts: {
  moveMode: MoveMode;
  exactMoves: number;
  minMoves: number;
  maxMoves: number;
  count: number;
  showLetters: boolean;
  showQrCodes: boolean;
}): string {
  const params = new URLSearchParams();
  if (opts.moveMode === 'exact') {
    params.set('exact', String(opts.exactMoves));
  } else {
    params.set('min', String(opts.minMoves));
    params.set('max', String(opts.maxMoves));
  }
  params.set('count', String(opts.count));
  if (opts.showLetters) params.set('letters', '1');
  if (!opts.showQrCodes) params.set('qr', '0');
  return `/print?${params.toString()}`;
}

function readInitialPrintParams() {
  const path = window.location.pathname.replace(/\/+$/, '');
  const isPrintPath = path.endsWith('/print');
  const params = new URLSearchParams(window.location.search);
  const stored = loadStoredPrintPrefs();

  const exactParam = isPrintPath ? params.get('exact') : null;
  const minParam = isPrintPath ? params.get('min') : null;
  const maxParam = isPrintPath ? params.get('max') : null;
  const countParam = isPrintPath ? params.get('count') : null;
  const lettersParam = isPrintPath ? params.get('letters') : null;
  const qrParam = isPrintPath ? params.get('qr') : null;

  let moveMode: MoveMode = 'range';
  let exactMoves = 14;
  let minMoves = 11;
  let maxMoves = 18;

  if (exactParam !== null && !Number.isNaN(Number(exactParam))) {
    moveMode = 'exact';
    exactMoves = clampInt(Number(exactParam), 1, 51);
  } else if (minParam !== null || maxParam !== null) {
    moveMode = 'range';
    const parsedMin =
      minParam !== null && !Number.isNaN(Number(minParam))
        ? clampInt(Number(minParam), 1, 51)
        : 11;
    const parsedMax =
      maxParam !== null && !Number.isNaN(Number(maxParam))
        ? clampInt(Number(maxParam), 1, 51)
        : 18;
    minMoves = Math.min(parsedMin, parsedMax);
    maxMoves = Math.max(parsedMin, parsedMax);
  }

  const count =
    countParam !== null && !Number.isNaN(Number(countParam))
      ? clampInt(Number(countParam), 1, 90)
      : typeof stored.count === 'number'
        ? clampInt(stored.count, 1, 90)
        : 9;

  const showLetters =
    lettersParam !== null
      ? lettersParam === '1' || lettersParam === 'true'
      : Boolean(stored.showLetters);

  const showQrCodes =
    qrParam !== null
      ? qrParam !== '0' && qrParam !== 'false'
      : stored.showQrCodes ?? true;

  const printMode: PrintMode =
    stored.printMode === 'fronts' ||
    stored.printMode === 'duplex' ||
    stored.printMode === 'answer-key'
      ? stored.printMode
      : 'duplex';

  const duplexFlip: DuplexFlip =
    stored.duplexFlip === 'short-edge' || stored.duplexFlip === 'long-edge'
      ? stored.duplexFlip
      : 'long-edge';

  const duplexOffsetYmm =
    typeof stored.duplexOffsetYmm === 'number' &&
    !Number.isNaN(stored.duplexOffsetYmm)
      ? Math.max(-10, Math.min(10, stored.duplexOffsetYmm))
      : 0;

  const paperSize: PaperSize =
    stored.paperSize === 'a4' || stored.paperSize === 'letter'
      ? stored.paperSize
      : 'letter';

  return {
    moveMode,
    exactMoves,
    minMoves,
    maxMoves,
    count,
    showLetters,
    showQrCodes,
    printMode,
    duplexFlip,
    duplexOffsetYmm,
    paperSize,
  };
}

function loadInitialCardFromUrl(): PuzzleCard | null {
  const codeParam = new URLSearchParams(window.location.search).get('code');
  if (!codeParam) return null;
  const board = decodeBoard(codeParam);
  if (!board) return null;
  const sol = solveBoard(board);
  if (!sol.solvable) return null;
  const code = encodeBoard(board);
  return {
    id: `${code}-url`,
    cardNumber: 1,
    code,
    board,
    moves: sol.moves,
    moveCount: sol.moveCount,
    difficulty: getDifficultyTier(sol.moveCount),
  };
}

function getInitialModeFromPath(): AppMode {
  if (new URLSearchParams(window.location.search).get('code')) {
    return 'single';
  }
  const path = window.location.pathname.replace(/\/+$/, '');
  return path.endsWith('/print') ? 'bulk' : 'single';
}

export const App: React.FC = () => {
  const [initialUrlCard] = useState<PuzzleCard | null>(loadInitialCardFromUrl);
  const [initialPrint] = useState(readInitialPrintParams);
  const [appMode, setAppMode] = useState<AppMode>(getInitialModeFromPath);

  // Shared generator settings (matched to URL card, /print params, or default Intermediate 11–18)
  const [moveMode, setMoveMode] = useState<MoveMode>(() =>
    initialUrlCard ? 'range' : initialPrint.moveMode
  );
  const [exactMoves, setExactMoves] = useState(
    () => initialUrlCard?.moveCount ?? initialPrint.exactMoves
  );
  const [minMoves, setMinMoves] = useState(() => {
    if (!initialUrlCard) return initialPrint.minMoves;
    const meta = DIFFICULTY_META[initialUrlCard.difficulty];
    return Math.min(meta.minMoves, initialUrlCard.moveCount);
  });
  const [maxMoves, setMaxMoves] = useState(() => {
    if (!initialUrlCard) return initialPrint.maxMoves;
    const meta = DIFFICULTY_META[initialUrlCard.difficulty];
    return Math.max(meta.maxMoves, initialUrlCard.moveCount);
  });
  const [count, setCount] = useState(() => initialPrint.count);
  const [showLetters, setShowLetters] = useState(() => initialPrint.showLetters);

  // Single-card companion state
  const [singleCard, setSingleCard] = useState<PuzzleCard | null>(initialUrlCard);
  const singleSeenKeysRef = useRef<Set<string>>(new Set());
  // Incremented ONLY when the user manually edits move controls in Single Card mode
  const [autoGenTick, setAutoGenTick] = useState(0);

  // Bulk deck state
  const [cards, setCards] = useState<PuzzleCard[]>([]);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [selectedCard, setSelectedCard] = useState<PuzzleCard | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Print studio settings (printer calibration persisted in localStorage)
  const [printMode, setPrintMode] = useState<PrintMode>(() => initialPrint.printMode);
  const [duplexFlip, setDuplexFlip] = useState<DuplexFlip>(() => initialPrint.duplexFlip);
  const [duplexOffsetYmm, setDuplexOffsetYmm] = useState(() => initialPrint.duplexOffsetYmm);
  const [paperSize, setPaperSize] = useState<PaperSize>(() => initialPrint.paperSize);
  const [showQrCodes, setShowQrCodes] = useState(() => initialPrint.showQrCodes);

  // Persist printer & print-card preferences to localStorage
  useEffect(() => {
    try {
      const prefs: StoredPrintPrefs = {
        printMode,
        duplexFlip,
        duplexOffsetYmm,
        paperSize,
        count,
        showLetters,
        showQrCodes,
      };
      window.localStorage.setItem(PRINT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors (e.g. private browsing)
    }
  }, [
    printMode,
    duplexFlip,
    duplexOffsetYmm,
    paperSize,
    count,
    showLetters,
    showQrCodes,
  ]);

  const switchAppMode = useCallback(
    (nextMode: AppMode) => {
      setAppMode(nextMode);
      const targetUrl =
        nextMode === 'bulk'
          ? buildPrintUrl({
              moveMode,
              exactMoves,
              minMoves,
              maxMoves,
              count,
              showLetters,
              showQrCodes,
            })
          : singleCard
            ? `/?code=${encodeURIComponent(singleCard.code)}`
            : '/';
      if (window.location.pathname + window.location.search !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    },
    [
      count,
      exactMoves,
      maxMoves,
      minMoves,
      moveMode,
      showLetters,
      showQrCodes,
      singleCard,
    ]
  );

  // Keep the browser URL synced with the active puzzle code (/) or print deck settings (/print)
  useEffect(() => {
    if (appMode === 'single') {
      if (!singleCard) return;
      const targetUrl = `/?code=${encodeURIComponent(singleCard.code)}`;
      if (window.location.pathname + window.location.search !== targetUrl) {
        window.history.replaceState(null, '', targetUrl);
      }
    } else {
      const targetUrl = buildPrintUrl({
        moveMode,
        exactMoves,
        minMoves,
        maxMoves,
        count,
        showLetters,
        showQrCodes,
      });
      if (window.location.pathname + window.location.search !== targetUrl) {
        window.history.replaceState(null, '', targetUrl);
      }
    }
  }, [
    appMode,
    singleCard,
    moveMode,
    exactMoves,
    minMoves,
    maxMoves,
    count,
    showLetters,
    showQrCodes,
  ]);

  // Worker state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const requestTargetRef = useRef<AppMode>('single');

  const syncControlsToCard = useCallback((card: PuzzleCard) => {
    const tierMeta = DIFFICULTY_META[card.difficulty];
    const nextMin = Math.min(tierMeta.minMoves, card.moveCount);
    const nextMax = Math.max(tierMeta.maxMoves, card.moveCount);
    setMoveMode('range');
    setExactMoves(card.moveCount);
    setMinMoves(nextMin);
    setMaxMoves(nextMax);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const nextMode = getInitialModeFromPath();
      setAppMode(nextMode);
      if (nextMode === 'single') {
        const cardFromUrl = loadInitialCardFromUrl();
        if (cardFromUrl) {
          setSingleCard(cardFromUrl);
          syncControlsToCard(cardFromUrl);
        }
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [syncControlsToCard]);

  const handleSingleSetMoveMode = useCallback((m: MoveMode) => {
    setMoveMode(m);
    setAutoGenTick((t) => t + 1);
  }, []);

  const handleSingleSetExactMoves = useCallback((n: number) => {
    setExactMoves(n);
    setAutoGenTick((t) => t + 1);
  }, []);

  const handleSingleSetMinMoves = useCallback((n: number) => {
    setMinMoves(n);
    setAutoGenTick((t) => t + 1);
  }, []);

  const handleSingleSetMaxMoves = useCallback((n: number) => {
    setMaxMoves(n);
    setAutoGenTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const worker = new Worker(
      new URL('./worker/generator.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.requestId !== requestIdRef.current) return;

      if (msg.type === 'progress') {
        if (requestTargetRef.current === 'single') {
          singleSeenKeysRef.current.add(canonicalBoardKey(msg.card.board));
          setSingleCard(msg.card);
        } else {
          setCards((prev) => [...prev, msg.card]);
        }
        setProgress({ completed: msg.completed, total: msg.total });
      } else if (msg.type === 'done') {
        setIsGenerating(false);
        if (msg.failedCount > 0 && !msg.cancelled) {
          setStatusNotice(
            `Generated ${msg.completed} of ${msg.total} cards. Try widening the move range for rare high move counts.`
          );
        } else {
          setStatusNotice(null);
        }
      }
    };

    workerRef.current = worker;

    // Only auto-generate a starter card if not opened via a QR/share link (?code=...)
    if (!initialUrlCard) {
      const reqId = ++requestIdRef.current;
      requestTargetRef.current = 'single';
      setIsGenerating(true);
      setProgress({ completed: 0, total: 1 });
      worker.postMessage({
        type: 'generate',
        requestId: reqId,
        count: 1,
        minMoves: 11,
        maxMoves: 18,
        pruneRedundant: true,
        startCardNumber: 1,
        existingKeys: [],
      } satisfies WorkerRequest);
    }

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [initialUrlCard]);

  const generateSingleCard = useCallback(() => {
    if (!workerRef.current) return;
    const reqId = ++requestIdRef.current;
    requestTargetRef.current = 'single';

    const targetMin = moveMode === 'exact' ? exactMoves : minMoves;
    const targetMax = moveMode === 'exact' ? exactMoves : maxMoves;

    setStatusNotice(null);
    setIsGenerating(true);
    setProgress({ completed: 0, total: 1 });

    // Keep recent 40 keys to avoid immediate repeats
    const recentKeys = Array.from(singleSeenKeysRef.current).slice(-40);

    workerRef.current.postMessage({
      type: 'generate',
      requestId: reqId,
      count: 1,
      minMoves: targetMin,
      maxMoves: targetMax,
      pruneRedundant: true,
      startCardNumber: 1,
      existingKeys: recentKeys,
    } satisfies WorkerRequest);
  }, [exactMoves, maxMoves, minMoves, moveMode]);

  // Auto-generate a new single card ONLY when the user edits move controls
  useEffect(() => {
    if (autoGenTick === 0 || appMode !== 'single') return;

    const timer = window.setTimeout(() => {
      generateSingleCard();
    }, 300);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenTick]);

  const startBulkGeneration = useCallback(
    (append: boolean) => {
      if (!workerRef.current) return;

      const reqId = ++requestIdRef.current;
      requestTargetRef.current = 'bulk';
      const targetMin = moveMode === 'exact' ? exactMoves : minMoves;
      const targetMax = moveMode === 'exact' ? exactMoves : maxMoves;
      const baseCards = append ? cards : [];

      if (!append) {
        setCards([]);
      }

      setStatusNotice(null);
      setIsGenerating(true);
      setProgress({ completed: 0, total: count });

      const existingKeys = baseCards.map((c) => canonicalBoardKey(c.board));
      const nextCardNum = append ? baseCards.length + 1 : 1;

      workerRef.current.postMessage({
        type: 'generate',
        requestId: reqId,
        count,
        minMoves: targetMin,
        maxMoves: targetMax,
        pruneRedundant: true,
        startCardNumber: nextCardNum,
        existingKeys,
      } satisfies WorkerRequest);
    },
    [
      cards,
      count,
      exactMoves,
      maxMoves,
      minMoves,
      moveMode,
    ]
  );

  const cancelGeneration = () => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      type: 'cancel',
      requestId: requestIdRef.current,
    } satisfies WorkerRequest);
    setIsGenerating(false);
  };

  const handleLookupCode = (rawInput: string): string | null => {
    // Support both raw puzzle codes (RH-...) and scanned deep-link URLs (?code=RH-...)
    let extracted = rawInput.trim();
    if (extracted.includes('://') || extracted.includes('code=')) {
      try {
        const parsed = new URL(
          extracted.startsWith('http') ? extracted : `https://example.com/${extracted}`
        );
        const param = parsed.searchParams.get('code');
        if (param) extracted = param;
      } catch {
        const match = extracted.match(/code=([^&\s]+)/i);
        if (match) extracted = decodeURIComponent(match[1]);
      }
    }

    const board = decodeBoard(extracted);
    if (!board) {
      return 'Invalid puzzle code or QR link. Check and try again.';
    }
    const sol = solveBoard(board);
    if (!sol.solvable) {
      return 'Decoded board is not solvable.';
    }
    const code = encodeBoard(board);
    const card: PuzzleCard = {
      id: `${code}-lookup-${Date.now()}`,
      cardNumber: 1,
      code,
      board,
      moves: sol.moves,
      moveCount: sol.moveCount,
      difficulty: getDifficultyTier(sol.moveCount),
    };
    if (appMode === 'single') {
      // Cancel any in-flight generation so it cannot overwrite the loaded puzzle
      if (workerRef.current && isGenerating) {
        workerRef.current.postMessage({
          type: 'cancel',
          requestId: requestIdRef.current,
        } satisfies WorkerRequest);
      }
      requestIdRef.current += 1;
      setIsGenerating(false);
      setSingleCard(card);
      syncControlsToCard(card);
    } else {
      setCards((prev) => [card, ...prev]);
      setSelectedCard(card);
    }
    return null;
  };

  const displayCards = useMemo(() => {
    return [...cards].sort((a, b) => a.moveCount - b.moveCount);
  }, [cards]);

  const handlePrint = () => {
    window.print();
  };

  const pageCount = Math.ceil(displayCards.length / 9);
  const totalPrintedPages =
    printMode === 'fronts' ? pageCount : pageCount * 2;

  return (
    <div className={`app-root mode-${appMode}`}>
      {/* Top Mode Switcher Bar */}
      <header className="top-nav no-print">
        <div className="top-nav-brand">
          <img src="/logo.svg" alt="Car Jam logo" className="brand-logo sm" />
          <span className="top-nav-title">Car Jam</span>
        </div>

        <div className="top-nav-right">
          <nav className="mode-tabs" aria-label="App Mode">
            <button
              type="button"
              className={appMode === 'single' ? 'active' : ''}
              onClick={() => switchAppMode('single')}
            >
              Single Card &amp; Play
            </button>
            <button
              type="button"
              className={appMode === 'bulk' ? 'active' : ''}
              onClick={() => switchAppMode('bulk')}
            >
              Bulk &amp; Print
            </button>
          </nav>
          <button
            type="button"
            className="about-icon-btn"
            onClick={() => setShowAbout(true)}
            title="About & Credits"
            aria-label="About and credits"
          >
            ?
          </button>
        </div>
      </header>

      {appMode === 'single' ? (
        <SingleCardMode
          card={singleCard}
          shareUrl={
            singleCard
              ? buildCardQrUrl(QR_BASE_URL, singleCard.code) ??
                `${window.location.origin}/?code=${encodeURIComponent(singleCard.code)}`
              : ''
          }
          moveMode={moveMode}
          setMoveMode={handleSingleSetMoveMode}
          exactMoves={exactMoves}
          setExactMoves={handleSingleSetExactMoves}
          minMoves={minMoves}
          setMinMoves={handleSingleSetMinMoves}
          maxMoves={maxMoves}
          setMaxMoves={handleSingleSetMaxMoves}
          isGenerating={isGenerating}
          onGenerateOne={generateSingleCard}
          onCancel={cancelGeneration}
          onOpenSolution={(c) => setSelectedCard(c)}
          onLookupCode={handleLookupCode}
        />
      ) : (
        <div className="app-shell">
          <GeneratorControls
            moveMode={moveMode}
            setMoveMode={setMoveMode}
            exactMoves={exactMoves}
            setExactMoves={setExactMoves}
            minMoves={minMoves}
            setMinMoves={setMinMoves}
            maxMoves={maxMoves}
            setMaxMoves={setMaxMoves}
            count={count}
            setCount={setCount}
            showLetters={showLetters}
            setShowLetters={setShowLetters}
            showQrCodes={showQrCodes}
            setShowQrCodes={setShowQrCodes}
            isGenerating={isGenerating}
            progress={progress}
            onGenerate={() => startBulkGeneration(false)}
            onAppend={() => startBulkGeneration(true)}
            onCancel={cancelGeneration}
            onLookupCode={handleLookupCode}
          />

          <main className="deck-stage no-print">
            <header className="stage-toolbar">
              <div className="toolbar-left">
                <h2>
                  Deck Preview{' '}
                  <span className="deck-count-pill">
                    {displayCards.length} card
                    {displayCards.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <div className="segmented compact">
                  <button
                    type="button"
                    className={previewSide === 'front' ? 'active' : ''}
                    onClick={() => setPreviewSide('front')}
                  >
                    Fronts
                  </button>
                  <button
                    type="button"
                    className={previewSide === 'back' ? 'active' : ''}
                    onClick={() => setPreviewSide('back')}
                  >
                    Solution Backs
                  </button>
                </div>
              </div>

              <div className="toolbar-print">
                <select
                  value={printMode}
                  onChange={(e) => setPrintMode(e.target.value as PrintMode)}
                  aria-label="Print mode"
                >
                  <option value="duplex">Duplex (Front + Mirrored Back)</option>
                  <option value="fronts">Fronts Only</option>
                  <option value="answer-key">
                    Fronts + Separate Answer Key
                  </option>
                </select>

                {printMode === 'duplex' && (
                  <>
                    <select
                      value={duplexFlip}
                      onChange={(e) =>
                        setDuplexFlip(e.target.value as DuplexFlip)
                      }
                      aria-label="Duplex flip edge"
                    >
                      <option value="long-edge">Flip Long Edge</option>
                      <option value="short-edge">Flip Short Edge</option>
                    </select>
                    <label
                      className="duplex-offset-field"
                      title="Nudge back page up (-) or down (+) in mm to match your printer's duplex alignment"
                    >
                      <span>Back Y</span>
                      <input
                        type="number"
                        step={0.5}
                        min={-10}
                        max={10}
                        value={duplexOffsetYmm}
                        onChange={(e) =>
                          setDuplexOffsetYmm(Number(e.target.value) || 0)
                        }
                      />
                      <span>mm</span>
                    </label>
                  </>
                )}

                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  aria-label="Paper size"
                >
                  <option value="letter">US Letter</option>
                  <option value="a4">A4</option>
                </select>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePrint}
                  disabled={displayCards.length === 0 || isGenerating}
                >
                  🖨 Print ({totalPrintedPages} pg)
                </button>
              </div>
            </header>

            <div className="print-tip-bar">
              <span>
                Exact ThinkFun card scale: <strong>56 × 87 mm</strong> (9 cards
                per sheet). Set Scale to <strong>100%</strong> &amp; enable{' '}
                <strong>Background Graphics</strong>.
              </span>
              {displayCards.length > 0 && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setCards([])}
                  disabled={isGenerating}
                >
                  Clear Deck
                </button>
              )}
            </div>

            {statusNotice && (
              <div className="notice-banner">{statusNotice}</div>
            )}

            {displayCards.length === 0 && !isGenerating ? (
              <div className="empty-state">
                <h3>No cards in deck yet</h3>
                <p>
                  Choose an exact move count or difficulty range on the left and
                  click <strong>Generate New Deck</strong>.
                </p>
              </div>
            ) : (
              <div className="cards-grid">
                {displayCards.map((card) => (
                  <div key={card.id} className="card-cell">
                    {previewSide === 'front' ? (
                      <RushHourCard
                        card={card}
                        showLetters={showLetters}
                        qrUrl={
                          showQrCodes
                            ? buildCardQrUrl(QR_BASE_URL, card.code)
                            : undefined
                        }
                        onClick={() => setSelectedCard(card)}
                      />
                    ) : (
                      <SolutionCardBack
                        card={card}
                        onClick={() => setSelectedCard(card)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {selectedCard && (
        <SolutionModal
          card={selectedCard}
          showLetters={appMode === 'single' ? false : showLetters}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {/* Hidden on screen; exact 56x87mm 3x3 sheets when printing */}
      <PrintSheet
        cards={appMode === 'bulk' ? displayCards : singleCard ? [singleCard] : []}
        showLetters={showLetters}
        qrBaseUrl={showQrCodes ? QR_BASE_URL : undefined}
        printMode={printMode}
        duplexFlip={duplexFlip}
        duplexOffsetYmm={duplexOffsetYmm}
        paperSize={paperSize}
      />
    </div>
  );
};

export default App;
