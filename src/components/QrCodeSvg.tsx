import React, { useEffect, useState } from 'react';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
}

type QrModule = typeof import('qrcode');

// The qrcode library is lazy-loaded (kept out of the initial JS bundle) and cached.
let qrModule: QrModule | null = null;
let qrModulePromise: Promise<QrModule> | null = null;

export function preloadQrLibrary(): Promise<QrModule> {
  if (!qrModulePromise) {
    qrModulePromise = import('qrcode').then((m) => {
      qrModule = (m as unknown as { default?: QrModule }).default ?? m;
      return qrModule;
    });
  }
  return qrModulePromise;
}

interface QrData {
  count: number;
  path: string;
}

const qrCache = new Map<string, QrData | null>();

function buildQr(lib: QrModule, value: string): QrData | null {
  const cached = qrCache.get(value);
  if (cached !== undefined) return cached;
  let result: QrData | null = null;
  try {
    const data = lib.create(value, { errorCorrectionLevel: 'M' });
    const count = data.modules.size;
    const parts: string[] = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (data.modules.get(r, c)) {
          parts.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }
    result = { count, path: parts.join('') };
  } catch {
    result = null;
  }
  qrCache.set(value, result);
  return result;
}

/**
 * Offline vector SVG QR code (prints razor-sharp at any DPI).
 * Renders a same-size white placeholder until the QR library has loaded.
 */
export const QrCodeSvg: React.FC<QrCodeSvgProps> = React.memo(
  ({ value, size, className }) => {
    const [lib, setLib] = useState<QrModule | null>(qrModule);

    useEffect(() => {
      if (lib) return;
      let alive = true;
      preloadQrLibrary().then((m) => {
        if (alive) setLib(m);
      });
      return () => {
        alive = false;
      };
    }, [lib]);

    const qr = lib ? buildQr(lib, value) : null;
    if (lib && !qr) return null;

    const quiet = 2;
    const count = qr?.count ?? 25;
    const viewSize = count + quiet * 2;

    return (
      <svg
        viewBox={`${-quiet} ${-quiet} ${viewSize} ${viewSize}`}
        width={size}
        height={size}
        className={className}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`QR code for ${value}`}
      >
        <rect
          x={-quiet}
          y={-quiet}
          width={viewSize}
          height={viewSize}
          fill="#FFFFFF"
        />
        {qr && <path d={qr.path} fill="#0F172A" />}
      </svg>
    );
  }
);
