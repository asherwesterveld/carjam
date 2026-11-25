import React, { useEffect } from 'react';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop no-print" onClick={onClose}>
      <div
        className="modal-dialog modal-compact"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="About Car Jam"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>About Car Jam</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close about dialog"
          >
            ✕
          </button>
        </div>

        <div className="about-body">
          <p>
            <strong>Car Jam</strong> is a free, live 6×6 sliding traffic puzzle
            player and exact-scale (56 × 87 mm) printable challenge card
            generator. Every board is solved and verified in your browser for
            exact optimal slide counts (1–51 moves) within standard 16-vehicle
            physical board limits.
          </p>

          <h3>Credits &amp; Attribution</h3>
          <ul className="about-list">
            <li>
              <strong>Nob Yoshigahara</strong> — inventor of the original
              sliding-block traffic puzzle.
            </li>
            <li>
              <strong>Michael Fogleman</strong> — for his exhaustive 6×6
              sliding-block analysis and discovery of the 51-move hardest
              configuration, used as a live mutation seed for Grand Master
              puzzles.
            </li>
            <li>
              Built with open-source libraries: React, Vite, TypeScript,
              qrcode, and jsQR.
            </li>
          </ul>

          <p className="about-disclaimer">
            Unofficial companion and puzzle generator compatible with standard
            6×6 physical traffic puzzle boards (such as ThinkFun&apos;s Rush
            Hour®). Not affiliated with, sponsored by, or endorsed by ThinkFun
            or Ravensburger.
          </p>
        </div>
      </div>
    </div>
  );
};
