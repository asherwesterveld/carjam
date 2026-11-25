import React, { useEffect, useState } from 'react';
import { DIFFICULTY_META } from '../engine/catalog';
import type { PuzzleCard } from '../engine/types';
import { QrCodeSvg } from './QrCodeSvg';

interface ShareCardModalProps {
  card: PuzzleCard;
  shareUrl: string;
  onClose: () => void;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  card,
  shareUrl,
  onClose,
}) => {
  const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null);
  const diff = DIFFICULTY_META[card.difficulty];
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copyText = async (text: string, field: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Fallback copy via temporary input
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1800);
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: `Car Jam Puzzle (${card.moveCount} Moves)`,
        text: `Try this ${diff.label} Car Jam puzzle (${card.moveCount} moves) — Code: ${card.code}`,
        url: shareUrl,
      });
    } catch {
      // User dismissed native share sheet
    }
  };

  return (
    <div className="modal-backdrop no-print" onClick={onClose}>
      <div
        className="modal-dialog modal-compact"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share Rush Hour Card"
      >
        <div className="modal-header" style={{ borderTopColor: diff.color }}>
          <div className="modal-title-group">
            <span className="tier-pill" style={{ background: diff.color }}>
              {diff.label}
            </span>
            <h2>Share Puzzle ({card.moveCount} Moves)</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close share modal"
          >
            ✕
          </button>
        </div>

        <div className="share-body">
          <div className="share-qr-wrap">
            <QrCodeSvg value={shareUrl} className="share-qr-svg" />
          </div>
          <p className="share-caption">
            Scan with another phone to load this exact board.
          </p>

          <div className="share-code-box">
            <code>{card.code}</code>
          </div>

          <div className="share-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copyText(card.code, 'code')}
            >
              {copiedField === 'code' ? '✓ Code Copied' : 'Copy Code'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copyText(shareUrl, 'link')}
            >
              {copiedField === 'link' ? '✓ Link Copied' : 'Copy Link'}
            </button>
            {canNativeShare && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNativeShare}
              >
                Share…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
