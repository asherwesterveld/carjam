import React from 'react';
import type { PuzzleCard } from '../engine/types';
import type { DuplexFlip, PaperSize, PrintMode } from './GeneratorControls';
import { RushHourCard } from './RushHourCard';
import { SolutionCardBack } from './SolutionCardBack';

interface PrintSheetProps {
  cards: PuzzleCard[];
  showLetters: boolean;
  qrBaseUrl?: string;
  printMode: PrintMode;
  duplexFlip: DuplexFlip;
  duplexOffsetYmm?: number;
  paperSize: PaperSize;
}

export function buildCardQrUrl(baseUrl: string | undefined, code: string): string | undefined {
  const trimmed = baseUrl?.trim().replace(/\/+$/, '');
  if (!trimmed) return undefined;
  return `${trimmed}/?code=${encodeURIComponent(code)}`;
}

const CARDS_PER_SHEET = 9; // 3x3 exact 56x87 mm grid (168x261 mm)

function chunk<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    pages.push(arr.slice(i, i + size));
  }
  return pages;
}

/**
 * Pads a 3x3 page to 9 slots and mirrors it for accurate double-sided alignment.
 * - long-edge (standard portrait book flip): mirrors columns [c2, c1, c0] in each row
 * - short-edge (top-edge flip): mirrors rows [r2, r1, r0]
 */
function buildDuplexBackSlots(
  frontCards: PuzzleCard[],
  flip: DuplexFlip
): (PuzzleCard | null)[] {
  const padded: (PuzzleCard | null)[] = Array.from(
    { length: CARDS_PER_SHEET },
    (_, i) => frontCards[i] ?? null
  );

  const out: (PuzzleCard | null)[] = new Array(CARDS_PER_SHEET).fill(null);

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const srcIdx = r * 3 + c;
      const dstR = flip === 'short-edge' ? 2 - r : r;
      const dstC = flip === 'long-edge' ? 2 - c : c;
      out[dstR * 3 + dstC] = padded[srcIdx];
    }
  }

  return out;
}

export const PrintSheet: React.FC<PrintSheetProps> = React.memo(({
  cards,
  showLetters,
  qrBaseUrl,
  printMode,
  duplexFlip,
  duplexOffsetYmm = 0,
  paperSize,
}) => {
  if (cards.length === 0) return null;

  const frontPages = chunk(cards, CARDS_PER_SHEET);
  const backOffsetStyle: React.CSSProperties | undefined =
    duplexOffsetYmm !== 0
      ? {
          transform: `translateY(${duplexOffsetYmm}mm)`,
        }
      : undefined;

  return (
    <div className={`print-root paper-${paperSize}`}>
      {/* Dynamic @page size rule */}
      <style>{`@media print { @page { size: ${
        paperSize === 'a4' ? 'A4' : 'letter'
      } portrait; margin: 0; } }`}</style>

      {printMode === 'fronts' &&
        frontPages.map((pageCards, pageIdx) => (
          <section key={`front-${pageIdx}`} className="print-page">
            <div
              className="print-grid-3x3"
            >
              {Array.from({ length: CARDS_PER_SHEET }).map((_, slotIdx) => {
                const card = pageCards[slotIdx];
                return (
                  <div key={slotIdx} className="print-slot">
                    {card ? (
                      <RushHourCard
                        card={card}
                        showLetters={showLetters}
                        qrUrl={buildCardQrUrl(qrBaseUrl, card.code)}
                        printMode
                      />
                    ) : (
                      <div className="print-slot-empty" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

      {printMode === 'duplex' &&
        frontPages.map((pageCards, pageIdx) => {
          const backSlots = buildDuplexBackSlots(pageCards, duplexFlip);
          return (
            <React.Fragment key={`duplex-${pageIdx}`}>
              {/* Front sheet */}
              <section className="print-page">
                <div
                  className="print-grid-3x3"
                >
                  {Array.from({ length: CARDS_PER_SHEET }).map((_, slotIdx) => {
                    const card = pageCards[slotIdx];
                    return (
                      <div key={slotIdx} className="print-slot">
                        {card ? (
                          <RushHourCard
                            card={card}
                            showLetters={showLetters}
                            qrUrl={buildCardQrUrl(qrBaseUrl, card.code)}
                            printMode
                          />
                        ) : (
                          <div className="print-slot-empty" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Mirrored solution back sheet */}
              <section className="print-page">
                <div
                  className="print-grid-3x3"
                  style={backOffsetStyle}
                >
                  {backSlots.map((card, slotIdx) => (
                    <div key={slotIdx} className="print-slot">
                      {card ? (
                        <SolutionCardBack card={card} printMode />
                      ) : (
                        <div className="print-slot-empty" />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </React.Fragment>
          );
        })}

      {printMode === 'answer-key' && (
        <>
          {frontPages.map((pageCards, pageIdx) => (
            <section key={`ak-front-${pageIdx}`} className="print-page">
              <div
                className="print-grid-3x3"
              >
                {Array.from({ length: CARDS_PER_SHEET }).map((_, slotIdx) => {
                  const card = pageCards[slotIdx];
                  return (
                    <div key={slotIdx} className="print-slot">
                      {card ? (
                        <RushHourCard
                          card={card}
                          showLetters={showLetters}
                          qrUrl={buildCardQrUrl(qrBaseUrl, card.code)}
                          printMode
                        />
                      ) : (
                        <div className="print-slot-empty" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {frontPages.map((pageCards, pageIdx) => (
            <section key={`ak-back-${pageIdx}`} className="print-page">
              <div
                className="print-grid-3x3"
              >
                {Array.from({ length: CARDS_PER_SHEET }).map((_, slotIdx) => {
                  const card = pageCards[slotIdx];
                  return (
                    <div key={slotIdx} className="print-slot">
                      {card ? (
                        <SolutionCardBack card={card} printMode />
                      ) : (
                        <div className="print-slot-empty" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
});
