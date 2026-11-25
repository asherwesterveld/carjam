import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface QrScannerModalProps {
  onDecoded: (rawText: string) => string | null;
  onClose: () => void;
}

/**
 * Offline QR scanner supporting both live camera video (HTTPS / localhost)
 * and native camera photo capture fallback (works even over plain HTTP LAN/Tailscale).
 */
export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  onDecoded,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraState, setCameraState] = useState<
    'starting' | 'active' | 'unavailable'
  >('starting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDecodedText = (text: string) => {
    const err = onDecoded(text);
    if (err) {
      setErrorMsg(err);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let active = true;
    let lastScan = 0;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unavailable');
        setErrorMsg(
          'Live camera requires HTTPS or localhost. Use "Take / Upload QR Photo" below instead.'
        );
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setCameraState('active');
          setErrorMsg(null);

          const tick = (now: number) => {
            if (!active) return;
            if (now - lastScan > 160 && video.readyState === video.HAVE_ENOUGH_DATA) {
              lastScan = now;
              const canvas = canvasRef.current;
              if (canvas) {
                const w = video.videoWidth;
                const h = video.videoHeight;
                if (w > 0 && h > 0) {
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext('2d', {
                    willReadFrequently: true,
                  });
                  if (ctx) {
                    ctx.drawImage(video, 0, 0, w, h);
                    const imgData = ctx.getImageData(0, 0, w, h);
                    const result = jsQR(imgData.data, w, h, {
                      inversionAttempts: 'dontInvert',
                    });
                    if (result?.data) {
                      active = false;
                      stream?.getTracks().forEach((t) => t.stop());
                      handleDecodedText(result.data);
                      return;
                    }
                  }
                }
              }
            }
            rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        }
      } catch {
        if (!active) return;
        setCameraState('unavailable');
        setErrorMsg(
          'Camera access was unavailable or requires HTTPS. Use "Take / Upload QR Photo" below.'
        );
      }
    };

    startCamera();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Scale down very large phone photos for fast decoding
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const result = jsQR(imgData.data, w, h, {
        inversionAttempts: 'attemptBoth',
      });
      if (result?.data) {
        handleDecodedText(result.data);
      } else {
        setErrorMsg('No QR code found in that photo. Try getting closer and sharper.');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setErrorMsg('Could not read that image file.');
    };
    img.src = url;
  };

  return (
    <div className="modal-backdrop no-print" onClick={onClose}>
      <div
        className="modal-dialog modal-compact"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Scan Rush Hour QR code"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>📷 Scan Card QR Code</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close QR scanner"
          >
            ✕
          </button>
        </div>

        <div className="scanner-body">
          <div
            className={`scanner-viewport ${
              cameraState === 'active' ? 'live' : ''
            }`}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className="scanner-video"
            />
            {cameraState === 'active' && <div className="scanner-reticle" />}
            {cameraState === 'starting' && (
              <div className="scanner-status">Starting camera…</div>
            )}
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {errorMsg && <p className="scanner-note">{errorMsg}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoFile}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="btn btn-primary full-width"
            onClick={() => fileInputRef.current?.click()}
          >
            📸 Take / Upload QR Photo
          </button>
        </div>
      </div>
    </div>
  );
};
