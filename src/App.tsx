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
import { getDifficultyTier } from './engine/catalog';
import { decodeBoard, encodeBoard } from './engine/codec';
import { canonicalBoardKey } from './engine/generator';
import { solveBoard } from './engine/solver';
import type { PuzzleCard } from './engine/types';
import type { WorkerRequest, WorkerResponse } from './worker/generator.worker';

type AppMode = 'single' | 'bulk';

// Default base URL encoded into printed card QR codes.
const DEFAULT_QR_BASE_URL = 'https://carjam.asherwesterveld.com';
const QR_URL_STORAGE_KEY = 'carjam_qr_base_url';

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

export const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('single');

  // Shared generator settings
  const [moveMode, setMoveMode] = useState<MoveMode>('range');
  const [exactMoves, setExactMoves] = useState(14);
  const [minMoves, setMinMoves] = useState(8);
  const [maxMoves, setMaxMoves] = useState(18);
  const [count, setCount] = useState(9);
  const [pruneRedundant, setPruneRedundant] = useState(true);
  const [sortByMoves, setSortByMoves] = useState(true);
  const [showLetters, setShowLetters] = useState(false);

  // Single-card companion state
  const [singleCard, setSingleCard] = useState<PuzzleCard | null>(null);
  const singleSeenKeysRef = useRef<Set<string>>(new Set());

  // Bulk deck state
  const [cards, setCards] = useState<PuzzleCard[]>([]);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [selectedCard, setSelectedCard] = useState<PuzzleCard | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Print studio settings
  const [printMode, setPrintMode] = useState<PrintMode>('duplex');
  const [duplexFlip, setDuplexFlip] = useState<DuplexFlip>('long-edge');
  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const [showCropMarks, setShowCropMarks] = useState(true);
  const [showQrCodes, setShowQrCodes] = useState(true);
  const [qrBaseUrl, setQrBaseUrl] = useState<string>(() => {
    try {
      return window.localStorage.getItem(QR_URL_STORAGE_KEY) || DEFAULT_QR_BASE_URL;
    } catch {
      return DEFAULT_QR_BASE_URL;
    }
  });

  const updateQrBaseUrl = (val: string) => {
    setQrBaseUrl(val);
    try {
      window.localStorage.setItem(QR_URL_STORAGE_KEY, val);
    } catch {
      // ignore storage quota/privacy errors
    }
  };

  // Worker state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const requestTargetRef = useRef<AppMode>('single');

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

    // If opened via a scanned QR code (?code=RH-...), load that exact card immediately
    const urlCard = loadInitialCardFromUrl();
    if (urlCard) {
      setSingleCard(urlCard);
      setAppMode('single');
    } else {
      // Auto-generate 1 starter card for Single Card mode on mount (StrictMode-safe)
      const reqId = ++requestIdRef.current;
      requestTargetRef.current = 'single';
      setIsGenerating(true);
      setProgress({ completed: 0, total: 1 });
      worker.postMessage({
        type: 'generate',
        requestId: reqId,
        count: 1,
        minMoves: 8,
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
  }, []);

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
      pruneRedundant,
      startCardNumber: 1,
      existingKeys: recentKeys,
    } satisfies WorkerRequest);
  }, [exactMoves, maxMoves, minMoves, moveMode, pruneRedundant]);

  // Auto-generate a new single card whenever the user changes move mode, exact moves, or range
  const lastAutoSpecRef = useRef<string>(
    `${moveMode}:${exactMoves}:${minMoves}:${maxMoves}`
  );
  useEffect(() => {
    const spec = `${moveMode}:${exactMoves}:${minMoves}:${maxMoves}`;
    if (spec === lastAutoSpecRef.current) return;
    lastAutoSpecRef.current = spec;
    if (appMode !== 'single') return;

    const timer = window.setTimeout(() => {
      generateSingleCard();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [appMode, moveMode, exactMoves, minMoves, maxMoves, generateSingleCard]);

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
        pruneRedundant,
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
      pruneRedundant,
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
      setSingleCard(card);
    } else {
      setCards((prev) => [card, ...prev]);
      setSelectedCard(card);
    }
    return null;
  };

  const displayCards = useMemo(() => {
    const list = sortByMoves
      ? [...cards].sort((a, b) => a.moveCount - b.moveCount)
      : cards;
    return list;
  }, [cards, sortByMoves]);

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
          <img src="./logo.svg" alt="Car Jam logo" className="brand-logo sm" />
          <span className="top-nav-title">Car Jam</span>
        </div>

        <div className="top-nav-right">
          <nav className="mode-tabs" aria-label="App Mode">
            <button
              type="button"
              className={appMode === 'single' ? 'active' : ''}
              onClick={() => setAppMode('single')}
            >
              Single Card
            </button>
            <button
              type="button"
              className={appMode === 'bulk' ? 'active' : ''}
              onClick={() => setAppMode('bulk')}
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
              ? buildCardQrUrl(qrBaseUrl, singleCard.code) ??
                `${window.location.origin}/?code=${encodeURIComponent(singleCard.code)}`
              : ''
          }
          moveMode={moveMode}
          setMoveMode={setMoveMode}
          exactMoves={exactMoves}
          setExactMoves={setExactMoves}
          minMoves={minMoves}
          setMinMoves={setMinMoves}
          maxMoves={maxMoves}
          setMaxMoves={setMaxMoves}
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
            pruneRedundant={pruneRedundant}
            setPruneRedundant={setPruneRedundant}
            sortByMoves={sortByMoves}
            setSortByMoves={setSortByMoves}
            showLetters={showLetters}
            setShowLetters={setShowLetters}
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
                )}

                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  aria-label="Paper size"
                >
                  <option value="letter">US Letter</option>
                  <option value="a4">A4</option>
                </select>

                <label className="crop-check">
                  <input
                    type="checkbox"
                    checked={showCropMarks}
                    onChange={(e) => setShowCropMarks(e.target.checked)}
                  />
                  <span>Crop marks</span>
                </label>

                <label className="crop-check">
                  <input
                    type="checkbox"
                    checked={showQrCodes}
                    onChange={(e) => setShowQrCodes(e.target.checked)}
                  />
                  <span>QR codes</span>
                </label>

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
              <div className="print-tip-right">
                {showQrCodes && (
                  <label className="qr-url-field">
                    <span>QR URL</span>
                    <input
                      type="url"
                      value={qrBaseUrl}
                      onChange={(e) => updateQrBaseUrl(e.target.value)}
                      placeholder="https://your-domain.com"
                    />
                  </label>
                )}
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
                            ? buildCardQrUrl(qrBaseUrl, card.code)
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
        qrBaseUrl={showQrCodes ? qrBaseUrl : undefined}
        printMode={printMode}
        duplexFlip={duplexFlip}
        paperSize={paperSize}
        showCropMarks={showCropMarks}
      />
    </div>
  );
};

export default App;
